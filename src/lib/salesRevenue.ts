import { supabase } from '@/lib/supabase';
import { isSchemaColumnError } from '@/lib/appointmentSales';
import {
  familiesCacheKey,
  withDashboardBillingCache,
} from '@/lib/dashboardBillingCache';
import {
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
  WORK_CENTER_BILLING_COMPANY_IDS,
} from '@/lib/workCenterBilling';

export type BillingEntityView = 'both' | 'medicina' | 'estetica';

export type RevenueBreakdown = {
  invoices: number;
  salesWithoutInvoice: number;
  total: number;
};

type InvoiceRow = {
  id: string;
  issue_date?: string | null;
  total_amount?: number | null;
  status?: string | null;
  notes?: string | null;
};

type SaleRow = {
  total_amount?: number | null;
  created_at?: string | null;
  ticket_number?: string | null;
  notes?: string | null;
};

/** Ventas TPV legacy sin factura que duplican totfac ya importado desde faccab. */
export function isLegacyOrphanSaleForRevenue(row: {
  ticket_number?: string | null;
  notes?: string | null;
}): boolean {
  const ticket = String(row.ticket_number ?? '').trim();
  if (ticket.startsWith('LEG-') || /^FAC-\d/i.test(ticket)) return true;
  const notes = String(row.notes ?? '');
  if (notes.includes('legacy_revenue') || notes.includes('Legacy FACCAB')) return true;
  if (/legacy/i.test(notes) && notes.includes('appointment_id')) return true;
  return false;
}

const PAGE = 1000;

function invoiceCountsAsBilling(row: { status?: string | null; notes?: string | null }): boolean {
  const status = String(row.status ?? '').toLowerCase();
  if (['cancelled', 'void', 'anulada'].includes(status)) return false;
  // Huérfanas legacy (sin ticket) se eliminan en reset; evitar escanear todas las ventas.
  return true;
}

function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function localDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Clave yyyy-mm desde issue_date (YYYY-MM-DD) o timestamp ISO. */
export function monthKey(value: string): string {
  if (value.length >= 7 && value[4] === '-') return value.slice(0, 7);
  return localMonthKey(new Date(value));
}

