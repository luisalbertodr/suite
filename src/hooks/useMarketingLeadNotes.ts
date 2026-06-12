import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';
import { withSupabaseTimeout } from '@/lib/marketingNotesApi';
import { waitForAuthBootstrap } from '@/lib/authSession';
import { MARKETING_HOST_COMPANY_ID } from '@/lib/marketingScope';

export type MarketingLeadNote = Database['public']['Tables']['marketing_lead_notes']['Row'];
export type MarketingLeadNoteInsert = Database['public']['Tables']['marketing_lead_notes']['Insert'];
export type MarketingLeadNoteUpdate = Database['public']['Tables']['marketing_lead_notes']['Update'];

export type MarketingLeadNoteKind = 'note' | 'call' | 'whatsapp' | 'email' | 'rejection' | 'reschedule';

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

function notesQueryKey(companyId: string | null | undefined, leadId: string | null | undefined) {
  return ['marketing-lead-notes', companyId, leadId] as const;
}

function appendToNotesIndex(
  prev: MarketingLeadNotesIndex | undefined,
  note: MarketingLeadNote,
): MarketingLeadNotesIndex {
  const base = prev ?? { counts: {}, previews: {} };
  const leadId = note.lead_id;
  if (!leadId) return base;

  const counts = { ...base.counts, [leadId]: (base.counts[leadId] ?? 0) + 1 };

  const previews = { ...base.previews };
  const existing = previews[leadId] ?? [];
  if (existing.length < PREVIEW_LIMIT) {
    previews[leadId] = [
      {
        id: note.id,
        body: note.body,
        kind: note.kind,
        created_at: note.created_at,
        next_action_at: note.next_action_at,
      },
      ...existing,
    ].slice(0, PREVIEW_LIMIT);
  }

  return { counts, previews };
}

function updateInNotesIndex(
  prev: MarketingLeadNotesIndex | undefined,
  note: MarketingLeadNote,
): MarketingLeadNotesIndex {
  const base = prev ?? { counts: {}, previews: {} };
  const leadId = note.lead_id;
  if (!leadId) return base;

  const previews = { ...base.previews };
  const list = previews[leadId];
  if (list) {
    previews[leadId] = list.map((n) =>
      n.id === note.id
        ? {
            id: note.id,
            body: note.body,
            kind: note.kind,
            created_at: note.created_at,
            next_action_at: note.next_action_at,
          }
        : n,
    );
  }

  return { ...base, previews };
}

function removeFromNotesIndex(
  prev: MarketingLeadNotesIndex | undefined,
  leadId: string,
  noteId: string,
): MarketingLeadNotesIndex {
  const base = prev ?? { counts: {}, previews: {} };
  const previews = { ...base.previews };
  const leadPreviews = (previews[leadId] ?? []).filter((n) => n.id !== noteId);
  if (leadPreviews.length > 0) {
    previews[leadId] = leadPreviews;
  } else {
    delete previews[leadId];
  }
  const counts = { ...base.counts };
  const nextCount = Math.max(0, (counts[leadId] ?? 1) - 1);
  if (nextCount === 0) {
    delete counts[leadId];
  } else {
    counts[leadId] = nextCount;
  }
  return { counts, previews };
}

