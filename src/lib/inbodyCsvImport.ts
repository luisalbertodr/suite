import { parseCSV } from '@/components/marketing/csvParser';
import { supabase } from '@/lib/supabase';
import {
  dniMatchKeys,
  findCustomerIdByDniKeys,
  normInbodyUserId,
  type InbodyImpedanceFreq,
  type InbodySegmentalFat,
  type InbodySegmentalLean,
} from '@/lib/inbodyMeasurements';

export interface InbodyCsvImportRow {
  company_id: string;
  customer_id: string | null;
  inbody_user_id: string;
  measured_at: string;
  height_cm: number | null;
  age_years: number | null;
  sex: string | null;
  weight_kg: number | null;
  weight_min_kg: number | null;
  weight_max_kg: number | null;
  smm_kg: number | null;
  smm_min_kg: number | null;
  smm_max_kg: number | null;
  body_fat_kg: number | null;
  body_fat_min_kg: number | null;
  body_fat_max_kg: number | null;
  tbw_kg: number | null;
  tbw_min_kg: number | null;
  tbw_max_kg: number | null;
  ffm_kg: number | null;
  ffm_min_kg: number | null;
  ffm_max_kg: number | null;
  slm_kg: number | null;
  bmi: number | null;
  bmi_min: number | null;
  bmi_max: number | null;
  pbf_pct: number | null;
  pbf_min_pct: number | null;
  pbf_max_pct: number | null;
  whr: number | null;
  whr_min: number | null;
  whr_max: number | null;
  bmr_kcal: number | null;
  bmr_min_kcal: number | null;
  bmr_max_kcal: number | null;
  fat_control_kg: number | null;
  muscle_control_kg: number | null;
  segmental_lean: InbodySegmentalLean;
  segmental_fat: InbodySegmentalFat;
  impedance: Record<string, InbodyImpedanceFreq>;
  edema: Record<string, number | null>;
  bca: Record<string, unknown>;
  source: string;
  import_batch: string;
}

export interface InbodyCsvParseResult {
  rows: InbodyCsvImportRow[];
  errors: string[];
  skipped: number;
}

const HEADER_ALIASES: Record<string, string[]> = {
  user_id: ['user_id', 'userid', 'id', 'dni', 'identify_num', 'member_id', 'codigo'],
  measured_at: ['datetimes', 'datetime', 'fecha', 'date', 'measured_at', 'test_date', 'fecha_medicion'],
  height_cm: ['height', 'ht', 'altura'],
  age_years: ['age', 'edad'],
  sex: ['sex', 'gender', 'sexo'],
  weight_kg: ['weight', 'wt', 'pwt', 'peso'],
  weight_min_kg: ['wt_min', 'weight_min', 'peso_min'],
  weight_max_kg: ['wt_max', 'weight_max', 'peso_max'],
  smm_kg: ['smm', 'mme', 'masa_muscular_esqueletica'],
  smm_min_kg: ['smm_min', 'mme_min'],
  smm_max_kg: ['smm_max', 'mme_max'],
  body_fat_kg: ['bfm', 'fat', 'pfat', 'masa_grasa', 'grasa'],
  body_fat_min_kg: ['bfm_min', 'fat_min', 'pbfm_min'],
  body_fat_max_kg: ['bfm_max', 'fat_max', 'pbfm_max', 'pbfm_mAx'],
  tbw_kg: ['tbw', 'act', 'agua', 'agua_corporal_total'],
  tbw_min_kg: ['tbw_min', 'act_min'],
  tbw_max_kg: ['tbw_max', 'act_max'],
  ffm_kg: ['ffm', 'mlg', 'masa_libre_de_grasa'],
  ffm_min_kg: ['ffm_min', 'mlg_min'],
  ffm_max_kg: ['ffm_max', 'mlg_max'],
  slm_kg: ['slm', 'slbm'],
  bmi: ['bmi', 'imc'],
  bmi_min: ['bmi_min', 'imc_min'],
  bmi_max: ['bmi_max', 'imc_max'],
  pbf_pct: ['pbf', 'pgc', 'porcentaje_grasa', 'grasa_pct'],
  pbf_min_pct: ['pbf_min', 'pgc_min'],
  pbf_max_pct: ['pbf_max', 'pgc_max'],
  whr: ['whr', 'rcc', 'cintura_cadera'],
  whr_min: ['whr_min', 'rcc_min'],
  whr_max: ['whr_max', 'rcc_max'],
  bmr_kcal: ['bmr', 'mb', 'metabolismo_basal'],
  bmr_min_kcal: ['bmr_min', 'mb_min'],
  bmr_max_kcal: ['bmr_max', 'mb_max'],
  fat_control_kg: ['fc', 'fat_control', 'control_grasa'],
  muscle_control_kg: ['mc', 'muscle_control', 'control_musculo'],
  lra: ['lra', 'lean_ra', 'mme_bd'],
  lla: ['lla', 'lean_la', 'mme_bi'],
  lt: ['lt', 'lean_t', 'mme_tr'],
  lrl: ['lrl', 'lean_rl', 'mme_pd'],
  lll: ['lll', 'lean_ll', 'mme_pi'],
  plra: ['plra'],
  plla: ['plla'],
  plt: ['plt'],
  plrl: ['plrl'],
  plll: ['plll'],
  fra: ['fra', 'fat_ra'],
  fla: ['fla', 'fat_la'],
  ft: ['ft', 'fat_t'],
  frl: ['frl', 'fat_rl'],
  fll: ['fll', 'fat_ll'],
  pbfra: ['pbfra'],
  pbfla: ['pbfla'],
  pbft: ['pbft'],
  pbfrl: ['pbfrl'],
  pbfll: ['pbfill', 'pbfll'],
  ira20: ['ira20'],
  ila20: ['ila20'],
  it20: ['it20'],
  irl20: ['irl20'],
  ill20: ['ill20'],
  ira100: ['ira100'],
  ila100: ['ila100'],
  it100: ['it100'],
  irl100: ['irl100'],
  ill100: ['ill100'],
};

