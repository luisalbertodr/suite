import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { fetchPendingQuestionnaireNotifications } from '@/lib/questionnaireNotifications';

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  link: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

let notificationsTableMissing = false;

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const isMissingRelation = (error: { code?: string; message?: string } | null) =>
    !!error && (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      /Could not find the table/i.test(error.message || '') ||
      /relation .* does not exist/i.test(error.message || '') ||
      /not found/i.test(error.message || '')
    );

  const { data: dbNotifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (notificationsTableMissing) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (isMissingRelation(error)) {
        notificationsTableMissing = true;
        return [];
      }
      if (error) throw error;
      return data as Notification[];
    },
    retry: false,
    refetchOnWindowFocus: !notificationsTableMissing,
    refetchInterval: notificationsTableMissing ? false : 30_000,
    refetchIntervalInBackground: true,
  });

  const { data: questionnaireNotifications = [] } = useQuery({
    queryKey: ['questionnaire-pending-notifications', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return fetchPendingQuestionnaireNotifications(companyId);
    },
    enabled: !!companyId,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  const notifications = (() => {
    const merged = [...questionnaireNotifications, ...dbNotifications] as Notification[];
    merged.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return merged;
  })();

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith('questionnaire-pending:')) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const unreadIds = dbNotifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
};
