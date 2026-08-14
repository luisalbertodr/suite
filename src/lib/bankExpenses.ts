import { supabase } from '@/lib/supabase';
import {
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
} from '@/lib/workCenterBilling';
import type {
  ComparisonPeriod,
  DailyBillingRow,
  YearBillingRow,
} from '@/lib/salesRevenue';

/** Devolución de fondos aportados: no cuenta como gasto. */
export const CONTRIBUTION_RETURN_CONCEPT =
  'Transferencia Inmediata A Favor de Diaz Rodriguez Luis Alberto';

/** Traspaso Estética → SL Medicina: no es gasto operativo (luego se devuelve). */
export const SL_INTERNAL_TRANSFER_CONCEPT =
  'Transferencia Inmediata A Favor De Delgado Lamas Medicina Estética';

const PAGE = 1000;

export type BankEntity = 'medicina' | 'estetica';

export type BankMovementKind =
  | 'expense'
  | 'contribution_return'
  | 'internal_transfer'
  | 'income'
  | 'other';

export type ParsedBankMovement = {
  movementDate: string;
  concept: string;
  amount: number;
  isExpense: boolean;
  isContributionReturn: boolean;
  isInternalTransfer: boolean;
  fingerprint: string;
};

export type BankExpenseSplit = {
  medicina: Map<number, number>;
  estetica: Map<number, number>;
};

export type BankExpenseDaySplit = {
  medicina: Map<string, number>;
  estetica: Map<string, number>;
};

export type BankMovementListRow = {
  id: string;
  company_id: string;
  movement_date: string;
  concept: string;
  amount: number;
  is_expense: boolean;
  is_contribution_return: boolean;
  source_filename: string | null;
  created_at: string;
};

export type BankMovementListFilters = {
  entity?: BankEntity | 'all';
  dateFrom?: string | null;
  dateTo?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  concept?: string | null;
  limit?: number;
};

type RpcExpenseMonthRow = {
  month_num: number;
  month_key: string;
  company_id: string;
  total: number;
};

type RpcExpenseDayRow = {
  day_date: string;
  day_key: string;
  company_id: string;
  total: number;
};

export function companyIdForBankEntity(entity: BankEntity): string {
  return entity === 'medicina' ? MEDICINA_COMPANY_ID : ESTETICA_COMPANY_ID;
}

