import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type ServiceMonitorStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export type ServiceStatusRow = {
  service_key: string;
  display_name: string;
  status: ServiceMonitorStatus;
  last_ok_at: string | null;
  last_check_at: string | null;
  last_error: string | null;
  latency_ms: number | null;
  details: Record<string, unknown>;
  consecutive_failures: number;
  updated_at: string;
};

export type ServiceCheckLogRow = {
  id: string;
  service_key: string;
  status: string;
  latency_ms: number | null;
  message: string | null;
  recovery_attempted: boolean;
  recovery_success: boolean | null;
  recovery_message: string | null;
  checked_at: string;
};

export type ServiceNotificationRow = {
  id: string;
  service_key: string | null;
  channel: string;
  destination: string;
  subject: string | null;
  body: string;
  success: boolean;
  error: string | null;
  created_at: string;
};

export type MonitorSettingsRow = {
  id: number;
  enabled: boolean;
  check_interval_seconds: number;
  monitor_company_id: string | null;
  alert_email: string;
  waha_down_email: string;
  waha_up_whatsapp: string;
  notification_cooldown_minutes: number;
  failures_before_alert: number;
  successes_before_recovery: number;
  updated_at: string;
};

export function useServiceMonitorSettings() {
  return useQuery({
    queryKey: ['suite-service-monitor-settings'],
    queryFn: async (): Promise<MonitorSettingsRow | null> => {
      const { data, error } = await supabase
        .from('suite_service_monitor_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data as MonitorSettingsRow | null;
    },
  });
}

export function useServiceMonitorStatus(refetchIntervalMs = 10_000) {
  return useQuery({
    queryKey: ['suite-service-status'],
    queryFn: async (): Promise<ServiceStatusRow[]> => {
      const { data, error } = await supabase
        .from('suite_service_status')
        .select('*')
        .order('display_name');
      if (error) throw error;
      return (data ?? []) as ServiceStatusRow[];
    },
    refetchInterval: refetchIntervalMs,
  });
}

export function useServiceMonitorLogs(limit = 30) {
  return useQuery({
    queryKey: ['suite-service-check-log', limit],
    queryFn: async (): Promise<ServiceCheckLogRow[]> => {
      const { data, error } = await supabase
        .from('suite_service_check_log')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ServiceCheckLogRow[];
    },
    refetchInterval: 15_000,
  });
}

export function useServiceMonitorNotifications(limit = 20) {
  return useQuery({
    queryKey: ['suite-service-notifications', limit],
    queryFn: async (): Promise<ServiceNotificationRow[]> => {
      const { data, error } = await supabase
        .from('suite_service_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ServiceNotificationRow[];
    },
    refetchInterval: 15_000,
  });
}

export function useRunServiceMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runRecovery = true) => {
      const { data, error } = await supabase.functions.invoke('service-health-monitor', {
        body: { source: 'ui', run_recovery: runRecovery },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suite-service-status'] });
      queryClient.invalidateQueries({ queryKey: ['suite-service-check-log'] });
      queryClient.invalidateQueries({ queryKey: ['suite-service-notifications'] });
    },
  });
}

export function useUpdateServiceMonitorSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<MonitorSettingsRow>) => {
      const { error } = await supabase
        .from('suite_service_monitor_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suite-service-monitor-settings'] });
    },
  });
}
