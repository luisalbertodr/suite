import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  findMarketingIntakeStageId,
  type MarketingStageRoleLike,
} from './marketingStageRoles.ts';

export { findMarketingIntakeStageId } from './marketingStageRoles.ts';

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
  return findMarketingIntakeStageId((data ?? []) as MarketingStageRoleLike[]);
}
