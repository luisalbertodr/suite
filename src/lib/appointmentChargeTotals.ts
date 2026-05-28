import { supabase } from '@/lib/supabase';
import { queryAppointmentItemsInChunks } from '@/lib/appointmentItemsSelect';

type PricingPayload = {
  quantity?: number;
  unit_price?: number;
  bonus_payment_mode?: string;
};

type ItemRow = {
  appointment_id: string;
  kind: string | null;
  label: string | null;
  notes: string | null;
  article_id: string | null;
  articles?: { precio?: number | null } | null;
};

function parsePricingFromNotes(notes: string | null): Partial<PricingPayload> {
  if (!notes || !notes.startsWith('__pricing__')) return {};
  try {
    const parsed = JSON.parse(notes.slice('__pricing__'.length)) as Partial<PricingPayload>;
    return {
      quantity: Number(parsed.quantity ?? 1),
      unit_price: Number(parsed.unit_price ?? 0),
      bonus_payment_mode: parsed.bonus_payment_mode ?? 'none',
    };
  } catch {
    return {};
  }
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferItemPriceFromLabel(
  label: string | null | undefined,
  byCode: Map<string, number>,
  byDescription: Map<string, number>,
): number {
  const raw = String(label || '').trim();
  if (!raw) return 0;
  const codeMatch = raw.match(/^([A-Za-z0-9._-]+)\s*[-:]/);
  if (codeMatch?.[1]) {
    const p = byCode.get(codeMatch[1].toLowerCase());
    if (typeof p === 'number' && p > 0) return p;
  }
  const normalized = normalizeText(raw.replace(/^([A-Za-z0-9._-]+)\s*[-:]\s*/, ''));
  return Math.max(0, Number(byDescription.get(normalized) || 0));
}

function lineTotal(row: ItemRow, byCode: Map<string, number>, byDescription: Map<string, number>): number {
  const fallback = parsePricingFromNotes(row.notes ?? null);
  const qty = Math.max(0, Number(fallback.quantity ?? 1));
  const baseUnit = Math.max(0, Number(fallback.unit_price ?? 0));
  const articlePrice = Math.max(0, Number(row.articles?.precio ?? 0));
  const inferredLabelPrice =
    !row.article_id && baseUnit <= 0
      ? inferItemPriceFromLabel(row.label, byCode, byDescription)
      : 0;
  const unit = baseUnit > 0 ? baseUnit : (row.article_id ? articlePrice : inferredLabelPrice);
  const mode = String(fallback.bonus_payment_mode ?? 'none');
  let line = qty * unit;
  if (row.kind === 'bonus') {
    if (mode === '60') line = unit * 0.6;
    else if (mode === '40') line = unit * 0.4;
    else if (mode === 'full') line = unit;
    else line = 0;
  }
  return line;
}

export function parseAppointmentIdFromSaleNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as { appointment_id?: string; source?: string };
    if (parsed?.appointment_id) return String(parsed.appointment_id);
  } catch {
    /* ignore */
  }
  return null;
}

function isSchemaColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST200') return true;
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('relationship') && msg.includes('schema cache')) return true;
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
}

async function loadSalesByAppointmentIds(
  appointmentIds: string[],
  totals: Map<string, number>,
): Promise<void> {
  if (!appointmentIds.length) return;
  let res = await supabase
    .from('sales')
    .select('appointment_id,total_amount,status,notes')
    .in('appointment_id', appointmentIds)
    .neq('status', 'cancelled');
  if (res.error && isSchemaColumnError(res.error)) {
    return;
  }
  if (res.error) return;
  for (const sale of res.data || []) {
    const aptId = (sale as any).appointment_id
      ? String((sale as any).appointment_id)
      : parseAppointmentIdFromSaleNotes((sale as any).notes ?? null);
    if (aptId && sale.total_amount != null && !totals.has(aptId)) {
      totals.set(aptId, Number(sale.total_amount));
    }
  }
}

