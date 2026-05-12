// Edge function: meta-sync-leads
// ---------------------------------------------------------------------------
// Sincroniza leads desde Meta Lead Ads (Facebook/Instagram) hacia la tabla
// public.marketing_leads, encolándolos a "Nuevo Formulario" (por defecto) o a
// "Formulario+Agenda ficticia" si el lead trae una cita/slot en sus respuestas
// o el formulario está marcado como "creates_appointment" en meta_forms.
// ---------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type MetaFieldDatum = { name: string; values: string[] };
type MetaLead = {
  id: string;
  created_time?: string;
  field_data?: MetaFieldDatum[];
  form_id?: string;
  ad_id?: string;
  campaign_name?: string;
  platform?: string;
};

type MetaLeadsResponse = {
  data?: MetaLead[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; type?: string; code?: number };
};

type SyncFormResult = {
  form_id: string;
  form_name: string | null;
  status: 'ok' | 'error' | 'skipped';
  inserted: number;
  skipped: number;
  errors: number;
  message?: string;
};

// Heurística para detectar si el lead trae una cita agendada en field_data.
const APPOINTMENT_KEYS = [
  'appointment',
  'appointment_request',
  'appointment_request_time',
  'select_a_date_and_time',
  'select_a_time',
  'preferred_appointment',
  'preferred_time',
  'preferred_date',
  'fecha_de_la_cita',
  'fecha_cita',
  'cita',
  'horario',
  'hora_preferida',
  'when_would_you_like_to_book',
  'when_would_you_like_to_come_in',
];

function hasAppointmentField(fields: MetaFieldDatum[] | undefined): boolean {
  if (!fields || fields.length === 0) return false;
  for (const f of fields) {
    const key = (f?.name ?? '').toLowerCase().replace(/\s+/g, '_');
    if (APPOINTMENT_KEYS.some((k) => key.includes(k))) {
      const value = (f?.values ?? []).find((v) => String(v).trim().length > 0);
      if (value) return true;
    }
  }
  return false;
}

