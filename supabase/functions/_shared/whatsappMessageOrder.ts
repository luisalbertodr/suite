/**
 * Orden intra-segundo para mensajes WhatsApp.
 * El proveedor solo entrega timestamps en segundos; codificamos un
 * desempate en los milisegundos del TIMESTAMPTZ.
 */

export function isoFromUnixSeconds(unixSec: number, seqInSecond = 0): string {
  const sec = Math.floor(Number(unixSec) || 0);
  if (!sec) return new Date().toISOString();
  const ms = Math.min(Math.max(Math.floor(seqInSecond), 0), 999);
  return new Date(sec * 1000 + ms).toISOString();
}

/** Ingesta en vivo: desempate = reloj local dentro del segundo del proveedor. */
export function isoFromUnixSecondsLive(unixSec: number | null | undefined): string {
  const sec = Math.floor(Number(unixSec) || 0);
  if (!sec) return new Date().toISOString();
  return new Date(sec * 1000 + (Date.now() % 1000)).toISOString();
}

/**
 * Asigna ISO con ms únicos por segundo, orden cronológico.
 * `newestFirst`: true si el array del proveedor viene del más reciente al más antiguo.
 */
export function assignBatchOrderedIsos(
  unixSeconds: Array<number | null | undefined>,
  opts?: { newestFirst?: boolean },
): string[] {
  const newestFirst = opts?.newestFirst ?? true;
  const fallbackSec = Math.floor(Date.now() / 1000);
  const indexed = unixSeconds.map((raw, i) => ({
    i,
    sec: Math.floor(Number(raw) || 0) || fallbackSec,
  }));
  indexed.sort((a, b) => {
    if (a.sec !== b.sec) return a.sec - b.sec;
    return newestFirst ? b.i - a.i : a.i - b.i;
  });
  const seqBySec = new Map<number, number>();
  const out = new Array<string>(unixSeconds.length);
  for (const item of indexed) {
    const seq = seqBySec.get(item.sec) ?? 0;
    seqBySec.set(item.sec, seq + 1);
    out[item.i] = isoFromUnixSeconds(item.sec, seq % 1000);
  }
  return out;
}
