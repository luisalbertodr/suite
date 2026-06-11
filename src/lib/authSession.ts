/** Errores del lock interno de GoTrue (concurrencia al iniciar sesión). */
export function isAuthLockError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? error);
  const details = String((error as { details?: string })?.details ?? '');
  return /Lock|AbortError|steal|not released within|timed out/i.test(`${message} ${details}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let authReadyResolved = false;
let authReadyPromise: Promise<void> | null = null;
let resolveAuthReady: (() => void) | null = null;

export function markAuthReady(): void {
  if (authReadyResolved) return;
  authReadyResolved = true;
  resolveAuthReady?.();
  resolveAuthReady = null;
}

export function waitUntilAuthReady(): Promise<void> {
  if (authReadyResolved) return Promise.resolve();
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      resolveAuthReady = resolve;
    });
  }
  return authReadyPromise;
}

let authOpChain: Promise<unknown> = Promise.resolve();

/** Espera auth estable + margen inicial tras login. Nunca bloquea más de 15s. */
export async function waitForAuthBootstrap(): Promise<void> {
  await Promise.race([
    waitUntilAuthReady(),
    sleep(15_000).then(() => {
      if (!authReadyResolved) {
        console.warn('[auth] waitUntilAuthReady timeout — continuando');
        markAuthReady();
      }
    }),
  ]);
  await sleep(300);
}

/** Encola operaciones Supabase para no competir con GoTrue al iniciar sesión. */
export async function runWhenAuthReady<T>(fn: () => Promise<T>): Promise<T> {
  await waitUntilAuthReady();
  const run = authOpChain.then(fn, fn);
  authOpChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function resetAuthReadyBarrier(): void {
  authReadyResolved = false;
  authReadyPromise = null;
  resolveAuthReady = null;
  authOpChain = Promise.resolve();
}
