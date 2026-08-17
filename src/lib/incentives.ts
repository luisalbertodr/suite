import { supabase } from '@/lib/supabase';

export type IncentiveShare = {
  employee_id: string;
  share_pct: number;
};

export type IncentiveHistoryRow = {
  id: string;
  source: string;
  minutes: number;
  share_pct: number;
  eligible: boolean;
  tier_code: string | null;
  notes: string | null;
  occurred_at: string;
  created_at: string;
  bono_id: string | null;
  amount_eur?: number | null;
  lead_id?: string | null;
};

export type IncentiveRequestRow = {
  id: string;
  employee_id?: string;
  employee_name?: string;
  requested_date: string;
  start_time: string;
  end_time: string;
  minutes: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes: string | null;
  review_notes?: string | null;
  created_at?: string;
};

export type IncentiveTrack = 'cabina' | 'recepcion' | 'none';

export type IncentiveMySummary = {
  ok: boolean;
  linked: boolean;
  employee_id?: string;
  balance_minutes: number;
  enabled: boolean;
  track: IncentiveTrack;
  model: string;
  revenue_min_eur: number;
  revenue_step_eur: number;
  revenue_base_hours: number;
  revenue_step_hours: number;
  cash_per_hour: number;
  lead_min_count: number;
  lead_step_count: number;
  month_amount_eur: number;
  month_leads: number;
  month_tier_hours: number;
  month_awarded_minutes: number;
  next_threshold: number | null;
  /** @deprecated cupo por recuento; se mantiene por compat */
  baseline: number;
  month_eligible: number;
  next_milestone: { count: number; extra_minutes: number } | null;
  history: IncentiveHistoryRow[];
  requests: IncentiveRequestRow[];
};

export type IncentiveAdminOverview = {
  ok: boolean;
  pending: IncentiveRequestRow[];
  balances: Array<{
    employee_id: string;
    employee_name: string;
    track?: IncentiveTrack;
    balance_minutes: number;
    month_eligible?: number;
    month_amount_eur?: number;
    month_leads?: number;
    month_tier_minutes?: number;
  }>;
  settings?: {
    revenue_min_eur: number;
    revenue_step_eur: number;
    revenue_base_hours: number;
    revenue_step_hours: number;
    cash_per_hour: number;
    lead_min_count: number;
    lead_step_count: number;
  };
};

export type IncentiveSettings = {
  company_id: string;
  enabled: boolean;
  min_eligible_amount: number;
  revenue_min_eur: number;
  revenue_step_eur: number;
  revenue_base_hours: number;
  revenue_step_hours: number;
  cash_per_hour: number;
  lead_min_count: number;
  lead_step_count: number;
  lead_base_hours: number;
  lead_step_hours: number;
  /** legacy fields kept optional for older rows */
  monthly_baseline_count?: number;
  type_a_minutes?: number;
  type_b_minutes?: number;
  type_a_min_amount?: number;
};

export type IncentiveEmployeeTrackRow = {
  employee_id: string;
  company_id: string;
  track: IncentiveTrack;
  active: boolean;
};

export type IncentiveBonusRule = {
  id: string;
  company_id: string;
  article_id: string | null;
  bonus_definition_id: string | null;
  name_pattern: string | null;
  tier_code: 'A' | 'B' | 'X';
  minutes_per_sale: number;
  active: boolean;
  articles?: { codigo: string; descripcion: string; precio: number } | null;
};