function normalizeFieldName(name: string): string {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function firstValue(values?: string[]): string | null {
  if (!values || values.length === 0) return null;
  const v = String(values[0] ?? '').trim();
  return v.length === 0 ? null : v;
}

function parseLeadFields(lead: MetaLead) {
  const fields = Array.isArray(lead.field_data) ? lead.field_data : [];
  let firstName: string | null = null;
  let lastName: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;
  const extras: Array<{ name: string; values: string[] }> = [];

  for (const f of fields) {
    const key = normalizeFieldName(f?.name ?? '');
    const value = firstValue(f?.values);
    if (!key) continue;
    switch (key) {
      case 'first_name':
        firstName = value;
        break;
      case 'last_name':
        lastName = value;
        break;
      case 'full_name': {
        if (value && !firstName) {
          const parts = value.split(/\s+/);
          firstName = parts[0] ?? null;
          if (parts.length > 1 && !lastName) lastName = parts.slice(1).join(' ');
        }
        break;
      }
      case 'phone':
      case 'phone_number':
        phone = value;
        break;
      case 'email':
        email = value;
        break;
      default:
        extras.push({ name: key, values: Array.isArray(f.values) ? f.values : [] });
    }
  }

  return { firstName, lastName, phone, email, extras };
}

async function fetchAllLeads(
  apiVersion: string,
  formId: string,
  accessToken: string,
  since: string | null,
): Promise<{ leads: MetaLead[]; error?: string }> {
  const leads: MetaLead[] = [];
  const baseFields =
    'id,created_time,field_data,form_id,ad_id,campaign_name,platform';
  let nextUrl: string | null = null;

  const buildInitialUrl = () => {
    const url = new URL(
      `https://graph.facebook.com/${apiVersion}/${formId}/leads`,
    );
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('fields', baseFields);
    url.searchParams.set('limit', '100');
    if (since) {
      url.searchParams.set(
        'filtering',
        JSON.stringify([
          { field: 'time_created', operator: 'GREATER_THAN', value: since },
        ]),
      );
    }
    return url.toString();
  };

  let current: string = buildInitialUrl();
  let safety = 0;

  while (current && safety < 20) {
    safety++;
    const resp = await fetch(current, { method: 'GET' });
    const text = await resp.text();
    let payload: MetaLeadsResponse;
    try {
      payload = JSON.parse(text) as MetaLeadsResponse;
    } catch {
      return {
        leads,
        error: `Respuesta no JSON desde Meta (HTTP ${resp.status})`,
      };
    }
    if (!resp.ok || payload.error) {
      const msg =
        payload.error?.message ??
        `HTTP ${resp.status}: ${text.slice(0, 200)}`;
      return { leads, error: msg };
    }
    if (Array.isArray(payload.data)) leads.push(...payload.data);
    nextUrl = payload.paging?.next ?? null;
    current = nextUrl ?? '';
  }

  return { leads };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: 'Faltan variables de entorno de Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Falta token de autenticación' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: profileErr } = await admin
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (profileErr || !profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'No se encontró empresa para el usuario' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const companyId: string = profile.company_id;

    let body: { form_ids?: string[]; force?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { data: config, error: cfgErr } = await admin
      .from('meta_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!config) {
      return new Response(
        JSON.stringify({
          error:
            'No hay configuración de Meta. Configura business_id, access_token y formularios en Configuración → Meta.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!config.access_token) {
      return new Response(
        JSON.stringify({ error: 'Falta access_token en la configuración de Meta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!config.enabled && !body.force) {
      return new Response(
        JSON.stringify({ error: 'La sincronización con Meta está deshabilitada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let formsQuery = admin
      .from('meta_forms')
      .select('*')
      .eq('company_id', companyId)
      .eq('enabled', true);
    if (body.form_ids && body.form_ids.length > 0) {
      formsQuery = formsQuery.in('form_id', body.form_ids);
    }
    const { data: forms, error: formsErr } = await formsQuery;
    if (formsErr) throw formsErr;
    if (!forms || forms.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            'No hay formularios Meta configurados. Añade alguno en Configuración → Meta.',
          forms: [],
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: stages, error: stagesErr } = await admin
      .from('marketing_lead_stages')
      .select('id, name, is_default_intake, position')
      .eq('company_id', companyId)
      .order('position', { ascending: true });
    if (stagesErr) throw stagesErr;

    const stageByName = new Map<string, string>();
    for (const s of stages ?? []) {
      if (s.name) stageByName.set(s.name.toLowerCase(), s.id);
    }
    const intakeStageId =
      (stages ?? []).find((s) => s.is_default_intake)?.id ??
      stageByName.get('nuevo formulario') ??
      (stages ?? [])[0]?.id ??
      null;
    const appointmentStageId =
      stageByName.get('formulario+agenda ficticia') ??
      stageByName.get('formulario + agenda ficticia') ??
      intakeStageId;

    const results: SyncFormResult[] = [];
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const form of forms) {
      const targetIntake = form.default_stage_id ?? intakeStageId;
      const targetAppointment =
        form.appointment_stage_id ??
        (form.creates_appointment ? appointmentStageId : null) ??
        appointmentStageId;

      const since = form.last_lead_created_time
        ? new Date(form.last_lead_created_time).toISOString()
        : null;

      const { leads: metaLeads, error: fetchErr } = await fetchAllLeads(
        config.graph_api_version || 'v23.0',
        form.form_id,
        config.access_token,
        since,
      );

      if (fetchErr) {
        totalErrors++;
        results.push({
          form_id: form.form_id,
          form_name: form.form_name,
          status: 'error',
          inserted: 0,
          skipped: 0,
          errors: 1,
          message: fetchErr,
        });
        await admin
          .from('meta_forms')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'error',
            last_sync_message: fetchErr.slice(0, 500),
          })
          .eq('id', form.id);
        continue;
      }

      // Cargamos TODOS los leads de la empresa (id/external_id/phone/email) para poder
      // emparejar por external_id, por teléfono normalizado (últimos 9 dígitos) y por email.
      const { data: existingAll, error: existingErr } = await admin
        .from('marketing_leads')
        .select('id, external_id, phone, email')
        .eq('company_id', companyId);
      if (existingErr) throw existingErr;

      const existingByExternal = new Map<string, string>();
      const existingByPhone9   = new Map<string, string>();
      const existingByPhoneAll = new Map<string, string>();
      const existingByEmail    = new Map<string, string>();
      for (const row of existingAll ?? []) {
        if (row.external_id) existingByExternal.set(row.external_id, row.id);
        if (row.phone) {
          const d = row.phone.replace(/\D/g, '');
          if (d.length >= 7) {
            existingByPhoneAll.set(d, row.id);
            existingByPhone9.set(d.slice(-9), row.id);
          }
        }
        if (row.email) {
          existingByEmail.set(row.email.trim().toLowerCase(), row.id);
        }
      }

      const findExistingLeadId = (
        leadId: string,
        phone: string | null,
        email: string | null,
      ): string | null => {
        if (existingByExternal.has(leadId)) return existingByExternal.get(leadId)!;
        if (phone) {
          const d = phone.replace(/\D/g, '');
          if (d.length >= 7) {
            const byFull = existingByPhoneAll.get(d);
            if (byFull) return byFull;
            const byLast9 = existingByPhone9.get(d.slice(-9));
            if (byLast9) return byLast9;
          }
        }
        if (email) {
          const e = email.trim().toLowerCase();
          if (e) {
            const byEmail = existingByEmail.get(e);
            if (byEmail) return byEmail;
          }
        }
        return null;
      };

      type BackfillTarget = {
        id: string;
        externalId: string;
        formName: string | null;
        campaign: string | null;
        externalCreatedAt: string | null;
        source: string;
      };

      const rows: Record<string, unknown>[] = [];
      const toBackfill: BackfillTarget[] = [];
      let skipped = 0;
      let lastCreatedTime: string | null = form.last_lead_created_time ?? null;
      let lastExternalId: string | null = form.last_lead_external_id ?? null;

      for (const lead of metaLeads) {
        if (!lead.id) continue;

        const { firstName, lastName, phone, email, extras } = parseLeadFields(lead);
        const platform = (lead.platform ?? '').toLowerCase();
        let source = 'meta';
        if (platform.includes('instagram')) source = 'instagram';
        else if (platform.includes('facebook')) source = 'facebook';

        const matchId = findExistingLeadId(lead.id, phone, email);

        if (matchId) {
          // El lead ya existe (importado de CRM antiguo o sync previa). No tocamos
          // su etapa ni datos editados por el usuario; sólo registramos el external_id
          // de Meta para que en futuras syncs sea trivial reconocerlo.
          skipped++;
          // Sólo backfill si no es ya un external_id de Meta conocido.
          if (!existingByExternal.has(lead.id)) {
            toBackfill.push({
              id: matchId,
              externalId: lead.id,
              formName: form.form_name ?? null,
              campaign: lead.campaign_name ?? null,
              externalCreatedAt: lead.created_time ?? null,
              source,
            });
            // Lo registramos en el índice por si en este mismo run aparece otra vez.
            existingByExternal.set(lead.id, matchId);
          }
        } else {
          const hasAppt =
            form.creates_appointment || hasAppointmentField(lead.field_data);
          const stageId = hasAppt ? targetAppointment : targetIntake;

          rows.push({
            company_id: companyId,
            stage_id: stageId,
            external_id: lead.id,
            source,
            form_name: form.form_name ?? null,
            campaign: lead.campaign_name ?? null,
            first_name: firstName,
            last_name: lastName,
            phone,
            email,
            field_data: extras,
            external_created_at: lead.created_time ?? null,
          });
        }

        if (
          lead.created_time &&
          (!lastCreatedTime || new Date(lead.created_time) > new Date(lastCreatedTime))
        ) {
          lastCreatedTime = lead.created_time;
          lastExternalId = lead.id;
        }
      }

      let inserted = 0;
      let formErrors = 0;
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { data: ins, error: insErr } = await admin
          .from('marketing_leads')
          .insert(slice)
          .select('id');
        if (insErr) {
          console.error('meta-sync insert error', insErr);
          formErrors += slice.length;
        } else {
          inserted += ins?.length ?? 0;
        }
      }

      // Backfill external_id (y metadatos suaves) en los leads existentes.
      for (const b of toBackfill) {
        const { error: bErr } = await admin
          .from('marketing_leads')
          .update({
            external_id: b.externalId,
            // Sólo sobreescribimos form_name/campaign/external_created_at si están vacíos.
            ...(b.formName ? { form_name: b.formName } : {}),
            ...(b.campaign ? { campaign: b.campaign } : {}),
            ...(b.externalCreatedAt ? { external_created_at: b.externalCreatedAt } : {}),
            // Marcamos fuente como Meta para que el origen sea trazable.
            source: b.source,
          })
          .eq('id', b.id)
          // Evita pisar external_id si otro proceso ya rellenó uno distinto.
          .is('external_id', null);
        if (bErr) {
          console.warn(`backfill external_id failed for ${b.id}:`, bErr.message);
        }
      }

      totalInserted += inserted;
      totalSkipped += skipped;
      totalErrors += formErrors;

      await admin
        .from('meta_forms')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: formErrors > 0 ? 'partial' : 'ok',
          last_sync_message:
            formErrors > 0
              ? `${inserted} insertados, ${formErrors} con error`
              : `${inserted} insertados, ${skipped} ya existían`,
          last_lead_created_time: lastCreatedTime,
          last_lead_external_id: lastExternalId,
        })
        .eq('id', form.id);

      results.push({
        form_id: form.form_id,
        form_name: form.form_name,
        status: formErrors > 0 ? 'error' : 'ok',
        inserted,
        skipped,
        errors: formErrors,
      });
    }

    const overallStatus: 'ok' | 'partial' | 'error' =
      totalErrors === 0 ? 'ok' : totalInserted > 0 ? 'partial' : 'error';

    await admin
      .from('meta_config')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: overallStatus,
        last_sync_message: `Insertados ${totalInserted}, omitidos ${totalSkipped}, con error ${totalErrors}`,
        last_sync_inserted: totalInserted,
        last_sync_skipped: totalSkipped,
      })
      .eq('company_id', companyId);

    return new Response(
      JSON.stringify({
        ok: true,
        inserted: totalInserted,
        skipped: totalSkipped,
        errors: totalErrors,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error sincronizando Meta';
    console.error('meta-sync-leads failed', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
