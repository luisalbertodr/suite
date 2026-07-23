/**
 * Ingestión de mediciones de báscula (MorphoScan Nova vía puente Bluetooth, u otras).
 *
 * POST https://supabase.lipoout.com/functions/v1/scale-ingest
 * Auth: header X-Scale-Ingest-Secret (= SCALE_INGEST_SECRET) o Bearer con el mismo secret.
 *
 * El Edge Runtime no habla Bluetooth: un puente local (app/PC) captura BLE y POSTea aquí.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-scale-ingest-secret, x-suite-company-id, x-suite-scale-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

const SPANISH_DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

type DeviceKind = 'inbody' | 'morphoscan';

type ScaleIngestBody = {
  company_id?: string;
  customer_id?: string | null;
  tax_id?: string | null;
  inbody_user_id?: string | null;
  external_user_id?: string | null;
  measured_at?: string;
  device?: string;
  source?: string;
  import_batch?: string;

  height_cm?: number | null;
  age_years?: number | null;
  sex?: string | null;

  weight_kg?: number | null;
  smm_kg?: number | null;
  body_fat_kg?: number | null;
  tbw_kg?: number | null;
  ffm_kg?: number | null;
  slm_kg?: number | null;
  bmi?: number | null;
  pbf_pct?: number | null;
  whr?: number | null;
  bmr_kcal?: number | null;
  fat_control_kg?: number | null;
  muscle_control_kg?: number | null;
  weight_control_kg?: number | null;
  target_weight_kg?: number | null;

  bone_mass_kg?: number | null;
  protein_mass_kg?: number | null;
  protein_pct?: number | null;
  body_water_pct?: number | null;
  visceral_fat_index?: number | null;
  subcutaneous_fat_pct?: number | null;
  metabolic_age?: number | null;
  smi?: number | null;
  body_type?: string | null;
  heart_rate?: number | null;

  segmental_lean?: Record<string, unknown>;
  segmental_fat?: Record<string, unknown>;
  impedance?: Record<string, unknown>;
  edema?: Record<string, unknown>;

  /** Alias frecuentes del puente BLE / Renpho / ble-scale-sync */
  weight?: number | null;
  bodyfat?: number | null;
  body_fat_pct?: number | null;
  bodyFatPercent?: number | null;
  muscle?: number | null;
  muscle_mass_kg?: number | null;
  muscleMass?: number | null;
  water?: number | null;
  water_pct?: number | null;
  waterPercent?: number | null;
  bone?: number | null;
  boneMass?: number | null;
  bmr?: number | null;
  visceral?: number | null;
  visceral_fat?: number | null;
  visceralFat?: number | null;
  subcutaneous?: number | null;
  bodyage?: number | null;
  metabolicAge?: number | null;
  heartrate?: number | null;
  physiqueRating?: number | null;
  /** ble-scale-sync usa `timestamp` en lugar de `measured_at` */
  timestamp?: string | null;
  impedance_ohm?: number | null;
  user_name?: string | null;
  user_slug?: string | null;

  raw?: Record<string, unknown>;
  raw_payload?: Record<string, unknown>;
};

