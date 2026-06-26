import type { NavigateFunction } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function normalizeWhatsappPhoneParam(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

function phoneSuffix9(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : null;
}

function chatIdMatchesPhoneSuffix(chatId: string, suffix9: string): boolean {
  const local = chatId.split('@')[0] ?? '';
  const d = local.replace(/\D/g, '');
  return d.length >= 9 && d.slice(-9) === suffix9;
}

export async function fetchWhatsappChatIdForLead(
  companyId: string,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('whatsapp_chats')
    .select('chat_id')
    .eq('company_id', companyId)
    .eq('marketing_lead_id', leadId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.chat_id ?? null;
}

/** Busca chat existente por sufijo telefónico (346…@c.us o @lid si el id lleva dígitos). */
export async function fetchWhatsappChatIdByPhone(
  companyId: string,
  phone: string,
): Promise<string | null> {
  const suffix = phoneSuffix9(phone);
  if (!suffix) return null;

  const { data, error } = await supabase
    .from('whatsapp_chats')
    .select('chat_id, last_message_at')
    .eq('company_id', companyId)
    .or(`chat_id.ilike.%${suffix}@c.us,chat_id.ilike.%${suffix}@s.whatsapp.net`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(5);
  if (error) throw error;

  for (const row of data ?? []) {
    const id = row.chat_id as string;
    if (chatIdMatchesPhoneSuffix(id, suffix)) return id;
  }

  // Fallback: escanear chats recientes con @lid u otros formatos
  const { data: recent, error: recentErr } = await supabase
    .from('whatsapp_chats')
    .select('chat_id')
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200);
  if (recentErr) throw recentErr;
  for (const row of recent ?? []) {
    const id = row.chat_id as string;
    if (chatIdMatchesPhoneSuffix(id, suffix)) return id;
  }

  return null;
}

export async function resolveWhatsappChatIdForLead(
  companyId: string | null | undefined,
  phone: string | null | undefined,
  marketingLeadId: string | null | undefined,
): Promise<string | null> {
  if (!companyId) return null;
  if (marketingLeadId) {
    const byLead = await fetchWhatsappChatIdForLead(companyId, marketingLeadId);
    if (byLead) return byLead;
  }
  if (phone?.trim()) {
    return fetchWhatsappChatIdByPhone(companyId, phone);
  }
  return null;
}

export function findLoadedChatForDeepLink(
  chats: Array<{ chat_id: string; marketing_lead_id?: string | null }>,
  input: {
    phoneDigits?: string | null;
    leadId?: string | null;
    phoneJid?: string | null;
    chatId?: string | null;
    jidsSameContact: (a: string, b: string) => boolean;
  },
): string | null {
  if (input.chatId) {
    const exact = chats.find((c) => c.chat_id === input.chatId);
    if (exact) return exact.chat_id;
    return input.chatId;
  }
  if (input.leadId) {
    const byLead = chats.find((c) => c.marketing_lead_id === input.leadId);
    if (byLead) return byLead.chat_id;
  }
  const suffix = phoneSuffix9(input.phoneDigits);
  if (suffix) {
    const bySuffix = chats.find((c) => chatIdMatchesPhoneSuffix(c.chat_id, suffix));
    if (bySuffix) return bySuffix.chat_id;
  }
  if (input.phoneJid) {
    const byJid = chats.find(
      (c) =>
        c.chat_id === input.phoneJid ||
        input.jidsSameContact(c.chat_id, input.phoneJid!),
    );
    if (byJid) return byJid.chat_id;
  }
  return input.phoneJid ?? null;
}

/** Abre WhatsApp en Suite con la conversación del lead (resuelve chat antes de navegar). */
export async function openSuiteWhatsappChat(
  navigate: NavigateFunction,
  companyId: string | null | undefined,
  phone: string,
  name?: string | null,
  marketingLeadId?: string | null,
): Promise<void> {
  const digits = phone ? normalizeWhatsappPhoneParam(phone) : null;
  if (!digits && !marketingLeadId) return;

  let chatId: string | null = null;
  try {
    chatId = await resolveWhatsappChatIdForLead(companyId, phone, marketingLeadId ?? null);
  } catch {
    /* navegar solo con teléfono */
  }

  const params = new URLSearchParams();
  if (chatId) params.set('chat_id', chatId);
  if (digits) params.set('phone', digits);
  if (marketingLeadId) params.set('lead_id', marketingLeadId);
  if (name?.trim()) params.set('name', name.trim());
  params.set('t', String(Date.now()));

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  navigate({ pathname: '/whatsapp', search: `?${params.toString()}` });
}
