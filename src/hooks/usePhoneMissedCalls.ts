import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

function yesterdayDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function usePhoneMissedCalls() {
  const queryClient = useQueryClient();
  const { companyId, loading } = useCompanyFilter();
  const from = yesterdayDateString();

  useQuery({
    queryKey: ['phone-missed-sync', companyId, from],
    enabled: !!companyId && !loading,
    staleTime: 45_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('issabel-calls', {
        body: {
          action: 'calls.sync_missed',
          company_id: companyId,
          from,
          limit: 500,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['phone-missed-unread', companyId] });
      return data;
    },
  });

  const unreadQuery = useQuery({
    queryKey: ['phone-missed-unread', companyId],
    enabled: !!companyId && !loading,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('company_id', companyId)
        .eq('type', 'phone_missed_call')
        .eq('read', false)
        .limit(1000);
      if (error) throw error;
      return data?.length ?? 0;
    },
  });

  return {
    missedUnread: unreadQuery.data ?? 0,
    isLoading: unreadQuery.isLoading,
  };
}
