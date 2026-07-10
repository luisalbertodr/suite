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

const READ_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

function readRetentionCutoffIso(): string {
  return new Date(Date.now() - READ_RETENTION_MS).toISOString();
}

/** Campanita: todas las no leídas + leídas de los últimos 2 días. */
export function filterBellNotifications<T extends { read: boolean; created_at: string }>(
  items: T[],
): T[] {
  const cutoff = Date.now() - READ_RETENTION_MS;
  return items.filter(
    (n) => !n.read || new Date(n.created_at).getTime() >= cutoff,
  );
}

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
      const cutoffIso = readRetentionCutoffIso();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`read.eq.false,created_at.gte.${cutoffIso}`)
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
    const merged = filterBellNotifications(
      [...questionnaireNotifications, ...dbNotifications] as Notification[],
    );
    merged.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return merged;
  })();

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith('questionnaire-pending:') || id.startsWith('questionnaire-personal-changes:')) return;
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
