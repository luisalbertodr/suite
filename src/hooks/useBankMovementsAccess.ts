import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { runWhenAuthReady } from '@/lib/authSession';
import {
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
} from '@/lib/workCenterBilling';
import type { BankEntity } from '@/lib/bankExpenses';

async function companyHasBankMovementsPermission(
  userId: string,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await runWhenAuthReady(() =>
    supabase.rpc('get_effective_user_permissions', {
      p_user_id: userId,
      p_company_id: companyId,
    }),
  );
  if (error) {
    console.warn('bank_movements permission check:', companyId, error.message);
    return false;
  }
  if (!Array.isArray(data)) return false;
  return data.some(
    (row: { resource?: string; action?: string }) =>
      row.resource === 'bank_movements' && row.action === 'read',
  );
}

/**
 * Acceso a la pestaña Movimientos bancarios, acotado por empresa (M/E).
 * Por defecto solo roles admin (vía role_permissions); el resto requiere
 * autorización explícita en la empresa correspondiente.
 */
export function useBankMovementsAccess() {
  const { user, isSuperuser } = useAuth();
  const { assignedBillingCompanies, loading: wcLoading } = useWorkCenter();

  const assignedIds = useMemo(
    () => new Set(assignedBillingCompanies.map((c) => c.id)),
    [assignedBillingCompanies],
  );

  const { data: isAdminRpc = false, isLoading: adminLoading } = useQuery({
    queryKey: ['bank-movements-is-admin', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) {
        console.warn('is_admin:', error.message);
        return false;
      }
      return data === true;
    },
    enabled: !!user && !isSuperuser,
    staleTime: 5 * 60 * 1000,
  });

  const { data: companyFlags, isLoading: permLoading } = useQuery({
    queryKey: [
      'bank-movements-company-perms',
      user?.id,
      isSuperuser,
      [...assignedIds].sort().join(','),
    ],
    queryFn: async () => {
      if (!user) return { medicina: false, estetica: false };
      if (isSuperuser) {
        return { medicina: true, estetica: true };
      }
      const [medicina, estetica] = await Promise.all([
        assignedIds.has(MEDICINA_COMPANY_ID)
          ? companyHasBankMovementsPermission(user.id, MEDICINA_COMPANY_ID)
          : Promise.resolve(false),
        assignedIds.has(ESTETICA_COMPANY_ID)
          ? companyHasBankMovementsPermission(user.id, ESTETICA_COMPANY_ID)
          : Promise.resolve(false),
      ]);
      return { medicina, estetica };
    },
    enabled: !!user && !wcLoading,
    staleTime: 60 * 1000,
  });

  const canMedicina = Boolean(companyFlags?.medicina);
  const canEstetica = Boolean(companyFlags?.estetica);
  const canAccess = canMedicina || canEstetica;
  const loading = wcLoading || (!isSuperuser && adminLoading) || permLoading;

  const allowedEntities = useMemo((): Array<BankEntity | 'all'> => {
    const entities: BankEntity[] = [];
    if (canMedicina) entities.push('medicina');
    if (canEstetica) entities.push('estetica');
    if (entities.length === 2) return ['all', ...entities];
    return entities;
  }, [canMedicina, canEstetica]);

  const defaultEntity = useMemo((): BankEntity | 'all' => {
    if (canMedicina && canEstetica) return 'all';
    if (canMedicina) return 'medicina';
    if (canEstetica) return 'estetica';
    return 'all';
  }, [canMedicina, canEstetica]);

  const canImportEntity = useCallback(
    (entity: BankEntity) => (entity === 'medicina' ? canMedicina : canEstetica),
    [canMedicina, canEstetica],
  );

  return {
    loading,
    canAccess,
    canMedicina,
    canEstetica,
    canImportEntity,
    allowedEntities,
    defaultEntity,
    isAdmin: isSuperuser || isAdminRpc,
  };
}
