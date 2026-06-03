import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LegacyImportAction = 'getStatus' | 'reset' | 'createRun' | 'getRun' | 'listRuns';

type LegacyImportBody = {
  action: LegacyImportAction;
  companyId?: string;
  scope?: 'sales' | 'appointments' | 'all';
  mode?: 'staging' | 'refresh' | 'full' | 'promote-only';
  options?: Record<string, unknown>;
  runId?: string;
  limit?: number;
};

async function resolveCompanyId(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  requestedCompanyId?: string,
): Promise<string | null> {
  const allowed = new Set<string>();

  const [activeRes, profilesRes, rolesRes] = await Promise.all([
    supabaseAdmin
      .from('user_active_company')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin.from('user_profiles').select('company_id').eq('user_id', userId),
    supabaseAdmin.from('user_company_roles').select('company_id').eq('user_id', userId),
  ]);

  const active = activeRes.data;
  if (active?.company_id) allowed.add(String(active.company_id));
  for (const row of profilesRes.data ?? []) {
    if (row.company_id) allowed.add(String(row.company_id));
  }
  for (const row of rolesRes.data ?? []) {
    if (row.company_id) allowed.add(String(row.company_id));
  }

  if (requestedCompanyId && allowed.has(requestedCompanyId)) {
    return requestedCompanyId;
  }
  if (active?.company_id) return String(active.company_id);
  const first = profilesRes.data?.find((p) => p.company_id)?.company_id;
  if (first) return String(first);
  const roleCompany = rolesRes.data?.find((r) => r.company_id)?.company_id;
  return roleCompany ? String(roleCompany) : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isStatementTimeout(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const o = err as { code?: string; message?: string };
  return (
    o.code === '57014' ||
    (typeof o.message === 'string' &&
      o.message.includes('statement timeout'))
  );
}

function degradedStatus(lastRun: Record<string, unknown> | null) {
  return {
    legacy_staging: {
      planinc_rows: 0,
      faccab_rows: 0,
      albcab_rows: 0,
      last_imported_at: null,
      last_import_batch: null,
      row_counts_approximate: true,
    },
    public_promoted: {
      legacy_appointments: null,
      legacy_sales: null,
      legacy_invoices: null,
      counts_deferred: true,
    },
    last_run: lastRun,
    degraded: true,
  };
}

async function fetchLastRun(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
) {
  const { data } = await supabaseAdmin
    .from('legacy_import_runs')
    .select(
      'id, mode, status, current_step, created_at, started_at, finished_at, error_message',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function isAuthorizedAdmin(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  email: string | undefined,
): Promise<boolean> {
  if (email) {
    const { data: su } = await supabaseAdmin
      .from('superusers')
      .select('id')
      .ilike('email', email)
      .eq('is_active', true)
      .maybeSingle();
    if (su) return true;
  }

  const { data: allowed } = await supabaseAdmin.rpc('user_has_effective_permission', {
    p_user_id: userId,
    p_resource: 'settings',
    p_action: 'read',
  });
  return allowed === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'No authorization header' }, 401);
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));

    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const allowed = await isAuthorizedAdmin(supabaseAdmin, user.id, user.email);
    if (!allowed) {
      return json({ error: 'Sin permiso de configuración' }, 403);
    }

    let body: LegacyImportBody;
    try {
      body = (await req.json()) as LegacyImportBody;
    } catch {
      return json({ error: 'Cuerpo JSON inválido' }, 400);
    }

    const { action } = body;
    if (!action) {
      return json({ error: 'action requerida' }, 400);
    }

    const companyId = await resolveCompanyId(supabaseAdmin, user.id, body.companyId);
    if (!companyId) {
      return json({ error: 'Empresa no encontrada para este usuario' }, 400);
    }

    if (action === 'getStatus') {
      try {
        const { data, error } = await supabaseAdmin.rpc('legacy_import_get_status', {
          p_company_id: companyId,
        });
        if (error) {
          if (isStatementTimeout(error)) {
            const lastRun = await fetchLastRun(supabaseAdmin, companyId);
            return json({ status: degradedStatus(lastRun) });
          }
          throw error;
        }
        return json({ status: data });
      } catch (err) {
        if (isStatementTimeout(err)) {
          const lastRun = await fetchLastRun(supabaseAdmin, companyId);
          return json({ status: degradedStatus(lastRun) });
        }
        throw err;
      }
    }

    if (action === 'reset') {
      const scope = body.scope ?? 'sales';
      const { data, error } = await supabaseAdmin.rpc('legacy_import_reset_public', {
        p_company_id: companyId,
        p_scope: scope,
      });
      if (error) throw error;
      return json({ result: data });
    }

    if (action === 'createRun') {
      const mode = body.mode ?? 'refresh';
      const options = body.options ?? {};
      const { data, error } = await supabaseAdmin
        .from('legacy_import_runs')
        .insert({
          company_id: companyId,
          mode,
          status: 'queued',
          options,
          created_by: user.id,
        })
        .select('id, mode, status, created_at')
        .single();
      if (error) throw error;

      const runId = data.id as string;
      const workerCommand =
        `python scripts/legacy_import_worker.py --run-id ${runId}`;

      return json({
        run: data,
        workerCommand,
        manualNote:
          'Ejecute este comando en el servidor donde están los DBF y el repositorio Suite (con SUPABASE_DB_URL en .env).',
      });
    }

    if (action === 'getRun') {
      if (!body.runId) return json({ error: 'runId requerido' }, 400);
      const { data, error } = await supabaseAdmin
        .from('legacy_import_runs')
        .select('*')
        .eq('id', body.runId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Ejecución no encontrada' }, 404);
      return json({ run: data });
    }

    if (action === 'listRuns') {
      const limit = Math.min(body.limit ?? 10, 50);
      try {
        const { data, error } = await supabaseAdmin
          .from('legacy_import_runs')
          .select(
            'id, mode, status, current_step, created_at, started_at, finished_at, error_message',
          )
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) {
          if (isStatementTimeout(error)) return json({ runs: [] });
          throw error;
        }
        return json({ runs: data ?? [] });
      } catch (err) {
        if (isStatementTimeout(err)) return json({ runs: [] });
        throw err;
      }
    }

    return json({ error: 'Acción desconocida' }, 400);
  } catch (err) {
    console.error('legacy-import error:', err);
    if (isStatementTimeout(err)) {
      return json(
        { error: 'Base de datos ocupada (timeout). Reintente en unos segundos.' },
        503,
      );
    }
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error
          ? err.message
          : 'Error interno';
    return json({ error: message }, 500);
  }
});