async function fetchAllPages<T>(
  build: (from: number, to: number) => ReturnType<typeof supabase.from>,
  selectFallback?: () => ReturnType<typeof supabase.from>,
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;

  while (true) {
    let res = await build(offset, offset + PAGE - 1);
    if (res.error && selectFallback) {
      res = await selectFallback();
      if (!res.error && res.data) {
        return res.data as T[];
      }
    }
    if (res.error) throw res.error;

    const rows = (res.data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return out;
}

async function loadInvoices(companyId: string, fromDate: string, toDate: string): Promise<InvoiceRow[]> {
  return fetchAllPages<InvoiceRow>(
    (from, to) =>
      supabase
        .from('invoices')
        .select('id, issue_date, total_amount, status, notes')
        .eq('company_id', companyId)
        .gte('issue_date', fromDate)
        .lte('issue_date', toDate)
        .order('issue_date')
        .range(from, to),
    () =>
      supabase
        .from('invoices')
        .select('id, issue_date, total_amount, status')
        .eq('company_id', companyId)
        .gte('issue_date', fromDate)
        .lte('issue_date', toDate),
  );
}

async function loadSalesWithoutInvoice(
  companyId: string,
  fromIso: string,
  toIso: string,
): Promise<SaleRow[]> {
  try {
    const rows = await fetchAllPages<SaleRow>((from, to) =>
      supabase
        .from('sales')
        .select('total_amount, created_at, ticket_number, notes')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .is('invoice_id', null)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at')
        .range(from, to),
    );
    return rows.filter((row) => !isLegacyOrphanSaleForRevenue(row));
  } catch (err) {
    if (!isSchemaColumnError(err as { code?: string; message?: string })) throw err;
    return [];
  }
}

function sumInvoices(rows: InvoiceRow[]): number {
  return rows.reduce((sum, inv) => {
    if (!invoiceCountsAsBilling(inv)) return sum;
    return sum + Number(inv.total_amount ?? 0);
  }, 0);
}

function sumSales(rows: SaleRow[]): number {
  return rows.reduce((s, row) => s + Number(row.total_amount ?? 0), 0);
}

/** Facturación alineada con Dunasoft (totfac / devengo): solo facturas emitidas. */
function billingTotalFromInvoices(invoiceTotal: number): number {
  return invoiceTotal;
}

function bucketInvoices(rows: InvoiceRow[]): Map<string, number> {
  const buckets = new Map<string, number>();
  for (const inv of rows) {
    if (!invoiceCountsAsBilling(inv) || !inv.issue_date) continue;
    const key = monthKey(inv.issue_date);
    buckets.set(key, (buckets.get(key) ?? 0) + Number(inv.total_amount ?? 0));
  }
  return buckets;
}

function bucketSales(rows: SaleRow[]): Map<string, number> {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const created = row.created_at;
    if (!created) continue;
    const key = monthKey(created);
    buckets.set(key, (buckets.get(key) ?? 0) + Number(row.total_amount ?? 0));
  }
  return buckets;
}

export type DashboardBilling = {
  currentMonth: RevenueBreakdown;
  series: Array<{ monthStart: Date; monthEnd: Date; total: number }>;
};

export type YearBillingRow = {
  name: string;
  monthNum: number;
  [yearKey: string]: number | string | undefined;
};

export type ComparisonPeriod =
  | { mode: 'rolling'; days: 15 | 30 }
  | { mode: 'month'; month: number };

export type DashboardBillingFamiliesFilter = {
  selectedFamilies: string[] | null;
  billingView: BillingEntityView;
};

export type DailyBillingRow = {
  name: string;
  dayKey?: string;
  [yearKey: string]: number | string | undefined;
};

export type YearBillingYearPayload = {
  totals: Record<string, number>;
  split?: { medicina: Record<string, number>; estetica: Record<string, number> };
};

export type YearBillingYearData = {
  year: number;
  totals: Map<number, number>;
  split?: { medicina: Map<number, number>; estetica: Map<number, number> };
};

type DailyBillingBucketsPayload = {
  byYear: Record<string, Record<string, number>>;
  splitByYear?: Record<string, { medicina: Record<string, number>; estetica: Record<string, number> }>;
};

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_LONG = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type RpcBillingRow = { month_num: number; month_key: string; total: number };
type RpcBillingSplitRow = { month_num: number; month_key: string; company_id: string; total: number };
type RpcBillingDailyRow = { day_date: string; day_key: string; total: number };
type RpcBillingDailySplitRow = { day_date: string; day_key: string; company_id: string; total: number };
type RpcFamilyMonthRow = {
  month_num: number;
  family_name: string;
  report_company_id: string;
  total: number;
};
type RpcFamilyDayRow = {
  day_key: string;
  family_name: string;
  report_company_id: string;
  total: number;
};

type DailyRowTemplate = {
  label: string;
  primaryDayKey?: string;
  dateForYear: (year: number) => string | null;
};

function mapFromRecord(rec: Record<string, number>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [key, value] of Object.entries(rec)) {
    out.set(Number(key), value);
  }
  return out;
}

function mapToRecord(m: Map<number, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of m) {
    out[String(key)] = value;
  }
  return out;
}

function dayMapFromRecord(rec: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(rec));
}

function dayMapToRecord(m: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of m) {
    out[key] = value;
  }
  return out;
}

export function comparisonPeriodCacheKey(period: ComparisonPeriod): string {
  return period.mode === 'rolling' ? `rolling:${period.days}` : `month:${period.month}`;
}

function aggregateFamilyMonthRows(
  rows: RpcFamilyMonthRow[],
  selectedFamilies: string[] | null,
  billingView: BillingEntityView,
): { totals: Map<number, number>; split: { medicina: Map<number, number>; estetica: Map<number, number> } } {
  const selected = selectedFamilies?.length ? new Set(selectedFamilies) : null;
  const totals = new Map<number, number>();
  const medicina = new Map<number, number>();
  const estetica = new Map<number, number>();

  for (const row of rows) {
    if (selected && !selected.has(row.family_name)) continue;
    const amount = Number(row.total ?? 0);
    const isMed = row.report_company_id === MEDICINA_COMPANY_ID;
    if (billingView === 'medicina' && !isMed) continue;
    if (billingView === 'estetica' && isMed) continue;
    totals.set(row.month_num, (totals.get(row.month_num) ?? 0) + amount);
    if (isMed) medicina.set(row.month_num, (medicina.get(row.month_num) ?? 0) + amount);
    else estetica.set(row.month_num, (estetica.get(row.month_num) ?? 0) + amount);
  }

  return { totals, split: { medicina, estetica } };
}