const db = {
  from: (table: string) => (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(table),
  rpc: (fn: string, args?: Record<string, unknown>) =>
    (supabase as unknown as { rpc: (name: string, params?: Record<string, unknown>) => ReturnType<typeof supabase.rpc> }).rpc(
      fn,
      args,
    ),
};

export function formatMinutesAsHours(minutes: number): string {
  const n = Number(minutes) || 0;
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  if (h <= 0) return `${sign}${m} min`;
  if (m === 0) return `${sign}${h} h`;
  return `${sign}${h} h ${m} min`;
}

export function hoursFromRevenue(
  amount: number,
  minEur = 2000,
  stepEur = 500,
  baseHours = 4,
  stepHours = 2,
): number {
  if (amount < minEur) return 0;
  return baseHours + Math.floor((amount - minEur) / stepEur) * stepHours;
}

export function hoursFromLeads(
  count: number,
  minCount = 15,
  stepCount = 5,
  baseHours = 4,
  stepHours = 2,
): number {
  if (count < minCount) return 0;
  return baseHours + Math.floor((count - minCount) / stepCount) * stepHours;
}

export function incentiveRevenueProgress(amount: number, minEur: number, stepEur: number): {
  pct: number;
  label: string;
  remainingToReward: number;
} {
  if (amount < minEur) {
    return {
      pct: Math.min(100, Math.round((amount / Math.max(minEur, 1)) * 100)),
      label: `${amount.toFixed(0)} € / ${minEur.toFixed(0)} € para el primer tramo (4 h)`,
      remainingToReward: Math.max(0, minEur - amount),
    };
  }
  const hours = hoursFromRevenue(amount, minEur, stepEur);
  const next = minEur + (Math.floor((amount - minEur) / stepEur) + 1) * stepEur;
  return {
    pct: 100,
    label: `Tramo actual: ${hours} h · siguiente a ${next.toFixed(0)} €`,
    remainingToReward: Math.max(0, next - amount),
  };
}

export function incentiveLeadProgress(leads: number, minCount: number, stepCount: number): {
  pct: number;
  label: string;
  remainingToReward: number;
} {
  if (leads < minCount) {
    return {
      pct: Math.min(100, Math.round((leads / Math.max(minCount, 1)) * 100)),
      label: `${leads} / ${minCount} leads presentados para el primer tramo (4 h)`,
      remainingToReward: Math.max(0, minCount - leads),
    };
  }
  const hours = hoursFromLeads(leads, minCount, stepCount);
  const next = minCount + (Math.floor((leads - minCount) / stepCount) + 1) * stepCount;
  return {
    pct: 100,
    label: `Tramo actual: ${hours} h · siguiente a ${next} presentadas`,
    remainingToReward: Math.max(0, next - leads),
  };
}

/** @deprecated usar incentiveRevenueProgress */
export function incentiveProgress(eligible: number, baseline: number): {
  pct: number;
  label: string;
  remainingToReward: number;
} {
  return incentiveRevenueProgress(eligible, baseline, 500);
}

export async function fetchIncentiveMySummary(companyId: string): Promise<IncentiveMySummary> {
  const { data, error } = await db.rpc('incentive_my_summary', { p_company_id: companyId });
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    ok: Boolean(raw.ok),
    linked: Boolean(raw.linked),
    employee_id: raw.employee_id ? String(raw.employee_id) : undefined,
    balance_minutes: Number(raw.balance_minutes ?? 0),
    enabled: raw.enabled !== false,
    track: (raw.track as IncentiveTrack) || 'cabina',
    model: String(raw.model ?? 'revenue_tiers'),
    revenue_min_eur: Number(raw.revenue_min_eur ?? 2000),
    revenue_step_eur: Number(raw.revenue_step_eur ?? 500),
    revenue_base_hours: Number(raw.revenue_base_hours ?? 4),
    revenue_step_hours: Number(raw.revenue_step_hours ?? 2),
    cash_per_hour: Number(raw.cash_per_hour ?? 10),
    lead_min_count: Number(raw.lead_min_count ?? 15),
    lead_step_count: Number(raw.lead_step_count ?? 5),
    month_amount_eur: Number(raw.month_amount_eur ?? 0),
    month_leads: Number(raw.month_leads ?? 0),
    month_tier_hours: Number(raw.month_tier_hours ?? 0),
    month_awarded_minutes: Number(raw.month_awarded_minutes ?? 0),
    next_threshold: raw.next_threshold != null ? Number(raw.next_threshold) : null,
    baseline: Number(raw.baseline ?? raw.revenue_min_eur ?? 2000),
    month_eligible: Number(raw.month_eligible ?? 0),
    next_milestone: (raw.next_milestone as IncentiveMySummary['next_milestone']) ?? null,
    history: Array.isArray(raw.history) ? (raw.history as IncentiveHistoryRow[]) : [],
    requests: Array.isArray(raw.requests) ? (raw.requests as IncentiveRequestRow[]) : [],
  };
}

export async function fetchIncentiveAdminOverview(companyId: string): Promise<IncentiveAdminOverview> {
  const { data, error } = await db.rpc('incentive_admin_overview', { p_company_id: companyId });
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    ok: Boolean(raw.ok),
    pending: Array.isArray(raw.pending) ? (raw.pending as IncentiveRequestRow[]) : [],
    balances: Array.isArray(raw.balances)
      ? (raw.balances as IncentiveAdminOverview['balances'])
      : [],
    settings: raw.settings as IncentiveAdminOverview['settings'],
  };
}

export async function creditBonoSale(bonoId: string, shares: IncentiveShare[]): Promise<void> {
  const payload = shares
    .filter((s) => s.employee_id && s.share_pct > 0)
    .map((s) => ({ employee_id: s.employee_id, share_pct: s.share_pct }));
  const { error } = await db.rpc('incentive_credit_bono_sale', {
    p_bono_id: bonoId,
    p_shares: payload.length ? payload : null,
  });
  if (error) throw error;
}

