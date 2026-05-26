import { resolveRecursoColor } from '@/lib/agendaRecursoMatch';

const ITEM_KIND_FALLBACK_COLORS: Record<string, string> = {
  service: 'bg-sky-500/75 border-sky-700/50',
  bonus: 'bg-violet-500/75 border-violet-700/50',
  product: 'bg-amber-500/75 border-amber-700/50',
  other: 'bg-slate-500/75 border-slate-700/50',
};

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function segmentStyleFromHex(hex: string | null | undefined): { backgroundColor: string; borderColor: string } | undefined {
  const color = String(hex || '').trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return undefined;
  return {
    backgroundColor: hexToRgba(color, 0.78),
    borderColor: color,
  };
}

export function segmentColorForRecursoTipo(itemKind?: string): string {
  const kind = String(itemKind || 'service').toLowerCase();
  return ITEM_KIND_FALLBACK_COLORS[kind] || ITEM_KIND_FALLBACK_COLORS.other;
}

export function segmentAppearance(
  hex: string | null | undefined,
  itemKind?: string
): { className: string; style?: { backgroundColor: string; borderColor: string } } {
  const style = segmentStyleFromHex(hex);
  if (style) {
    return { className: 'border rounded-sm', style };
  }
  return { className: `border rounded-sm ${segmentColorForRecursoTipo(itemKind)}` };
}

/** z-index por encima del DockBar (z-50). */
export const AGENDA_APPOINTMENT_MODAL_Z = 'z-[80]';
export const AGENDA_APPOINTMENT_OVERLAY_Z = 'z-[90]';

export { resolveRecursoColor };
