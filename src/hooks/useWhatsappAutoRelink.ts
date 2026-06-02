import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import { isGroupJid, isSystemChatJid } from '@/components/whatsapp/whatsappUtils';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

/** Persiste vínculos cliente/chat en BD vía whatsapp_auto_link_chat (incl. @lid). */
export function useWhatsappAutoRelink(chats: WhatsappChatRow[]) {
  const { companyId } = useWhatsappCompanyId();
  const queryClient = useQueryClient();
  const runningRef = useRef(false);
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!companyId || chats.length === 0) return;

    const unlinked = chats.filter(
      (c) =>
        !c.customer_id &&
        !c.is_group &&
        !isGroupJid(c.chat_id) &&
        !isSystemChatJid(c.chat_id),
    );
    if (unlinked.length === 0) return;

    const key = unlinked
      .map((c) => c.chat_id)
      .sort()
      .join('|');
    if (key === lastKeyRef.current || runningRef.current) return;

    runningRef.current = true;
    lastKeyRef.current = key;

    void (async () => {
      try {
        for (const c of unlinked.slice(0, 40)) {
          const { error } = await supabase.rpc('whatsapp_auto_link_chat', {
            p_company_id: companyId,
            p_chat_id: c.chat_id,
          });
          if (error) break;
        }
        await queryClient.invalidateQueries({
          queryKey: ['whatsapp-chats', companyId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['whatsapp-customer-match', companyId],
        });
      } finally {
        runningRef.current = false;
      }
    })();
  }, [chats, companyId, queryClient]);
}