export async function createIncentiveRequest(input: {
  companyId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}): Promise<string> {
  const { data, error } = await db.rpc('incentive_create_request', {
    p_company_id: input.companyId,
    p_requested_date: input.date,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function reviewIncentiveRequest(input: {
  requestId: string;
  approve: boolean;
  reviewNotes?: string;
  appointmentId?: string | null;
  legacyIdplan?: string | null;
}): Promise<void> {
  const { error } = await db.rpc('incentive_review_request', {
    p_request_id: input.requestId,
    p_approve: input.approve,
    p_review_notes: input.reviewNotes ?? null,
    p_appointment_id: input.appointmentId ?? null,
    p_legacy_idplan: input.legacyIdplan ?? null,
  });
  if (error) throw error;
}

export async function cashIncentivePayout(input: {
  companyId: string;
  employeeId: string;
  hours: number;
  notes?: string;
}): Promise<{ euros: number }> {
  const { data, error } = await db.rpc('incentive_cash_payout', {
    p_company_id: input.companyId,
    p_employee_id: input.employeeId,
    p_hours: input.hours,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, unknown>;
  return { euros: Number(raw.euros ?? 0) };
}

export async function fetchIncentiveSettings(companyId: string): Promise<IncentiveSettings | null> {
  const { data, error } = await db
    .from('incentive_settings')
    .select(
      'company_id,enabled,min_eligible_amount,revenue_min_eur,revenue_step_eur,revenue_base_hours,revenue_step_hours,cash_per_hour,lead_min_count,lead_step_count,lead_base_hours,lead_step_hours,monthly_baseline_count,type_a_minutes,type_b_minutes,type_a_min_amount',
    )
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    company_id: String(row.company_id),
    enabled: Boolean(row.enabled),
    min_eligible_amount: Number(row.min_eligible_amount ?? 100),
    revenue_min_eur: Number(row.revenue_min_eur ?? 2000),
    revenue_step_eur: Number(row.revenue_step_eur ?? 500),
    revenue_base_hours: Number(row.revenue_base_hours ?? 4),
    revenue_step_hours: Number(row.revenue_step_hours ?? 2),
    cash_per_hour: Number(row.cash_per_hour ?? 10),
    lead_min_count: Number(row.lead_min_count ?? 15),
    lead_step_count: Number(row.lead_step_count ?? 5),
    lead_base_hours: Number(row.lead_base_hours ?? 4),
    lead_step_hours: Number(row.lead_step_hours ?? 2),
    monthly_baseline_count: Number(row.monthly_baseline_count ?? 4),
    type_a_minutes: Number(row.type_a_minutes ?? 60),
    type_b_minutes: Number(row.type_b_minutes ?? 30),
    type_a_min_amount: Number(row.type_a_min_amount ?? 450),
  };
}

export async function upsertIncentiveSettings(settings: IncentiveSettings): Promise<void> {
  const { error } = await db.from('incentive_settings').upsert({
    company_id: settings.company_id,
    enabled: settings.enabled,
    min_eligible_amount: settings.min_eligible_amount,
    revenue_min_eur: settings.revenue_min_eur,
    revenue_step_eur: settings.revenue_step_eur,
    revenue_base_hours: settings.revenue_base_hours,
    revenue_step_hours: settings.revenue_step_hours,
    cash_per_hour: settings.cash_per_hour,
    lead_min_count: settings.lead_min_count,
    lead_step_count: settings.lead_step_count,
    lead_base_hours: settings.lead_base_hours,
    lead_step_hours: settings.lead_step_hours,
    model_version: 'revenue_tiers',
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchIncentiveEmployeeTracks(
  companyId: string,
): Promise<IncentiveEmployeeTrackRow[]> {
  const { data, error } = await db
    .from('incentive_employee_tracks')
    .select('employee_id,company_id,track,active')
    .eq('company_id', companyId);
  if (error) throw error;
  return (data ?? []) as IncentiveEmployeeTrackRow[];
}

export async function upsertIncentiveEmployeeTrack(row: IncentiveEmployeeTrackRow): Promise<void> {
  const { error } = await db.from('incentive_employee_tracks').upsert({
    employee_id: row.employee_id,
    company_id: row.company_id,
    track: row.track,
    active: row.active,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchIncentiveBonusRules(companyId: string): Promise<IncentiveBonusRule[]> {
  const { data, error } = await db
    .from('incentive_bonus_rules')
    .select(
      'id,company_id,article_id,bonus_definition_id,name_pattern,tier_code,minutes_per_sale,active,articles:article_id(codigo,descripcion,precio)',
    )
    .eq('company_id', companyId)
    .order('tier_code')
    .order('minutes_per_sale', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IncentiveBonusRule[];
}

export async function updateIncentiveBonusRule(
  id: string,
  patch: Partial<Pick<IncentiveBonusRule, 'tier_code' | 'minutes_per_sale' | 'active'>>,
): Promise<void> {
  const { error } = await db.from('incentive_bonus_rules').update(patch).eq('id', id);
  if (error) throw error;
}

export async function fetchIncentiveMilestones(
  companyId: string,
): Promise<Array<{ id: string; eligible_count: number; extra_minutes: number; active: boolean }>> {
  const { data, error } = await db
    .from('incentive_milestones')
    .select('id,eligible_count,extra_minutes,active')
    .eq('company_id', companyId)
    .order('eligible_count');
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    eligible_count: number;
    extra_minutes: number;
    active: boolean;
  }>;
}

export async function updateIncentiveMilestone(
  id: string,
  patch: { active?: boolean; extra_minutes?: number },
): Promise<void> {
  const { error } = await db.from('incentive_milestones').update(patch).eq('id', id);
  if (error) throw error;
}
