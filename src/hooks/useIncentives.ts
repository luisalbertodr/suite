import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  cashIncentivePayout,
  createIncentiveRequest,
  creditBonoSale,
  fetchIncentiveAdminOverview,
  fetchIncentiveBoardTeam,
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
import { ESTETICA_COMPANY_ID } from '@/lib/workCenterBilling';
import { useWorkCenter } from '@/hooks/useWorkCenter';

function useIncentiveBoardCompanyId(): string | null {
  const { companyId, accessibleCompanies } = useCompanyFilter();
  if (accessibleCompanies.some((c) => c.id === ESTETICA_COMPANY_ID)) {
    return ESTETICA_COMPANY_ID;
  }
  return companyId;
}

function useIncentiveAdminCompanyId(): string | null {
  const { companyId } = useCompanyFilter();
  const { operationalCompanyId } = useWorkCenter();
  return operationalCompanyId ?? companyId;
}

function useCanManageIncentives(): { allowed: boolean; loading: boolean } {
  const { hasPermission, loading } = usePermissions();
  const isAdmin = useIsIncentiveAdmin();
  return { allowed: hasPermission('incentives', 'manage') || isAdmin, loading };
}

export function useIncentiveMySummary(options?: { boardPermission?: boolean }) {
  const companyId = useIncentiveBoardCompanyId();
  const { hasPermission, loading } = usePermissions();
  const canRead =
    hasPermission('incentives', 'read') ||
    (options?.boardPermission !== false && hasPermission('incentives_board', 'read'));

  return useQuery({
    queryKey: ['incentive-my-summary', companyId],
    queryFn: () => fetchIncentiveMySummary(companyId!),
    enabled: Boolean(companyId) && !loading && canRead,
    staleTime: 30_000,
  });
}

export function useIsIncentiveAdmin(): boolean {
  const { isSuperuser } = useAuth();
  const { data: isAdmin = false } = useQuery({
    queryKey: ['incentive-is-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) return false;
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
  });
  return Boolean(isSuperuser || isAdmin);
}

export function useIncentiveBoardTeam() {
  const companyId = useIncentiveBoardCompanyId();
  const isAdmin = useIsIncentiveAdmin();

  return useQuery({
    queryKey: ['incentive-board-team', companyId],
    queryFn: () => fetchIncentiveBoardTeam(companyId!),
    enabled: Boolean(companyId) && isAdmin,
    staleTime: 30_000,
  });
}

export function useIncentiveAdminOverview() {
  const companyId = useIncentiveAdminCompanyId();
  const { allowed, loading } = useCanManageIncentives();

  return useQuery({
    queryKey: ['incentive-admin-overview', companyId],
    queryFn: () => fetchIncentiveAdminOverview(companyId!),
    enabled: Boolean(companyId) && !loading && allowed,
    staleTime: 15_000,
  });
}

export function useIncentiveSettings() {
  const companyId = useIncentiveAdminCompanyId();
  const { allowed, loading } = useCanManageIncentives();

  return useQuery({
    queryKey: ['incentive-settings', companyId],
    queryFn: () => fetchIncentiveSettings(companyId!),
    enabled: Boolean(companyId) && !loading && allowed,
  });
}

export function useIncentiveBonusRules() {
  const companyId = useIncentiveAdminCompanyId();
  const { allowed, loading } = useCanManageIncentives();

  return useQuery({
    queryKey: ['incentive-bonus-rules', companyId],
    queryFn: () => fetchIncentiveBonusRules(companyId!),
    enabled: Boolean(companyId) && !loading && allowed,
  });
}

export function useIncentiveMilestones() {
  const companyId = useIncentiveAdminCompanyId();
  const { allowed, loading } = useCanManageIncentives();

  return useQuery({
    queryKey: ['incentive-milestones', companyId],
    queryFn: () => fetchIncentiveMilestones(companyId!),
    enabled: Boolean(companyId) && !loading && allowed,
  });
}

export function useIncentiveEmployeeTracks() {
  const companyId = useIncentiveAdminCompanyId();
  const { allowed, loading } = useCanManageIncentives();

  return useQuery({
    queryKey: ['incentive-employee-tracks', companyId],
    queryFn: () => fetchIncentiveEmployeeTracks(companyId!),
    enabled: Boolean(companyId) && !loading && allowed,
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
      queryClient.invalidateQueries({ queryKey: ['incentive-board-team'] });
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