export function normalizeBankConcept(concept: string): string {
  return String(concept ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isContributionReturnConcept(concept: string): boolean {
  const needle = normalizeBankConcept(CONTRIBUTION_RETURN_CONCEPT);
  return normalizeBankConcept(concept).includes(needle);
}

/**
 * Traspasos internos / a cuenta particular: no restan del beneficio.
 * - Transferencia inmediata a favor de Delgado Lamas Medicina (Estética → SL)
 * - Conceptos «Traspaso …» (p. ej. a cuenta particular)
 */
export function isInternalOrPersonalTransferConcept(concept: string): boolean {
  const n = normalizeBankConcept(concept);
  if (!n) return false;
  if (n.includes('transferencia inmediata a favor de delgado lamas medicina')) return true;
  if (/\btraspaso\b/.test(n)) return true;
  return false;
}

export function classifyBankAmount(
  concept: string,
  amount: number,
): {
  isExpense: boolean;
  isContributionReturn: boolean;
  isInternalTransfer: boolean;
} {
  const isContributionReturn = isContributionReturnConcept(concept);
  const isInternalTransfer =
    !isContributionReturn && isInternalOrPersonalTransferConcept(concept);
  const isExpense = amount < 0 && !isContributionReturn && !isInternalTransfer;
  return { isExpense, isContributionReturn, isInternalTransfer };
}

export function bankMovementKind(row: {
  concept: string;
  amount: number;
  is_expense: boolean;
  is_contribution_return: boolean;
}): BankMovementKind {
  if (row.is_contribution_return || isContributionReturnConcept(row.concept)) {
    return 'contribution_return';
  }
  if (isInternalOrPersonalTransferConcept(row.concept)) return 'internal_transfer';
  if (row.is_expense) return 'expense';
  if (row.amount > 0) return 'income';
  return 'other';
}

/** Importe ES/EU: 1.234,56 | -1234,56 | 1,234.56 | (123.45) */
export function parseBankAmount(raw: string): number | null {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  const paren = /^\((.+)\)$/.exec(s);
  if (paren) s = `-${paren[1]!.trim()}`;
  s = s.replace(/\s/g, '').replace(/€/g, '').replace(/EUR/gi, '');
  if (!s || s === '-' || s === '+') return null;

  const neg = s.startsWith('-');
  const pos = s.startsWith('+');
  if (neg || pos) s = s.slice(1);

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    s = decimals <= 2 ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    if (decimals > 2) s = s.replace(/\./g, '');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Fecha DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD */
export function parseBankDate(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/.exec(s);
  if (!dmy) return null;
  let year = Number(dmy[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const month = String(Number(dmy[2])).padStart(2, '0');
  const day = String(Number(dmy[1])).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function detectDelimiter(headerLine: string): ';' | ',' | '\t' {
  const sc = (headerLine.match(/;/g) ?? []).length;
  const cc = (headerLine.match(/,/g) ?? []).length;
  const tc = (headerLine.match(/\t/g) ?? []).length;
  if (tc >= sc && tc >= cc && tc > 0) return '\t';
  if (sc >= cc) return ';';
  return ',';
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      out.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  out.push(field);
  return out.map((v) => v.trim());
}

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const DATE_HEADERS_PRIORITY = [
  'fecha_operacion',
  'fecha',
  'f_operacion',
  'operation_date',
  'fecha_valor',
  'f_valor',
  'value_date',
  'date',
] as const;

const CONCEPT_HEADERS = new Set([
  'concepto',
  'descripcion',
  'description',
  'detalle',
  'narrativa',
  'concept',
  'movimiento',
]);

const AMOUNT_HEADERS_PRIORITY = [
  'importe',
  'importe_eur',
  'importe_euros',
  'amount',
  'cantidad',
  'cargo',
  'abono',
] as const;

function findHeaderIndex(headers: string[], priority: readonly string[]): number {
  for (const key of priority) {
    const idx = headers.indexOf(key);
    if (idx >= 0) return idx;
  }
  return -1;
}

function findConceptIndex(headers: string[]): number {
  for (let i = 0; i < headers.length; i += 1) {
    if (CONCEPT_HEADERS.has(headers[i]!)) return i;
  }
  return headers.findIndex((h) => h.includes('concepto') || h.includes('descripcion'));
}

function findAmountIndex(headers: string[]): number {
  const exact = findHeaderIndex(headers, AMOUNT_HEADERS_PRIORITY);
  if (exact >= 0) return exact;
  // No usar "saldo" ni "fecha_valor": solo columnas de importe.
  return headers.findIndex((h) => h.startsWith('importe') || h === 'amount');
}

function findDateIndex(headers: string[]): number {
  const exact = findHeaderIndex(headers, DATE_HEADERS_PRIORITY);
  if (exact >= 0) return exact;
  return headers.findIndex(
    (h) =>
      h.startsWith('fecha') &&
      !h.includes('hasta') &&
      !h.includes('desde') &&
      !h.includes('export'),
  );
}

function looksLikeMovementsHeader(headers: string[]): boolean {
  const dateIdx = findDateIndex(headers);
  const conceptIdx = findConceptIndex(headers);
  const amountIdx = findAmountIndex(headers);
  if (dateIdx < 0 || conceptIdx < 0 || amountIdx < 0) return false;
  // Evitar filas de metadatos tipo "Titular,Saldo disponible,Saldo real"
  const joined = headers.join('|');
  if (joined.includes('titular') && joined.includes('saldo') && !joined.includes('concepto')) {
    return false;
  }
  return true;
}

/**
 * Localiza la fila de cabecera real (Santander One / Medicina / Estética
 * incluyen preámbulo con cuenta, titular y saldos).
 */
function findMovementsHeaderRow(lines: string[]): {
  headerIndex: number;
  delimiter: ';' | ',' | '\t';
  headers: string[];
  dateIdx: number;
  conceptIdx: number;
  amountIdx: number;
} | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    // Las cabeceras reales mencionan Fecha/Concepto/Importe; el preámbulo no.
    const lower = line.toLowerCase();
    if (!lower.includes('concepto') || !lower.includes('importe')) continue;
    if (!lower.includes('fecha')) continue;

    const delimiter = detectDelimiter(line);
    const headers = splitCsvLine(line, delimiter).map(normalizeHeader);
    if (!looksLikeMovementsHeader(headers)) continue;

    const dateIdx = findDateIndex(headers);
    const conceptIdx = findConceptIndex(headers);
    const amountIdx = findAmountIndex(headers);
    if (dateIdx < 0 || conceptIdx < 0 || amountIdx < 0) continue;

    return { headerIndex: i, delimiter, headers, dateIdx, conceptIdx, amountIdx };
  }
  return null;
}

export function bankMovementFingerprint(
  movementDate: string,
  concept: string,
  amount: number,
): string {
  const amt = amount.toFixed(2);
  return `${movementDate}|${normalizeBankConcept(concept)}|${amt}`;
}

/**
 * Parsea extractos Santander One Empresa (Medicina / Estética) y CSV genéricos ES.
 * Ignora el preámbulo (titular, IBAN, saldos) hasta la cabecera de movimientos.
 */
export function parseBankMovementsCsv(text: string): {
  rows: ParsedBankMovement[];
  errors: string[];
} {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: ['El archivo no tiene filas de datos.'] };
  }

  const header = findMovementsHeaderRow(lines);
  if (!header) {
    return {
      rows: [],
      errors: [
        'No se encontró la cabecera de movimientos (Fecha / Concepto / Importe). Revisa el CSV de Santander.',
      ],
    };
  }

  const { headerIndex, delimiter, dateIdx, conceptIdx, amountIdx } = header;
  const rows: ParsedBankMovement[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]!, delimiter);
    if (cols.every((c) => !c.trim())) continue;

    // Filas residuales de metadatos / totales
    const first = (cols[dateIdx] ?? '').trim();
    if (!first || /^movimientos/i.test(first) || /^titular/i.test(first)) continue;

    const movementDate = parseBankDate(cols[dateIdx] ?? '');
    const amount = parseBankAmount(cols[amountIdx] ?? '');
    const concept = String(cols[conceptIdx] ?? '').trim();
    if (!movementDate || amount == null) {
      // No bombardear con errores de filas vacías o basura residual
      if (first || concept) {
        errors.push(`Fila ${i + 1}: fecha o importe inválidos («${first}» / «${cols[amountIdx] ?? ''}»).`);
      }
      continue;
    }
    const { isExpense, isContributionReturn, isInternalTransfer } = classifyBankAmount(
      concept,
      amount,
    );
    const fingerprint = bankMovementFingerprint(movementDate, concept, amount);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    rows.push({
      movementDate,
      concept,
      amount,
      isExpense,
      isContributionReturn,
      isInternalTransfer,
      fingerprint,
    });
  }

  return { rows, errors };
}

