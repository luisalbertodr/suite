import { useEffect, useMemo } from 'react';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { resolveWhatsappBillingCompanyId } from '@/lib/whatsappCompany';

const STORAGE_KEY = 'whatsapp_company_id';

/** Empresa activa para WhatsApp: siempre la emisora E del centro laboral. */
export function useWhatsappCompanyId() {
  const { billingCompanies, loading: wcLoading } = useWorkCenter();
  const { companyId: sessionCompanyId, loading: companyLoading } = useCompanyFilter();

  const companyId = useMemo(
    () => resolveWhatsappBillingCompanyId(billingCompanies, sessionCompanyId),
    [billingCompanies, sessionCompanyId],
  );

  useEffect(() => {
    if (companyId) {
      sessionStorage.setItem(STORAGE_KEY, companyId);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [companyId]);

  return {
    companyId,
    loading: wcLoading || companyLoading,
  };
}

export function getStoredWhatsappCompanyId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}
