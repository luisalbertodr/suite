import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useToast } from '@/hooks/use-toast';

const isMissingRelation = (error: { code?: string; message?: string } | null) =>
  !!error && (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /Could not find the table/i.test(error.message || '') ||
    /relation .* does not exist/i.test(error.message || '') ||
    /not found/i.test(error.message || '')
  );

export const useCabinas = () => {
  const { companyId } = useCompanyFilter();
  const { operationalCompanyId, loading: wcLoading } = useWorkCenter();
  const scopeCompanyId = operationalCompanyId ?? companyId;
  const { toast } = useToast();
  const qc = useQueryClient();

  const cabinas = useQuery({
    queryKey: ['cabinas', scopeCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cabinas')
        .select('*')
        .eq('company_id', scopeCompanyId!)
        .order('nombre');
      if (isMissingRelation(error)) return [];
      if (error) throw error;
      return data;
    },
    enabled: !!scopeCompanyId && !wcLoading,
    retry: false,
  });

  const create = useMutation({
    mutationFn: async (values: { nombre: string; descripcion?: string; capacidad?: number; color?: string }) => {
      const { error } = await supabase.from('cabinas').insert({ ...values, company_id: scopeCompanyId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cabinas'] }); toast({ title: 'Cabina creada' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...values }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('cabinas').update(values as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cabinas'] }); toast({ title: 'Cabina actualizada' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cabinas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cabinas'] }); toast({ title: 'Cabina eliminada' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  return { cabinas, create, update, remove, companyId: scopeCompanyId };
};

export const useRecursos = () => {
  const { companyId } = useCompanyFilter();
  const { operationalCompanyId, loading: wcLoading } = useWorkCenter();
  const scopeCompanyId = operationalCompanyId ?? companyId;
  const { toast } = useToast();
  const qc = useQueryClient();

  const recursos = useQuery({
    queryKey: ['recursos', scopeCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recursos')
        .select('*, cabinas(nombre)')
        .eq('company_id', scopeCompanyId!)
        .order('nombre');
      if (isMissingRelation(error)) return [];
      if (error) throw error;
      return data;
    },
    enabled: !!scopeCompanyId && !wcLoading,
    retry: false,
  });

  const create = useMutation({
    mutationFn: async (values: {
      nombre: string;
      descripcion?: string;
      tipo?: string;
      cabina_id?: string | null;
      color?: string;
      match_keywords?: string;
    }) => {
      const { data, error } = await supabase
        .from('recursos')
        .insert({ ...values, company_id: scopeCompanyId! })
        .select('id')
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recursos'] }); toast({ title: 'Recurso creado' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...values }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('recursos').update(values as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recursos'] }); toast({ title: 'Recurso actualizado' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  /** Asigna/quita tratamientos (artículos servicio) con recurso exclusivo. */
  const syncTratamientos = useMutation({
    mutationFn: async ({
      recursoId,
      articleIds,
      previousArticleIds,
    }: {
      recursoId: string;
      articleIds: string[];
      previousArticleIds: string[];
    }) => {
      const next = new Set(articleIds);
      const prev = new Set(previousArticleIds);
      const toLink = articleIds.filter((id) => !prev.has(id));
      const toUnlink = previousArticleIds.filter((id) => !next.has(id));

      if (toLink.length) {
        const { error } = await supabase
          .from('articles')
          .update({ recurso_id: recursoId })
          .in('id', toLink);
        if (error) throw error;
      }
      if (toUnlink.length) {
        const { error } = await supabase
          .from('articles')
          .update({ recurso_id: null })
          .in('id', toUnlink)
          .eq('recurso_id', recursoId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recursos'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: () => toast({ title: 'Error al vincular tratamientos', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recursos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recursos'] }); toast({ title: 'Recurso eliminado' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  return { recursos, create, update, remove, syncTratamientos, companyId: scopeCompanyId };
};
