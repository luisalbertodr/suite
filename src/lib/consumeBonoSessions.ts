import { supabase } from '@/lib/supabase';
import type { AppointmentItemDraft } from '@/types/agenda';

type CoverageRow = {
  coverage_type?: string;
  article_id?: string | null;
  family_code?: string | null;
  covered_quantity?: number;
  used_quantity?: number;
  label?: string;
};

function sessionSignature(item: AppointmentItemDraft): string | null {
  if (!item.bono_id) return null;
  return `${item.bono_id}:${item.bono_coverage_index ?? -1}:${item.clientKey}`;
}

function countSessions(items: AppointmentItemDraft[]): Map<string, AppointmentItemDraft> {
  const m = new Map<string, AppointmentItemDraft>();
  for (const it of items) {
    const sig = sessionSignature(it);
    if (sig) m.set(sig, it);
  }
  return m;
}

async function consumeOneBonoSession(
  item: AppointmentItemDraft,
  opts: { appointmentId: string; appointmentDate: string; employeeId?: string | null },
): Promise<void> {
  if (!item.bono_id) return;

  const { data: bono, error: fetchError } = await supabase
    .from('bonos')
    .select('id, sesiones_totales, sesiones_usadas, estado, coverage_items')
    .eq('id', item.bono_id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!bono) return;

  const sesionesUsadas = Number(bono.sesiones_usadas ?? 0);
  const sesionesTotales = Number(bono.sesiones_totales ?? 0);
  if (sesionesUsadas >= sesionesTotales) {
    throw new Error('El bono no tiene sesiones disponibles');
  }

  const coverage = Array.isArray(bono.coverage_items) ? [...(bono.coverage_items as CoverageRow[])] : [];
  const idx = item.bono_coverage_index;
  if (typeof idx === 'number' && idx >= 0 && idx < coverage.length) {
    const line = { ...coverage[idx] };
    const covered = Number(line.covered_quantity ?? 1);
    const used = Number(line.used_quantity ?? 0);
    if (used >= covered) {
      throw new Error('No quedan unidades de ese servicio en el bono');
    }
    line.used_quantity = used + 1;
    coverage[idx] = line;
  }

  const nextUsed = sesionesUsadas + 1;
  const { error: updateError } = await supabase
    .from('bonos')
    .update({
      sesiones_usadas: nextUsed,
      estado: nextUsed >= sesionesTotales ? 'completado' : 'activo',
      coverage_items: coverage,
    })
    .eq('id', item.bono_id);
  if (updateError) throw updateError;

  const { error: usoError } = await supabase.from('bono_uso').insert({
    bono_id: item.bono_id,
    article_id: item.article_id ?? null,
    empleado_id: opts.employeeId ?? null,
    fecha: opts.appointmentDate,
    quantity: 1,
    notas: JSON.stringify({
      appointment_id: opts.appointmentId,
      appointment_item_label: item.label,
      bono_coverage_index: item.bono_coverage_index ?? null,
    }),
    source_table: 'appointments',
    source_legacy_key: opts.appointmentId,
  });
  if (usoError) throw usoError;
}

async function consumeOneVoucherSession(item: AppointmentItemDraft): Promise<void> {
  if (!item.customer_voucher_id) return;
  const { data: voucher, error: fetchError } = await supabase
    .from('customer_vouchers')
    .select('id, total_sessions, used_sessions')
    .eq('id', item.customer_voucher_id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!voucher) return;

  const used = Number(voucher.used_sessions ?? 0);
  const total = Number(voucher.total_sessions ?? 0);
  if (used >= total) throw new Error('El bono no tiene sesiones disponibles');

  const nextUsed = used + 1;
  const { error: updateError } = await supabase
    .from('customer_vouchers')
    .update({ used_sessions: nextUsed, is_active: nextUsed < total })
    .eq('id', item.customer_voucher_id);
  if (updateError) throw updateError;
}

/** Registra consumo de sesiones nuevas respecto al estado previo de la cita. */
export async function applyBonoSessionDelta(
  previousItems: AppointmentItemDraft[],
  nextItems: AppointmentItemDraft[],
  opts: { appointmentId: string; appointmentDate: string; employeeId?: string | null },
): Promise<void> {
  const prev = countSessions(previousItems);
  const next = countSessions(nextItems);

  for (const [sig, item] of next) {
    if (prev.has(sig)) continue;
    if (item.bono_id) {
      await consumeOneBonoSession(item, opts);
    } else if (item.customer_voucher_id && item.bonus_payment_mode === 'none') {
      await consumeOneVoucherSession(item);
    }
  }
}