export const useMarketingLeadNotes = (
  leadId: string | null | undefined,
  leadCompanyId?: string | null,
) => {
  const queryClient = useQueryClient();
  const companyId = leadCompanyId ?? MARKETING_HOST_COMPANY_ID;
  const { user } = useAuth();
  const queryKey = notesQueryKey(companyId, leadId);

  const query = useQuery({
    queryKey,
    enabled: Boolean(leadId && companyId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<MarketingLeadNote[]> => {
      if (!leadId) return [];
      await waitForAuthBootstrap();
      const { data, error } = await supabase
        .from('marketing_lead_notes')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const patchNotesIndex = (note: MarketingLeadNote) => {
    if (!companyId || !note.lead_id) return;
    queryClient.setQueryData<MarketingLeadNotesIndex>(
      ['marketing-lead-notes-index', companyId],
      (prev) => appendToNotesIndex(prev, note),
    );
  };

  const addNote = useMutation({
    mutationFn: async (input: {
      body: string;
      kind?: MarketingLeadNoteKind;
      next_action_at?: string | null;
    }) => {
      if (!companyId) throw new Error('Sin empresa activa');
      if (!leadId) throw new Error('Sin lead');

      return withSupabaseTimeout('Guardar nota', async () => {
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

        if (error) {
          const msg = error.message ?? 'Error al guardar la nota';
          if (/permission|policy|42501|403/i.test(msg)) {
            throw new Error('No tienes permiso para añadir notas en esta empresa.');
          }
          throw new Error(msg);
        }
        if (!data) throw new Error('No se pudo confirmar la nota guardada.');
        return data;
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<MarketingLeadNote[]>(queryKey);
      const optimistic: MarketingLeadNote = {
        id: `optimistic-${Date.now()}`,
        company_id: companyId!,
        lead_id: leadId!,
        body: input.body,
        kind: input.kind ?? 'note',
        next_action_at: input.next_action_at ?? null,
        created_by: user?.id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<MarketingLeadNote[]>(queryKey, [optimistic, ...(prev ?? [])]);
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<MarketingLeadNote[]>(queryKey, (old) => {
        const list = old ?? [];
        const withoutOptimistic = list.filter((n) => !n.id.startsWith('optimistic-'));
        return [data, ...withoutOptimistic.filter((n) => n.id !== data.id)];
      });
      patchNotesIndex(data);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(queryKey, ctx.prev);
      }
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await withSupabaseTimeout('Eliminar nota', () =>
        supabase.from('marketing_lead_notes').delete().eq('id', id),
      );
      if (error) {
        const msg = error.message ?? 'Error al eliminar la nota';
        if (/permission|policy|42501|403/i.test(msg)) {
          throw new Error('No tienes permiso para eliminar esta nota.');
        }
        throw new Error(msg);
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<MarketingLeadNote[]>(queryKey);
      queryClient.setQueryData<MarketingLeadNote[]>(
        queryKey,
        (old) => (old ?? []).filter((n) => n.id !== id),
      );
      return { prev };
    },
    onSuccess: (_data, id) => {
      if (companyId && leadId) {
        queryClient.setQueryData<MarketingLeadNotesIndex>(
          ['marketing-lead-notes-index', companyId],
          (prev) => removeFromNotesIndex(prev, leadId, id),
        );
      }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(queryKey, ctx.prev);
      }
    },
  });

  const updateNote = useMutation({
    mutationFn: async (input: { id: string; values: MarketingLeadNoteUpdate }) => {
      const { data, error } = await withSupabaseTimeout('Actualizar nota', () =>
        supabase
          .from('marketing_lead_notes')
          .update(input.values)
          .eq('id', input.id)
          .select('*')
          .single(),
      );
      if (error) {
        const msg = error.message ?? 'Error al actualizar la nota';
        if (/permission|policy|42501|403/i.test(msg)) {
          throw new Error('No tienes permiso para editar esta nota.');
        }
        throw new Error(msg);
      }
      return data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<MarketingLeadNote[]>(queryKey);
      queryClient.setQueryData<MarketingLeadNote[]>(queryKey, (old) =>
        (old ?? []).map((n) =>
          n.id === input.id ? ({ ...n, ...input.values } as MarketingLeadNote) : n,
        ),
      );
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<MarketingLeadNote[]>(queryKey, (old) =>
        (old ?? []).map((n) => (n.id === data.id ? data : n)),
      );
      if (companyId) {
        queryClient.setQueryData<MarketingLeadNotesIndex>(
          ['marketing-lead-notes-index', companyId],
          (prev) => updateInNotesIndex(prev, data),
        );
      }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(queryKey, ctx.prev);
      }
    },
  });

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
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
        .select('lead_id, body')
        .eq('company_id', companyId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      const seen = new Set<string>();
      for (const row of data ?? []) {
        if (!row.lead_id || !row.body) continue;
        const key = `${row.lead_id}\0${row.body.trim().toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
      }
      return counts;
    },
  });
};

export const useMarketingLeadNotesIndex = (scopeCompanyId?: string | null) => {
  const { companyId: activeCompanyId, loading: companyLoading } = useCompanyFilter();
  const companyId = scopeCompanyId ?? activeCompanyId;

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
      const countedBodies = new Set<string>();
      const previewBodies = new Set<string>();
      for (const row of data ?? []) {
        if (!row.lead_id) continue;
        const bodyKey = `${row.lead_id}\0${row.body.trim().toLowerCase()}`;
        if (countedBodies.has(bodyKey)) continue;
        countedBodies.add(bodyKey);
        counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
        if (!previews[row.lead_id]) previews[row.lead_id] = [];
        if (previews[row.lead_id].length < PREVIEW_LIMIT) {
          const previewKey = bodyKey;
          if (previewBodies.has(previewKey)) continue;
          previewBodies.add(previewKey);
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

