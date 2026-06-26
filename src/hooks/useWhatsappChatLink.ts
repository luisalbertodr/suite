import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

export interface LinkCandidateCustomer {
  id: string;
  name: string;
  phone: string | null;
  phone_mobile: string | null;
  phone_home: string | null;
  email: string | null;
}

export interface LinkCandidateLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}

export interface LinkSearchResult {
  ok: boolean;
  customers: LinkCandidateCustomer[];
  leads: LinkCandidateLead[];
}

function patchChatInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
  chatId: string,
  patch: Partial<WhatsappChatRow>,
) {
  queryClient.setQueryData<WhatsappChatRow[]>(['whatsapp-chats', companyId], (old) =>
    old?.map((c) => (c.chat_id === chatId ? { ...c, ...patch } : c)),
  );
  queryClient.setQueryData<WhatsappChatRow | null>(
    ['whatsapp-chat-one', companyId, chatId],
    (old) => (old ? { ...old, ...patch } : old),
  );
}

export const useWhatsappChatLink = () => {
  const queryClient = useQueryClient();
  const { companyId } = useWhatsappCompanyId();

  const search = useMutation({
    mutationFn: async (q: string) => {
      return invokeWhatsappProxy<LinkSearchResult>({
        action: 'chat.search_link',
        q,
        limit: 12,
      });
    },
  });

  const setLink = useMutation({
    mutationFn: async (input: {
      chat_id: string;
      customer_id?: string | null;
      marketing_lead_id?: string | null;
    }) => {
      return invokeWhatsappProxy<{ ok: boolean }>({
        action: 'chat.set_link',
        ...input,
      });
    },
    onSuccess: (_data, input) => {
      if (!companyId) return;
      const patch: Partial<WhatsappChatRow> = {};
      if ('customer_id' in input) patch.customer_id = input.customer_id ?? null;
      if ('marketing_lead_id' in input) patch.marketing_lead_id = input.marketing_lead_id ?? null;
      patchChatInCache(queryClient, companyId, input.chat_id, patch);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });
    },
  });

  const ensureChat = useMutation({
    mutationFn: async (input: {
      chat_id: string;
      name?: string | null;
      marketing_lead_id?: string | null;
    }) => {
      return invokeWhatsappProxy<{ ok: boolean; chat_id: string }>({
        action: 'chat.ensure',
        ...input,
      });
    },
    onSuccess: (_data, input) => {
      if (!companyId) return;
      if (input.marketing_lead_id) {
        patchChatInCache(queryClient, companyId, input.chat_id, {
          marketing_lead_id: input.marketing_lead_id,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });
    },
  });

  return { search, setLink, ensureChat };
};
