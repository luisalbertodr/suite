import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractWhatsappAdAttribution } from './whatsappAdAttribution.ts';
import { resolveMarketingLeadForWhatsappChat } from './stripeDeposit.ts';

/**
 * Tras un mensaje entrante 1:1, crea un lead de Marketing si el contacto
 * aún no es cliente ni lead (caso típico Click-to-WhatsApp / Meta).
 * No crea leads para clientes existentes ni para grupos.
 */
export async function maybeAutoCreateMarketingLeadFromInbound(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  opts: {
    messageRaw?: unknown;
    messageTimestamp?: string | null;
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
  const source = attribution.fromAd ? 'ctwa' : 'whatsapp';
  const externalId = attribution.ctwaClid
    ? `ctwa:${attribution.ctwaClid}`
    : attribution.sourceId
      ? `ctwa-ad:${attribution.sourceId}`
      : null;

  const result = await resolveMarketingLeadForWhatsappChat(
    admin,
    companyId,
    chatId,
    null,
    opts.chatDisplayName ?? (chat?.name as string | null) ?? null,
    null,
    {
      source,
      campaign: attribution.campaign,
      form_name: attribution.formName,
      field_data: attribution.extras.length ? attribution.extras : undefined,
      external_id: externalId,
      external_created_at: opts.messageTimestamp ?? new Date().toISOString(),
      tags: attribution.fromAd ? ['CTWA', 'Meta'] : ['WhatsApp'],
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

  return {
    created: result.created,
    leadId: result.lead.id,
    reason: result.created ? (attribution.fromAd ? 'created_ctwa' : 'created_whatsapp') : 'linked_existing',
  };
}
