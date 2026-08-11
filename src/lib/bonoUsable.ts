/**
 * Criterio único de “bono usable” para ficha, cita, Style y tab Artículos.
 * Debe coincidir con lo que el TPV Style puede canjear y lo que se muestra en Vigentes.
 */

export type BonoUsabilityFields = {
  estado?: string | null;
  sessions_total?: number | null;
  sessions_used?: number | null;
  /** Si se informa (p.ej. tras bonoSessionsDisplay), tiene prioridad sobre sessions_* */
  remaining?: number | null;
  fecha_vencimiento?: string | null;
};

export function bonoRemainingSessions(bono: Pick<BonoUsabilityFields, 'sessions_total' | 'sessions_used' | 'remaining'>): number {
  if (bono.remaining != null && Number.isFinite(Number(bono.remaining))) {
    return Math.max(0, Number(bono.remaining));
  }
  return Math.max(0, Number(bono.sessions_total ?? 0) - Number(bono.sessions_used ?? 0));
}

/** Vencido si hay fecha y el día de vencimiento ya pasó (comparación por fecha local). */
export function isBonoExpired(fechaVencimiento?: string | null, now = new Date()): boolean {
  if (!fechaVencimiento) return false;
  const raw = String(fechaVencimiento).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [y, m, d] = raw.split('-').map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return end.getTime() < now.getTime();
}

/**
 * Bono que se puede usar / debe listarse como activo:
 * estado activo, con sesiones restantes y no vencido.
 * Excluye completado, inactivo y cualquier otro estado no operativo.
 */
export function isBonoUsable(bono: BonoUsabilityFields, now = new Date()): boolean {
  const estado = String(bono.estado ?? '').trim().toLowerCase();
  if (estado === 'completado' || estado === 'inactivo') return false;
  if (estado && estado !== 'activo') return false;
  if (bonoRemainingSessions(bono) <= 0) return false;
  if (isBonoExpired(bono.fecha_vencimiento, now)) return false;
  return true;
}

export function bonoEstadoLabel(estado?: string | null): string {
  const value = String(estado ?? '').trim().toLowerCase();
  if (value === 'activo') return 'Activo';
  if (value === 'completado') return 'Completado';
  if (value === 'inactivo') return 'Inactivo';
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—';
}
