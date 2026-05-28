
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export interface AccessibleCompany {
  id: string;
  name: string;
  short_name: string | null;
  tax_id: string | null;
  work_center_id: string | null;
  work_center_name: string | null;
  is_assigned: boolean;
  is_active: boolean;
}

interface CompanyContextValue {
  companyId: string | null;
  accessibleCompanies: AccessibleCompany[];
  loading: boolean;
  switching: boolean;
  switchCompany: (companyId: string) => Promise<boolean>;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH === '1') {
    console.log(...args);
  }
};

export function CompanyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [accessibleCompanies, setAccessibleCompanies] = useState<AccessibleCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const setupInProgressForUser = useRef<string | null>(null);

  const loadAccessibleCompanies = useCallback(async (): Promise<AccessibleCompany[]> => {
    const { data, error } = await supabase.rpc('get_user_accessible_companies');
    if (error) {
      console.error('get_user_accessible_companies failed:', error);
      return [];
    }
    return (data ?? []) as AccessibleCompany[];
  }, []);

  const resolveActiveCompany = useCallback(
    (companies: AccessibleCompany[], preferredId?: string | null): string | null => {
      if (preferredId && companies.some((c) => c.id === preferredId)) {
        return preferredId;
      }
      const active = companies.find((c) => c.is_active);
      if (active) return active.id;
      const assigned = companies.find((c) => c.is_assigned);
      if (assigned) return assigned.id;
      return companies[0]?.id ?? null;
    },
    [],
  );

  const persistActiveCompany = useCallback((nextCompanyId: string, userId: string) => {
    sessionStorage.setItem('current_company_id', nextCompanyId);
    sessionStorage.setItem('current_user_id', userId);
  }, []);

  const refreshCompanies = useCallback(async () => {
    if (!user) {
      setAccessibleCompanies([]);
      setCompanyId(null);
      return;
    }

    const companies = await loadAccessibleCompanies();
    setAccessibleCompanies(companies);

    const cachedId = sessionStorage.getItem('current_company_id');
    const cachedUserId = sessionStorage.getItem('current_user_id');
    const preferredId = cachedUserId === user.id ? cachedId : null;
    const activeId = resolveActiveCompany(companies, preferredId);

    if (activeId) {
      setCompanyId(activeId);
      persistActiveCompany(activeId, user.id);
    } else {
      setCompanyId(null);
    }
  }, [user, loadAccessibleCompanies, resolveActiveCompany, persistActiveCompany]);

  useEffect(() => {
    const userId = user?.id ?? null;
    const setupKey = authLoading ? null : (userId ?? '__anonymous__');

    if (setupKey && setupInProgressForUser.current === setupKey) {
      return;
    }
    if (setupKey) {
      setupInProgressForUser.current = setupKey;
    }

    let cancelled = false;

    const setup = async () => {
      if (authLoading) return;

      if (!user) {
        if (cancelled) return;
        setCompanyId(null);
        setAccessibleCompanies([]);
        sessionStorage.removeItem('current_company_id');
        sessionStorage.removeItem('current_user_id');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let companies = await loadAccessibleCompanies();

        const cachedId = sessionStorage.getItem('current_company_id');
        const cachedUserId = sessionStorage.getItem('current_user_id');
        let preferredId = cachedUserId === user.id ? cachedId : null;

        if (!preferredId && companies.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('company_id')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(1);

          preferredId = profiles?.[0]?.company_id ?? null;
        }

        let activeId = resolveActiveCompany(companies, preferredId);

        if (activeId && !companies.some((c) => c.id === activeId)) {
          const { error: rpcError } = await supabase.rpc('set_active_company_id', {
            p_company_id: activeId,
          });
          if (rpcError) {
            debugLog('set_active_company_id fallback failed:', rpcError.message);
          } else {
            companies = await loadAccessibleCompanies();
            activeId = resolveActiveCompany(companies, activeId);
          }
        }

        if (cancelled) return;
        setAccessibleCompanies(companies);
        setCompanyId(activeId);
        if (activeId) {
          persistActiveCompany(activeId, user.id);
        }
        debugLog('Company context ready:', { activeId, count: companies.length });
      } catch (error) {
        console.error('Error setting up company context:', error);
        if (cancelled) return;
        setCompanyId(null);
        setAccessibleCompanies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (setupKey && setupInProgressForUser.current === setupKey) {
        setupInProgressForUser.current = null;
      }
    };
  }, [
    user?.id,
    authLoading,
    loadAccessibleCompanies,
    resolveActiveCompany,
    persistActiveCompany,
    user,
  ]);

  const switchCompany = useCallback(
    async (nextCompanyId: string): Promise<boolean> => {
      if (!user || nextCompanyId === companyId) return true;

      setSwitching(true);
      try {
        const { error } = await supabase.rpc('set_active_company_id', {
          p_company_id: nextCompanyId,
        });
        if (error) {
          console.error('set_active_company_id failed:', error);
          return false;
        }

        setCompanyId(nextCompanyId);
        persistActiveCompany(nextCompanyId, user.id);

        const companies = await loadAccessibleCompanies();
        setAccessibleCompanies(
          companies.map((c) => ({
            ...c,
            is_active: c.id === nextCompanyId,
          })),
        );

        await queryClient.invalidateQueries();
        window.dispatchEvent(new CustomEvent('company-switched', { detail: { companyId: nextCompanyId } }));
        return true;
      } finally {
        setSwitching(false);
      }
    },
    [user, companyId, persistActiveCompany, loadAccessibleCompanies, queryClient],
  );

  return (
    <CompanyContext.Provider
      value={{
        companyId,
        accessibleCompanies,
        loading: authLoading || loading,
        switching,
        switchCompany,
        refreshCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompanyFilter = (): CompanyContextValue => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompanyFilter must be used within a CompanyProvider');
  }
  return context;
};
