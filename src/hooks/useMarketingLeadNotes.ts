import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

export type MarketingLeadNote = Database['public']['Tables']['marketing_lead_notes']['Row'];
export type MarketingLeadNoteInsert = Database['public']['Tables']['marketing_lead_notes']['Insert'];
export type MarketingLeadNoteUpdate = Database['public']['Tables']['marketing_lead_notes']['Update'];

export type MarketingLeadNoteKind = 'note' | 'call' | 'whatsapp' | 'email' | 'rejection' | 'reschedule';

export const useMarketingLeadNotes = (leadId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['marketing-lead-notes', leadId],
    enabled: !!leadId && !!companyId && !companyLoading,
    queryFn: async (): Promise<MarketingLeadNote[]> => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('marketing_lead_notes')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['marketing-lead-notes', leadId] });
    queryClient.invalidateQueries({ queryKey: ['marketing-lead-notes-counts', companyId] });
    queryClient.invalidateQueries({ queryKey: ['marketing-lead-notes-index', companyId] });
  };

  const addNote = useMutation({
    mutationFn: async (input: {
      body: string;
      kind?: MarketingLeadNoteKind;
      next_action_at?: string | null;
    }) => {
      if (!companyId) throw new Error('Sin empresa');
      if (!leadId) throw new Error('Sin lead');
      const { data, error } = await supabase
        .from('marketing_lead_notes')
        .insert({
          company_id: companyId,
          lead_id: leadId,
          body: input.body,
          kind: input.kind ?? 'note',
          next_action_at: input.next_action_at ?? null,
          created_by: user?.id ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ['marketing-leads', companyId] });
      }
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_lead_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: async (input: { id: string; values: MarketingLeadNoteUpdate }) => {
      const { data, error } = await supabase
        .from('marketing_lead_notes')
        .update(input.values)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    addNote,
    deleteNote,
    updateNote,
  };
};

export const useMarketingLeadNoteCounts = () => {
  const { companyId, loading: companyLoading } = useCompanyFilter();

  return useQuery({
    queryKey: ['marketing-lead-notes-counts', companyId],
    enabled: !!companyId && !companyLoading,
    queryFn: async (): Promise<Record<string, number>> => {
      if (!companyId) return {};
      const { data, error } = await supabase
        .from('marketing_lead_notes')
        .select('lead_id')
        .eq('company_id', companyId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.lead_id) counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
      }
      return counts;
    },
  });
};

export type MarketingLeadNotePreview = {
  id: string;
  body: string;
  kind: string;
  created_at: string;
  next_action_at: string | null;
};

export type MarketingLeadNotesIndex = {
  counts: Record<string, number>;
  previews: Record<string, MarketingLeadNotePreview[]>;
};

export const PREVIEW_LIMIT = 3;

export const useMarketingLeadNotesIndex = () => {
  const { companyId, loading: companyLoading } = useCompanyFilter();

  return useQuery({
    queryKey: ['marketing-lead-notes-index', companyId],
    enabled: !!companyId && !companyLoading,
    staleTime: 45_000,
    queryFn: async (): Promise<MarketingLeadNotesIndex> => {
      if (!companyId) return { counts: {}, previews: {} };
      const { data, error } = await supabase
        .from('marketing_lead_notes')
        .select('id, lead_id, body, kind, created_at, next_action_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const counts: Record<string, number> = {};
      const previews: Record<string, MarketingLeadNotePreview[]> = {};
      for (const row of data ?? []) {
        if (!row.lead_id) continue;
        counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
        if (!previews[row.lead_id]) previews[row.lead_id] = [];
        if (previews[row.lead_id].length < PREVIEW_LIMIT) {
          previews[row.lead_id].push({
            id: row.id,
            body: row.body,
            kind: row.kind,
            created_at: row.created_at,
            next_action_at: row.next_action_at,
          });
        }
      }
      return { counts, previews };
    },
  });
};
