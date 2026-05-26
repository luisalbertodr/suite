import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

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

export const useWhatsappChatLink = () => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });
    },
  });

  const ensureChat = useMutation({
    mutationFn: async (input: { chat_id: string; name?: string | null }) => {
      return invokeWhatsappProxy<{ ok: boolean; chat_id: string }>({
        action: 'chat.ensure',
        ...input,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });
    },
  });

  return { search, setLink, ensureChat };
};
