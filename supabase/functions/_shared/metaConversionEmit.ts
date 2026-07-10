import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Nombre del CRM en eventos CAPI (Meta CRM integration → lead_event_source). */
const META_CRM_SOURCE_NAME = 'Suite';

export type MetaConversionEventInput = {
  event_name: string;
  event_id: string;
  event_time?: number;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  external_id?: string | null;
  /** ID numérico de lead Meta (15-17 dígitos); si no se pasa, se infiere de external_id. */
  meta_lead_id?: number | null;
  value?: number | null;
  currency?: string | null;
  campaign?: string | null;
};

type MetaConversionConfig = {
  conversions_enabled: boolean;
  n8n_webhook_url: string | null;
  n8n_webhook_secret: string | null;
  conversions_test_event_code: string | null;
};

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const v = String(email).trim().toLowerCase();
  return v.length > 0 ? v : null;
}

function normPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits.length > 0 ? digits : null;
}

function normName(name: string | null | undefined): string | null {
  if (!name) return null;
  const v = String(name).trim().toLowerCase();
  return v.length > 0 ? v : null;
}

/** Lead ID de Meta Lead Ads (15-17 dígitos). */
export function parseMetaLeadId(
  externalId: string | null | undefined,
): number | null {
  if (!externalId) return null;
  const digits = String(externalId).replace(/\D/g, '');
  if (digits.length < 15 || digits.length > 17) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

export async function buildMetaCapiPayload(
  event: MetaConversionEventInput,
  testEventCode?: string | null,
): Promise<Record<string, unknown>> {
  const user_data: Record<string, unknown> = {};
  const em = normEmail(event.email);
  const ph = normPhone(event.phone);
  const fn = normName(event.first_name);
  const ln = normName(event.last_name);
  const ext = event.external_id ? String(event.external_id) : null;
  const metaLeadId = event.meta_lead_id ?? parseMetaLeadId(ext);

  if (em) user_data.em = [await sha256Hex(em)];
  if (ph) user_data.ph = [await sha256Hex(ph)];
  if (fn) user_data.fn = [await sha256Hex(fn)];
  if (ln) user_data.ln = [await sha256Hex(ln)];
  if (metaLeadId != null) {
    user_data.lead_id = metaLeadId;
  } else if (ext) {
    user_data.external_id = [await sha256Hex(ext)];
  }

  const custom_data: Record<string, unknown> = {
    event_source: 'crm',
    lead_event_source: META_CRM_SOURCE_NAME,
  };
  if (event.value != null && Number.isFinite(Number(event.value))) {
    custom_data.value = Number(event.value);
  }
  if (event.currency) custom_data.currency = String(event.currency).toUpperCase();

  const capiEvent: Record<string, unknown> = {
    event_name: event.event_name,
    event_time: event.event_time ?? Math.floor(Date.now() / 1000),
    event_id: event.event_id,
    action_source: 'system_generated',
    user_data,
    custom_data,
  };

  const payload: Record<string, unknown> = { data: [capiEvent] };
  const testCode = testEventCode?.trim();
  if (testCode) payload.test_event_code = testCode;
  return payload;
}

export async function loadMetaConversionConfig(
  admin: SupabaseClient,
  companyId: string,
): Promise<MetaConversionConfig | null> {
  const { data, error } = await admin
    .from('meta_config')
    .select(
      'conversions_enabled, n8n_webhook_url, n8n_webhook_secret, conversions_test_event_code',
    )
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) {
    console.error('meta conversion config load failed:', error.message);
    return null;
  }
  return data ?? null;
}

/** Envía payload CAPI hasheado al webhook n8n (n8n solo reenvía a Meta). */
export async function emitMetaConversion(
  admin: SupabaseClient,
  companyId: string,
  event: MetaConversionEventInput,
): Promise<boolean> {
  const cfg = await loadMetaConversionConfig(admin, companyId);
  if (!cfg?.conversions_enabled) return false;
  const url = cfg.n8n_webhook_url?.trim();
  if (!url) return false;

  const capi_payload = await buildMetaCapiPayload(
    event,
    cfg.conversions_test_event_code,
  );

  const envelope = {
    company_id: companyId,
    event_name: event.event_name,
    event_id: event.event_id,
    capi_payload,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const secret = cfg.n8n_webhook_secret?.trim();
  if (secret) headers['X-Suite-Secret'] = secret;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(envelope),
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error(
        `meta conversion n8n HTTP ${resp.status}: ${text.slice(0, 500)}`,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error('meta conversion n8n fetch failed:', e);
    return false;
  }
}

export async function emitLeadConversionFromRow(
  admin: SupabaseClient,
  companyId: string,
  lead: {
    id: string;
    external_id?: string | null;
    email?: string | null;
    phone?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    campaign?: string | null;
  },
  eventName = 'Lead',
): Promise<boolean> {
  const metaLeadId = parseMetaLeadId(lead.external_id);
  return emitMetaConversion(admin, companyId, {
    event_name: eventName,
    event_id: `${lead.id}-${eventName.toLowerCase()}`,
    email: lead.email,
    phone: lead.phone,
    first_name: lead.first_name,
    last_name: lead.last_name,
    external_id: lead.external_id ?? lead.id,
    meta_lead_id: metaLeadId,
    campaign: lead.campaign,
  });
}

type StageRuleRow = {
  event_name: string;
  value_amount: number | null;
  currency: string | null;
  enabled: boolean;
};

type LeadForStageEmit = {
  id: string;
  stage_id: string | null;
  external_id?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  campaign?: string | null;
};

/** Emite conversión Meta si la etapa actual del lead tiene regla configurada. */
export async function emitMetaConversionForLeadStage(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
): Promise<boolean> {
  const { data: lead, error: leadErr } = await admin
    .from('marketing_leads')
    .select(
      'id, stage_id, external_id, email, phone, first_name, last_name, campaign',
    )
    .eq('id', leadId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (leadErr || !lead?.stage_id) return false;

  const { data: rule, error: ruleErr } = await admin
    .from('meta_conversion_stage_rules')
    .select('event_name, value_amount, currency, enabled')
    .eq('company_id', companyId)
    .eq('stage_id', lead.stage_id)
    .eq('enabled', true)
    .maybeSingle();
  if (ruleErr || !rule) return false;

  const epoch = Math.floor(Date.now() / 1000);
  const row = rule as StageRuleRow;
  const leadRow = lead as LeadForStageEmit;
  const metaLeadId = parseMetaLeadId(leadRow.external_id);

  return emitMetaConversion(admin, companyId, {
    event_name: row.event_name,
    event_id: `${leadRow.id}-stage-${leadRow.stage_id}`,
    event_time: epoch,
    email: leadRow.email,
    phone: leadRow.phone,
    first_name: leadRow.first_name,
    last_name: leadRow.last_name,
    external_id: leadRow.external_id ?? leadRow.id,
    meta_lead_id: metaLeadId,
    campaign: leadRow.campaign,
    value: row.value_amount != null ? Number(row.value_amount) : null,
    currency: row.currency ?? 'EUR',
  });
}
