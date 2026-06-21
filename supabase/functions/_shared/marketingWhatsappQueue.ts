import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadMetaFormAutomation,
  sendInitialAutomationForLead,
  formHasInitialWhatsappContent,
  type MarketingLeadAutomationRow,
  type MetaFormAutomation,
} from './marketingWhatsappAutomation.ts';
import {
  loadMarketingIntakeStageId,
} from './marketingIntakeStage.ts';
import {
  isMorningCatchupWindow,
  isWithinAutomationHours,
  madridDateKey,
  normalizeAutomationHours,
} from './whatsappAutomationHours.ts';
import type { WhatsappAutomationSettings } from './whatsappAutomationDispatch.ts';

export type MarketingWhatsappQueueSettings = WhatsappAutomationSettings & {
  marketing_queue_daily_limit: number;
  marketing_queue_hour_start: number;
  marketing_queue_hour_end: number;
  marketing_queue_min_pause_seconds: number;
  marketing_queue_max_pause_seconds: number;
  marketing_queue_last_sent_at: string | null;
  marketing_queue_next_send_at: string | null;
};

export function normalizeQueueSettings(
  settings: MarketingWhatsappQueueSettings,
): MarketingWhatsappQueueSettings {
  return {
    ...settings,
    marketing_queue_daily_limit: settings.marketing_queue_daily_limit ?? 100,
    marketing_queue_hour_start: settings.marketing_queue_hour_start ?? 10,
    marketing_queue_hour_end: settings.marketing_queue_hour_end ?? 20,
    marketing_queue_min_pause_seconds: settings.marketing_queue_min_pause_seconds ?? 180,
    marketing_queue_max_pause_seconds: settings.marketing_queue_max_pause_seconds ?? 900,
  };
}

const IN_QUERY_CHUNK = 80;

const LEAD_SELECT_FOR_QUEUE =
  'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, external_created_at, created_at, archived_at, stage_id';

