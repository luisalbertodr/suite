import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
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
  const { toast } = useToast();
  const qc = useQueryClient();

  const cabinas = useQuery({
    queryKey: ['cabinas', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cabinas')
        .select('*')
        .eq('company_id', companyId!)
        .order('nombre');
      if (isMissingRelation(error)) return [];
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    retry: false,
  });

  const create = useMutation({
    mutationFn: async (values: { nombre: string; descripcion?: string; capacidad?: number; color?: string }) => {
      const { error } = await supabase.from('cabinas').insert({ ...values, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cabinas'] }); toast({ title: 'Cabina creada' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...values }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('cabinas').update(values).eq('id', id);
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

  return { cabinas, create, update, remove, companyId };
};

export const useRecursos = () => {
  const { companyId } = useCompanyFilter();
  const { toast } = useToast();
  const qc = useQueryClient();

  const recursos = useQuery({
    queryKey: ['recursos', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recursos')
        .select('*, cabinas(nombre)')
        .eq('company_id', companyId!)
        .order('nombre');
      if (isMissingRelation(error)) return [];
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    retry: false,
  });

  const create = useMutation({
    mutationFn: async (values: { nombre: string; descripcion?: string; tipo?: string; cabina_id?: string | null }) => {
      const { error } = await supabase.from('recursos').insert({ ...values, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recursos'] }); toast({ title: 'Recurso creado' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...values }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('recursos').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recursos'] }); toast({ title: 'Recurso actualizado' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recursos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recursos'] }); toast({ title: 'Recurso eliminado' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  return { recursos, create, update, remove, companyId };
};
