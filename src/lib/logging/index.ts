type LogLevel = 'info' | 'warn' | 'error';

const REDACTED_KEYS = new Set([
  'password',
  'encrypted_password',
  'token',
  'token_hash',
  'secret',
  'authorization',
  'cookie',
  'api_key',
]);

function redactMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test' && level === 'info') {
    return;
  }
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: redactMetadata(meta) } : {}),
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.info(JSON.stringify(entry));
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
};
