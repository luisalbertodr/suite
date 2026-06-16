import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadMetaFormAutomation,
  sendInitialAutomationForLead,
  type MarketingLeadAutomationRow,
  type MetaFormAutomation,
} from './marketingWhatsappAutomation.ts';
import type { WhatsappAutomationSettings } from './whatsappAutomationDispatch.ts';
import {
  isWithinAutomationHours,
  madridDateKey,
  normalizeAutomationHours,
} from './whatsappAutomationHours.ts';

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
    marketing_queue_daily_limit: settings.marketing_queue_daily_limit ?? 50,
    marketing_queue_hour_start: settings.marketing_queue_hour_start ?? 10,
    marketing_queue_hour_end: settings.marketing_queue_hour_end ?? 20,
    marketing_queue_min_pause_seconds: settings.marketing_queue_min_pause_seconds ?? 180,
    marketing_queue_max_pause_seconds: settings.marketing_queue_max_pause_seconds ?? 900,
  };
}

type LeadRow = MarketingLeadAutomationRow & {
  external_created_at: string | null;
  created_at: string;
  archived_at: string | null;
};

function randomPauseMs(settings: MarketingWhatsappQueueSettings): number {
  const s = normalizeQueueSettings(settings);
  const min = Math.min(s.marketing_queue_min_pause_seconds, s.marketing_queue_max_pause_seconds);
  const max = Math.max(s.marketing_queue_min_pause_seconds, s.marketing_queue_max_pause_seconds);
  const seconds = min + Math.random() * (max - min);
  return Math.round(seconds * 1000);
}

function leadSortKey(lead: LeadRow): string {
  return lead.external_created_at ?? lead.created_at ?? '';
}

const META_FORM_SELECT =
  'id, form_id, form_name, whatsapp_automation_enabled, whatsapp_initial_message, whatsapp_reply_1_message, whatsapp_reply_2_message, whatsapp_reply_invalid_message, whatsapp_reminder_message, whatsapp_reminder_delay_hours, stripe_deposit_enabled, stripe_deposit_amount_cents';

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

