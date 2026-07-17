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
    'authorization, x-client-info, apikey, content-type, x-scale-ingest-secret',
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

  /** Alias frecuentes del puente BLE / Renpho */
  weight?: number | null;
  bodyfat?: number | null;
  body_fat_pct?: number | null;
  muscle?: number | null;
  muscle_mass_kg?: number | null;
  water?: number | null;
  bone?: number | null;
  bmr?: number | null;
  visceral?: number | null;
  subcutaneous?: number | null;
  bodyage?: number | null;
  heartrate?: number | null;

  raw?: Record<string, unknown>;
  raw_payload?: Record<string, unknown>;
};

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
  const pbfPct = pickMetric(body, ['pbf_pct', 'body_fat_pct', 'bodyfat']);
  let bodyFatKg = pickMetric(body, ['body_fat_kg']);
  if (bodyFatKg == null && weightKg != null && pbfPct != null) {
    bodyFatKg = Math.round(((weightKg * pbfPct) / 100) * 100) / 100;
  }

  // Renpho suele enviar `water` como %; preferir body_water_pct / tbw_kg explícitos.
  let bodyWaterPct = asNumber(body.body_water_pct);
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

  return {
    company_id: ctx.companyId,
    customer_id: ctx.customerId,
    inbody_user_id: ctx.userId,
    measured_at: ctx.measuredAt,
    device: ctx.device,
    source: ctx.source,
    import_batch: asString(body.import_batch) || `scale_ingest_${new Date().toISOString().slice(0, 13)}`,

    height_cm: asNumber(body.height_cm),
    age_years: asNumber(body.age_years),
    sex: asString(body.sex) || null,

    weight_kg: weightKg,
    smm_kg: pickMetric(body, ['smm_kg', 'muscle_mass_kg', 'muscle']),
    body_fat_kg: bodyFatKg,
    tbw_kg: tbwKg,
    ffm_kg: asNumber(body.ffm_kg),
    slm_kg: asNumber(body.slm_kg),
    bmi: asNumber(body.bmi),
    pbf_pct: pbfPct,
    whr: asNumber(body.whr),
    bmr_kcal: pickMetric(body, ['bmr_kcal', 'bmr']),
    fat_control_kg: asNumber(body.fat_control_kg),
    muscle_control_kg: asNumber(body.muscle_control_kg),
    weight_control_kg: asNumber(body.weight_control_kg),
    target_weight_kg: asNumber(body.target_weight_kg),

    bone_mass_kg: pickMetric(body, ['bone_mass_kg', 'bone']),
    protein_mass_kg: asNumber(body.protein_mass_kg),
    protein_pct: asNumber(body.protein_pct),
    body_water_pct: bodyWaterPct,
    visceral_fat_index: pickMetric(body, ['visceral_fat_index', 'visceral']),
    subcutaneous_fat_pct: pickMetric(body, ['subcutaneous_fat_pct', 'subcutaneous']),
    metabolic_age: pickMetric(body, ['metabolic_age', 'bodyage']),
    smi: asNumber(body.smi),
    body_type: asString(body.body_type) || null,
    heart_rate: pickMetric(body, ['heart_rate', 'heartrate']),

    segmental_lean: body.segmental_lean && typeof body.segmental_lean === 'object'
      ? body.segmental_lean
      : {},
    segmental_fat: body.segmental_fat && typeof body.segmental_fat === 'object'
      ? body.segmental_fat
      : {},
    impedance: body.impedance && typeof body.impedance === 'object' ? body.impedance : {},
    edema: body.edema && typeof body.edema === 'object' ? body.edema : {},
    raw_payload: rawPayload,
    updated_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    const configured = !!(Deno.env.get('SCALE_INGEST_SECRET') ?? '').trim();
    return json({
      ok: true,
      service: 'scale-ingest',
      configured,
      hint: 'POST measurement JSON with X-Scale-Ingest-Secret',
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
    body = (await req.json()) as ScaleIngestBody;
  } catch {
    return err('JSON inválido');
  }

  const companyId = asString(body.company_id);
  if (!companyId) return err('company_id es obligatorio');

  const measuredAt = parseMeasuredAt(body.measured_at);
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

  const link = await resolveCustomerId(admin, companyId, {
    customerId: asString(body.customer_id) || null,
    taxId: taxHint || null,
  });

  let userId = completeSpanishDni(taxHint);
  if (!userId && link.customerId) {
    const { data: cust } = await admin
      .from('customers')
      .select('tax_id')
      .eq('id', link.customerId)
      .maybeSingle();
    userId = completeSpanishDni(cust?.tax_id);
  }
  if (!userId && asString(body.external_user_id)) {
    userId = `MS:${asString(body.external_user_id)}`;
  }
  if (!userId && link.customerId) {
    userId = `MS:${link.customerId}`;
  }
  if (!userId) {
    return err(
      'Se necesita tax_id, inbody_user_id, external_user_id o customer_id para identificar la medición',
    );
  }

  const weightKg = pickMetric(body, ['weight_kg', 'weight']);
  if (weightKg == null || weightKg <= 0) {
    return err('weight_kg (o weight) es obligatorio y debe ser > 0');
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

  return json({
    ok: true,
    measurement: upserted,
    linked: {
      customer_id: link.customerId,
      matched_by: link.matchedBy,
      inbody_user_id: userId,
    },
  });
});
