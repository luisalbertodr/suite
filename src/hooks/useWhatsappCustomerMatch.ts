import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  extractPhoneDigitsFromJid,
  isGroupJid,
} from '@/components/whatsapp/whatsappUtils';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

function phoneLast9(digits: string | null | undefined): string | null {
  if (!digits) return null;
  const d = digits.replace(/\D/g, '');
  if (d.length < 9) return null;
  return d.slice(-9);
}

/** Resuelve últimos 9 dígitos por chat (JID @c.us o mensajes entrantes para @lid). */
async function resolvePhoneLast9ByChat(
  companyId: string,
  chats: WhatsappChatRow[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const needMessages: string[] = [];

  for (const c of chats) {
    if (c.customer_id || c.is_group || isGroupJid(c.chat_id)) continue;
    const fromJid = extractPhoneDigitsFromJid(c.chat_id);
    const last9 = phoneLast9(fromJid);
    if (last9) {
      out.set(c.chat_id, last9);
    } else {
      needMessages.push(c.chat_id);
    }
  }

  if (needMessages.length === 0) return out;

  const { data: rows, error } = await supabase
    .from('whatsapp_messages')
    .select('chat_id, from_jid, timestamp')
    .eq('company_id', companyId)
    .in('chat_id', needMessages)
    .eq('from_me', false)
    .order('timestamp', { ascending: false })
    .limit(500);

  if (error) throw error;

  const seen = new Set<string>();
  for (const row of rows ?? []) {
    if (seen.has(row.chat_id)) continue;
    const last9 = phoneLast9(extractPhoneDigitsFromJid(row.from_jid));
    if (last9) {
      out.set(row.chat_id, last9);
      seen.add(row.chat_id);
    }
  }

  return out;
}

/**
 * Para chats sin customer_id en BD, busca cliente por phone_norm (p. ej. chats @lid).
 * Complementa whatsapp_auto_link_chat hasta que persista el vínculo.
 */
export function useWhatsappCustomerMatch(chats: WhatsappChatRow[]) {
  const { companyId } = useCompanyFilter();

  const unlinkedChats = useMemo(
    () =>
      chats.filter(
        (c) => !c.customer_id && !c.is_group && !isGroupJid(c.chat_id),
      ),
    [chats],
  );

  const matchQuery = useQuery({
    queryKey: [
      'whatsapp-customer-match',
      companyId,
      unlinkedChats.map((c) => c.chat_id).sort().join('|'),
    ],
    enabled: !!companyId && unlinkedChats.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (!companyId || unlinkedChats.length === 0) {
        return {
          customerIdByChatId: {} as Record<string, string>,
          customerNameByChatId: {} as Record<string, string>,
        };
      }

      const phoneByChat = await resolvePhoneLast9ByChat(companyId, unlinkedChats);
      const suffixes = [...new Set(phoneByChat.values())];
      if (suffixes.length === 0) {
        return {
          customerIdByChatId: {},
          customerNameByChatId: {},
        };
      }

      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, phone_norm')
        .eq('company_id', companyId)
        .in('phone_norm', suffixes);

      if (error) throw error;

      const byNorm = new Map<string, { id: string; name: string }>();
      for (const cust of customers ?? []) {
        if (cust.phone_norm && !byNorm.has(cust.phone_norm)) {
          byNorm.set(cust.phone_norm, { id: cust.id, name: cust.name ?? '' });
        }
      }

      const customerIdByChatId: Record<string, string> = {};
      const customerNameByChatId: Record<string, string> = {};
      for (const [chatId, last9] of phoneByChat) {
        const hit = byNorm.get(last9);
        if (hit) {
          customerIdByChatId[chatId] = hit.id;
          customerNameByChatId[chatId] = hit.name;
        }
      }

      return { customerIdByChatId, customerNameByChatId };
    },
  });

  return {
    customerIdByChatId: matchQuery.data?.customerIdByChatId ?? {},
    customerNameByChatId: matchQuery.data?.customerNameByChatId ?? {},
    isMatching: matchQuery.isFetching,
  };
}
