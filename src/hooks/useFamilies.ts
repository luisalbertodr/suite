
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { familyBelongsToBillingCompany } from '@/lib/billingCompany';

export type ArticleFamilyRecord = {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  billing_company_id: string | null;
};

export type UseFamiliesOptions = {
  /** visible: solo la empresa activa (UI). all: catálogo completo (mapas de facturación). */
  scope?: 'visible' | 'all';
};

export const useFamilies = (options?: UseFamiliesOptions) => {
  const scope = options?.scope ?? 'visible';
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const {
    isMultiEntity,
    catalogHostCompanyId,
    siblingBillingCompanyId,
    companyLabels,
    loading: wcLoading,
  } = useWorkCenter();
  const queryClient = useQueryClient();

  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const billingScopeId = companyId;

  const { data: families = [], isLoading: loading, error } = useQuery({
    queryKey: ['article-families', catalogCompanyId, billingScopeId, isMultiEntity, scope],
    queryFn: async () => {
      if (!catalogCompanyId) return [];

      const { data, error } = await supabase
        .from('article_families')
        .select('*')
        .eq('company_id', catalogCompanyId)
        .order('name');

      if (error) throw error;

      const rows = (data ?? []) as ArticleFamilyRecord[];
      if (scope === 'all' || !isMultiEntity || !billingScopeId) return rows;

      return rows.filter((f) =>        familyBelongsToBillingCompany(f, billingScopeId, catalogCompanyId),
      );
    },
    enabled: !!catalogCompanyId && !companyLoading && !wcLoading,
  });

  const familyNames = families.map((f) => f.name);

  const invalidateFamilies = () => {
    queryClient.invalidateQueries({ queryKey: ['article-families'] });
  };

  const createFamilyMutation = useMutation({
    mutationFn: async (input: { name: string; billing_company_id?: string | null }) => {
      if (!catalogCompanyId) throw new Error('No company ID available');

      const row: Record<string, unknown> = {
        company_id: catalogCompanyId,
        name: input.name.trim(),
        billing_company_id: input.billing_company_id ?? billingScopeId ?? null,
      };

      const { data, error } = await supabase
        .from('article_families')
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: invalidateFamilies,
  });

  const updateFamilyBillingMutation = useMutation({
    mutationFn: async ({
      familyId,
      billing_company_id,
    }: {
      familyId: string;
      billing_company_id: string | null;
    }) => {
      if (!catalogCompanyId) throw new Error('No company ID available');
      const { data, error } = await supabase
        .from('article_families')
        .update({ billing_company_id })
        .eq('id', familyId)
        .eq('company_id', catalogCompanyId)
        .select()
        .single();
      if (error) throw error;

      const { error: articlesError } = await supabase
        .from('articles')
        .update({ billing_company_id })
        .eq('company_id', catalogCompanyId)
        .eq('familia', data.name);

      if (articlesError && articlesError.code !== '42703') throw articlesError;

      return data;
    },
    onSuccess: () => {
      invalidateFamilies();
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['tpv-articles'] });
    },
  });

  const releaseFamilyFromBillingMutation = useMutation({
    mutationFn: async (family: { id: string; name: string }) => {
      if (!catalogCompanyId || !billingScopeId) {
        throw new Error('No company ID available');
      }
      if (!siblingBillingCompanyId) {
        throw new Error('No hay otra empresa en el centro laboral');
      }

      const { error: familyError } = await supabase
        .from('article_families')
        .update({ billing_company_id: siblingBillingCompanyId })
        .eq('id', family.id)
        .eq('company_id', catalogCompanyId);

      if (familyError) throw familyError;

      const { error: articlesError } = await supabase
        .from('articles')
        .update({ billing_company_id: siblingBillingCompanyId })
        .eq('company_id', catalogCompanyId)
        .eq('familia', family.name)
        .eq('billing_company_id', billingScopeId);

      if (articlesError && articlesError.code !== '42703') throw articlesError;

      return { siblingBillingCompanyId };
    },
    onSuccess: () => {
      invalidateFamilies();
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['tpv-articles'] });
    },
  });

  const updateFamilyMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      if (!catalogCompanyId) throw new Error('No company ID available');

      const { data, error } = await supabase
        .from('article_families')
        .update({ name: newName.trim() })
        .eq('company_id', catalogCompanyId)
        .eq('name', oldName)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: invalidateFamilies,
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: async (familyName: string) => {
      if (!catalogCompanyId) throw new Error('No company ID available');

      const { error } = await supabase
        .from('article_families')
        .delete()
        .eq('company_id', catalogCompanyId)
        .eq('name', familyName);

      if (error) throw error;
    },
    onSuccess: invalidateFamilies,
  });

  const ensureVariosFamilyExists = async (): Promise<void> => {
    if (!catalogCompanyId) throw new Error('No company ID available');

    const { data: existingFamily, error: checkError } = await supabase
      .from('article_families')
      .select('id')
      .eq('company_id', catalogCompanyId)
      .eq('name', 'Varios')
      .maybeSingle();

    if (checkError) throw checkError;

    if (!existingFamily) {
      const row: Record<string, unknown> = {
        company_id: catalogCompanyId,
        name: 'Varios',
        description: 'Familia por defecto para artículos varios',
      };
      if (isMultiEntity && billingScopeId) {
        row.billing_company_id = billingScopeId;
      }
      const { error: insertError } = await supabase.from('article_families').insert(row);
      if (insertError) throw insertError;
      invalidateFamilies();
    }
  };

  const addFamily = async (
    familyName: string,
    billing_company_id?: string | null,
  ): Promise<boolean> => {
    if (!familyName.trim() || familyNames.includes(familyName.trim())) {
      return false;
    }

    try {
      await createFamilyMutation.mutateAsync({
        name: familyName,
        billing_company_id: billing_company_id ?? (isMultiEntity ? billingScopeId : null),
      });
      return true;
    } catch (error) {
      console.error('Error adding family:', error);
      throw error;
    }
  };

  const releaseFamilyFromBilling = async (family: {
    id: string;
    name: string;
  }): Promise<void> => {
    await releaseFamilyFromBillingMutation.mutateAsync(family);
  };

  const removeFamily = async (familyName: string): Promise<void> => {
    try {
      await deleteFamilyMutation.mutateAsync(familyName);
    } catch (error) {
      console.error('Error removing family:', error);
      throw error;
    }
  };

  const updateFamily = async (oldName: string, newName: string): Promise<boolean> => {
    if (!newName.trim() || familyNames.includes(newName.trim())) {
      return false;
    }

    try {
      await updateFamilyMutation.mutateAsync({ oldName, newName });
      return true;
    } catch (error) {
      console.error('Error updating family:', error);
      throw error;
    }
  };

  const saveFamilies = async (_newFamilies: string[]) => {
    console.warn('saveFamilies is deprecated, use addFamily/removeFamily/updateFamily instead');
  };

  return {
    families,
    familyNames,
    loading: companyLoading || wcLoading || loading,
    saveFamilies,
    addFamily,
    removeFamily,
    updateFamily,
    updateFamilyBilling: updateFamilyBillingMutation.mutateAsync,
    releaseFamilyFromBilling,
    siblingBillingCompanyId,
    siblingBillingLabel: siblingBillingCompanyId
      ? (companyLabels.get(siblingBillingCompanyId) ?? 'otra empresa')
      : null,
    ensureVariosFamilyExists,
    error,
  };
};
