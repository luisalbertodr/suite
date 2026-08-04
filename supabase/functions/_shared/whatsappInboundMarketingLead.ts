import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractWhatsappAdAttribution } from './whatsappAdAttribution.ts';
import {
  leadFieldsFromMetaForm,
  resolveMetaFormForWhatsappInbound,
} from './metaFormWhatsappInbound.ts';
import { resolveMarketingCtwaCampaign } from './marketingCtwaCampaigns.ts';
import { resolveMarketingLeadForWhatsappChat } from './stripeDeposit.ts';
import { sendCtwaIntroMessageForLead } from './marketingCtwaIntro.ts';

/**
 * Tras un mensaje entrante 1:1, crea un lead de Marketing si el contacto
 * aún no es cliente ni lead (caso típico Click-to-WhatsApp / Meta).
 * Asigna campaña CTWA configurada y envía el mensaje introductorio.
 */
export async function maybeAutoCreateMarketingLeadFromInbound(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  opts: {
    messageRaw?: unknown;
    messageTimestamp?: string | null;
    messageBody?: string | null;
    chatDisplayName?: string | null;
  } = {},
): Promise<{ created: boolean; leadId: string | null; reason?: string }> {
  if (/@g\.us$/i.test(chatId) || /@broadcast$/i.test(chatId)) {
    return { created: false, leadId: null, reason: 'group' };
  }

  const { data: chat } = await admin
    .from('whatsapp_chats')
    .select('marketing_lead_id, customer_id, name')
    .eq('company_id', companyId)
    .eq('chat_id', chatId)
    .maybeSingle();

  if (chat?.marketing_lead_id) {
    return { created: false, leadId: chat.marketing_lead_id as string, reason: 'already_linked' };
  }
  if (chat?.customer_id) {
    return { created: false, leadId: null, reason: 'customer' };
  }

  const attribution = extractWhatsappAdAttribution(opts.messageRaw);
  const ctwaCampaign = await resolveMarketingCtwaCampaign(admin, companyId, {
    campaign: attribution.campaign,
    formName: attribution.formName,
    firstMessageBody: opts.messageBody ?? null,
    attribution,
  });

  const matchedForm = ctwaCampaign?.meta_form_id
    ? (
        await admin
          .from('meta_forms')
          .select(
            'id, form_id, form_name, whatsapp_inbound_default, whatsapp_automation_enabled, whatsapp_initial_audio_path',
          )
          .eq('id', ctwaCampaign.meta_form_id)
          .eq('company_id', companyId)
          .maybeSingle()
      ).data
    : await resolveMetaFormForWhatsappInbound(admin, companyId, {
        campaign: ctwaCampaign?.name ?? attribution.campaign,
        formName: attribution.formName,
        attribution,
      });

  const formFields = matchedForm
    ? leadFieldsFromMetaForm(matchedForm, attribution)
    : null;

  const campaignName =
    ctwaCampaign?.name?.trim() ||
    formFields?.campaign ||
    attribution.campaign ||
    'WhatsApp Meta';
  const formName =
    formFields?.form_name ||
    (ctwaCampaign ? 'Click to WhatsApp' : attribution.formName);

  const source = attribution.fromAd || ctwaCampaign || matchedForm ? 'ctwa' : 'whatsapp';
  const externalId = attribution.ctwaClid
    ? `ctwa:${attribution.ctwaClid}`
    : attribution.sourceId
      ? `ctwa-ad:${attribution.sourceId}`
      : null;

  const tags = ['WhatsApp'];
  if (source === 'ctwa' || ctwaCampaign) {
    tags.length = 0;
    tags.push('CTWA', 'Meta');
  }
  if (ctwaCampaign?.name) tags.push(ctwaCampaign.name);

  const result = await resolveMarketingLeadForWhatsappChat(
    admin,
    companyId,
    chatId,
    null,
    opts.chatDisplayName ?? (chat?.name as string | null) ?? null,
    null,
    {
      source,
      campaign: campaignName,
      form_name: formName,
      meta_form_id: formFields?.meta_form_id ?? ctwaCampaign?.meta_form_id ?? null,
      ctwa_campaign_id: ctwaCampaign?.id ?? null,
      field_data: attribution.extras.length ? attribution.extras : undefined,
      external_id: externalId,
      external_created_at: opts.messageTimestamp ?? new Date().toISOString(),
      tags,
      skipIfCustomer: true,
      allowMissing: true,
    },
  );

  if (!result.lead) {
    return {
      created: false,
      leadId: null,
      reason: result.skippedReason ?? 'skipped',
    };
  }

  if (result.created && ctwaCampaign) {
    try {
      await sendCtwaIntroMessageForLead(admin, companyId, result.lead.id, ctwaCampaign);
    } catch (introErr) {
      console.error('CTWA intro message failed:', introErr);
    }
  }

  return {
    created: result.created,
    leadId: result.lead.id,
    reason: result.created
      ? ctwaCampaign
        ? `created_ctwa_campaign:${ctwaCampaign.name}`
        : matchedForm
          ? `created_linked:${matchedForm.form_name ?? matchedForm.id}`
          : attribution.fromAd
            ? 'created_ctwa'
            : 'created_whatsapp'
      : 'linked_existing',
  };
}