export function isLeadEligibleForWhatsappQueue(lead: LeadRow): boolean {
  if (lead.archived_at) return false;
  if (!lead.phone?.trim()) return false;
  if (lead.wa_automation_initial_sent_at) return false;
  return true;
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

export async function enqueueEligibleMarketingLeads(
  admin: SupabaseClient,
  companyId: string,
  queuedBy?: string | null,
): Promise<{ enqueued: number; skipped: number }> {
  const { data: leads, error } = await admin
    .from('marketing_leads')
    .select(
      'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, external_created_at, created_at, archived_at',
    )
    .eq('company_id', companyId)
    .is('wa_automation_initial_sent_at', null)
    .is('archived_at', null)
    .not('phone', 'is', null);

  if (error) throw error;

  const { data: pendingRows } = await admin
    .from('marketing_whatsapp_queue')
    .select('marketing_lead_id')
    .eq('company_id', companyId)
    .eq('status', 'pending');

  const pendingIds = new Set((pendingRows ?? []).map((r) => r.marketing_lead_id as string));

  const eligible: LeadRow[] = [];
  for (const row of leads ?? []) {
    const lead = row as LeadRow;
    if (!isLeadEligibleForWhatsappQueue(lead)) continue;
    if (pendingIds.has(lead.id)) continue;
    const form = await resolveMetaFormForLead(admin, companyId, lead);
    if (!form?.whatsapp_automation_enabled || !form.whatsapp_initial_message?.trim()) continue;
    eligible.push(lead);
  }

  eligible.sort((a, b) => leadSortKey(a).localeCompare(leadSortKey(b)));

  if (eligible.length === 0) return { enqueued: 0, skipped: (leads?.length ?? 0) };

  const inserts = eligible.map((lead) => ({
    company_id: companyId,
    marketing_lead_id: lead.id,
    status: 'pending',
    queued_by: queuedBy ?? null,
  }));

  const { error: insErr } = await admin.from('marketing_whatsapp_queue').upsert(inserts, {
    onConflict: 'company_id,marketing_lead_id',
    ignoreDuplicates: false,
  });
  if (insErr) throw insErr;

  return { enqueued: inserts.length, skipped: (leads?.length ?? 0) - inserts.length };
}

export async function getMarketingWhatsappQueueStats(
  admin: SupabaseClient,
  companyId: string,
  settings: MarketingWhatsappQueueSettings,
): Promise<{
  pending: number;
  sent_today: number;
  daily_limit: number;
  eligible_not_queued: number;
  within_hours: boolean;
  next_send_at: string | null;
  hour_start: number;
  hour_end: number;
}> {
  const s = normalizeQueueSettings(settings);
  const { count: pending } = await admin
    .from('marketing_whatsapp_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'pending');

  const sentToday = await countQueueSendsToday(admin, companyId);

  const { data: leads } = await admin
    .from('marketing_leads')
    .select(
      'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, external_created_at, created_at, archived_at',
    )
    .eq('company_id', companyId)
    .is('wa_automation_initial_sent_at', null)
    .is('archived_at', null)
    .not('phone', 'is', null);

  const { data: pendingRows } = await admin
    .from('marketing_whatsapp_queue')
    .select('marketing_lead_id')
    .eq('company_id', companyId)
    .in('status', ['pending', 'sent', 'failed']);

  const queuedIds = new Set((pendingRows ?? []).map((r) => r.marketing_lead_id as string));

  let eligibleNotQueued = 0;
  for (const row of leads ?? []) {
    const lead = row as LeadRow;
    if (!isLeadEligibleForWhatsappQueue(lead)) continue;
    if (queuedIds.has(lead.id)) continue;
    const form = await resolveMetaFormForLead(admin, companyId, lead);
    if (!form?.whatsapp_automation_enabled || !form.whatsapp_initial_message?.trim()) continue;
    eligibleNotQueued++;
  }

  return {
    pending: pending ?? 0,
    sent_today: sentToday,
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
  const s = normalizeQueueSettings(settings);
  if (!isWithinAutomationHours(s)) {
    return { sent: 0, skipped: 0, reason: 'outside_hours' };
  }

  const now = Date.now();
  if (settings.marketing_queue_next_send_at) {
    const nextAt = new Date(settings.marketing_queue_next_send_at).getTime();
    if (Number.isFinite(nextAt) && now < nextAt) {
      return { sent: 0, skipped: 0, reason: 'pause' };
    }
  }

  const sentToday = await countQueueSendsToday(admin, companyId);
  if (sentToday >= s.marketing_queue_daily_limit) {
    return { sent: 0, skipped: 0, reason: 'daily_limit' };
  }

  const { data: queueRows, error: qErr } = await admin
    .from('marketing_whatsapp_queue')
    .select('id, marketing_lead_id')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('queued_at', { ascending: true })
    .limit(80);

  if (qErr) throw qErr;
  if (!queueRows?.length) return { sent: 0, skipped: 0, reason: 'empty' };

  const leadIds = queueRows.map((r) => r.marketing_lead_id as string);
  const { data: leadRows, error: lErr } = await admin
    .from('marketing_leads')
    .select(
      'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, external_created_at, created_at, archived_at',
    )
    .in('id', leadIds);
  if (lErr) throw lErr;

  const leadMap = new Map((leadRows ?? []).map((l) => [l.id as string, l as LeadRow]));

  const ordered = queueRows
    .map((q) => ({
      queueId: q.id as string,
      lead: leadMap.get(q.marketing_lead_id as string),
    }))
    .filter((x) => x.lead)
    .sort((a, b) => leadSortKey(a.lead!).localeCompare(leadSortKey(b.lead!)));

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
    if (!form?.whatsapp_automation_enabled || !form.whatsapp_initial_message?.trim()) {
      await admin
        .from('marketing_whatsapp_queue')
        .update({ status: 'failed', error: 'Formulario sin automatización WhatsApp' })
        .eq('id', item.queueId)
        .eq('status', 'pending');
      continue;
    }

    const result = await sendInitialAutomationForLead(admin, companyId, lead.id, lead, form);
    const sentNow = new Date().toISOString();
    const pauseMs = randomPauseMs(s);
    const nextSendAt = new Date(Date.now() + pauseMs).toISOString();

    if (result.ok && result.status === 'awaiting_reply') {
      await admin
        .from('marketing_whatsapp_queue')
        .update({ status: 'sent', sent_at: sentNow, error: null })
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
    if (!form?.whatsapp_automation_enabled || !form.whatsapp_initial_message?.trim()) {
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
