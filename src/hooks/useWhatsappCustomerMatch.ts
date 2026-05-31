import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  extractPhoneDigitsFromJid,
  formatPhoneDigits,
  isGroupJid,
} from '@/components/whatsapp/whatsappUtils';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

function phoneLast9(digits: string | null | undefined): string | null {
  if (!digits) return null;
  const d = digits.replace(/\D/g, '');
  if (d.length < 9) return null;
  return d.slice(-9);
}

/** Resuelve teléfono formateado (+…) por chat (JID @c.us o mensajes entrantes para @lid). */
async function resolvePhoneLabelByChat(
  companyId: string,
  chats: WhatsappChatRow[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const needMessages: string[] = [];

  for (const c of chats) {
    if (c.is_group || isGroupJid(c.chat_id)) continue;
    const fromJid = extractPhoneDigitsFromJid(c.chat_id);
    const formatted = formatPhoneDigits(fromJid);
    if (formatted) {
      out.set(c.chat_id, formatted);
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
    const formatted = formatPhoneDigits(extractPhoneDigitsFromJid(row.from_jid));
    if (formatted) {
      out.set(row.chat_id, formatted);
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
          phoneLabelByChatId: {} as Record<string, string>,
        };
      }

      const phoneByChat = await resolvePhoneLabelByChat(companyId, unlinkedChats);
      const suffixes = [...new Set(
        [...phoneByChat.values()].map((p) => phoneLast9(p.replace(/\D/g, ''))).filter(Boolean),
      )] as string[];
      const phoneLabelByChatId: Record<string, string> = {};
      for (const [chatId, label] of phoneByChat) {
        phoneLabelByChatId[chatId] = label;
      }

      if (suffixes.length === 0) {
        return {
          customerIdByChatId: {},
          customerNameByChatId: {},
          phoneLabelByChatId,
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
        const norm = phoneLast9(last9.replace(/\D/g, ''));
        if (!norm) continue;
        const hit = byNorm.get(norm);
        if (hit) {
          customerIdByChatId[chatId] = hit.id;
          customerNameByChatId[chatId] = hit.name;
        }
      }

      return { customerIdByChatId, customerNameByChatId, phoneLabelByChatId };
    },
  });

  return {
    customerIdByChatId: matchQuery.data?.customerIdByChatId ?? {},
    customerNameByChatId: matchQuery.data?.customerNameByChatId ?? {},
    phoneLabelByChatId: matchQuery.data?.phoneLabelByChatId ?? {},
    isMatching: matchQuery.isFetching,
  };
}
