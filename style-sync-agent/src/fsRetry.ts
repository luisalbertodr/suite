export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableFsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as NodeJS.ErrnoException).code;
  if (!code) return false;
  return [
    "EBUSY",
    "EPERM",
    "EACCES",
    "ENOENT",
    "EIO",
    "ENOTCONN",
    "ETIMEDOUT",
    "EAGAIN",
    "EBUSY",
    "ESTALE",
  ].includes(code);
}

export type FsRetryOptions = {
  label?: string;
  maxAttempts?: number;
  baseMs?: number;
  onRetry?: (attempt: number, err: unknown) => void;
};

/**
 * Reintenta operaciones de fichero ante bloqueos CIFS / cabecera DBF bloqueada por VFP.
 */
export async function withFsRetry<T>(
  op: () => T | Promise<T>,
  opts: FsRetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? Number(process.env.FS_RETRY_MAX ?? "6");
  const baseMs = opts.baseMs ?? Number(process.env.FS_RETRY_BASE_MS ?? "100");
  const label = opts.label ?? "fs";

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (!isRetryableFsError(err) || attempt >= maxAttempts) {
        throw err;
      }
      const delay = baseMs * 2 ** (attempt - 1);
      opts.onRetry?.(attempt, err);
      await sleep(delay);
    }
  }
  throw lastErr;
}
