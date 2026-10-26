import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import { MediaUploadItem } from '@/types/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { getVerifiedSessionSecret } from '@/lib/config/env';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_UPLOAD_MIME_TYPES: Record<
  string,
  { extension: string; magicPrefixHex?: string[]; isTextSafe?: boolean }
> = {
  'image/png': {
    extension: 'png',
    magicPrefixHex: ['89504e470d0a1a0a'],
  },
  'image/jpeg': {
    extension: 'jpg',
    magicPrefixHex: ['ffd8ff'],
  },
  'image/webp': {
    extension: 'webp',
    magicPrefixHex: ['52494646'], // RIFF....WEBP
  },
  'image/gif': {
    extension: 'gif',
    magicPrefixHex: ['474946383761', '474946383961'],
  },
  'application/pdf': {
    extension: 'pdf',
    magicPrefixHex: ['25504446'], // %PDF
  },
  'text/plain': {
    extension: 'txt',
    isTextSafe: true,
  },
};

export const uploadMediaSchema = z.object({
  circleId: z.string().uuid().nullable().optional(),
  originalFilename: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(3).max(100),
  visibility: z.enum(['public', 'circle_members', 'private']).default('circle_members'),
  contentBase64: z.string().min(1),
});

function sanitizeFilenameBase(originalFilename: string): string {
  const withoutPath = originalFilename.split(/[\\/]/).pop() ?? 'file';
  const withoutExt = withoutPath.replace(/\.[^.]+$/, '');
  const cleaned = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || 'upload';
}

function verifyFileMagicBytes(mimeType: string, buffer: Buffer): void {
  const spec = ALLOWED_UPLOAD_MIME_TYPES[mimeType];
  if (!spec) {
    throw new ValidationError(
      `Unsupported MIME type "${mimeType}". Allowed types: ${Object.keys(ALLOWED_UPLOAD_MIME_TYPES).join(', ')}`
    );
  }

  // Reject executable or script payloads masquerading as uploads
  const headText = buffer.subarray(0, 256).toString('utf8').toLowerCase();
  if (
    headText.includes('<script') ||
    headText.includes('<!doctype html') ||
    headText.includes('<html') ||
    headText.startsWith('mz') // Windows PE executable header
  ) {
    throw new ValidationError('Executable or active HTML/script uploads are forbidden.');
  }

  if (spec.magicPrefixHex && spec.magicPrefixHex.length > 0) {
    const actualHex = buffer.subarray(0, 12).toString('hex').toLowerCase();
    const matched = spec.magicPrefixHex.some((prefix) => actualHex.startsWith(prefix));
    if (!matched) {
      throw new ValidationError(
        `File header signature does not match declared MIME type "${mimeType}".`
      );
    }
    if (mimeType === 'image/webp') {
      const webpMarker = buffer.subarray(8, 12).toString('ascii');
      if (webpMarker !== 'WEBP') {
        throw new ValidationError('Invalid WebP file header signature.');
      }
    }
  }
}

export function createSignedDownloadUrl(uploadId: string, expiresInSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const sig = crypto
    .createHmac('sha256', getVerifiedSessionSecret())
    .update(`${uploadId}.${exp}`)
    .digest('hex');
  return `/api/uploads/${uploadId}?exp=${exp}&sig=${sig}`;
}

export function verifySignedDownloadToken(
  uploadId: string,
  expParam: string | null,
  sigParam: string | null
): boolean {
  if (!expParam || !sigParam) return false;
  const exp = Number(expParam);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expectedSig = crypto
    .createHmac('sha256', getVerifiedSessionSecret())
    .update(`${uploadId}.${exp}`)
    .digest('hex');
  if (expectedSig.length !== sigParam.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sigParam));
}

