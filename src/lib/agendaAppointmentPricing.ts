import type { AppointmentItemDraft } from '@/types/agenda';

function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function appointmentItemLineTotal(item: AppointmentItemDraft): number {
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
