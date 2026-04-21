import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

let notificationsTableMissing = false;

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const isMissingRelation = (error: { code?: string; message?: string } | null) =>
    !!error && (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      /Could not find the table/i.test(error.message || '') ||
      /relation .* does not exist/i.test(error.message || '') ||
      /not found/i.test(error.message || '')
    );

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (notificationsTableMissing) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (isMissingRelation(error)) {
        notificationsTableMissing = true;
        return [];
      }
      if (error) throw error;
      return data as Notification[];
    },
    retry: false,
    refetchOnWindowFocus: !notificationsTableMissing,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
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
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
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
