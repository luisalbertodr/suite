import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const INTAKE_NAME_ALIASES = new Set(['nuevo lead', 'nuevo formulario']);

type StageRow = {
  id: string;
  name: string;
  is_default_intake?: boolean;
  position?: number;
};

function normalizeStageName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function findMarketingIntakeStageId(stages: StageRow[]): string | null {
  if (!stages.length) return null;
  const byAlias = stages.find((s) => INTAKE_NAME_ALIASES.has(normalizeStageName(s.name)));
  if (byAlias) return byAlias.id;
  const byFlag = stages.find((s) => s.is_default_intake);
  if (byFlag) return byFlag.id;
  const byPosition = stages.find((s) => s.position === 0);
  if (byPosition) return byPosition.id;
  return stages[0]?.id ?? null;
}

export async function loadMarketingIntakeStageId(
  admin: SupabaseClient,
  companyId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('marketing_lead_stages')
    .select('id, name, is_default_intake, position')
    .eq('company_id', companyId)
    .order('position', { ascending: true });
  if (error) throw error;
  return findMarketingIntakeStageId((data ?? []) as StageRow[]);
}