export async function importBankMovements(params: {
  entity: BankEntity;
  rows: ParsedBankMovement[];
  sourceFilename?: string;
}): Promise<{ inserted: number; skipped: number; expenseTotal: number }> {
  const companyId = companyIdForBankEntity(params.entity);
  const batchId = crypto.randomUUID();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let inserted = 0;
  let skipped = 0;
  let expenseTotal = 0;

  for (let offset = 0; offset < params.rows.length; offset += PAGE) {
    const chunk = params.rows.slice(offset, offset + PAGE);
    const payload = chunk.map((row) => ({
      company_id: companyId,
      movement_date: row.movementDate,
      concept: row.concept,
      amount: row.amount,
      is_expense: row.isExpense,
      is_contribution_return: row.isContributionReturn,
      fingerprint: row.fingerprint,
      source_filename: params.sourceFilename ?? null,
      import_batch_id: batchId,
      created_by: user?.id ?? null,
    }));

    // Actualiza flags al reimportar (reclasifica gastos / exclusiones).
    const { data, error } = await supabase
      .from('bank_movements')
      .upsert(payload, { onConflict: 'company_id,fingerprint' })
      .select('id, is_expense, amount');

    if (error) throw error;
    const got = data?.length ?? 0;
    inserted += got;
    skipped += Math.max(0, chunk.length - got);
    for (const row of data ?? []) {
      if (row.is_expense) expenseTotal += Math.abs(Number(row.amount ?? 0));
    }
  }

  return { inserted, skipped, expenseTotal };
}