export async function createMediaUpload(
  actorUserId: string,
  input: z.input<typeof uploadMediaSchema>
): Promise<MediaUploadItem> {
  const parsed = uploadMediaSchema.parse(input);
  const normalizedMime = parsed.mimeType.toLowerCase();
  const spec = ALLOWED_UPLOAD_MIME_TYPES[normalizedMime];
  if (!spec) {
    throw new ValidationError(
      `Unsupported MIME type "${parsed.mimeType}". Allowed types: ${Object.keys(ALLOWED_UPLOAD_MIME_TYPES).join(', ')}`
    );
  }

  let buffer: Buffer;
  try {
    const cleanBase64 = parsed.contentBase64.replace(/^data:[^;]+;base64,/, '');
    buffer = Buffer.from(cleanBase64, 'base64');
  } catch {
    throw new ValidationError('Invalid base64 file payload.');
  }

  if (buffer.byteLength === 0) {
    throw new ValidationError('Uploaded file cannot be empty.');
  }
  if (buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new ValidationError(
      `File size (${buffer.byteLength} bytes) exceeds maximum limit of ${MAX_UPLOAD_SIZE_BYTES} bytes.`
    );
  }

  verifyFileMagicBytes(normalizedMime, buffer);

  const uploadId = crypto.randomUUID();
  const safeBase = sanitizeFilenameBase(parsed.originalFilename);
  const safeFilename = `${safeBase}-${uploadId.slice(0, 8)}.${spec.extension}`;
  const objectPath = `${parsed.circleId ?? 'profiles'}/${actorUserId}/${uploadId}/${safeFilename}`;
  const sha256Checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  return withRlsTransaction(actorUserId, async (tx) => {
    if (parsed.circleId) {
      const memRes = await tx.query<{ status: string }>(
        `SELECT status FROM public.circle_memberships
         WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
        [parsed.circleId, actorUserId]
      );
      if (memRes.rows[0]?.status !== 'active') {
        throw new ForbiddenError('Only active Circle members can upload media to this Circle.');
      }
    }

    const res = await tx.query<MediaUploadItem>(
      `INSERT INTO public.media_uploads (
         id, circle_id, uploader_id, bucket_name, object_path,
         original_filename, safe_filename, mime_type, size_bytes,
         sha256_checksum, visibility, storage_backend, content_base64, status
       ) VALUES ($1, $2, $3, 'circles-media', $4, $5, $6, $7, $8, $9, $10, 'database_signed', $11, 'active')
       RETURNING id, circle_id, uploader_id, bucket_name, object_path,
                 original_filename, safe_filename, mime_type, size_bytes,
                 sha256_checksum, visibility, storage_backend, status, created_at;`,
      [
        uploadId,
        parsed.circleId ?? null,
        actorUserId,
        objectPath,
        parsed.originalFilename,
        safeFilename,
        normalizedMime,
        buffer.byteLength,
        sha256Checksum,
        parsed.visibility,
        buffer.toString('base64'),
      ]
    );

    const item = res.rows[0];
    return {
      ...item,
      signed_download_url: createSignedDownloadUrl(item.id),
    };
  });
}

export async function getMediaUploadForDownload(
  actorUserId: string | null,
  uploadId: string,
  querySignature?: { exp: string | null; sig: string | null }
): Promise<{
  item: MediaUploadItem;
  buffer: Buffer;
}> {
  const hasValidSignature = querySignature
    ? verifySignedDownloadToken(uploadId, querySignature.exp, querySignature.sig)
    : false;

  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<MediaUploadItem & { content_base64: string | null }>(
      `SELECT * FROM public.media_uploads WHERE id = $1 AND status = 'active' LIMIT 1;`,
      [uploadId]
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundError('Media upload not found or access denied.');
    }

    if (row.visibility === 'private' && row.uploader_id !== actorUserId && !hasValidSignature) {
      throw new ForbiddenError('This file is private.');
    }

    return {
      item: {
        id: row.id,
        circle_id: row.circle_id,
        uploader_id: row.uploader_id,
        bucket_name: row.bucket_name,
        object_path: row.object_path,
        original_filename: row.original_filename,
        safe_filename: row.safe_filename,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        sha256_checksum: row.sha256_checksum,
        visibility: row.visibility,
        storage_backend: row.storage_backend,
        status: row.status,
        created_at: row.created_at,
      },
      buffer: Buffer.from(row.content_base64 ?? '', 'base64'),
    };
  });
}

export async function deleteOrCleanupMediaUpload(
  actorUserId: string,
  uploadId: string
): Promise<{ deleted: boolean }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM public.media_uploads
       WHERE id = $1 AND status = 'active'
       LIMIT 1;`,
      [uploadId]
    );
    if (!existing.rows[0]) {
      throw new NotFoundError('Upload not found or you do not have permission to delete it.');
    }

    await tx.query(
      `UPDATE public.media_uploads
       SET status = 'deleted', content_base64 = NULL
       WHERE id = $1;`,
      [uploadId]
    );
    return { deleted: true };
  });
}