async function mapLeadStageByIds(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, string | null>> {
  const stageByLead = new Map<string, string | null>();
  for (let i = 0; i < leadIds.length; i += IN_QUERY_CHUNK) {
    const chunk = leadIds.slice(i, i + IN_QUERY_CHUNK);
    const { data, error } = await admin
      .from('marketing_leads')
      .select('id, stage_id')
      .in('id', chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      stageByLead.set(row.id as string, row.stage_id as string | null);
    }
  }
  return stageByLead;
}

async function updateQueueRowsInChunks(
  admin: SupabaseClient,
  queueIds: string[],
  values: Record<string, unknown>,
): Promise<void> {
  for (let i = 0; i < queueIds.length; i += IN_QUERY_CHUNK) {
    const chunk = queueIds.slice(i, i + IN_QUERY_CHUNK);
    const { error } = await admin
      .from('marketing_whatsapp_queue')
      .update(values)
      .in('id', chunk)
      .eq('status', 'pending');
    if (error) throw error;
  }
}

type LeadRow = MarketingLeadAutomationRow & {
  external_created_at: string | null;
  created_at: string;
  archived_at: string | null;
  stage_id: string | null;
};

function randomPauseMs(
  settings: MarketingWhatsappQueueSettings,
  morningCatchup = false,
): number {
  const s = normalizeQueueSettings(settings);
  const min = Math.min(s.marketing_queue_min_pause_seconds, s.marketing_queue_max_pause_seconds);
  const max = Math.max(s.marketing_queue_min_pause_seconds, s.marketing_queue_max_pause_seconds);
  const effectiveMax = morningCatchup ? Math.min(max, 120) : max;
  const effectiveMin = morningCatchup ? Math.min(min, 60) : min;
  const seconds = effectiveMin + Math.random() * (effectiveMax - effectiveMin);
  return Math.round(seconds * 1000);
}

const MAX_AUTO_ENQUEUE_AGE_MS = 72 * 60 * 60 * 1000;

function isRecentLeadForAutoEnqueue(lead: LeadRow): boolean {
  const key = lead.external_created_at ?? lead.created_at;
  if (!key) return false;
  const t = new Date(key).getTime();
  return Number.isFinite(t) && Date.now() - t < MAX_AUTO_ENQUEUE_AGE_MS;
}

async function autoEnqueueEligibleLeads(
  admin: SupabaseClient,
  companyId: string,
): Promise<number> {
  const eligible = await collectEligibleLeadsNotInQueue(admin, companyId);
  const recent = eligible.filter(isRecentLeadForAutoEnqueue);
  if (recent.length === 0) return 0;
  const { enqueued } = await enqueueMarketingLeadsById(
    admin,
    companyId,
    recent.map((l) => l.id),
    null,
  );
  return enqueued;
}

/** Al abrir el día, no heredar pausas de la jornada anterior si hay cola pendiente. */
async function resetQueuePauseAtDayStart(
  admin: SupabaseClient,
  companyId: string,
  settings: MarketingWhatsappQueueSettings,
): Promise<void> {
  const { count } = await admin
    .from('marketing_whatsapp_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'pending');
  if (!count) return;

  const lastSent = settings.marketing_queue_last_sent_at;
  const todayKey = madridDateKey();
  const lastKey = lastSent ? madridDateKey(new Date(lastSent)) : null;
  if (lastKey && lastKey >= todayKey) return;

  await admin
    .from('whatsapp_automation_settings')
    .update({
      marketing_queue_next_send_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);
}

function leadSortKey(lead: LeadRow): string {
  return lead.external_created_at ?? lead.created_at ?? '';
}

function compareLeadsNewestFirst(a: LeadRow, b: LeadRow): number {
  return leadSortKey(b).localeCompare(leadSortKey(a));
}

const META_FORM_SELECT =
  'id, form_id, form_name, whatsapp_automation_enabled, whatsapp_initial_message, whatsapp_initial_audio_enabled, whatsapp_initial_audio_path, whatsapp_initial_audio_filename, whatsapp_initial_audio_mime, whatsapp_reply_1_message, whatsapp_reply_2_message, whatsapp_reply_invalid_message, whatsapp_reminder_message, whatsapp_reminder_delay_hours, whatsapp_reminder_enabled, stripe_deposit_enabled, stripe_deposit_amount_cents';

async function loadMetaFormByName(
  admin: SupabaseClient,
  companyId: string,
  formName: string,
): Promise<MetaFormAutomation | null> {
  const { data } = await admin
    .from('meta_forms')
    .select(META_FORM_SELECT)
    .eq('company_id', companyId)
    .eq('form_name', formName.trim())
    .maybeSingle();
  return (data as MetaFormAutomation | null) ?? null;
}

function inferMetaFormNameFromCampaign(campaign: string | null | undefined): string | null {
  const c = campaign?.trim() ?? '';
  if (!c) return null;
  if (/body\s*sculpt/i.test(c)) return 'Body Sculpt';
  if (/método\s*skin|metodo\s*skin/i.test(c)) return 'Método Skin Lipoout';
  return null;
}

async function resolveMetaFormForLead(
  admin: SupabaseClient,
  companyId: string,
  lead: LeadRow,
): Promise<MetaFormAutomation | null> {
  if (lead.meta_form_id) {
    return await loadMetaFormAutomation(admin, lead.meta_form_id);
  }
  const formName = lead.form_name?.trim() || inferMetaFormNameFromCampaign(lead.campaign);
  if (!formName) return null;
  return await loadMetaFormByName(admin, companyId, formName);
}

export function isLeadEligibleForWhatsappQueue(
  lead: LeadRow,
  intakeStageId: string | null,
): boolean {
  if (!intakeStageId) return false;
  if (lead.stage_id !== intakeStageId) return false;
  if (lead.archived_at) return false;
  if (!lead.phone?.trim()) return false;
  if (lead.wa_automation_initial_sent_at) return false;
  return true;
}

const QUEUE_CANCEL_NOT_INTAKE = 'Lead fuera de la etapa «Nuevo lead»';

async function pruneQueueNotInIntakeStage(
  admin: SupabaseClient,
  companyId: string,
  intakeStageId: string,
): Promise<number> {
  const { data: rows, error } = await admin
    .from('marketing_whatsapp_queue')
    .select('id, marketing_lead_id')
    .eq('company_id', companyId)
    .eq('status', 'pending');
  if (error) throw error;
  if (!rows?.length) return 0;

  const leadIds = rows.map((r) => r.marketing_lead_id as string);
  const stageByLead = await mapLeadStageByIds(admin, leadIds);
  const toCancel = rows
    .filter((r) => stageByLead.get(r.marketing_lead_id as string) !== intakeStageId)
    .map((r) => r.id as string);

  if (toCancel.length === 0) return 0;

  await updateQueueRowsInChunks(admin, toCancel, {
    status: 'cancelled',
    error: QUEUE_CANCEL_NOT_INTAKE,
  });
  return toCancel.length;
}

export type EligibleQueueLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  form_name: string | null;
  campaign: string | null;
  external_created_at: string | null;
  created_at: string;
};

async function collectEligibleLeadsNotInQueue(
  admin: SupabaseClient,
  companyId: string,
): Promise<LeadRow[]> {
  const intakeStageId = await loadMarketingIntakeStageId(admin, companyId);
  if (!intakeStageId) return [];

  const { data: leads, error } = await admin
    .from('marketing_leads')
    .select(
      'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, external_created_at, created_at, archived_at, stage_id',
    )
    .eq('company_id', companyId)
    .eq('stage_id', intakeStageId)
    .is('wa_automation_initial_sent_at', null)
    .is('archived_at', null)
    .not('phone', 'is', null);

  if (error) throw error;

  const { data: queuedRows } = await admin
    .from('marketing_whatsapp_queue')
    .select('marketing_lead_id, status')
    .eq('company_id', companyId)
    .in('status', ['pending', 'sent']);

  const blockedIds = new Set(
    (queuedRows ?? []).map((r) => r.marketing_lead_id as string),
  );

  const eligible: LeadRow[] = [];
  for (const row of leads ?? []) {
    const lead = row as LeadRow;
    if (!isLeadEligibleForWhatsappQueue(lead, intakeStageId)) continue;
    if (blockedIds.has(lead.id)) continue;
    const form = await resolveMetaFormForLead(admin, companyId, lead);
    if (!form?.whatsapp_automation_enabled || !formHasInitialWhatsappContent(form)) continue;
    eligible.push(lead);
  }

  eligible.sort(compareLeadsNewestFirst);
  return eligible;
}

export async function listEligibleMarketingLeadsForQueue(
  admin: SupabaseClient,
  companyId: string,
): Promise<EligibleQueueLead[]> {
  const eligible = await collectEligibleLeadsNotInQueue(admin, companyId);
  return eligible.map((lead) => ({
    id: lead.id,
    first_name: lead.first_name,
    last_name: lead.last_name,
    phone: lead.phone,
    form_name: lead.form_name,
    campaign: lead.campaign,
    external_created_at: lead.external_created_at,
    created_at: lead.created_at,
  }));
}

export async function enqueueMarketingLeadsById(
  admin: SupabaseClient,
  companyId: string,
  leadIds: string[],
  queuedBy?: string | null,
): Promise<{ enqueued: number; skipped: number }> {
  const uniqueIds = [...new Set(leadIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { enqueued: 0, skipped: 0 };

  const eligible = await collectEligibleLeadsNotInQueue(admin, companyId);
  const eligibleIds = new Set(eligible.map((l) => l.id));
  const toEnqueue = uniqueIds.filter((id) => eligibleIds.has(id));
  const skipped = uniqueIds.length - toEnqueue.length;

  if (toEnqueue.length === 0) return { enqueued: 0, skipped };

  const inserts = toEnqueue.map((leadId) => ({
    company_id: companyId,
    marketing_lead_id: leadId,
    status: 'pending',
    queued_by: queuedBy ?? null,
    error: null,
    sent_at: null,
  }));

  const { error: insErr } = await admin.from('marketing_whatsapp_queue').upsert(inserts, {
    onConflict: 'company_id,marketing_lead_id',
    ignoreDuplicates: false,
  });
  if (insErr) throw insErr;

  return { enqueued: inserts.length, skipped };
}

export async function countQueueSendsToday(
  admin: SupabaseClient,
  companyId: string,
): Promise<number> {
  const dateKey = madridDateKey();
  const start = new Date(`${dateKey}T00:00:00+02:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const { count, error } = await admin
    .from('marketing_whatsapp_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'sent')
    .gte('sent_at', start.toISOString())
    .lt('sent_at', end.toISOString());
  if (error) throw error;
  return count ?? 0;
}

async function countQueueSendsTodayByKind(
  admin: SupabaseClient,
  companyId: string,
  kind: 'text' | 'audio',
): Promise<number> {
  const dateKey = madridDateKey();
  const start = new Date(`${dateKey}T00:00:00+02:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const kinds = kind === 'audio' ? ['audio', 'audio_link'] : [kind];
  const { count, error } = await admin
    .from('marketing_whatsapp_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'sent')
    .in('sent_kind', kinds)
    .gte('sent_at', start.toISOString())
    .lt('sent_at', end.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function getMarketingWhatsappQueueStats(
  admin: SupabaseClient,
  companyId: string,
  settings: MarketingWhatsappQueueSettings,
): Promise<{
  pending: number;
  sent_today: number;
  sent_today_text: number;
  sent_today_audio: number;
  daily_limit: number;
  eligible_not_queued: number;
  within_hours: boolean;
  next_send_at: string | null;
  hour_start: number;
  hour_end: number;
}> {
  const s = normalizeQueueSettings(settings);
  const intakeStageId = await loadMarketingIntakeStageId(admin, companyId);

  let pending = 0;
  if (intakeStageId) {
    const { data: pendingQueue } = await admin
      .from('marketing_whatsapp_queue')
      .select('id, marketing_leads!inner(stage_id)')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .eq('marketing_leads.stage_id', intakeStageId);
    pending = pendingQueue?.length ?? 0;
  }

  const sentToday = await countQueueSendsToday(admin, companyId);
  const sentTodayText = await countQueueSendsTodayByKind(admin, companyId, 'text');
  const sentTodayAudio = await countQueueSendsTodayByKind(admin, companyId, 'audio');

  let eligibleNotQueued = 0;
  if (intakeStageId) {
    const { data: leads } = await admin
      .from('marketing_leads')
      .select(
        'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, external_created_at, created_at, archived_at, stage_id',
      )
      .eq('company_id', companyId)
      .eq('stage_id', intakeStageId)
      .is('wa_automation_initial_sent_at', null)
      .is('archived_at', null)
      .not('phone', 'is', null);

    const { data: pendingRows } = await admin
      .from('marketing_whatsapp_queue')
      .select('marketing_lead_id')
      .eq('company_id', companyId)
      .in('status', ['pending', 'sent', 'failed']);

    const queuedIds = new Set((pendingRows ?? []).map((r) => r.marketing_lead_id as string));

    for (const row of leads ?? []) {
      const lead = row as LeadRow;
      if (!isLeadEligibleForWhatsappQueue(lead, intakeStageId)) continue;
      if (queuedIds.has(lead.id)) continue;
      const form = await resolveMetaFormForLead(admin, companyId, lead);
      if (!form?.whatsapp_automation_enabled || !formHasInitialWhatsappContent(form)) continue;
      eligibleNotQueued++;
    }
  }

  return {
    pending,
    sent_today: sentToday,
    sent_today_text: sentTodayText,
    sent_today_audio: sentTodayAudio,
    daily_limit: s.marketing_queue_daily_limit,
    eligible_not_queued: eligibleNotQueued,
    within_hours: isWithinAutomationHours(s),
    next_send_at: settings.marketing_queue_next_send_at,
    hour_start: normalizeAutomationHours(s).hour_start,
    hour_end: normalizeAutomationHours(s).hour_end,
  };
}

export async function runMarketingWhatsappQueueForCompany(
  admin: SupabaseClient,
  companyId: string,
  settings: MarketingWhatsappQueueSettings,
): Promise<{ sent: number; skipped: number; reason?: string }> {
  let s = normalizeQueueSettings(settings);

  const intakeStageId = await loadMarketingIntakeStageId(admin, companyId);
  if (!intakeStageId) {
    return { sent: 0, skipped: 0, reason: 'no_intake_stage' };
  }

  try {
    await pruneQueueNotInIntakeStage(admin, companyId, intakeStageId);
  } catch (e) {
    console.error('pruneQueueNotInIntakeStage failed:', companyId, e);
  }

  try {
    await autoEnqueueEligibleLeads(admin, companyId);
  } catch (e) {
    console.error('autoEnqueueEligibleLeads failed:', companyId, e);
  }

  if (!isWithinAutomationHours(s)) {
    return { sent: 0, skipped: 0, reason: 'outside_hours' };
  }

  try {
    await resetQueuePauseAtDayStart(admin, companyId, s);
  } catch (e) {
    console.error('resetQueuePauseAtDayStart failed:', companyId, e);
  }

  const morningCatchup = isMorningCatchupWindow(s);
  const maxPerRun = morningCatchup ? 3 : 1;
  let totalSent = 0;
  let totalSkipped = 0;
  let lastReason: string | undefined;

  for (let attempt = 0; attempt < maxPerRun; attempt++) {
    const { data: freshSettings } = await admin
      .from('whatsapp_automation_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (freshSettings) {
      s = normalizeQueueSettings(freshSettings as MarketingWhatsappQueueSettings);
    }

    const now = Date.now();
    if (s.marketing_queue_next_send_at) {
      const nextAt = new Date(s.marketing_queue_next_send_at).getTime();
      if (Number.isFinite(nextAt) && now < nextAt) {
        lastReason = 'pause';
        break;
      }
    }

    const sentToday = await countQueueSendsToday(admin, companyId);
    if (sentToday >= s.marketing_queue_daily_limit) {
      lastReason = 'daily_limit';
      break;
    }

    const result = await processNextPendingQueueLead(admin, companyId, s, morningCatchup, intakeStageId);
    if (result.sent > 0) {
      totalSent += result.sent;
      if (!morningCatchup) break;
      continue;
    }

    totalSkipped += result.skipped;
    lastReason = result.reason;
    break;
  }

  if (totalSent > 0) return { sent: totalSent, skipped: totalSkipped };
  return { sent: 0, skipped: totalSkipped, reason: lastReason ?? 'empty' };
}

async function processNextPendingQueueLead(
  admin: SupabaseClient,
  companyId: string,
  settings: MarketingWhatsappQueueSettings,
  morningCatchup: boolean,
  intakeStageId: string,
): Promise<{ sent: number; skipped: number; reason?: string }> {
  const { data: queueRows, error: qErr } = await admin
    .from('marketing_whatsapp_queue')
    .select(`
      id,
      marketing_lead_id,
      marketing_leads!inner (
        ${LEAD_SELECT_FOR_QUEUE}
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .eq('marketing_leads.stage_id', intakeStageId);

  if (qErr) throw qErr;
  if (!queueRows?.length) return { sent: 0, skipped: 0, reason: 'empty' };

  const ordered = queueRows
    .map((q) => ({
      queueId: q.id as string,
      lead: q.marketing_leads as unknown as LeadRow,
    }))
    .filter((x) => x.lead?.id)
    .sort((a, b) => compareLeadsNewestFirst(a.lead, b.lead));

  for (const item of ordered) {
    const lead = item.lead!;
    if (lead.wa_automation_initial_sent_at) {
      await admin
        .from('marketing_whatsapp_queue')
        .update({ status: 'cancelled', error: 'Ya tenía mensaje inicial enviado' })
        .eq('id', item.queueId)
        .eq('status', 'pending');
      continue;
    }

    const form = await resolveMetaFormForLead(admin, companyId, lead);
    if (!form?.whatsapp_automation_enabled || !formHasInitialWhatsappContent(form)) {
      await admin
        .from('marketing_whatsapp_queue')
        .update({ status: 'failed', error: 'Formulario sin automatización WhatsApp (texto o audio)' })
        .eq('id', item.queueId)
        .eq('status', 'pending');
      continue;
    }

    const result = await sendInitialAutomationForLead(admin, companyId, lead.id, lead, form);
    const sentNow = new Date().toISOString();
    const pauseMs = randomPauseMs(settings, morningCatchup);
    const nextSendAt = new Date(Date.now() + pauseMs).toISOString();

    if (result.ok && result.status === 'awaiting_reply') {
      await admin
        .from('marketing_whatsapp_queue')
        .update({
          status: 'sent',
          sent_at: sentNow,
          error: null,
          sent_kind: result.sent_kind ?? 'text',
        })
        .eq('id', item.queueId)
        .eq('status', 'pending');

      await admin
        .from('whatsapp_automation_settings')
        .update({
          marketing_queue_last_sent_at: sentNow,
          marketing_queue_next_send_at: nextSendAt,
          updated_at: sentNow,
        })
        .eq('company_id', companyId);

      return { sent: 1, skipped: 0 };
    }

    await admin
      .from('marketing_whatsapp_queue')
      .update({
        status: result.status === 'skipped' ? 'cancelled' : 'failed',
        error: (result.error ?? 'Envío fallido').slice(0, 500),
      })
      .eq('id', item.queueId)
      .eq('status', 'pending');

    if (result.status === 'failed') {
      await admin
        .from('whatsapp_automation_settings')
        .update({
          marketing_queue_next_send_at: nextSendAt,
          updated_at: sentNow,
        })
        .eq('company_id', companyId);
    }

    return { sent: 0, skipped: 1, reason: result.error ?? result.status };
  }

  return { sent: 0, skipped: 0, reason: 'no_eligible' };
}

/** Encola bienvenida WA inicial; no reencola si ya enviado o pendiente. */
export async function enqueueMarketingLeadForInitialWhatsapp(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  queuedBy?: string | null,
): Promise<void> {
  const { data: existing } = await admin
    .from('marketing_whatsapp_queue')
    .select('status')
    .eq('company_id', companyId)
    .eq('marketing_lead_id', leadId)
    .maybeSingle();
  if (existing?.status === 'sent' || existing?.status === 'pending') return;

  const { error } = await admin.from('marketing_whatsapp_queue').upsert(
    {
      company_id: companyId,
      marketing_lead_id: leadId,
      status: 'pending',
      queued_by: queuedBy ?? null,
    },
    { onConflict: 'company_id,marketing_lead_id' },
  );
  if (error) throw error;
}

/** Envío manual inmediato de un lead pendiente en cola (sin horario ni pausa del cron). */
export async function sendQueueLeadNow(
  admin: SupabaseClient,
  companyId: string,
  queueId: string,
  settings: MarketingWhatsappQueueSettings,
): Promise<{ ok: boolean; send_error?: string }> {
  const s = normalizeQueueSettings(settings);
  const intakeStageId = await loadMarketingIntakeStageId(admin, companyId);
  if (!intakeStageId) {
    return { ok: false, send_error: 'Etapa «Nuevo lead» no configurada' };
  }

  const { data: queueRow, error: qErr } = await admin
    .from('marketing_whatsapp_queue')
    .select('id, marketing_lead_id, status')
    .eq('company_id', companyId)
    .eq('id', queueId)
    .maybeSingle();
  if (qErr) throw qErr;
  if (!queueRow || queueRow.status !== 'pending') {
    return { ok: false, send_error: 'La fila no está pendiente en cola' };
  }

  const leadId = queueRow.marketing_lead_id as string;
  const { data: lead, error: lErr } = await admin
    .from('marketing_leads')
    .select(LEAD_SELECT_FOR_QUEUE)
    .eq('id', leadId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (lErr) throw lErr;
  if (!lead) return { ok: false, send_error: 'Lead no encontrado' };

  const leadRow = lead as LeadRow;
  if (!isLeadEligibleForWhatsappQueue(leadRow, intakeStageId)) {
    return {
      ok: false,
      send_error: 'Lead no elegible (etapa, teléfono o mensaje ya enviado)',
    };
  }

  const sentToday = await countQueueSendsToday(admin, companyId);
  if (sentToday >= s.marketing_queue_daily_limit) {
    return {
      ok: false,
      send_error: `Límite diario alcanzado (${s.marketing_queue_daily_limit}/día)`,
    };
  }

  const form = await resolveMetaFormForLead(admin, companyId, leadRow);
  if (!form?.whatsapp_automation_enabled || !formHasInitialWhatsappContent(form)) {
    await admin
      .from('marketing_whatsapp_queue')
      .update({ status: 'failed', error: 'Formulario sin automatización WhatsApp (texto o audio)' })
      .eq('id', queueId)
      .eq('status', 'pending');
    return { ok: false, send_error: 'Formulario sin automatización WhatsApp' };
  }

  const result = await sendInitialAutomationForLead(admin, companyId, leadId, leadRow, form);
  const sentNow = new Date().toISOString();

  if (result.ok && result.status === 'awaiting_reply') {
    await admin
      .from('marketing_whatsapp_queue')
      .update({
        status: 'sent',
        sent_at: sentNow,
        error: null,
        sent_kind: result.sent_kind ?? 'text',
      })
      .eq('id', queueId)
      .eq('status', 'pending');

    await admin
      .from('whatsapp_automation_settings')
      .update({
        marketing_queue_last_sent_at: sentNow,
        updated_at: sentNow,
      })
      .eq('company_id', companyId);

    return { ok: true };
  }

  await admin
    .from('marketing_whatsapp_queue')
    .update({
      status: result.status === 'skipped' ? 'cancelled' : 'failed',
      error: (result.error ?? 'Envío fallido').slice(0, 500),
    })
    .eq('id', queueId)
    .eq('status', 'pending');

  return { ok: false, send_error: result.error ?? result.status };
}

/** Reenvía bienvenida WA a leads concretos (modo prueba si está activo). */
export async function resendWelcomeWhatsappForLeads(
  admin: SupabaseClient,
  companyId: string,
  leadIds: string[],
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;
  const uniqueIds = [...new Set(leadIds.filter(Boolean))];

  for (const leadId of uniqueIds) {
    const { data: row, error } = await admin
      .from('marketing_leads')
      .select(
        'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, external_created_at, created_at, archived_at',
      )
      .eq('id', leadId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error || !row) {
      errors.push(`Lead ${leadId}: no encontrado`);
      continue;
    }
    const lead = row as MarketingLeadAutomationRow;
    if (!lead.phone?.trim()) {
      errors.push(`${leadDisplayName(lead)}: sin teléfono`);
      continue;
    }
    const form = await resolveMetaFormForLead(admin, companyId, lead as LeadRow);
    if (!form?.whatsapp_automation_enabled || !formHasInitialWhatsappContent(form)) {
      errors.push(`${leadDisplayName(lead)}: formulario sin automatización`);
      continue;
    }
    try {
      const result = await sendInitialAutomationForLead(admin, companyId, leadId, lead, form);
      if (result.ok && result.status === 'awaiting_reply') {
        sent += 1;
        await admin.from('marketing_whatsapp_queue').upsert(
          {
            company_id: companyId,
            marketing_lead_id: leadId,
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_kind: result.sent_kind ?? 'text',
            error: null,
          },
          { onConflict: 'company_id,marketing_lead_id' },
        );
      } else {
        errors.push(`${leadDisplayName(lead)}: ${result.error ?? result.status}`);
      }
    } catch (e) {
      errors.push(`${leadDisplayName(lead)}: ${e instanceof Error ? e.message : 'Error'}`);
    }
  }

  return { sent, errors };
}

function leadDisplayName(lead: {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}): string {
  const n = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  return n || lead.phone?.trim() || 'Lead';
}
