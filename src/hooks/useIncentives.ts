import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { usePermissions } from '@/hooks/usePermissions';
import {
  cashIncentivePayout,
  createIncentiveRequest,
  creditBonoSale,
  fetchIncentiveAdminOverview,
  fetchIncentiveBonusRules,
  fetchIncentiveEmployeeTracks,
  fetchIncentiveMilestones,
  fetchIncentiveMySummary,
  fetchIncentiveSettings,
  reviewIncentiveRequest,
  updateIncentiveBonusRule,
  updateIncentiveMilestone,
  upsertIncentiveEmployeeTrack,
  upsertIncentiveSettings,
  type IncentiveEmployeeTrackRow,
  type IncentiveSettings,
  type IncentiveShare,
} from '@/lib/incentives';

export function useIncentiveMySummary() {
  const { companyId } = useCompanyFilter();
  const { hasPermission, loading } = usePermissions();
  const canRead = hasPermission('incentives', 'read');

  return useQuery({
    queryKey: ['incentive-my-summary', companyId],
    queryFn: () => fetchIncentiveMySummary(companyId!),
    enabled: Boolean(companyId) && !loading && canRead,
    staleTime: 30_000,
  });
}

export function useIncentiveAdminOverview() {
  const { companyId } = useCompanyFilter();
  const { hasPermission, loading } = usePermissions();
  const canManage = hasPermission('incentives', 'manage');

  return useQuery({
    queryKey: ['incentive-admin-overview', companyId],
    queryFn: () => fetchIncentiveAdminOverview(companyId!),
    enabled: Boolean(companyId) && !loading && canManage,
    staleTime: 15_000,
  });
}

export function useIncentiveSettings() {
  const { companyId } = useCompanyFilter();
  const { hasPermission, loading } = usePermissions();
  const canManage = hasPermission('incentives', 'manage');

  return useQuery({
    queryKey: ['incentive-settings', companyId],
    queryFn: () => fetchIncentiveSettings(companyId!),
    enabled: Boolean(companyId) && !loading && canManage,
  });
}

export function useIncentiveBonusRules() {
  const { companyId } = useCompanyFilter();
  const { hasPermission, loading } = usePermissions();
  const canManage = hasPermission('incentives', 'manage');

  return useQuery({
    queryKey: ['incentive-bonus-rules', companyId],
    queryFn: () => fetchIncentiveBonusRules(companyId!),
    enabled: Boolean(companyId) && !loading && canManage,
  });
}

export function useIncentiveMilestones() {
  const { companyId } = useCompanyFilter();
  const { hasPermission, loading } = usePermissions();
  const canManage = hasPermission('incentives', 'manage');

  return useQuery({
    queryKey: ['incentive-milestones', companyId],
    queryFn: () => fetchIncentiveMilestones(companyId!),
    enabled: Boolean(companyId) && !loading && canManage,
  });
}

export function useIncentiveEmployeeTracks() {
  const { companyId } = useCompanyFilter();
  const { hasPermission, loading } = usePermissions();
  const canManage = hasPermission('incentives', 'manage');

  return useQuery({
    queryKey: ['incentive-employee-tracks', companyId],
    queryFn: () => fetchIncentiveEmployeeTracks(companyId!),
    enabled: Boolean(companyId) && !loading && canManage,
  });
}

export function useUpsertIncentiveEmployeeTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (row: IncentiveEmployeeTrackRow) => upsertIncentiveEmployeeTrack(row),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentive-employee-tracks'] });
      queryClient.invalidateQueries({ queryKey: ['incentive-admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['incentive-my-summary'] });
    },
  });
}

export function useCashIncentivePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cashIncentivePayout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentive-my-summary'] });
      queryClient.invalidateQueries({ queryKey: ['incentive-admin-overview'] });
    },
  });
}

export function useCreditBonoSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bonoId: string; shares: IncentiveShare[] }) =>
      creditBonoSale(input.bonoId, input.shares),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentive-my-summary'] });
      queryClient.invalidateQueries({ queryKey: ['incentive-admin-overview'] });
    },
  });
}

export function useCreateIncentiveRequest() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  return useMutation({
    mutationFn: (input: { date: string; startTime: string; endTime: string; notes?: string }) =>
      createIncentiveRequest({ companyId: companyId!, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentive-my-summary'] });
      queryClient.invalidateQueries({ queryKey: ['incentive-admin-overview'] });
    },
  });
}

export function useReviewIncentiveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reviewIncentiveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentive-my-summary'] });
      queryClient.invalidateQueries({ queryKey: ['incentive-admin-overview'] });
    },
  });
}

export function useSaveIncentiveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: IncentiveSettings) => upsertIncentiveSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentive-settings'] });
      queryClient.invalidateQueries({ queryKey: ['incentive-my-summary'] });
    },
  });
}

export function usePatchIncentiveBonusRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      patch: Parameters<typeof updateIncentiveBonusRule>[1];
    }) => updateIncentiveBonusRule(input.id, input.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentive-bonus-rules'] });
    },
  });
}

export function usePatchIncentiveMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof updateIncentiveMilestone>[1] }) =>
      updateIncentiveMilestone(input.id, input.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentive-milestones'] });
    },
  });
}