async function ingestSalesRows(
  rows: Array<{ total_amount?: number | null; notes?: string | null; appointment_id?: string | null }> | null,
  aptSet: Set<string>,
  totals: Map<string, number>,
): Promise<void> {
  for (const sale of rows || []) {
    const aptId =
      (sale.appointment_id ? String(sale.appointment_id) : null) ??
      parseAppointmentIdFromSaleNotes(sale.notes ?? null);
    if (aptId && aptSet.has(aptId) && !totals.has(aptId) && sale.total_amount != null) {
      totals.set(aptId, Number(sale.total_amount));
    }
  }
}

function schemaErrorMessage(error: { message?: string } | null): string {
  return String(error?.message || '').toLowerCase();
}

function schemaErrorMissingColumn(error: { message?: string } | null, column: string): boolean {
  const msg = schemaErrorMessage(error);
  return msg.includes(column.toLowerCase());
}

async function loadSalesByCustomerId(
  customerId: string,
  aptSet: Set<string>,
  totals: Map<string, number>,
): Promise<void> {
  let res = await supabase
    .from('sales')
    .select('total_amount, notes')
    .eq('customer_id', customerId);
  if (res.error) {
    if (!isSchemaColumnError(res.error)) return;
    if (schemaErrorMissingColumn(res.error, 'customer_id')) return;
    if (schemaErrorMissingColumn(res.error, 'notes')) {
      res = await supabase.from('sales').select('total_amount').eq('customer_id', customerId);
    } else {
      return;
    }
  }
  if (res.error) return;
  await ingestSalesRows(res.data, aptSet, totals);
}

async function loadSalesByCompanyId(
  companyId: string,
  aptSet: Set<string>,
  totals: Map<string, number>,
): Promise<void> {
  let res = await supabase
    .from('sales')
    .select('total_amount, notes')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(8000);
  if (res.error) {
    if (!isSchemaColumnError(res.error)) return;
    if (schemaErrorMissingColumn(res.error, 'notes')) {
      res = await supabase
        .from('sales')
        .select('total_amount')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(8000);
    } else {
      return;
    }
  }
  if (res.error) return;
  await ingestSalesRows(res.data, aptSet, totals);
}

export async function buildAppointmentChargedTotals(
  appointmentIds: string[],
  opts?: { companyId?: string | null; customerId?: string | null },
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (!appointmentIds.length) return totals;

  const aptSet = new Set(appointmentIds);

  await loadSalesByAppointmentIds(appointmentIds, totals);

  if (opts?.customerId) {
    await loadSalesByCustomerId(opts.customerId, aptSet, totals);
  }

  const needsCompanySales = appointmentIds.some((id) => !totals.has(id));
  if (needsCompanySales && opts?.companyId) {
    await loadSalesByCompanyId(opts.companyId, aptSet, totals);
  }

  const missing = appointmentIds.filter((id) => !totals.has(id));
  if (!missing.length) return totals;

  const byCode = new Map<string, number>();
  const byDescription = new Map<string, number>();
  if (opts?.companyId) {
    const { data: articleRows } = await supabase
      .from('articles')
      .select('codigo, descripcion, precio')
      .eq('company_id', opts.companyId);
    for (const a of articleRows || []) {
      const price = Math.max(0, Number(a.precio || 0));
      if (price <= 0) continue;
      if (a.codigo) byCode.set(String(a.codigo).toLowerCase(), price);
      if (a.descripcion) byDescription.set(normalizeText(a.descripcion), price);
    }
  }

  const chunkSize = 80;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    const rows = await queryAppointmentItemsInChunks(chunk, chunkSize);
    for (const row of rows) {
      totals.set(
        String(row.appointment_id),
        (totals.get(String(row.appointment_id)) || 0) +
          lineTotal(
            {
              appointment_id: String(row.appointment_id),
              kind: (row.kind as string | null) ?? null,
              label: (row.label as string | null) ?? null,
              notes: (row.notes as string | null) ?? null,
              article_id: (row.article_id as string | null) ?? null,
              articles: null,
            },
            byCode,
            byDescription,
          ),
      );
    }
  }

  return totals;
}
