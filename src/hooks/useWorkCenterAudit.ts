import { useQuery } from '@tanstack/react-query';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { buildWorkCenterAudit } from '@/lib/workCenterAudit';
import {
  fetchAuditArticles,
  fetchAuditEmployees,
  fetchAuditFamilies,
} from '@/lib/workCenterAuditQueries';

export function useWorkCenterAudit() {
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { isMultiEntity, billingCompanies, loading: wcLoading } = useWorkCenter();

  const query = useQuery({
    queryKey: ['work-center-audit', companyId, billingCompanies.map((c) => c.id).join(',')],
    enabled: !!companyId && !companyLoading && !wcLoading && isMultiEntity,
    staleTime: 60_000,
    queryFn: async () => {
      if (!companyId) return null;

      const [families, articles, employees] = await Promise.all([
        fetchAuditFamilies(companyId),
        fetchAuditArticles(companyId),
        fetchAuditEmployees(companyId),
      ]);

      return buildWorkCenterAudit({
        hostCompanyId: companyId,
        billingCompanies,
        families,
        articles,
        employees,
      });
    },
  });

  return {
    audit: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    isMultiEntity,
    billingCompanies,
  };
}