function aggregateFamilyDayRows(
  rows: RpcFamilyDayRow[],
  selectedFamilies: string[] | null,
  billingView: BillingEntityView,
): {
  byYear: Record<string, Record<string, number>>;
  splitByYear: Record<string, { medicina: Record<string, number>; estetica: Record<string, number> }>;
} {
  const selected = selectedFamilies?.length ? new Set(selectedFamilies) : null;
  const byYear: Record<string, Record<string, number>> = {};
  const splitByYear: Record<string, { medicina: Record<string, number>; estetica: Record<string, number> }> = {};

  for (const row of rows) {
    if (selected && !selected.has(row.family_name)) continue;
    const amount = Number(row.total ?? 0);
    const isMed = row.report_company_id === MEDICINA_COMPANY_ID;
    if (billingView === 'medicina' && !isMed) continue;
    if (billingView === 'estetica' && isMed) continue;
    const year = row.day_key.slice(0, 4);
    if (!byYear[year]) byYear[year] = {};
    if (!splitByYear[year]) splitByYear[year] = { medicina: {}, estetica: {} };
    byYear[year][row.day_key] = (byYear[year][row.day_key] ?? 0) + amount;
    if (isMed) {
      splitByYear[year].medicina[row.day_key] = (splitByYear[year].medicina[row.day_key] ?? 0) + amount;
    } else {
      splitByYear[year].estetica[row.day_key] = (splitByYear[year].estetica[row.day_key] ?? 0) + amount;
    }
  }

  return { byYear, splitByYear };
}

async function fetchRpcMonthlyByFamily(year: number): Promise<RpcFamilyMonthRow[]> {
  const { data, error } = await supabase.rpc('dashboard_billing_monthly_by_family', { p_year: year });
  if (error) throw error;
  return (data ?? []) as RpcFamilyMonthRow[];
}