function normalizeHeader(header: string): string {
  return (header || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const counts = {
    ',': (firstLine.match(/,/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  };
  if (counts[';'] >= counts[','] && counts[';'] >= counts['\t'] && counts[';'] > 0) return ';';
  if (counts['\t'] >= counts[','] && counts['\t'] > 0) return '\t';
  return ',';
}

function parseDelimited(text: string, delimiter: ',' | ';' | '\t'): string[][] {
  if (delimiter === ',') return parseCSV(text);
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, '')));
}

function toFloat(value: string | undefined): number | null {
  if (value == null) return null;
  const s = value.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pick(row: Record<string, string>, field: string): string | undefined {
  const aliases = HEADER_ALIASES[field] || [field];
  for (const alias of aliases) {
    if (row[alias] != null && row[alias] !== '') return row[alias];
  }
  return undefined;
}

function pickFloat(row: Record<string, string>, field: string): number | null {
  return toFloat(pick(row, field));
}

function parseMeasuredAt(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (/^\d{14}$/.test(s)) {
    const y = s.slice(0, 4);
    const mo = s.slice(4, 6);
    const d = s.slice(6, 8);
    const h = s.slice(8, 10);
    const mi = s.slice(10, 12);
    const sec = s.slice(12, 14);
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}`).toISOString();
  }
  const eu = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (eu) {
    const [, dd, mm, yyyy, hh = '0', min = '0', sec = '0'] = eu;
    return new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(sec),
    ).toISOString();
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return null;
}

function buildSegmentalLean(row: Record<string, string>): InbodySegmentalLean {
  return {
    right_arm: { kg: pickFloat(row, 'lra'), pct: pickFloat(row, 'plra') },
    left_arm: { kg: pickFloat(row, 'lla'), pct: pickFloat(row, 'plla') },
    trunk: { kg: pickFloat(row, 'lt'), pct: pickFloat(row, 'plt') },
    right_leg: { kg: pickFloat(row, 'lrl'), pct: pickFloat(row, 'plrl') },
    left_leg: { kg: pickFloat(row, 'lll'), pct: pickFloat(row, 'plll') },
  };
}

function buildSegmentalFat(row: Record<string, string>): InbodySegmentalFat {
  return {
    right_arm: { kg: pickFloat(row, 'fra'), pct: pickFloat(row, 'pbfra') },
    left_arm: { kg: pickFloat(row, 'fla'), pct: pickFloat(row, 'pbfla') },
    trunk: { kg: pickFloat(row, 'ft'), pct: pickFloat(row, 'pbft') },
    right_leg: { kg: pickFloat(row, 'frl'), pct: pickFloat(row, 'pbfrl') },
    left_leg: { kg: pickFloat(row, 'fll'), pct: pickFloat(row, 'pbfll') },
  };
}

function buildImpedance(row: Record<string, string>): Record<string, InbodyImpedanceFreq> {
  const out: Record<string, InbodyImpedanceFreq> = {};
  const f20: InbodyImpedanceFreq = {
    right_arm: pickFloat(row, 'ira20'),
    left_arm: pickFloat(row, 'ila20'),
    trunk: pickFloat(row, 'it20'),
    right_leg: pickFloat(row, 'irl20'),
    left_leg: pickFloat(row, 'ill20'),
  };
  const f100: InbodyImpedanceFreq = {
    right_arm: pickFloat(row, 'ira100'),
    left_arm: pickFloat(row, 'ila100'),
    trunk: pickFloat(row, 'it100'),
    right_leg: pickFloat(row, 'irl100'),
    left_leg: pickFloat(row, 'ill100'),
  };
  if (Object.values(f20).some((v) => v != null)) out['20khz'] = f20;
  if (Object.values(f100).some((v) => v != null)) out['100khz'] = f100;
  return out;
}

function mapHeaders(headers: string[]): Record<number, string> {
  const aliasToField = new Map<string, string>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) aliasToField.set(alias, field);
  }
  const mapped: Record<number, string> = {};
  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    mapped[idx] = aliasToField.get(norm) || norm;
  });
  return mapped;
}

export function parseInbodyCsv(
  text: string,
  companyId: string,
  customerByTax: Map<string, string>,
  importBatch: string,
): InbodyCsvParseResult {
  const delimiter = detectDelimiter(text);
  const table = parseDelimited(text, delimiter);
  const errors: string[] = [];
  let skipped = 0;

  if (table.length < 2) {
    return { rows: [], errors: ['El CSV está vacío o no tiene filas de datos.'], skipped: 0 };
  }

  const headerMap = mapHeaders(table[0]);
  const rows: InbodyCsvImportRow[] = [];

  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    if (!cells.some((c) => c.trim())) continue;

    const raw: Record<string, string> = {};
    cells.forEach((cell, idx) => {
      const key = headerMap[idx];
      if (key) raw[key] = cell.trim();
    });

    const userRaw = pick(raw, 'user_id');
    const userId = userRaw ? normInbodyUserId(userRaw) : '';
    const measuredAt = parseMeasuredAt(pick(raw, 'measured_at'));

    if (!userId) {
      skipped++;
      errors.push(`Fila ${i + 1}: falta ID de usuario / DNI.`);
      continue;
    }
    if (!measuredAt) {
      skipped++;
      errors.push(`Fila ${i + 1}: fecha inválida (${pick(raw, 'measured_at') || 'vacía'}).`);
      continue;
    }

    const customerId = findCustomerIdByDniKeys(userId, customerByTax);

    rows.push({
      company_id: companyId,
      customer_id: customerId,
      inbody_user_id: userId,
      measured_at: measuredAt,
      height_cm: pickFloat(raw, 'height_cm'),
      age_years: pickFloat(raw, 'age_years'),
      sex: pick(raw, 'sex') || null,
      weight_kg: pickFloat(raw, 'weight_kg'),
      weight_min_kg: pickFloat(raw, 'weight_min_kg'),
      weight_max_kg: pickFloat(raw, 'weight_max_kg'),
      smm_kg: pickFloat(raw, 'smm_kg'),
      smm_min_kg: pickFloat(raw, 'smm_min_kg'),
      smm_max_kg: pickFloat(raw, 'smm_max_kg'),
      body_fat_kg: pickFloat(raw, 'body_fat_kg'),
      body_fat_min_kg: pickFloat(raw, 'body_fat_min_kg'),
      body_fat_max_kg: pickFloat(raw, 'body_fat_max_kg'),
      tbw_kg: pickFloat(raw, 'tbw_kg'),
      tbw_min_kg: pickFloat(raw, 'tbw_min_kg'),
      tbw_max_kg: pickFloat(raw, 'tbw_max_kg'),
      ffm_kg: pickFloat(raw, 'ffm_kg'),
      ffm_min_kg: pickFloat(raw, 'ffm_min_kg'),
      ffm_max_kg: pickFloat(raw, 'ffm_max_kg'),
      slm_kg: pickFloat(raw, 'slm_kg'),
      bmi: pickFloat(raw, 'bmi'),
      bmi_min: pickFloat(raw, 'bmi_min'),
      bmi_max: pickFloat(raw, 'bmi_max'),
      pbf_pct: pickFloat(raw, 'pbf_pct'),
      pbf_min_pct: pickFloat(raw, 'pbf_min_pct'),
      pbf_max_pct: pickFloat(raw, 'pbf_max_pct'),
      whr: pickFloat(raw, 'whr'),
      whr_min: pickFloat(raw, 'whr_min'),
      whr_max: pickFloat(raw, 'whr_max'),
      bmr_kcal: pickFloat(raw, 'bmr_kcal'),
      bmr_min_kcal: pickFloat(raw, 'bmr_min_kcal'),
      bmr_max_kcal: pickFloat(raw, 'bmr_max_kcal'),
      fat_control_kg: pickFloat(raw, 'fat_control_kg'),
      muscle_control_kg: pickFloat(raw, 'muscle_control_kg'),
      segmental_lean: buildSegmentalLean(raw),
      segmental_fat: buildSegmentalFat(raw),
      impedance: buildImpedance(raw),
      edema: {},
      bca: raw,
      source: 'lookinbody_csv',
      import_batch: importBatch,
    });
  }

  return { rows, errors, skipped };
}

export async function loadCustomerTaxMap(companyId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, tax_id')
    .eq('company_id', companyId)
    .not('tax_id', 'is', null);

  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data || []) {
    for (const key of dniMatchKeys(row.tax_id)) {
      if (!map.has(key)) map.set(key, row.id);
    }
  }
  return map;
}

export async function upsertInbodyCsvRows(rows: InbodyCsvImportRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const chunkSize = 100;
  let total = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) => ({
      ...row,
      bca: row.bca,
      mfa: {},
      lb: { segmental_lean: row.segmental_lean, segmental_fat: row.segmental_fat },
      wc: {},
      imp: row.impedance,
      ed: row.edema,
    }));

    const { error } = await (supabase as any).from('inbody_measurements').upsert(chunk, {
      onConflict: 'company_id,inbody_user_id,measured_at',
    });
    if (error) throw error;
    total += chunk.length;
  }

  return total;
}
