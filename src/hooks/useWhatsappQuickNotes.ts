import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export type WhatsappQuickNote = {
  id: string;
  company_id: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function useWhatsappQuickNotes() {
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const qc = useQueryClient();
  const key = ['whatsapp-quick-notes', companyId] as const;

  const query = useQuery({
    queryKey: key,
    enabled: !!companyId && !companyLoading,
    staleTime: 60_000,
    queryFn: async (): Promise<WhatsappQuickNote[]> => {
      const { data, error } = await supabase
        .from('whatsapp_quick_notes')
        .select('*')
        .eq('company_id', companyId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WhatsappQuickNote[];
    },
  });

  const createNote = useMutation({
    mutationFn: async (input: { title: string; body: string }) => {
      if (!companyId) throw new Error('Sin empresa activa');
      const maxOrder = (query.data ?? []).reduce((m, n) => Math.max(m, n.sort_order), 0);
      const { data, error } = await supabase
        .from('whatsapp_quick_notes')
        .insert({
          company_id: companyId,
          title: input.title.trim(),
          body: input.body.trim(),
          sort_order: maxOrder + 1,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as WhatsappQuickNote;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateNote = useMutation({
    mutationFn: async (input: { id: string; title: string; body: string }) => {
      const { data, error } = await supabase
        .from('whatsapp_quick_notes')
        .update({
          title: input.title.trim(),
          body: input.body.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as WhatsappQuickNote;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_quick_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { ...query, createNote, updateNote, deleteNote, companyId };
}
