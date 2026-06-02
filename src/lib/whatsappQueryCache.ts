import type { QueryClient } from '@tanstack/react-query';
import { jidsSameContact } from '@/components/whatsapp/whatsappUtils';
import type { Database } from '@/integrations/supabase/types';

type WhatsappChatRow = Database['public']['Tables']['whatsapp_chats']['Row'];

export function chatsQueryKey(companyId: string) {
  return ['whatsapp-chats', companyId] as const;
}

export function sortChatsByLastMessage(chats: WhatsappChatRow[]): WhatsappChatRow[] {
  return [...chats].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
}

export function patchChatsListAfterOutgoing(
  queryClient: QueryClient,
  companyId: string,
  chatId: string,
  preview: string | null,
  timestamp?: string,
) {
  const ts = timestamp ?? new Date().toISOString();

  queryClient.setQueryData<WhatsappChatRow[]>(chatsQueryKey(companyId), (prev) => {
    if (!prev?.length) return prev;
    let touched = false;
    const next = prev.map((c) => {
      if (c.chat_id !== chatId && !jidsSameContact(c.chat_id, chatId)) return c;
      touched = true;
      return {
        ...c,
        last_message_preview: preview?.slice(0, 200) ?? c.last_message_preview,
        last_message_at: ts,
        last_message_from_me: true,
      };
    });
    return touched ? sortChatsByLastMessage(next) : prev;
  });
}

export function createDebouncedInvalidate(
  queryClient: QueryClient,
  delayMs = 1200,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (queryKey: readonly unknown[], immediate = false) => {
    if (immediate) {
      if (timer) clearTimeout(timer);
      timer = null;
      void queryClient.invalidateQueries({ queryKey });
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void queryClient.invalidateQueries({ queryKey });
    }, delayMs);
  };
}