/** Payload nativo de ble-scale-sync WebhookExporter (BodyComposition + user_*). */
function normalizeIncomingBody(
  raw: Record<string, unknown>,
  req: Request,
): ScaleIngestBody {
  const body = { ...raw } as ScaleIngestBody;

  // company_id puede venir en body, query o header (ble-scale-sync no tiene body_template)
  if (!asString(body.company_id)) {
    const fromHeader = req.headers.get('x-suite-company-id')?.trim();
    const fromQuery = new URL(req.url).searchParams.get('company_id')?.trim();
    body.company_id = fromHeader || fromQuery || undefined;
  }

  if (!asString(body.external_user_id)) {
    const fromHeader = req.headers.get('x-suite-scale-id')?.trim();
    const slug = asString(body.user_slug);
    body.external_user_id = fromHeader || (slug ? `scale-${slug}` : undefined);
  }

  if (!asString(body.device)) body.device = 'morphoscan';
  if (!asString(body.source)) body.source = 'ble-scale-sync';

  // Campos camelCase del webhook nativo
  if (asNumber(body.weight_kg) == null && asNumber(raw.weight) != null) {
    body.weight_kg = asNumber(raw.weight);
  }
  if (asNumber(body.body_fat_pct) == null && asNumber(raw.bodyFatPercent) != null) {
    body.body_fat_pct = asNumber(raw.bodyFatPercent);
  }
  if (asNumber(body.muscle_mass_kg) == null && asNumber(raw.muscleMass) != null) {
    body.muscle_mass_kg = asNumber(raw.muscleMass);
  }
  if (asNumber(body.water_pct) == null && asNumber(raw.waterPercent) != null) {
    body.water_pct = asNumber(raw.waterPercent);
  }
  if (asNumber(body.bone_mass_kg) == null && asNumber(raw.boneMass) != null) {
    body.bone_mass_kg = asNumber(raw.boneMass);
  }
  if (asNumber(body.visceral_fat) == null && asNumber(raw.visceralFat) != null) {
    body.visceral_fat = asNumber(raw.visceralFat);
  }
  if (asNumber(body.metabolic_age) == null && asNumber(raw.metabolicAge) != null) {
    body.metabolic_age = asNumber(raw.metabolicAge);
  }
  if (asNumber(body.bmr_kcal) == null && asNumber(raw.bmr) != null) {
    body.bmr_kcal = asNumber(raw.bmr);
  }
  if (asNumber(body.protein_pct) == null && asNumber(raw.proteinPercent) != null) {
    body.protein_pct = asNumber(raw.proteinPercent);
  }
  if (asNumber(body.protein_mass_kg) == null && asNumber(raw.proteinMassKg) != null) {
    body.protein_mass_kg = asNumber(raw.proteinMassKg);
  }
  if (asNumber(body.subcutaneous_fat_pct) == null && asNumber(raw.subcutaneousFatPercent) != null) {
    body.subcutaneous_fat_pct = asNumber(raw.subcutaneousFatPercent);
  }
  if (asNumber(body.smm_kg) == null && asNumber(raw.smmKg) != null) {
    body.smm_kg = asNumber(raw.smmKg);
  }
  // Renpho "masa muscular" ≈ soft lean (SLM), NOT skeletal muscle (SMM)
  if (asNumber(body.slm_kg) == null && asNumber(raw.muscleMass) != null) {
    body.slm_kg = asNumber(raw.muscleMass);
  }
  if (asNumber(body.ffm_kg) == null && asNumber(raw.ffmKg) != null) {
    body.ffm_kg = asNumber(raw.ffmKg);
  }
  if (asNumber(body.body_fat_kg) == null && asNumber(raw.bodyFatKg) != null) {
    body.body_fat_kg = asNumber(raw.bodyFatKg);
  }
  // Segmental DF-BIA map from MorphoScan adapter
  if (raw.impedance && typeof raw.impedance === 'object' && !Array.isArray(raw.impedance)) {
    body.impedance = raw.impedance as Record<string, unknown>;
  }
  if (raw.segmental_lean && typeof raw.segmental_lean === 'object') {
    body.segmental_lean = raw.segmental_lean as Record<string, unknown>;
  }
  if (raw.segmental_fat && typeof raw.segmental_fat === 'object') {
    body.segmental_fat = raw.segmental_fat as Record<string, unknown>;
  }
  // Hex del frame BIA MorphoScan (para mapear segmentales)
  if (raw.raw && typeof raw.raw === 'object') {
    const prev =
      body.raw_payload && typeof body.raw_payload === 'object' ? body.raw_payload : {};
    body.raw_payload = { ...prev, ...(raw.raw as Record<string, unknown>) };
    const nestedImp = (raw.raw as Record<string, unknown>).impedance;
    if (
      !body.impedance &&
      nestedImp &&
      typeof nestedImp === 'object' &&
      !Array.isArray(nestedImp)
    ) {
      body.impedance = nestedImp as Record<string, unknown>;
    }
  }
  if (!asString(body.body_type) && raw.physiqueRating != null) {
    body.body_type = String(raw.physiqueRating);
  }

  // impedance numérico del bridge → raw_payload (no pisar mapa segmental)
  const ohm = asNumber(raw.impedance);
  if (ohm != null) {
    const prev =
      body.raw_payload && typeof body.raw_payload === 'object' ? body.raw_payload : {};
    body.raw_payload = { ...prev, impedance_ohm: ohm };
  }

  body.raw = raw;
  return body;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const err = (message: string, status = 400, extra?: Record<string, unknown>) =>
  json({ error: message, ...extra }, status);

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normTaxId(value: string | null | undefined): string {
  return (value || '').replace(/[\s\-.]/g, '').replace(/\u0000/g, '').toUpperCase();
}

function completeSpanishDni(userId: string | null | undefined): string {
  const norm = normTaxId(userId);
  if (/^\d{7,8}$/.test(norm)) {
    const num = parseInt(norm.padStart(8, '0'), 10);
    const letter = SPANISH_DNI_LETTERS[num % 23] ?? '';
    return `${norm.padStart(8, '0')}${letter}`;
  }
  return norm;
}

function dniNumericKey(value: string | null | undefined): string | null {
  const s = normTaxId(value);
  if (!s) return null;
  const dni = s.match(/^(\d{7,8})([A-Z])?$/);
  if (dni) return dni[1].padStart(8, '0');
  const nie = s.match(/^([XYZ]\d{7})([A-Z])?$/);
  if (nie) return nie[1];
  return null;
}

function normalizeDevice(raw: string | undefined, source: string): DeviceKind {
  const d = (raw || '').toLowerCase().trim();
  if (d === 'morphoscan' || d === 'morpho' || d === 'renpho') return 'morphoscan';
  if (d === 'inbody') return 'inbody';
  if (source.toLowerCase().includes('morphoscan') || source.toLowerCase().includes('renpho')) {
    return 'morphoscan';
  }
  return 'inbody';
}

function parseMeasuredAt(value: string | undefined): string | null {
  if (!value?.trim()) return new Date().toISOString();
  const trimmed = value.trim();
  const withT = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const date = new Date(withT);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function authorize(req: Request): boolean {
  const expected = (Deno.env.get('SCALE_INGEST_SECRET') ?? '').trim();
  if (!expected) return false;

  const headerSecret =
    req.headers.get('x-scale-ingest-secret')?.trim() ||
    new URL(req.url).searchParams.get('secret')?.trim() ||
    '';
  if (headerSecret && headerSecret === expected) return true;

  const auth = req.headers.get('authorization')?.trim() ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token === expected) return true;
  }
  return false;
}

