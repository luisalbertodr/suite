import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invokeWhatsappProxy, useWhatsappConfig } from '@/hooks/useWhatsappConfig';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import { isGroupJid } from '@/components/whatsapp/whatsappUtils';

export type WhatsappGroupJoinRequest = {
  requesterId?: string;
  requesterPn?: string;
  addedById?: string | null;
  parentGroupId?: string | null;
  requestMethod?: string;
  timestamp?: number;
};

function participantIdForAction(req: WhatsappGroupJoinRequest): string | null {
  const pn = req.requesterPn?.trim();
  if (pn) return pn;
  const id = req.requesterId?.trim();
  return id || null;
}

export function useWhatsappGroupJoinRequests(chatId: string | null, enabled = true) {
  const queryClient = useQueryClient();
  const { companyId } = useWhatsappCompanyId();
  const { config } = useWhatsappConfig();
  const isWaha = config?.provider !== 'openwa' && config?.provider !== 'meta';
  const isGroup = !!chatId && isGroupJid(chatId);
  const key = ['whatsapp-group-join-requests', companyId, chatId] as const;

  const listQuery = useQuery({
    queryKey: key,
    enabled: enabled && !!companyId && isWaha && isGroup,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await invokeWhatsappProxy<{
        ok: boolean;
        requests?: WhatsappGroupJoinRequest[];
      }>({
        action: 'groups.join_requests.list',
        chat_id: chatId!,
        company_id: companyId!,
      });
      return Array.isArray(res.requests) ? res.requests : [];
    },
  });

  const approvalQuery = useQuery({
    queryKey: ['whatsapp-group-membership-approval', companyId, chatId],
    enabled: enabled && !!companyId && isWaha && isGroup,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await invokeWhatsappProxy<{
        ok: boolean;
        new_members_approval_required?: boolean;
      }>({
        action: 'groups.membership_approval.get',
        chat_id: chatId!,
        company_id: companyId!,
      });
      return !!res.new_members_approval_required;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({
      queryKey: ['whatsapp-group-membership-approval', companyId, chatId],
    });
    void queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
  };

  const approve = useMutation({
    mutationFn: async (participantIds: string[]) =>
      invokeWhatsappProxy({
        action: 'groups.join_requests.approve',
        chat_id: chatId!,
        participant_ids: participantIds,
        company_id: companyId!,
      }),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async (participantIds: string[]) =>
      invokeWhatsappProxy({
        action: 'groups.join_requests.reject',
        chat_id: chatId!,
        participant_ids: participantIds,
        company_id: companyId!,
      }),
    onSuccess: invalidate,
  });

  const setApprovalRequired = useMutation({
    mutationFn: async (required: boolean) =>
      invokeWhatsappProxy({
        action: 'groups.membership_approval.set',
        chat_id: chatId!,
        new_members_approval_required: required,
        company_id: companyId!,
      }),
    onSuccess: invalidate,
  });

  return {
    requests: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error as Error | null,
    refetch: listQuery.refetch,
    approvalRequired: approvalQuery.data ?? false,
    approvalLoading: approvalQuery.isLoading,
    approve,
    reject,
    setApprovalRequired,
    participantIdForAction,
  };
}