async function fetchRpcDailyByFamily(fromDate: string, toDate: string): Promise<RpcFamilyDayRow[]> {
  const { data, error } = await supabase.rpc('dashboard_billing_daily_by_family', {
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  if (error) throw error;
  return (data ?? []) as RpcFamilyDayRow[];
}

function needsFamilyDetailRows(selectedFamilies: string[] | null | undefined): boolean {
  return Boolean(selectedFamilies?.length);
}

async function fetchMonthlyFamilyRows(
  year: number,
  selectedFamilies: string[] | null,
): Promise<RpcFamilyMonthRow[]> {
  if (!needsFamilyDetailRows(selectedFamilies)) {
    const split = await fetchRpcMonthlyBillingSplit(year);
    return splitRowsToFamilyMonthRows(split);
  }
  try {
    return await fetchRpcMonthlyByFamily(year);
  } catch {
    const split = await fetchRpcMonthlyBillingSplit(year);
    return splitRowsToFamilyMonthRows(split);
  }
}

async function fetchDailyFamilyRows(
  fromDate: string,
  toDate: string,
  selectedFamilies: string[] | null,
): Promise<RpcFamilyDayRow[]> {
  if (!needsFamilyDetailRows(selectedFamilies)) {
    const split = await fetchRpcDailyBillingSplit(fromDate, toDate);
    const rows: RpcFamilyDayRow[] = [];
    for (const [dayKey, companyMap] of split) {
      for (const [companyIdKey, total] of companyMap) {
        rows.push({
          day_key: dayKey,
          family_name: 'Todas',
          report_company_id: companyIdKey,
          total,
        });
      }
    }
    return rows;
  }
  try {
    return await fetchRpcDailyByFamily(fromDate, toDate);
  } catch {
    const split = await fetchRpcDailyBillingSplit(fromDate, toDate);
    const rows: RpcFamilyDayRow[] = [];
    for (const [dayKey, companyMap] of split) {
      for (const [companyIdKey, total] of companyMap) {
        rows.push({
          day_key: dayKey,
          family_name: 'Todas',
          report_company_id: companyIdKey,
          total,
        });
      }
    }
    return rows;
  }
}

function splitRowsToFamilyMonthRows(
  split: Map<string, Map<number, number>>,
): RpcFamilyMonthRow[] {
  const rows: RpcFamilyMonthRow[] = [];
  for (const [companyId, monthMap] of split) {
    const reportId = companyId;
    for (const [monthNum, total] of monthMap) {
      rows.push({
        month_num: monthNum,
        family_name: 'Todas',
        report_company_id: reportId,
        total,
      });
    }
  }
  return rows;
}

export function mergeYearBillingRows(
  years: number[],
  yearDataByYear: Map<number, YearBillingYearData | undefined>,
): YearBillingRow[] {
  const sortedYears = [...years].sort((a, b) => a - b);
  return MONTH_SHORT.map((name, idx) => {
    const monthNum = idx + 1;
    const row: YearBillingRow = { name, monthNum };
    for (const year of sortedYears) {
      const data = yearDataByYear.get(year);
      const total = data?.totals.get(monthNum) ?? 0;
      row[String(year)] = total;
      if (data?.split) {
        row[`${year}_medicina`] = data.split.medicina.get(monthNum) ?? 0;
        row[`${year}_estetica`] = data.split.estetica.get(monthNum) ?? 0;
      }
    }
    return row;
  });
}

/** Facturación mensual de un solo año (cacheable en BD). */
export async function fetchYearBillingSingleYear(
  companyId: string,
  year: number,
  familiesFilter?: DashboardBillingFamiliesFilter,
): Promise<YearBillingYearData> {
  const useSplit = isWorkCenterStyleBilling(companyId);
  const billingView = familiesFilter?.billingView ?? 'both';
  const selectedFamilies = familiesFilter?.selectedFamilies ?? null;
  const famKey = familiesCacheKey(selectedFamilies);
  const viewKey = billingView;

  if (useSplit) {
    const rawCacheKey = `monthly_family_raw:v2:${companyId}:${year}`;
    const rawPayload = await withDashboardBillingCache<{ rows: RpcFamilyMonthRow[] }>(
      rawCacheKey,
      companyId,
      async () => {
        return { rows: await fetchMonthlyFamilyRows(year, selectedFamilies) };
      },
    );
    const { totals, split } = aggregateFamilyMonthRows(rawPayload.rows, selectedFamilies, billingView);
    return { year, totals, split };
  }

  const cacheKey = `monthly:v2:${resolveStyleBillingRpcCompanyId(companyId)}:${year}:${viewKey}:${famKey}`;
  const payload = await withDashboardBillingCache<YearBillingYearPayload>(
    cacheKey,
    companyId,
    async () => {
      try {
        const totals = await fetchRpcMonthlyBilling(companyId, year);
        return { totals: mapToRecord(totals) };
      } catch {
        const invoices = await loadInvoices(companyId, `${year}-01-01`, `${year}-12-31`);
        return { totals: mapToRecord(bucketInvoicesByMonthNum(invoices)) };
      }
    },
  );

  return {
    year,
    totals: mapFromRecord(payload.totals),
    split: payload.split
      ? {
          medicina: mapFromRecord(payload.split.medicina),
          estetica: mapFromRecord(payload.split.estetica),
        }
      : undefined,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function buildRollingTemplates(days: number): DailyRowTemplate[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const templates: DailyRowTemplate[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const anchor = new Date(today);
    anchor.setDate(anchor.getDate() - offset);
    const monthLabel = MONTH_SHORT[anchor.getMonth()];
    templates.push({
      label: `${anchor.getDate()} ${monthLabel}`,
      primaryDayKey: toYmd(anchor),
      dateForYear: (year) => {
        const d = new Date(year, anchor.getMonth(), anchor.getDate(), 12, 0, 0, 0);
        return toYmd(d);
      },
    });
  }
  return templates;
}

function buildMonthTemplates(month: number, years: number[]): DailyRowTemplate[] {
  const maxDay = Math.max(...years.map((year) => new Date(year, month, 0).getDate()));
  const templates: DailyRowTemplate[] = [];
  for (let day = 1; day <= maxDay; day += 1) {
    templates.push({
      label: String(day),
      dateForYear: (year) => {
        const daysInMonth = new Date(year, month, 0).getDate();
        if (day > daysInMonth) return null;
        return `${year}-${pad2(month)}-${pad2(day)}`;
      },
    });
  }
  return templates;
}

function collectTemplateDateKeys(templates: DailyRowTemplate[], years: number[]): string[] {
  const keys = new Set<string>();
  for (const template of templates) {
    for (const year of years) {
      const key = template.dateForYear(year);
      if (key) keys.add(key);
    }
  }
  return [...keys].sort();
}

export function isWorkCenterStyleBilling(companyId: string): boolean {
  return (WORK_CENTER_BILLING_COMPANY_IDS as readonly string[]).includes(companyId);
}

/** Centro laboral Lipoout: facturación fiscal vía mapeos Style del hub (M+E). */
export function resolveStyleBillingRpcCompanyId(companyId: string): string {
  return companyId;
}

export function usesWorkCenterStyleBillingRpc(companyId: string): boolean {
  return isWorkCenterStyleBilling(companyId);
}

async function fetchRpcDailyBilling(
  companyId: string,
  fromDate: string,
  toDate: string,
): Promise<Map<string, number>> {
  const rpcCompanyId = resolveStyleBillingRpcCompanyId(companyId);
  const { data, error } = await supabase.rpc('dashboard_billing_daily', {
    p_company_id: rpcCompanyId,
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  if (error) throw error;
  const out = new Map<string, number>();
  for (const row of (data ?? []) as RpcBillingDailyRow[]) {
    out.set(row.day_key, Number(row.total ?? 0));
  }
  return out;
}

async function fetchRpcDailyBillingSplit(
  fromDate: string,
  toDate: string,
): Promise<Map<string, Map<string, number>>> {
  const { data, error } = await supabase.rpc('dashboard_billing_daily_split', {
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  if (error) throw error;
  const out = new Map<string, Map<string, number>>();
  for (const row of (data ?? []) as RpcBillingDailySplitRow[]) {
    if (!out.has(row.day_key)) out.set(row.day_key, new Map());
    out.get(row.day_key)!.set(row.company_id, Number(row.total ?? 0));
  }
  return out;
}

function bucketInvoicesByDayKey(rows: InvoiceRow[]): Map<string, number> {
  const buckets = new Map<string, number>();
  for (const inv of rows) {
    if (!invoiceCountsAsBilling(inv) || !inv.issue_date) continue;
    const key = inv.issue_date.slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + Number(inv.total_amount ?? 0));
  }
  return buckets;
}

function mapYearDailyBuckets(
  buckets: Map<string, number>,
  year: number,
): Map<string, number> {
  const prefix = `${year}-`;
  const out = new Map<string, number>();
  for (const [dayKey, total] of buckets) {
    if (dayKey.startsWith(prefix)) out.set(dayKey, total);
  }
  return out;
}

function mapYearDailySplitBuckets(
  split: Map<string, Map<string, number>>,
  year: number,
): { medicina: Map<string, number>; estetica: Map<string, number> } {
  const prefix = `${year}-`;
  const medicina = new Map<string, number>();
  const estetica = new Map<string, number>();
  for (const [dayKey, companyMap] of split) {
    if (!dayKey.startsWith(prefix)) continue;
    medicina.set(dayKey, companyMap.get(MEDICINA_COMPANY_ID) ?? 0);
    estetica.set(dayKey, companyMap.get(ESTETICA_COMPANY_ID) ?? 0);
  }
  return { medicina, estetica };
}

/** Comparativa diaria entre años (últimos N días o mismo mes). */
export async function fetchDailyBillingComparison(
  companyId: string,
  years: number[],
  period: ComparisonPeriod,
  familiesFilter?: DashboardBillingFamiliesFilter,
): Promise<DailyBillingRow[]> {
  const sortedYears = [...years].sort((a, b) => a - b);
  const billingView = familiesFilter?.billingView ?? 'both';
  const selectedFamilies = familiesFilter?.selectedFamilies ?? null;

  const templates =
    period.mode === 'rolling'
      ? buildRollingTemplates(period.days)
      : buildMonthTemplates(period.month, sortedYears);

  const dateKeys = collectTemplateDateKeys(templates, sortedYears);
  if (!dateKeys.length) return [];

  const from = dateKeys[0]!;
  const to = dateKeys[dateKeys.length - 1]!;
  const useSplit = isWorkCenterStyleBilling(companyId);

  let byYear = new Map<number, Map<string, number>>();
  let splitByYear = new Map<number, { medicina: Map<string, number>; estetica: Map<string, number> }>();

  if (useSplit) {
    const rawCacheKey = `daily_family_raw:v2:${companyId}:${from}:${to}`;
    const rawPayload = await withDashboardBillingCache<{ rows: RpcFamilyDayRow[] }>(
      rawCacheKey,
      companyId,
      async () => {
        return { rows: await fetchDailyFamilyRows(from, to, selectedFamilies) };
      },
    );
    const aggregated = aggregateFamilyDayRows(rawPayload.rows, selectedFamilies, billingView);
    for (const year of sortedYears) {
      byYear.set(year, dayMapFromRecord(aggregated.byYear[String(year)] ?? {}));
      const split = aggregated.splitByYear[String(year)];
      if (split) {
        splitByYear.set(year, {
          medicina: dayMapFromRecord(split.medicina),
          estetica: dayMapFromRecord(split.estetica),
        });
      }
    }
  } else {
    const bucketsCacheKey = `daily:v2:${resolveStyleBillingRpcCompanyId(companyId)}:${from}:${to}`;
    const bucketsPayload = await withDashboardBillingCache<DailyBillingBucketsPayload>(
      bucketsCacheKey,
      companyId,
      async () => {
        const byYearRecord: Record<string, Record<string, number>> = {};
        try {
          const buckets = await fetchRpcDailyBilling(companyId, from, to);
          for (const year of sortedYears) {
            byYearRecord[String(year)] = dayMapToRecord(mapYearDailyBuckets(buckets, year));
          }
        } catch {
          for (const year of sortedYears) {
            const yearKeys = dateKeys.filter((key) => key.startsWith(`${year}-`));
            if (!yearKeys.length) continue;
            const invoices = await loadInvoices(companyId, yearKeys[0]!, yearKeys[yearKeys.length - 1]!);
            byYearRecord[String(year)] = dayMapToRecord(bucketInvoicesByDayKey(invoices));
          }
        }
        return { byYear: byYearRecord };
      },
    );
    for (const year of sortedYears) {
      byYear.set(year, dayMapFromRecord(bucketsPayload.byYear[String(year)] ?? {}));
    }
    splitByYear = new Map();
  }

  return templates.map((template) => {
    const row: DailyBillingRow = { name: template.label, dayKey: template.primaryDayKey };
    for (const year of sortedYears) {
      const dayKey = template.dateForYear(year);
      const total = dayKey ? byYear.get(year)?.get(dayKey) ?? 0 : 0;
      row[String(year)] = total;
      if (useSplit) {
        const split = splitByYear.get(year);
        row[`${year}_medicina`] = dayKey ? split?.medicina.get(dayKey) ?? 0 : 0;
        row[`${year}_estetica`] = dayKey ? split?.estetica.get(dayKey) ?? 0 : 0;
      }
    }
    return row;
  });
}

export function comparisonPeriodLabel(period: ComparisonPeriod): string {
  if (period.mode === 'rolling') {
    return period.days === 15 ? 'Últimos 15 días' : 'Último mes (30 días)';
  }
  return `${MONTH_LONG[period.month - 1] ?? 'Mes'} (día a día)`;
}

export { MONTH_LONG as COMPARISON_MONTH_NAMES };
async function fetchRpcMonthlyBilling(
  companyId: string,
  year: number,
): Promise<Map<number, number>> {
  const rpcCompanyId = resolveStyleBillingRpcCompanyId(companyId);
  const { data, error } = await supabase.rpc('dashboard_billing_monthly', {
    p_company_id: rpcCompanyId,
    p_year: year,
  });
  if (error) throw error;
  const out = new Map<number, number>();
  for (const row of (data ?? []) as RpcBillingRow[]) {
    out.set(row.month_num, Number(row.total ?? 0));
  }
  return out;
}

async function fetchRpcMonthlyBillingSplit(
  year: number,
): Promise<Map<string, Map<number, number>>> {
  const { data, error } = await supabase.rpc('dashboard_billing_monthly_split', {
    p_year: year,
  });
  if (error) throw error;
  const out = new Map<string, Map<number, number>>();
  for (const row of (data ?? []) as RpcBillingSplitRow[]) {
    if (!out.has(row.company_id)) out.set(row.company_id, new Map());
    out.get(row.company_id)!.set(row.month_num, Number(row.total ?? 0));
  }
  return out;
}

export function yearBillingDataKey(year: number, view: BillingEntityView): string {
  if (view === 'medicina') return `${year}_medicina`;
  if (view === 'estetica') return `${year}_estetica`;
  return String(year);
}

export function yearBillingLegend(year: number, view: BillingEntityView): string {
  if (view === 'medicina') return `${year} Medicina`;
  if (view === 'estetica') return `${year} Estética`;
  return String(year);
}

/** Comparativa mensual entre varios años (Ene–Dic). Incluye desglose M/E en centro laboral. */
export async function fetchYearBillingComparison(
  companyId: string,
  years: number[],
  familiesFilter?: DashboardBillingFamiliesFilter,
): Promise<YearBillingRow[]> {
  const sortedYears = [...years].sort((a, b) => a - b);
  const yearData = await Promise.all(
    sortedYears.map((year) => fetchYearBillingSingleYear(companyId, year, familiesFilter)),
  );
  const byYear = new Map<number, YearBillingYearData | undefined>();
  for (const data of yearData) {
    byYear.set(data.year, data);
  }
  return mergeYearBillingRows(sortedYears, byYear);
}

export async function fetchMonthBillingForView(
  companyId: string,
  view: BillingEntityView,
): Promise<number> {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  if (!isWorkCenterStyleBilling(companyId)) {
    const buckets = await fetchRpcMonthlyBilling(companyId, year);
    return buckets.get(month) ?? 0;
  }
  const split = await fetchRpcMonthlyBillingSplit(year);
  const med = split.get(MEDICINA_COMPANY_ID)?.get(month) ?? 0;
  const est = split.get(ESTETICA_COMPANY_ID)?.get(month) ?? 0;
  if (view === 'medicina') return med;
  if (view === 'estetica') return est;
  return med + est;
}

async function fetchCurrentMonthPendingSales(companyId: string): Promise<{
  medicina: number;
  estetica: number;
  total: number;
}> {
  const now = new Date();
  const fromIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const toIso = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  const companyIds = isWorkCenterStyleBilling(companyId)
    ? [...WORK_CENTER_BILLING_COMPANY_IDS]
    : [companyId];

  let medicina = 0;
  let estetica = 0;
  let other = 0;
  for (const cid of companyIds) {
    const sales = await loadSalesWithoutInvoice(cid, fromIso, toIso);
    const sum = sumSales(sales);
    if (cid === MEDICINA_COMPANY_ID) medicina += sum;
    else if (cid === ESTETICA_COMPANY_ID) estetica += sum;
    else other += sum;
  }
  return { medicina, estetica, total: medicina + estetica + other };
}

/** Facturación del mes en curso: facturas Style + ventas TPV sin facturar (citas cobradas hoy, etc.). */
export async function fetchLiveMonthBillingForView(
  companyId: string,
  view: BillingEntityView,
): Promise<number> {
  const [invoiceBase, pending] = await Promise.all([
    fetchMonthBillingForView(companyId, view),
    fetchCurrentMonthPendingSales(companyId),
  ]);
  if (view === 'medicina') return invoiceBase + pending.medicina;
  if (view === 'estetica') return invoiceBase + pending.estetica;
  return invoiceBase + pending.total;
}

function bucketInvoicesByMonthNum(rows: InvoiceRow[]): Map<number, number> {
  const buckets = new Map<number, number>();
  for (const inv of rows) {
    if (!invoiceCountsAsBilling(inv) || !inv.issue_date) continue;
    const m = parseInt(inv.issue_date.slice(5, 7), 10);
    buckets.set(m, (buckets.get(m) ?? 0) + Number(inv.total_amount ?? 0));
  }
  return buckets;
}

async function fetchCurrentMonthBillingRpc(companyId: string): Promise<number | null> {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  try {
    const buckets = await fetchRpcMonthlyBilling(companyId, year);
    return buckets.get(month) ?? 0;
  } catch {
    return null;
  }
}

/** Una sola carga para tarjeta + gráfico del dashboard (evita N consultas repetidas). */
export async function fetchDashboardBilling(
  companyId: string,
  monthsBack: number,
): Promise<DashboardBilling> {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const useRpc = usesWorkCenterStyleBillingRpc(companyId);

  let series: DashboardBilling['series'] = [];
  let rpcMonthTotal: number | null = null;

  if (useRpc) {
    const years = new Set<number>();
    for (let i = monthsBack; i >= 0; i -= 1) {
      years.add(new Date(now.getFullYear(), now.getMonth() - i, 1).getFullYear());
    }
    const rpcBuckets = new Map<string, number>();
    for (const year of years) {
      const monthly = await fetchRpcMonthlyBilling(companyId, year);
      for (const [monthNum, total] of monthly) {
        rpcBuckets.set(`${year}-${String(monthNum).padStart(2, '0')}`, total);
      }
    }
    for (let i = monthsBack; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const key = localMonthKey(monthStart);
      series.push({ monthStart, monthEnd, total: rpcBuckets.get(key) ?? 0 });
    }
    rpcMonthTotal = await fetchCurrentMonthBillingRpc(companyId);
  } else {
    const [invoices, salesNoInv] = await Promise.all([
      loadInvoices(companyId, localDateOnly(rangeStart), localDateOnly(rangeEnd)),
      loadSalesWithoutInvoice(companyId, rangeStart.toISOString(), rangeEnd.toISOString()),
    ]);
    const invBuckets = bucketInvoices(invoices);
    for (let i = monthsBack; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const key = localMonthKey(monthStart);
      series.push({ monthStart, monthEnd, total: invBuckets.get(key) ?? 0 });
    }
  }

  const cmKey = localMonthKey(currentMonthStart);
  const currentFromSeries = series.find((s) => localMonthKey(s.monthStart) === cmKey)?.total ?? 0;

  return {
    currentMonth: {
      invoices: currentFromSeries,
      salesWithoutInvoice: 0,
      total: rpcMonthTotal ?? currentFromSeries,
    },
    series,
  };
}

/** Facturación de un periodo concreto. */
export async function fetchPeriodRevenue(
  companyId: string,
  fromIso: string,
  toIso: string,
): Promise<RevenueBreakdown> {
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  const [invoices, salesNoInv] = await Promise.all([
    loadInvoices(companyId, fromDate, toDate),
    loadSalesWithoutInvoice(companyId, fromIso, toIso),
  ]);

  const invTotal = sumInvoices(invoices);
  const salesTotal = sumSales(salesNoInv);

  return {
    invoices: invTotal,
    salesWithoutInvoice: salesTotal,
    total: billingTotalFromInvoices(invTotal),
  };
}

type SaleRevenueRow = {
  total_amount: number | null;
  created_at: string;
  invoice_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  ticket_number?: string | null;
};

/** Tickets TPV completados sin factura (para reportes). */
export async function fetchSalesWithoutInvoiceRows(
  companyId: string,
  fromIso?: string,
  toIso?: string,
  customerId?: string,
): Promise<SaleRevenueRow[]> {
  let query = supabase
    .from('sales')
    .select('total_amount, created_at, invoice_id, customer_id, customer_name, ticket_number')
    .eq('company_id', companyId)
    .eq('status', 'completed');

  if (fromIso) query = query.gte('created_at', fromIso);
  if (toIso) query = query.lte('created_at', toIso);
  if (customerId) query = query.eq('customer_id', customerId);

  let res = await query;
  if (res.error && isSchemaColumnError(res.error)) {
    query = supabase
      .from('sales')
      .select('total_amount, created_at, customer_name, ticket_number')
      .eq('company_id', companyId)
      .eq('status', 'completed');
    if (fromIso) query = query.gte('created_at', fromIso);
    if (toIso) query = query.lte('created_at', toIso);
    res = await query;
  }

  if (res.error) throw res.error;

  return (res.data ?? [])
    .filter((row) => !(row as SaleRevenueRow).invoice_id)
    .filter((row) => !isLegacyOrphanSaleForRevenue(row as SaleRevenueRow)) as SaleRevenueRow[];
}

/** Serie mensual de facturación (preferir fetchDashboardBilling en el dashboard). */
export async function fetchMonthlyRevenueSeries(
  companyId: string,
  monthsBack: number,
): Promise<Array<{ monthStart: Date; monthEnd: Date; total: number }>> {
  const { series } = await fetchDashboardBilling(companyId, monthsBack);
  return series;
}
