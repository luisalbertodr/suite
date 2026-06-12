import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Empresa activa del usuario (multi-empresa / varios perfiles). */
export async function resolveUserCompanyId(
  admin: SupabaseClient,
  userId: string,
  requestedCompanyId?: string,
): Promise<string | null> {
  const allowed = new Set<string>();

  const { data: active } = await admin
    .from('user_active_company')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (active?.company_id) allowed.add(String(active.company_id));

  const { data: profiles } = await admin
    .from('user_profiles')
    .select('company_id')
    .eq('user_id', userId);
  for (const row of profiles ?? []) {
    if (row.company_id) allowed.add(String(row.company_id));
  }

  const { data: roles } = await admin
    .from('user_company_roles')
    .select('company_id')
    .eq('user_id', userId);
  for (const row of roles ?? []) {
    if (row.company_id) allowed.add(String(row.company_id));
  }

  if (requestedCompanyId && allowed.has(requestedCompanyId)) {
    return requestedCompanyId;
  }
  if (active?.company_id) return String(active.company_id);
  const first = profiles?.find((p) => p.company_id)?.company_id;
  if (first) return String(first);
  const roleCompany = roles?.find((r) => r.company_id)?.company_id;
  return roleCompany ? String(roleCompany) : null;
}
