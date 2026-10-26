import { NextRequest, NextResponse } from 'next/server';
import {
  deleteOrCleanupMediaUpload,
  getMediaUploadForDownload,
} from '@/features/uploads/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { uploadId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const { item, buffer } = await getMediaUploadForDownload(
      user?.id ?? null,
      params.uploadId,
      {
        exp: searchParams.get('exp'),
        sig: searchParams.get('sig'),
      }
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': item.mime_type,
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': `inline; filename="${item.safe_filename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { uploadId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const result = await deleteOrCleanupMediaUpload(user.id, params.uploadId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
