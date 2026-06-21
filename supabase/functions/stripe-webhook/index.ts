import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadStripeConfig,
  markDepositPaid,
  verifyStripeWebhookSignature,
} from '../_shared/stripeDeposit.ts';
import {
  loadWhatsappConfig,
  renderWhatsappTemplate,
  normalizeChatId,
  type WhatsappTemplateContext,
} from '../_shared/marketingWhatsappAutomation.ts';
import { loadAutomationSettings } from '../_shared/whatsappAutomationDispatch.ts';
import { isWithinAutomationHours } from '../_shared/whatsappAutomationHours.ts';
import { providerSendText } from '../_shared/whatsappProviderClient.ts';
import {
  normalizeWhatsappProvider,
  type WhatsappProviderConfig,
} from '../_shared/whatsappProviderTypes.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sendWhatsappAfterPayment(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  leadId: string,
  messageTemplate: string,
  amountCents?: number | null,
  currency?: string | null,
): Promise<void> {
  const automationSettings = await loadAutomationSettings(admin, companyId);
  if (!isWithinAutomationHours(automationSettings)) {
    console.log('post-payment WhatsApp skipped: outside automation hours');
    return;
  }

  const { data: lead } = await admin
    .from('marketing_leads')
    .select(
      'phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source',
    )
    .eq('id', leadId)
    .maybeSingle();
  if (!lead?.phone?.trim()) return;

  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url || (cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    return;
  }

  const ctx = lead as WhatsappTemplateContext;
  let text = renderWhatsappTemplate(messageTemplate, ctx, undefined);
  if (amountCents && amountCents > 0) {
    const { formatEurosFromCents } = await import('../_shared/stripeDeposit.ts');
    const importe = formatEurosFromCents(amountCents, currency ?? 'eur');
    text = text.replace(/\{importe_senal\}/gi, importe);
  }
  const chatId = normalizeChatId(lead.phone, cfg.default_country_code);
  const providerCfg: WhatsappProviderConfig = {
    company_id: cfg.company_id,
    provider: normalizeWhatsappProvider(cfg.provider),
    base_url: cfg.base_url,
    api_key: cfg.api_key,
    session_name: cfg.session_name || 'default',
    webhook_secret: cfg.webhook_secret ?? null,
    default_country_code: cfg.default_country_code,
    enabled: cfg.enabled,
    last_status: cfg.last_status,
    me_jid: cfg.me_jid,
  };
  try {
    await providerSendText(providerCfg, chatId, text);
  } catch (e) {
    console.error('WhatsApp post-payment send failed:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let event: {
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const metadata = (event.data?.object?.metadata ?? {}) as Record<string, string>;
  const companyId = metadata.company_id;
  const depositSessionId = metadata.deposit_session_id;

  if (companyId) {
    const stripeCfg = await loadStripeConfig(admin, companyId);
    if (stripeCfg?.webhook_secret) {
      const valid = await verifyStripeWebhookSignature(
        payload,
        signature,
        stripeCfg.webhook_secret,
      );
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Firma Stripe inválida' }), { status: 400 });
      }
    }
  }

  if (event.type === 'checkout.session.completed') {
    const obj = event.data?.object ?? {};
    const sessionId = String(obj.id ?? '');
    const paymentIntent = String(obj.payment_intent ?? '');
    const meta = (obj.metadata ?? {}) as Record<string, string>;
    const depId = meta.deposit_session_id ?? depositSessionId;
    const compId = meta.company_id ?? companyId;

    if (depId) {
      await markDepositPaid(admin, depId, paymentIntent || null);
    } else if (sessionId && compId) {
      const { data: row } = await admin
        .from('stripe_deposit_sessions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent || null,
        })
        .eq('company_id', compId)
        .eq('stripe_checkout_session_id', sessionId)
        .eq('status', 'pending')
        .select('id, marketing_lead_id')
        .maybeSingle();
      if (row?.id) {
        await markDepositPaid(admin, row.id, paymentIntent || null);
      }
    }

    if (compId) {
      await admin
        .from('stripe_config')
        .update({ last_webhook_at: new Date().toISOString() })
        .eq('company_id', compId);

      const stripeCfg = await loadStripeConfig(admin, compId);
      const leadId = meta.marketing_lead_id;
      let paidAmountCents: number | null = null;
      let paidCurrency: string | null = null;
      if (depId) {
        const { data: paidSession } = await admin
          .from('stripe_deposit_sessions')
          .select('amount_cents, currency')
          .eq('id', depId)
          .maybeSingle();
        if (paidSession) {
          paidAmountCents = Number(paidSession.amount_cents ?? 0) || null;
          paidCurrency = paidSession.currency ?? null;
        }
      }
      if (stripeCfg?.payment_success_whatsapp_message?.trim() && leadId) {
        try {
          await sendWhatsappAfterPayment(
            admin,
            compId,
            leadId,
            stripeCfg.payment_success_whatsapp_message.trim(),
            paidAmountCents,
            paidCurrency,
          );
        } catch (e) {
          console.error('post-payment WhatsApp failed:', e);
        }
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
