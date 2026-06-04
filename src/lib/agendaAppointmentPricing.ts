import type { AppointmentItemDraft } from '@/types/agenda';

function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function isBonoSessionItem(item: AppointmentItemDraft): boolean {
  if (item.bono_id) return true;
  return !!item.customer_voucher_id && item.bonus_payment_mode === 'none' && item.occupies_time;
}

export function appointmentItemLineTotal(item: AppointmentItemDraft): number {
  if (isBonoSessionItem(item)) return 0;
  const qty = Math.max(0, n(item.quantity, 1));
  const unit = Math.max(0, n(item.unit_price, 0));
  if (item.kind === 'bonus') {
    if (item.bonus_payment_mode === '60') return unit * 0.6;
    if (item.bonus_payment_mode === '40') return unit * 0.4;
    if (item.bonus_payment_mode === 'full') return unit;
    return 0;
  }
  return qty * unit;
}

export function appointmentItemsTotal(items: AppointmentItemDraft[]): number {
  return items.reduce((sum, it) => sum + appointmentItemLineTotal(it), 0);
}

export function formatAppointmentItemAmount(item: AppointmentItemDraft): string {
  if (isBonoSessionItem(item)) return 'BONO';
  return `${appointmentItemLineTotal(item).toFixed(2)} €`;
}

/** Precio unitario de catálogo o ítem (null si es 0 o bono). */
export function formatArticleUnitPrice(
  precio: number | null | undefined,
  opts?: { hideZero?: boolean }
): string | null {
  if (precio == null) return null;
  const p = Number(precio);
  if (!Number.isFinite(p) || (opts?.hideZero !== false && p <= 0)) return null;
  return `${p.toFixed(2)} €`;
}

export function formatItemUnitPriceLabel(item: AppointmentItemDraft): string | null {
  if (isBonoSessionItem(item)) return null;
  return formatArticleUnitPrice(item.unit_price);
}
