import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentStatePatch = {
  last_cola_id?: number;
  agent_last_tick_at?: string;
  last_outbound_ok_at?: string;
  last_inbound_ok_at?: string;
  outbound_errors?: number;
  inbound_errors?: number;
  agent_version?: string;
  worker_version?: string | null;
  last_error?: string | null;
  last_error_at?: string | null;
  inbound_worker_status?: string;
  inbound_worker_last_seen_at?: string | null;
  inbound_worker_alert_at?: string | null;
  inbound_worker_alert_message?: string | null;
  last_outbound_lag_ms?: number;
  last_inbound_lag_ms?: number;
};

export async function patchAgentState(
  supabase: SupabaseClient,
  companyId: string,
  patch: AgentStatePatch,
): Promise<void> {
  const { error } = await supabase
    .schema("dunasoft")
    .from("style_sync_agent_state")
    .upsert({ company_id: companyId, ...patch }, { onConflict: "company_id" });
  if (error) throw error;
}

export async function incrementAgentErrors(
  supabase: SupabaseClient,
  companyId: string,
  field: "outbound_errors" | "inbound_errors",
  lastError: string,
): Promise<void> {
  const { data, error } = await supabase
    .schema("dunasoft")
    .from("style_sync_agent_state")
    .select(field)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  const current = Number((data as Record<string, unknown> | null)?.[field] ?? 0);
  await patchAgentState(supabase, companyId, {
    [field]: current + 1,
    last_error: lastError,
    last_error_at: new Date().toISOString(),
  } as AgentStatePatch);
}
