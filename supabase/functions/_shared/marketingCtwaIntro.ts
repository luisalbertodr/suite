import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { MarketingCtwaCampaignRow } from './marketingCtwaCampaigns.ts';
import {
  loadWhatsappConfig,
  asProviderConfig,
  leadDisplayName,
  sendAutomatedLeadMessageForExternal,
  type MarketingLeadAutomationRow,
} from './marketingWhatsappAutomation.ts';
import { ensureWhatsappSessionReadyForSend } from './whatsappSessionStatus.ts';

/** Envía el mensaje introductorio configurado para una campaña CTWA. */
export async function sendCtwaIntroMessageForLead(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  campaign: MarketingCtwaCampaignRow,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!campaign.intro_enabled) {
    return { ok: true, skipped: true };
  }
  const template = campaign.intro_message?.trim();
  if (!template) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'skipped',
        wa_automation_error: 'Campaña CTWA sin mensaje introductorio',
      })
      .eq('id', leadId);
    return { ok: true, skipped: true };
  }

  const { data: lead, error } = await admin
    .from('marketing_leads')
    .select(
      'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at',
    )
    .eq('id', leadId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  if (!lead) return { ok: false, error: 'Lead no encontrado' };

  if (lead.wa_automation_initial_sent_at) {
    return { ok: true, skipped: true };
  }
  if (!lead.phone?.trim()) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'skipped',
        wa_automation_error: 'Lead CTWA sin teléfono',
      })
      .eq('id', leadId);
    return { ok: false, error: 'Sin teléfono' };
  }

  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: 'WhatsApp no configurado o deshabilitado',
      })
      .eq('id', leadId);
    return { ok: false, error: 'WhatsApp no configurado' };
  }

  const providerCfg = asProviderConfig(cfg);
  const session = await ensureWhatsappSessionReadyForSend(admin, companyId, {
    ...providerCfg,
    last_status: cfg.last_status,
    me_jid: cfg.me_jid,
  });
  if (!session.ready) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: session.error ?? 'Sesión WhatsApp no conectada',
      })
      .eq('id', leadId);
    return { ok: false, error: session.error ?? 'Sesión no conectada' };
  }

  try {
    const leadCtx = {
      phone: lead.phone,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      campaign: campaign.name,
      form_name: lead.form_name,
      appointment_at: lead.appointment_at,
      appointment_label: lead.appointment_label,
      source: lead.source,
      field_data: lead.field_data,
    };

    let formDeposit: {
      stripe_deposit_enabled?: boolean;
      stripe_deposit_amount_cents?: number | null;
      form_name?: string | null;
      form_id?: string;
    } | null = { form_name: campaign.name, form_id: '' };

    if (campaign.meta_form_id) {
      const { data: form } = await admin
        .from('meta_forms')
        .select('form_id, form_name, stripe_deposit_enabled, stripe_deposit_amount_cents')
        .eq('id', campaign.meta_form_id)
        .maybeSingle();
      if (form) {
        formDeposit = {
          form_id: form.form_id,
          form_name: form.form_name ?? campaign.name,
          stripe_deposit_enabled: form.stripe_deposit_enabled,
          stripe_deposit_amount_cents: form.stripe_deposit_amount_cents,
        };
      }
    }

    const { renderWhatsappTemplateWithPaymentLinks } = await import('./stripeDeposit.ts');
    const finalText = await renderWhatsappTemplateWithPaymentLinks(
      admin,
      companyId,
      leadId,
      template,
      leadCtx,
      formDeposit,
      null,
    );

    const contactName = leadDisplayName(lead as MarketingLeadAutomationRow);
    await sendAutomatedLeadMessageForExternal(
      admin,
      cfg,
      companyId,
      lead.phone!,
      finalText,
      {
        automation_type: 'ctwa_intro',
        reference_id: leadId,
        contactName,
      },
    );

    const now = new Date().toISOString();
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'completed',
        wa_automation_error: null,
        wa_automation_initial_sent_at: now,
        wa_automation_initial_sent_kind: 'text',
        last_contacted_at: now,
        ctwa_campaign_id: campaign.id,
        campaign: campaign.name,
      })
      .eq('id', leadId);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar intro CTWA';
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: msg.slice(0, 500),
      })
      .eq('id', leadId);
    return { ok: false, error: msg };
  }
}
