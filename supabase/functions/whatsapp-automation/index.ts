import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  defaultDayBeforeMessage,
  defaultHourBeforeMessage,
  loadAutomationSettings,
  runAppointmentRemindersForCompany,
  sendAutomatedWhatsapp,
} from '../_shared/whatsappAutomationDispatch.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-automation-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  action?: 'run_reminders' | 'test_send';
  company_id?: string;
  test_type?: 'day_before' | 'hour_before';
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function authorize(
  req: Request,
  admin: ReturnType<typeof createClient>,
): Promise<{ ok: true; source: string } | { ok: false; status: number; error: string }> {
  const cronSecret = Deno.env.get('WHATSAPP_AUTOMATION_CRON_SECRET') ??
    Deno.env.get('SERVICE_MONITOR_CRON_SECRET');
  const headerSecret = req.headers.get('x-automation-secret');
  if (cronSecret && headerSecret === cronSecret) {
    return { ok: true, source: 'cron' };
  }

  const auth = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!auth) return { ok: false, status: 401, error: 'No autorizado' };

  const token = auth.replace(/^Bearer\s+/i, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) {
    return { ok: true, source: 'service_role' };
  }

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: 'Token inválido' };

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, error: 'Config Supabase incompleta' };
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin');
  if (adminErr || !isAdmin) {
    return { ok: false, status: 403, error: 'Solo administradores' };
  }
  return { ok: true, source: 'ui' };
}

async function resolveCompanyId(
  admin: ReturnType<typeof createClient>,
  explicit?: string,
): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await admin.from('companies').select('id').limit(1).maybeSingle();
  return data?.id ?? null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const auth = await authorize(req, admin);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action ?? (auth.source === 'cron' ? 'run_reminders' : 'test_send');
  const companyId = await resolveCompanyId(admin, body.company_id);
  if (!companyId) return json({ error: 'Sin empresa' }, 400);

  if (action === 'run_reminders') {
    const { data: companies } = await admin.from('companies').select('id');
    const summary: Record<string, unknown> = {};
    for (const c of companies ?? []) {
      try {
        summary[c.id] = await runAppointmentRemindersForCompany(admin, c.id);
      } catch (e) {
        summary[c.id] = {
          error: e instanceof Error ? e.message : 'Error',
        };
      }
    }
    return json({ ok: true, action, summary });
  }

  if (action === 'test_send') {
    const settings = await loadAutomationSettings(admin, companyId);
    const testPhone = settings.test_phone || '667435503';
    const sampleDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const template =
      body.test_type === 'hour_before'
        ? settings.appointment_reminder_hour_before_message ?? defaultHourBeforeMessage()
        : settings.appointment_reminder_day_before_message ?? defaultDayBeforeMessage();
    const text = template
      .replace(/\{nombre\}/g, 'María')
      .replace(/\{nombre_completo\}/g, 'María García')
      .replace(/\{fecha_cita\}/g, 'mañana 15 de junio')
      .replace(/\{hora_cita\}/g, '11:00')
      .replace(/\{titulo\}/g, 'Consulta')
      .replace(/\{profesional\}/g, 'Ana')
      .replace(/\{cita\}/g, 'mañana 15 de junio 11:00');

    const res = await sendAutomatedWhatsapp(admin, companyId, testPhone, text, {
      automation_type: 'test_manual',
      reference_id: `test-${Date.now()}`,
      intended_label: 'María García (667123456)',
    });
    return json({ ok: res.ok, error: res.error, sent_to: testPhone, test_mode: settings.test_mode_enabled });
  }

  return json({ error: 'Acción desconocida' }, 400);
});