async function findOpenWeighRequest(
  admin: SupabaseClient,
  companyId: string,
): Promise<{
  id: string;
  customer_id: string;
  height_cm: number | null;
  age_years: number | null;
  sex: string | null;
  profile_name: string | null;
} | null> {
  const nowIso = new Date().toISOString();

  // Caducar abiertas vencidas de este centro
  await admin
    .from('scale_weigh_requests')
    .update({ status: 'expired' })
    .eq('company_id', companyId)
    .eq('status', 'open')
    .lt('expires_at', nowIso);

  const { data } = await admin
    .from('scale_weigh_requests')
    .select('id, customer_id, expires_at, height_cm, age_years, sex, profile_name')
    .eq('company_id', companyId)
    .eq('status', 'open')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.id || !data.customer_id) return null;
  return {
    id: data.id,
    customer_id: data.customer_id,
    height_cm: asNumber(data.height_cm),
    age_years: asNumber(data.age_years) != null ? Math.trunc(asNumber(data.age_years)!) : null,
    sex: asString(data.sex),
    profile_name: asString(data.profile_name),
  };
}

async function pendingWeighProfile(req: Request): Promise<Response> {
  if (!(Deno.env.get('SCALE_INGEST_SECRET') ?? '').trim()) {
    return err('SCALE_INGEST_SECRET no configurado en el servidor', 503);
  }
  if (!authorize(req)) return err('No autorizado', 401);

  const companyId =
    req.headers.get('x-suite-company-id')?.trim() ||
    new URL(req.url).searchParams.get('company_id')?.trim() ||
    '';
  if (!companyId) {
    return err('company_id obligatorio (header X-Suite-Company-Id o ?company_id=)');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return err('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const weigh = await findOpenWeighRequest(admin, companyId);
  if (!weigh) {
    return json({
      ok: true,
      pending: false,
      company_id: companyId,
    });
  }

  // Completar desde ficha si el snapshot no vino relleno
  const profile = await loadCustomerProfile(admin, companyId, weigh.customer_id);
  const heightCm = weigh.height_cm ?? profile.height_cm;
  const ageYears = weigh.age_years ?? ageFromBirthDate(profile.birth_date);
  const sexRaw = weigh.sex || profile.sex;
  let gender: 'male' | 'female' | null = null;
  if (sexRaw && /^(m|male|hombre|h)$/i.test(sexRaw)) gender = 'male';
  else if (sexRaw && /^(f|female|mujer)$/i.test(sexRaw)) gender = 'female';

  const { data: customer } = await admin
    .from('customers')
    .select('name')
    .eq('id', weigh.customer_id)
    .maybeSingle();

  const ready =
    heightCm != null &&
    heightCm > 0 &&
    ageYears != null &&
    ageYears > 0 &&
    gender != null;

  return json({
    ok: true,
    pending: true,
    ready,
    company_id: companyId,
    weigh_request_id: weigh.id,
    customer_id: weigh.customer_id,
    name: weigh.profile_name || (customer?.name ? String(customer.name).slice(0, 8) : 'Suite'),
    height_cm: heightCm,
    age_years: ageYears,
    sex: gender === 'male' ? 'M' : gender === 'female' ? 'F' : null,
    gender,
  });
}

async function fulfillWeighRequest(
  admin: SupabaseClient,
  requestId: string,
  measurementId: string,
  weightKg: number,
) {
  await admin
    .from('scale_weigh_requests')
    .update({
      status: 'fulfilled',
      fulfilled_at: new Date().toISOString(),
      measurement_id: measurementId,
      matched_weight_kg: weightKg,
    })
    .eq('id', requestId)
    .eq('status', 'open');
}

async function loadCustomerProfile(
  admin: SupabaseClient,
  companyId: string,
  customerId: string,
): Promise<{ tax_id: string | null; height_cm: number | null; birth_date: string | null; sex: string | null }> {
  const { data } = await admin
    .from('customers')
    .select('tax_id, height_cm, birth_date, clinical_profile')
    .eq('id', customerId)
    .eq('company_id', companyId)
    .maybeSingle();

  const profile = (data?.clinical_profile && typeof data.clinical_profile === 'object'
    ? data.clinical_profile
    : {}) as Record<string, unknown>;
  const sexRaw = asString(profile.sex || profile.gender || profile.sexo);
  let sex: string | null = null;
  if (/^(m|male|hombre|h)$/i.test(sexRaw)) sex = 'M';
  else if (/^(f|female|mujer)$/i.test(sexRaw)) sex = 'F';

  return {
    tax_id: data?.tax_id ?? null,
    height_cm: asNumber(data?.height_cm),
    birth_date: data?.birth_date ? String(data.birth_date).slice(0, 10) : null,
    sex,
  };
}

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

async function resolveCustomerId(
  admin: SupabaseClient,
  companyId: string,
  opts: {
    customerId?: string | null;
    taxId?: string | null;
  },
): Promise<{ customerId: string | null; matchedBy: string | null }> {
  if (opts.customerId) {
    const { data } = await admin
      .from('customers')
      .select('id, tax_id')
      .eq('id', opts.customerId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (data?.id) return { customerId: data.id, matchedBy: 'customer_id' };
  }

  const tax = completeSpanishDni(opts.taxId);
  if (!tax) return { customerId: null, matchedBy: null };

  const { data: exact } = await admin
    .from('customers')
    .select('id, tax_id')
    .eq('company_id', companyId)
    .ilike('tax_id', tax)
    .maybeSingle();
  if (exact?.id) return { customerId: exact.id, matchedBy: 'tax_id' };

  const numKey = dniNumericKey(tax);
  if (numKey) {
    const { data: candidates } = await admin
      .from('customers')
      .select('id, tax_id')
      .eq('company_id', companyId)
      .not('tax_id', 'is', null)
      .limit(500);
    for (const row of candidates ?? []) {
      if (dniNumericKey(row.tax_id) === numKey) {
        return { customerId: row.id, matchedBy: 'tax_id_numeric' };
      }
    }
  }

  return { customerId: null, matchedBy: null };
}

function pickMetric(body: ScaleIngestBody, keys: (keyof ScaleIngestBody)[]): number | null {
  for (const key of keys) {
    const n = asNumber(body[key]);
    if (n != null) return n;
  }
  return null;
}

type SegKey = 'right_arm' | 'left_arm' | 'trunk' | 'right_leg' | 'left_leg';
const SEG_KEYS: SegKey[] = ['right_arm', 'left_arm', 'trunk', 'right_leg', 'left_leg'];
const LIMB_KEYS: SegKey[] = ['right_arm', 'left_arm', 'right_leg', 'left_leg'];
const LEAN_STD_SHARE: Record<SegKey, number> = {
  trunk: 0.507,
  right_leg: 0.177,
  left_leg: 0.177,
  right_arm: 0.056,
  left_arm: 0.056,
};
const FAT_STD_SHARE: Record<SegKey, number> = {
  trunk: 0.442,
  right_leg: 0.196,
  left_leg: 0.196,
  right_arm: 0.083,
  left_arm: 0.083,
};
const IDEAL_FAT: Record<SegKey, number> = {
  trunk: 0.5,
  right_leg: 0.15,
  left_leg: 0.15,
  right_arm: 0.1,
  left_arm: 0.1,
};

function isFemaleSex(sex: string | null | undefined): boolean {
  const s = (sex || '').toLowerCase();
  return s === 'f' || s === 'female' || s.startsWith('mujer');
}

function stdLeanTotal(sex: string | null | undefined, heightCm: number | null): number | null {
  if (heightCm == null || !(heightCm > 100)) return null;
  return Math.round(heightCm * (isFemaleSex(sex) ? 0.237 : 0.28) * 100) / 100;
}

function stdFatTotal(sex: string | null | undefined, heightCm: number | null): number | null {
  if (heightCm == null || !(heightCm > 100)) return null;
  return Math.round(heightCm * (isFemaleSex(sex) ? 0.087 : 0.065) * 100) / 100;
}

function estimateWhr(input: {
  sex: string | null | undefined;
  age: number | null;
  bmi: number | null;
  pbf: number | null;
  visceral: number | null;
  existing: number | null;
}): number | null {
  if (input.existing != null && input.existing > 0.5 && input.existing < 1.3) return input.existing;
  if (input.bmi == null && input.pbf == null) return null;
  const age = input.age ?? 30;
  const bmi = input.bmi ?? 22;
  const pbf = input.pbf ?? 22;
  const visceral = input.visceral ?? 3;
  let whr: number;
  if (isFemaleSex(input.sex)) {
    whr =
      0.78 +
      0.004 * Math.max(0, pbf - 22) +
      0.01 * Math.max(0, visceral - 2) +
      0.002 * Math.max(0, bmi - 20) +
      0.0005 * Math.max(0, age - 25);
    whr = Math.min(1.0, Math.max(0.65, whr));
  } else {
    whr =
      0.87 +
      0.005 * Math.max(0, pbf - 18) +
      0.012 * Math.max(0, visceral - 5) +
      0.0025 * Math.max(0, bmi - 23) +
      0.0006 * Math.max(0, age - 30);
    whr = Math.min(1.15, Math.max(0.75, whr));
  }
  return Math.round(whr * 100) / 100;
}

/** Deriva kg segmentales + estándar/% desde DF-BIA. */
function deriveSegmentalsFromImpedance(input: {
  impedance: Record<string, Record<string, number>>;
  leanTotal: number | null;
  fatTotal: number | null;
  weightKg: number | null;
  pbfPct: number | null;
  heightCm: number | null;
  sex: string | null;
}): { lean: Record<string, unknown>; fat: Record<string, unknown> } | null {
  const z20 = input.impedance['20khz'] ?? input.impedance['100khz'];
  if (!z20 || typeof z20 !== 'object') return null;

  let leanTotal = input.leanTotal;
  if (leanTotal == null && input.weightKg != null && input.pbfPct != null) {
    leanTotal = input.weightKg * (1 - input.pbfPct / 100);
  }
  let fatTotal = input.fatTotal;
  if (fatTotal == null && input.weightKg != null && input.pbfPct != null) {
    fatTotal = (input.weightKg * input.pbfPct) / 100;
  }
  if (leanTotal == null || leanTotal < 10) return null;

  const limbG: Partial<Record<SegKey, number>> = {};
  let sumG = 0;
  for (const k of LIMB_KEYS) {
    const ohm = Number(z20[k]);
    if (!(ohm > 0)) continue;
    limbG[k] = 1 / ohm;
    sumG += limbG[k]!;
  }
  if (sumG <= 0) return null;

  const limbTarget = leanTotal * 0.52;
  const leanKg: Record<SegKey, number> = {
    right_arm: 0,
    left_arm: 0,
    trunk: 0,
    right_leg: 0,
    left_leg: 0,
  };
  for (const k of LIMB_KEYS) {
    leanKg[k] = limbG[k] != null ? (limbTarget * limbG[k]!) / sumG : limbTarget / 4;
  }
  leanKg.trunk = Math.max(0, leanTotal - LIMB_KEYS.reduce((s, k) => s + leanKg[k], 0));

  const fatKg: Record<SegKey, number> = {
    right_arm: 0,
    left_arm: 0,
    trunk: 0,
    right_leg: 0,
    left_leg: 0,
  };
  if (fatTotal != null && fatTotal > 0) {
    let sumW = 0;
    const w: Record<SegKey, number> = { ...IDEAL_FAT };
    for (const k of LIMB_KEYS) {
      const ohm = Number(z20[k]);
      if (ohm > 0) w[k] = IDEAL_FAT[k] * (ohm / 300);
      sumW += w[k];
    }
    sumW += w.trunk;
    for (const k of SEG_KEYS) fatKg[k] = (fatTotal * w[k]) / sumW;
  }

  const leanStdTot = stdLeanTotal(input.sex, input.heightCm);
  const fatStdTot = stdFatTotal(input.sex, input.heightCm);

  const lean: Record<string, unknown> = {
    diff_arm: Math.round(Math.abs(leanKg.right_arm - leanKg.left_arm) * 100) / 100,
    diff_leg: Math.round(Math.abs(leanKg.right_leg - leanKg.left_leg) * 100) / 100,
  };
  const fat: Record<string, unknown> = {};
  for (const k of SEG_KEYS) {
    const leanStd = leanStdTot != null ? leanStdTot * LEAN_STD_SHARE[k] : null;
    const fatStd = fatStdTot != null ? fatStdTot * FAT_STD_SHARE[k] : null;
    const leanPct = leanStd && leanStd > 0 ? Math.round((1000 * leanKg[k]) / leanStd) / 10 : null;
    const fatPct = fatStd && fatStd > 0 ? Math.round((1000 * fatKg[k]) / fatStd) / 10 : null;
    lean[k] = {
      kg: Math.round(leanKg[k] * 100) / 100,
      eval_pct: leanPct,
      pct: leanPct,
      standard_kg: leanStd != null ? Math.round(leanStd * 100) / 100 : null,
    };
    fat[k] = {
      kg: Math.round(fatKg[k] * 100) / 100,
      pct: fatPct,
      eval_pct: fatPct,
      standard_kg: fatStd != null ? Math.round(fatStd * 100) / 100 : null,
    };
  }
  return { lean, fat };
}

function buildRow(
  body: ScaleIngestBody,
  ctx: {
    companyId: string;
    customerId: string | null;
    userId: string;
    measuredAt: string;
    device: DeviceKind;
    source: string;
  },
) {
  const weightKg = pickMetric(body, ['weight_kg', 'weight']);
  const pbfPct = pickMetric(body, ['pbf_pct', 'body_fat_pct', 'bodyFatPercent', 'bodyfat']);
  let bodyFatKg = pickMetric(body, ['body_fat_kg']);
  if (bodyFatKg == null && weightKg != null && pbfPct != null) {
    bodyFatKg = Math.round(((weightKg * pbfPct) / 100) * 100) / 100;
  }

  // Renpho / ble-scale-sync: water / water_pct como %; preferir body_water_pct / tbw_kg.
  let bodyWaterPct = asNumber(body.body_water_pct) ?? asNumber(body.water_pct);
  let tbwKg = asNumber(body.tbw_kg);
  const waterAlias = asNumber(body.water);
  if (bodyWaterPct == null && waterAlias != null && waterAlias > 0 && waterAlias <= 80) {
    bodyWaterPct = waterAlias;
  } else if (tbwKg == null && waterAlias != null && weightKg != null && waterAlias > 80) {
    // Valor atípico: tratar como kg solo si supera el umbral típico de %.
    tbwKg = waterAlias;
  }
  if (tbwKg == null && weightKg != null && bodyWaterPct != null) {
    tbwKg = Math.round(((weightKg * bodyWaterPct) / 100) * 100) / 100;
  }

  const rawPayload =
    (body.raw_payload && typeof body.raw_payload === 'object' ? body.raw_payload : null) ||
    (body.raw && typeof body.raw === 'object' ? body.raw : null) ||
    {};

  const impedance =
    body.impedance && typeof body.impedance === 'object' && !Array.isArray(body.impedance)
      ? (body.impedance as Record<string, Record<string, number>>)
      : {};

  let segmentalLean =
    body.segmental_lean && typeof body.segmental_lean === 'object' ? body.segmental_lean : {};
  let segmentalFat =
    body.segmental_fat && typeof body.segmental_fat === 'object' ? body.segmental_fat : {};

  // MorphoScan BLE: solo llega mapa Ω; rellenar lean/fat kg derivados para la UI.
  const hasSegKg = ['right_arm', 'left_arm', 'trunk', 'right_leg', 'left_leg'].some((k) => {
    const lean = (segmentalLean as Record<string, { kg?: number }>)[k];
    const fat = (segmentalFat as Record<string, { kg?: number }>)[k];
    return lean?.kg != null || fat?.kg != null;
  });
  if (!hasSegKg && Object.keys(impedance).length > 0) {
    const derived = deriveSegmentalsFromImpedance({
      impedance,
      leanTotal: pickMetric(body, ['slm_kg', 'muscle_mass_kg', 'muscleMass', 'ffm_kg']),
      fatTotal: bodyFatKg,
      weightKg,
      pbfPct,
      heightCm: asNumber(body.height_cm),
      sex: asString(body.sex),
    });
    if (derived) {
      segmentalLean = derived.lean;
      segmentalFat = derived.fat;
    }
  }

  const heightCm = asNumber(body.height_cm);
  const bmi =
    asNumber(body.bmi) ??
    (weightKg != null && heightCm != null && heightCm > 0
      ? weightKg / (heightCm / 100) ** 2
      : null);
  const visceral = pickMetric(body, ['visceral_fat_index', 'visceral', 'visceral_fat', 'visceralFat']);
  const whr = estimateWhr({
    sex: asString(body.sex),
    age: asNumber(body.age_years),
    bmi,
    pbf: pbfPct,
    visceral,
    existing: asNumber(body.whr),
  });

  return {
    company_id: ctx.companyId,
    customer_id: ctx.customerId,
    inbody_user_id: ctx.userId,
    measured_at: ctx.measuredAt,
    device: ctx.device,
    source: ctx.source,
    import_batch: asString(body.import_batch) || `scale_ingest_${new Date().toISOString().slice(0, 13)}`,

    height_cm: heightCm,
    age_years: asNumber(body.age_years),
    sex: asString(body.sex) || null,

    weight_kg: weightKg,
    smm_kg: pickMetric(body, ['smm_kg', 'smmKg']),
    body_fat_kg: bodyFatKg,
    tbw_kg: tbwKg,
    ffm_kg: asNumber(body.ffm_kg),
    slm_kg: pickMetric(body, ['slm_kg', 'muscle_mass_kg', 'muscleMass']),
    bmi: bmi != null ? Math.round(bmi * 100) / 100 : null,
    pbf_pct: pbfPct,
    whr,
    bmr_kcal: pickMetric(body, ['bmr_kcal', 'bmr']),
    fat_control_kg: asNumber(body.fat_control_kg),
    muscle_control_kg: asNumber(body.muscle_control_kg),
    weight_control_kg: asNumber(body.weight_control_kg),
    target_weight_kg: asNumber(body.target_weight_kg),

    bone_mass_kg: pickMetric(body, ['bone_mass_kg', 'boneMass', 'bone']),
    protein_mass_kg: asNumber(body.protein_mass_kg),
    protein_pct: asNumber(body.protein_pct),
    body_water_pct: bodyWaterPct,
    visceral_fat_index: visceral,
    subcutaneous_fat_pct: pickMetric(body, ['subcutaneous_fat_pct', 'subcutaneous']),
    metabolic_age: pickMetric(body, ['metabolic_age', 'metabolicAge', 'bodyage']),
    smi: asNumber(body.smi),
    body_type: asString(body.body_type) || null,
    heart_rate: pickMetric(body, ['heart_rate', 'heartrate']),

    segmental_lean: segmentalLean,
    segmental_fat: segmentalFat,
    impedance,
    edema: body.edema && typeof body.edema === 'object' ? body.edema : {},
    raw_payload: rawPayload,
    updated_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ble-scale-sync WebhookExporter hace HEAD en healthcheck
  if (req.method === 'HEAD' || req.method === 'GET') {
    const configured = !!(Deno.env.get('SCALE_INGEST_SECRET') ?? '').trim();
    if (req.method === 'HEAD') {
      return new Response(null, {
        status: configured ? 200 : 503,
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    if (url.searchParams.get('pending') === '1' || url.searchParams.get('action') === 'pending-profile') {
      return pendingWeighProfile(req);
    }

    return json({
      ok: true,
      service: 'scale-ingest',
      configured,
      hint: 'POST measurement JSON with X-Scale-Ingest-Secret; GET ?pending=1 for open weigh profile',
    });
  }

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  if (!(Deno.env.get('SCALE_INGEST_SECRET') ?? '').trim()) {
    return err('SCALE_INGEST_SECRET no configurado en el servidor', 503);
  }
  if (!authorize(req)) {
    return err('No autorizado', 401);
  }

  let body: ScaleIngestBody;
  try {
    const raw = (await req.json()) as Record<string, unknown>;
    body = normalizeIncomingBody(raw, req);
  } catch {
    return err('JSON inválido');
  }

  const companyId = asString(body.company_id);
  if (!companyId) {
    return err(
      'company_id es obligatorio (body, ?company_id= o header X-Suite-Company-Id)',
    );
  }

  const measuredAt = parseMeasuredAt(
    asString(body.measured_at) || asString(body.timestamp) || undefined,
  );
  if (!measuredAt) return err('measured_at inválido');

  const source =
    asString(body.source) ||
    (normalizeDevice(body.device, '') === 'morphoscan' ? 'morphoscan_ble' : 'scale_ingest');
  const device = normalizeDevice(body.device, source);

  const taxHint =
    asString(body.tax_id) ||
    asString(body.inbody_user_id) ||
    asString(body.external_user_id) ||
    '';

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return err('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: company } = await admin.from('companies').select('id').eq('id', companyId).maybeSingle();
  if (!company?.id) return err('company_id no encontrado', 404);

  const weightKg = pickMetric(body, ['weight_kg', 'weight']);
  if (weightKg == null || weightKg <= 0) {
    return err('weight_kg (o weight) es obligatorio y debe ser > 0');
  }

  const weighRequest = await findOpenWeighRequest(admin, companyId);

  let link = await resolveCustomerId(admin, companyId, {
    customerId: asString(body.customer_id) || null,
    taxId: taxHint || null,
  });

  if (!link.customerId && weighRequest) {
    link = { customerId: weighRequest.customer_id, matchedBy: 'weigh_request' };
  }

  let profile: Awaited<ReturnType<typeof loadCustomerProfile>> | null = null;
  if (link.customerId) {
    profile = await loadCustomerProfile(admin, companyId, link.customerId);
  }

  let userId = completeSpanishDni(taxHint) || completeSpanishDni(profile?.tax_id);
  if (!userId && asString(body.external_user_id) && !link.customerId) {
    userId = `MS:${asString(body.external_user_id)}`;
  }
  if (!userId && link.customerId) {
    userId = `MS:${link.customerId}`;
  }
  if (!userId) {
    return err(
      'Se necesita tax_id, inbody_user_id, external_user_id, customer_id o una petición «Pesar ahora» abierta',
    );
  }

  // Enriquecer altura/edad/sexo desde ficha si el puente no los manda
  if (profile) {
    if (asNumber(body.height_cm) == null && profile.height_cm != null) {
      body.height_cm = profile.height_cm;
    }
    if (asNumber(body.age_years) == null) {
      const age = ageFromBirthDate(profile.birth_date);
      if (age != null) body.age_years = age;
    }
    if (!asString(body.sex) && profile.sex) {
      body.sex = profile.sex;
    }
  }

  const row = buildRow(body, {
    companyId,
    customerId: link.customerId,
    userId,
    measuredAt,
    device,
    source,
  });

  const { data: upserted, error: upsertError } = await admin
    .from('inbody_measurements')
    .upsert(row, { onConflict: 'company_id,inbody_user_id,measured_at' })
    .select('id, customer_id, inbody_user_id, measured_at, device, source, weight_kg')
    .single();

  if (upsertError) {
    console.error('scale-ingest upsert failed', upsertError);
    return err('Error al guardar la medición', 500, { detail: upsertError.message });
  }

  if (weighRequest && link.matchedBy === 'weigh_request' && upserted?.id) {
    await fulfillWeighRequest(admin, weighRequest.id, upserted.id, weightKg);
  } else if (weighRequest && link.customerId === weighRequest.customer_id && upserted?.id) {
    await fulfillWeighRequest(admin, weighRequest.id, upserted.id, weightKg);
  }

  return json({
    ok: true,
    measurement: upserted,
    linked: {
      customer_id: link.customerId,
      matched_by: link.matchedBy,
      inbody_user_id: userId,
      weigh_request_id: weighRequest?.id ?? null,
    },
  });
});
