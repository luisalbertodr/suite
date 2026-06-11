import { waitUntilAuthReady } from '@/lib/authSession';

/** Ejecuta una mutación de marketing sin encolarla tras otras peticiones (evita falsos timeout). */
export async function withSupabaseTimeout<T>(
  label: string,
  fn: () => Promise<T>,
  ms = 45_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await waitUntilAuthReady();
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label}: la operación tardó demasiado. Comprueba la conexión e inténtalo de nuevo.`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function parseNoteNextActionAt(raw: string): string | null {
  if (!raw.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error('La fecha/hora de próximo contacto no es válida.');
  }
  return d.toISOString();
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
