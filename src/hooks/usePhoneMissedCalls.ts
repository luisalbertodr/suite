import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { usePermissions } from '@/hooks/usePermissions';
import { canAccessPhone } from '@/lib/phonePermissions';
import { PHONE_CALLS_POLL_INTERVAL_MS } from '@/lib/lipooutPhone';

function yesterdayDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function usePhoneMissedCalls() {
  const queryClient = useQueryClient();
  const { companyId, loading } = useCompanyFilter();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const canSyncMissed = canAccessPhone(hasPermission);
  const from = yesterdayDateString();
  const [syncReady, setSyncReady] = useState(false);

  useEffect(() => {
    if (!companyId || loading || permissionsLoading || !canSyncMissed) {
      setSyncReady(false);
      return;
    }
    const timer = window.setTimeout(() => setSyncReady(true), 4000);
    return () => window.clearTimeout(timer);
  }, [companyId, loading, permissionsLoading, canSyncMissed]);

  useQuery({
    queryKey: ['phone-missed-sync', companyId, from],
    enabled: !!companyId && !loading && !permissionsLoading && canSyncMissed && syncReady,
    staleTime: PHONE_CALLS_POLL_INTERVAL_MS - 2_000,
    refetchInterval: PHONE_CALLS_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('issabel-calls', {
        body: {
          action: 'calls.sync_missed',
          company_id: companyId,
          from,
          limit: 250,
        },
      });
      if (error) {
        console.warn('issabel-calls sync omitido:', error.message);
        return { ok: false, skipped: true, created: 0, missed: 0 };
      }
      if (data?.error) {
        console.warn('issabel-calls sync omitido:', data.error);
        return { ok: false, skipped: true, created: 0, missed: 0 };
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['phone-missed-unread', companyId] });
      if ((data?.created ?? 0) > 0) {
        queryClient.invalidateQueries({ queryKey: ['issabel-calls'] });
      }
      return data;
    },
  });

  const unreadQuery = useQuery({
    queryKey: ['phone-missed-unread', companyId],
    enabled: !!companyId && !loading && !permissionsLoading && canSyncMissed,
    staleTime: PHONE_CALLS_POLL_INTERVAL_MS - 2_000,
    refetchInterval: PHONE_CALLS_POLL_INTERVAL_MS,
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