export async function listBankMovements(
  filters: BankMovementListFilters = {},
): Promise<BankMovementListRow[]> {
  const entity = filters.entity ?? 'all';
  const limit = filters.limit ?? 2000;

  let query = supabase
    .from('bank_movements')
    .select(
      'id, company_id, movement_date, concept, amount, is_expense, is_contribution_return, source_filename, created_at',
    )
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entity !== 'all') {
    query = query.eq('company_id', companyIdForBankEntity(entity));
  } else {
    query = query.in('company_id', [MEDICINA_COMPANY_ID, ESTETICA_COMPANY_ID]);
  }

  if (filters.dateFrom) query = query.gte('movement_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('movement_date', filters.dateTo);
  if (filters.amountMin != null && Number.isFinite(filters.amountMin)) {
    query = query.gte('amount', filters.amountMin);
  }
  if (filters.amountMax != null && Number.isFinite(filters.amountMax)) {
    query = query.lte('amount', filters.amountMax);
  }
  const concept = filters.concept?.trim();
  if (concept) query = query.ilike('concept', `%${concept}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BankMovementListRow[];
}

export async function summarizeBankExpenses(entity: BankEntity | 'all'): Promise<{
  expenseCount: number;
  expenseTotal: number;
  contributionReturnCount: number;
  movementCount: number;
}> {
  let query = supabase
    .from('bank_movements')
    .select('amount, is_expense, is_contribution_return');

  if (entity !== 'all') {
    query = query.eq('company_id', companyIdForBankEntity(entity));
  } else {
    query = query.in('company_id', [MEDICINA_COMPANY_ID, ESTETICA_COMPANY_ID]);
  }

  const { data, error } = await query;
  if (error) throw error;
  let expenseCount = 0;
  let expenseTotal = 0;
  let contributionReturnCount = 0;
  for (const row of data ?? []) {
    if (row.is_contribution_return) contributionReturnCount += 1;
    if (row.is_expense) {
      expenseCount += 1;
      expenseTotal += Math.abs(Number(row.amount ?? 0));
    }
  }
  return {
    expenseCount,
    expenseTotal,
    contributionReturnCount,
    movementCount: data?.length ?? 0,
  };
}

export async function fetchBankExpenseTotalForPeriod(opts: {
  fromDate: string;
  toDate: string;
  /** null/undefined = Medicina + Estética */
  companyId?: string | null;
}): Promise<number> {
  let query = supabase
    .from('bank_movements')
    .select('amount')
    .eq('is_expense', true)
    .gte('movement_date', opts.fromDate)
    .lte('movement_date', opts.toDate);

  if (opts.companyId) {
    query = query.eq('company_id', opts.companyId);
  } else {
    query = query.in('company_id', [MEDICINA_COMPANY_ID, ESTETICA_COMPANY_ID]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);
}

function emptyMonthSplit(): BankExpenseSplit {
  return { medicina: new Map(), estetica: new Map() };
}

export async function fetchBankExpensesMonthly(year: number): Promise<BankExpenseSplit> {
  const out = emptyMonthSplit();
  try {
    const { data, error } = await supabase.rpc('dashboard_bank_expenses_monthly', {
      p_year: year,
    });
    if (error) throw error;
    for (const row of (data ?? []) as RpcExpenseMonthRow[]) {
      const total = Number(row.total ?? 0);
      if (row.company_id === MEDICINA_COMPANY_ID) {
        out.medicina.set(row.month_num, (out.medicina.get(row.month_num) ?? 0) + total);
      } else if (row.company_id === ESTETICA_COMPANY_ID) {
        out.estetica.set(row.month_num, (out.estetica.get(row.month_num) ?? 0) + total);
      }
    }
    return out;
  } catch {
    const { data, error } = await supabase
      .from('bank_movements')
      .select('company_id, movement_date, amount')
      .eq('is_expense', true)
      .gte('movement_date', `${year}-01-01`)
      .lte('movement_date', `${year}-12-31`);
    if (error) throw error;
    for (const row of data ?? []) {
      const monthNum = Number(String(row.movement_date).slice(5, 7));
      const total = Math.abs(Number(row.amount ?? 0));
      if (row.company_id === MEDICINA_COMPANY_ID) {
        out.medicina.set(monthNum, (out.medicina.get(monthNum) ?? 0) + total);
      } else if (row.company_id === ESTETICA_COMPANY_ID) {
        out.estetica.set(monthNum, (out.estetica.get(monthNum) ?? 0) + total);
      }
    }
    return out;
  }
}

export async function fetchBankExpensesDaily(
  fromDate: string,
  toDate: string,
): Promise<BankExpenseDaySplit> {
  const out: BankExpenseDaySplit = {
    medicina: new Map(),
    estetica: new Map(),
  };
  try {
    const { data, error } = await supabase.rpc('dashboard_bank_expenses_daily', {
      p_from_date: fromDate,
      p_to_date: toDate,
    });
    if (error) throw error;
    for (const row of (data ?? []) as RpcExpenseDayRow[]) {
      const total = Number(row.total ?? 0);
      if (row.company_id === MEDICINA_COMPANY_ID) {
        out.medicina.set(row.day_key, (out.medicina.get(row.day_key) ?? 0) + total);
      } else if (row.company_id === ESTETICA_COMPANY_ID) {
        out.estetica.set(row.day_key, (out.estetica.get(row.day_key) ?? 0) + total);
      }
    }
    return out;
  } catch {
    const { data, error } = await supabase
      .from('bank_movements')
      .select('company_id, movement_date, amount')
      .eq('is_expense', true)
      .gte('movement_date', fromDate)
      .lte('movement_date', toDate);
    if (error) throw error;
    for (const row of data ?? []) {
      const dayKey = String(row.movement_date).slice(0, 10);
      const total = Math.abs(Number(row.amount ?? 0));
      if (row.company_id === MEDICINA_COMPANY_ID) {
        out.medicina.set(dayKey, (out.medicina.get(dayKey) ?? 0) + total);
      } else if (row.company_id === ESTETICA_COMPANY_ID) {
        out.estetica.set(dayKey, (out.estetica.get(dayKey) ?? 0) + total);
      }
    }
    return out;
  }
}

function num(row: YearBillingRow | DailyBillingRow, key: string): number {
  return Number(row[key] ?? 0);
}

/** Añade claves gasto/beneficio a filas mensuales ya cargadas. */
export function enrichYearBillingWithExpenses(
  rows: YearBillingRow[],
  years: number[],
  byYear: Map<number, BankExpenseSplit>,
): YearBillingRow[] {
  return rows.map((row) => {
    const next: YearBillingRow = { ...row };
    const monthNum = row.monthNum;
    for (const year of years) {
      const split = byYear.get(year);
      const gastoMed = split?.medicina.get(monthNum) ?? 0;
      const gastoEst = split?.estetica.get(monthNum) ?? 0;
      const gasto = gastoMed + gastoEst;
      const factMed = num(row, `${year}_medicina`);
      const factEst = num(row, `${year}_estetica`);
      const fact = num(row, String(year));
      next[`${year}_gasto_medicina`] = gastoMed;
      next[`${year}_gasto_estetica`] = gastoEst;
      next[`${year}_gasto`] = gasto;
      next[`${year}_beneficio_medicina`] = factMed - gastoMed;
      next[`${year}_beneficio_estetica`] = factEst - gastoEst;
      next[`${year}_beneficio`] = fact - gasto;
    }
    return next;
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function dailyExpenseDayKey(
  row: DailyBillingRow,
  year: number,
  period: ComparisonPeriod,
): string | null {
  if (period.mode === 'rolling') {
    if (row.dayKey && /^\d{4}-\d{2}-\d{2}$/.test(row.dayKey)) {
      return `${year}-${row.dayKey.slice(5)}`;
    }
    return null;
  }
  const day = Number(row.name);
  if (!Number.isFinite(day) || day < 1) return null;
  const daysInMonth = new Date(year, period.month, 0).getDate();
  if (day > daysInMonth) return null;
  return `${year}-${pad2(period.month)}-${pad2(day)}`;
}

/** Añade claves gasto/beneficio a filas diarias de comparativa. */
export function enrichDailyBillingWithExpenses(
  rows: DailyBillingRow[],
  years: number[],
  expenses: BankExpenseDaySplit,
  period: ComparisonPeriod,
): DailyBillingRow[] {
  return rows.map((row) => {
    const next: DailyBillingRow = { ...row };
    for (const year of years) {
      const dayKey = dailyExpenseDayKey(row, year, period);
      const gastoMed = dayKey ? expenses.medicina.get(dayKey) ?? 0 : 0;
      const gastoEst = dayKey ? expenses.estetica.get(dayKey) ?? 0 : 0;
      const gasto = gastoMed + gastoEst;
      const factMed = num(row, `${year}_medicina`);
      const factEst = num(row, `${year}_estetica`);
      const fact = num(row, String(year));
      next[`${year}_gasto_medicina`] = gastoMed;
      next[`${year}_gasto_estetica`] = gastoEst;
      next[`${year}_gasto`] = gasto;
      next[`${year}_beneficio_medicina`] = factMed - gastoMed;
      next[`${year}_beneficio_estetica`] = factEst - gastoEst;
      next[`${year}_beneficio`] = fact - gasto;
    }
    return next;
  });
}
