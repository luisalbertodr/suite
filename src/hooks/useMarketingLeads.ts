import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { withSupabaseTimeout } from '@/lib/marketingNotesApi';
import type { Database, Json } from '@/integrations/supabase/types';

export type MarketingLead = Database['public']['Tables']['marketing_leads']['Row'];
export type MarketingLeadInsert = Database['public']['Tables']['marketing_leads']['Insert'];
export type MarketingLeadUpdate = Database['public']['Tables']['marketing_leads']['Update'];

export type MarketingLeadFieldEntry = {
  name: string;
  values: string[];
};

export type MetaLeadFormPayload = {
  data?: Array<{
    id?: string;
    created_time?: string;
    field_data?: Array<{ name: string; values: string[] }>;
    form_name?: string;
    campaign_name?: string;
    platform?: string;
    ad_id?: string;
  }>;
};

export type TuPartnerLeadNote = {
  body?: string;
  note?: string;
  text?: string;
  message?: string;
  created_at?: string;
  date?: string;
  createdAt?: string;
  kind?: string;
};

export type TuPartnerLeadItem = {
  stage?: string;
  stageIndex?: number;
  position?: number;
  rowIndex?: number;
  contactId?: string | null;
  opportunityId?: string | null;
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string | null;
  monetaryValue?: string | number;
  createdAt?: string;
  assignedTo?: string;
  appointmentDate?: string | null;
  status?: string | null;
  url?: string;
  tags?: string[];
  notes?: TuPartnerLeadNote[] | string[];
};

export type TuPartnerLeadsPayload = {
  exportDate?: string;
  source?: string;
  totalLeads?: number;
  leads?: TuPartnerLeadItem[];
};

export type ImportFormat = 'meta' | 'tupartner' | 'unknown';

export const detectImportFormat = (raw: unknown): ImportFormat => {
  if (!raw || typeof raw !== 'object') return 'unknown';
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.leads)) {
    const first = (obj.leads as unknown[])[0];
    if (first && typeof first === 'object' && 'stage' in (first as object)) {
      return 'tupartner';
    }
  }
  if (Array.isArray(obj.data)) {
    const first = (obj.data as unknown[])[0];
    if (first && typeof first === 'object' && 'field_data' in (first as object)) {
      return 'meta';
    }
  }
  return 'unknown';
};

const STANDARD_FIELDS = new Set([
  'first_name',
  'last_name',
  'full_name',
  'phone_number',
  'phone',
  'email',
]);

const normalizeFieldName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, '_');

const firstValue = (values?: string[]): string | null => {
  if (!values || values.length === 0) return null;
  const v = String(values[0] ?? '').trim();
  return v.length === 0 ? null : v;
};

/** Últimos 9 dígitos; alineado con marketing_lead_phone_norm en BD y meta-sync. */
export const marketingLeadPhoneNorm = (phone: string | null | undefined): string | null => {
  const d = String(phone ?? '').replace(/\D/g, '');
  if (d.length >= 9) return d.slice(-9);
  return null;
};

export type ParsedMetaLead = {
  external_id: string | null;
  created_time: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  form_name: string | null;
  campaign: string | null;
  source: string;
  field_data: MarketingLeadFieldEntry[];
};

// Parsea fechas tipo "May 9, 2026 12:43 AM (CEST)" → ISO
export const parseLooseDate = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\s+\([A-Z]{2,5}\)$/, '').trim();
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  return null;
};

// "May 12th, 5:30 pm" → ISO en el año actual (asume año más cercano)
export const parseAppointmentLabel = (
  label: string | null | undefined,
  base: Date = new Date(),
): string | null => {
  if (!label) return null;
  const cleaned = String(label).trim().replace(/(\d+)(st|nd|rd|th)/i, '$1');
  const withYear = `${cleaned}, ${base.getFullYear()}`;
  const d1 = new Date(withYear);
  if (!Number.isNaN(d1.getTime())) {
    // Si la fecha resultante es más de 30 días en el pasado, prueba año siguiente
    const diffDays = (base.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 30) {
      const d2 = new Date(`${cleaned}, ${base.getFullYear() + 1}`);
      if (!Number.isNaN(d2.getTime())) return d2.toISOString();
    }
    return d1.toISOString();
  }
  return null;
};

// "€1.234,56" / "€0,00" / "1234.56" → number
export const parseMonetaryValue = (raw: string | number | null | undefined): number => {
  if (raw == null) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).replace(/[^\d,.\-]/g, '');
  if (!s) return 0;
  // Heurística: si hay coma y punto, asume formato europeo (1.234,56)
  let normalized = s;
  if (s.includes(',') && s.includes('.')) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    normalized = s.replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

export type ParsedTuPartnerLead = {
  external_id: string | null;
  stage_name: string | null;
  stage_index: number | null;
  position_in_stage: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  value: number;
  source: string;
  campaign: string | null;
  created_at_iso: string | null;
  appointment_at: string | null;
  appointment_label: string | null;
  assigned_to: string | null;
  win_status: string | null;
  tags: string[];
  notes: Array<{ body: string; created_at: string | null; kind: string }>;
};

/** En un mismo export, un solo lead por teléfono (gana la última fila del JSON). */
function dedupeTuPartnerLeadsByPhone(leads: ParsedTuPartnerLead[]): ParsedTuPartnerLead[] {
  const without9: ParsedTuPartnerLead[] = [];
  const by9 = new Map<string, ParsedTuPartnerLead>();
  for (const p of leads) {
    const n9 = marketingLeadPhoneNorm(p.phone);
    if (!n9) {
      without9.push(p);
      continue;
    }
    by9.set(n9, p);
  }
  return [...without9, ...by9.values()];
}

const isImportAssignedToNoise = (value: string): boolean =>
  /lipoout|triple\s*glow|medicina\s*est[eé]tica/i.test(value.trim());

export const parseTuPartnerPayload = (raw: TuPartnerLeadsPayload): ParsedTuPartnerLead[] => {
  const items = Array.isArray(raw?.leads) ? raw.leads : [];
  return items.map((it) => {
    // El nombre puede venir como "Raffaella - Body Sculpt & Lift". Lo separamos.
    const rawName = (it.name ?? '').trim();
    const [namePart, ...campaignParts] = rawName.split(' - ');
    const first_name = namePart || null;
    const campaign = campaignParts.length > 0 ? campaignParts.join(' - ') : null;

    // contactName: "RA\nRaffaella" → "Raffaella"
    const contactDisplay = (it.contactName ?? '').split('\n').slice(-1)[0]?.trim() || null;

    // external_id: contactId || opportunityId || extraer de url
    let externalId: string | null = it.contactId ?? it.opportunityId ?? null;
    if (!externalId && it.url) {
      const parts = it.url.split('/').filter(Boolean);
      externalId = parts[parts.length - 1] || null;
    }

    const tags = Array.isArray(it.tags) ? it.tags.filter((t) => typeof t === 'string') : [];

    const rawNotes = Array.isArray(it.notes) ? it.notes : [];
    const notes = rawNotes
      .map((n) => {
        if (typeof n === 'string') {
          return { body: n, created_at: null, kind: 'note' };
        }
        const body = n.body ?? n.note ?? n.text ?? n.message ?? '';
        if (!body) return null;
        const ts = n.created_at ?? n.createdAt ?? n.date ?? null;
        return {
          body: String(body),
          created_at: parseLooseDate(ts),
          kind: n.kind ?? 'note',
        };
      })
      .filter((n): n is { body: string; created_at: string | null; kind: string } => !!n);

    return {
      external_id: externalId,
      stage_name: it.stage ?? null,
      stage_index: typeof it.stageIndex === 'number' ? it.stageIndex : null,
      position_in_stage: typeof it.position === 'number' ? it.position : 0,
      first_name: contactDisplay ?? first_name,
      last_name: null,
      phone: it.phone ?? null,
      email: it.email ?? null,
      value: parseMonetaryValue(it.monetaryValue),
      source: 'tupartner',
      campaign,
      created_at_iso: parseLooseDate(it.createdAt),
      appointment_at: parseAppointmentLabel(it.appointmentDate),
      appointment_label: it.appointmentDate ?? null,
      assigned_to: it.assignedTo && !isImportAssignedToNoise(it.assignedTo) ? it.assignedTo : null,
      win_status: it.status ?? null,
      tags,
      notes,
    };
  });
};

export const parseMetaLeadPayload = (raw: MetaLeadFormPayload): ParsedMetaLead[] => {
  const items = Array.isArray(raw?.data) ? raw.data : [];
  return items.map((it) => {
    const fields = Array.isArray(it.field_data) ? it.field_data : [];
    let firstName: string | null = null;
    let lastName: string | null = null;
    let phone: string | null = null;
    let email: string | null = null;
    const extraFields: MarketingLeadFieldEntry[] = [];

    for (const f of fields) {
      const key = normalizeFieldName(f?.name ?? '');
      const value = firstValue(f?.values);
      if (!key) continue;
      switch (key) {
        case 'first_name':
          firstName = value;
          break;
        case 'last_name':
          lastName = value;
          break;
        case 'full_name': {
          if (value && !firstName) {
            const [fn, ...rest] = value.split(/\s+/);
            firstName = fn ?? null;
            if (rest.length > 0 && !lastName) lastName = rest.join(' ');
          }
          break;
        }
        case 'phone_number':
        case 'phone':
          phone = value;
          break;
        case 'email':
          email = value;
          break;
        default:
          extraFields.push({ name: key, values: Array.isArray(f.values) ? f.values : [] });
      }
    }

    const platform = (it.platform || '').toLowerCase();
    let source = 'meta';
    if (platform.includes('instagram')) source = 'instagram';
    else if (platform.includes('facebook')) source = 'facebook';

    return {
      external_id: it.id ?? null,
      created_time: it.created_time ?? null,
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      form_name: it.form_name ?? null,
      campaign: it.campaign_name ?? null,
      source,
      field_data: extraFields,
    };
  });
};

export const useMarketingLeads = (scopeCompanyId?: string | null) => {
  const queryClient = useQueryClient();
  const { companyId: hostCompanyId, loading: companyLoading } = useCompanyFilter();
  const companyId = scopeCompanyId ?? hostCompanyId;

  const query = useQuery({
    queryKey: ['marketing-leads', companyId],
    enabled: !!companyId && !companyLoading,
    staleTime: 45_000,
    queryFn: async (): Promise<MarketingLead[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('marketing_leads')
        .select('*')
        .eq('company_id', companyId)
        .is('archived_at', null)
        .order('position_in_stage', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['marketing-leads', companyId] });

  const updateLead = useMutation({
    mutationFn: async (input: { id: string; values: MarketingLeadUpdate }) => {
      const { data, error } = await supabase
        .from('marketing_leads')
        .update(input.values)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: ['marketing-leads', companyId] });
      const prev = queryClient.getQueryData<MarketingLead[]>(['marketing-leads', companyId]);
      if (prev) {
        queryClient.setQueryData<MarketingLead[]>(
          ['marketing-leads', companyId],
          prev.map((l) => (l.id === id ? { ...l, ...values } as MarketingLead : l)),
        );
      }
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<MarketingLead[]>(['marketing-leads', companyId], (prev) =>
        prev ? prev.map((l) => (l.id === data.id ? data : l)) : prev,
      );
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['marketing-leads', companyId], ctx.prev);
      }
    },
  });

  const moveLeadToStage = useMutation({
    mutationFn: async (input: { id: string; stage_id: string | null; position_in_stage: number }) => {
      return withSupabaseTimeout('Mover lead', async () => {
        let q = supabase
          .from('marketing_leads')
          .update({
            stage_id: input.stage_id,
            position_in_stage: input.position_in_stage,
          })
          .eq('id', input.id);
        if (companyId) q = q.eq('company_id', companyId);
        const { data, error } = await q.select('*').single();
        if (error) throw error;
        return data;
      });
    },
    onMutate: async ({ id, stage_id, position_in_stage }) => {
      await queryClient.cancelQueries({ queryKey: ['marketing-leads', companyId] });
      const prev = queryClient.getQueryData<MarketingLead[]>(['marketing-leads', companyId]);
      if (prev) {
        queryClient.setQueryData<MarketingLead[]>(
          ['marketing-leads', companyId],
          prev.map((l) =>
            l.id === id ? { ...l, stage_id, position_in_stage } : l,
          ),
        );
      }
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<MarketingLead[]>(['marketing-leads', companyId], (prev) =>
        prev ? prev.map((l) => (l.id === data.id ? data : l)) : prev,
      );
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['marketing-leads', companyId], ctx.prev);
      }
    },
  });

  const createLead = useMutation({
    mutationFn: async (input: Omit<MarketingLeadInsert, 'company_id'>) => {
      if (!companyId) throw new Error('Sin empresa');
      const { data, error } = await supabase
        .from('marketing_leads')
        .insert({ ...input, company_id: companyId })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_leads')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const archiveLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_leads')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const importLeadsMutation = useMutation({
    mutationFn: async (input: {
      parsed: ParsedMetaLead[];
      defaultStageId: string | null;
    }): Promise<{ inserted: number; skipped: number; errors: number }> => {
      if (!companyId) throw new Error('Sin empresa');
      const { parsed, defaultStageId } = input;

      const { data: existingLeadRows, error: existingLeadErr } = await supabase
        .from('marketing_leads')
        .select('external_id, phone')
        .eq('company_id', companyId);
      if (existingLeadErr) throw existingLeadErr;

      const existingExternal = new Set<string>();
      const existingPhone9 = new Set<string>();
      for (const r of existingLeadRows ?? []) {
        if (r.external_id) existingExternal.add(r.external_id);
        const n9 = marketingLeadPhoneNorm(r.phone);
        if (n9) existingPhone9.add(n9);
      }

      const rows: MarketingLeadInsert[] = [];
      let skipped = 0;
      const seenPhone9InImport = new Set<string>();
      for (const p of parsed) {
        if (p.external_id && existingExternal.has(p.external_id)) {
          skipped++;
          continue;
        }
        const n9 = marketingLeadPhoneNorm(p.phone);
        if (n9 && existingPhone9.has(n9)) {
          skipped++;
          continue;
        }
        if (n9 && seenPhone9InImport.has(n9)) {
          skipped++;
          continue;
        }
        if (n9) seenPhone9InImport.add(n9);
        rows.push({
          company_id: companyId,
          stage_id: defaultStageId,
          external_id: p.external_id,
          source: p.source,
          form_name: p.form_name,
          campaign: p.campaign,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          email: p.email,
          field_data: p.field_data as unknown as Json,
          external_created_at: p.created_time,
        });
      }

      let inserted = 0;
      let errors = 0;
      // Insert en chunks para no romper el límite del API
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('marketing_leads')
          .insert(slice)
          .select('id');
        if (error) {
          errors += slice.length;
          console.error('Error en chunk de import', error);
        } else {
          inserted += data?.length ?? 0;
        }
      }

      return { inserted, skipped, errors };
    },
    onSuccess: invalidate,
  });

  const importTuPartnerMutation = useMutation({
    mutationFn: async (input: {
      parsed: ParsedTuPartnerLead[];
      mode?: 'upsert' | 'skip-existing';
    }): Promise<{
      inserted: number;
      updated: number;
      skipped: number;
      errors: number;
      stagesCreated: number;
      notesInserted: number;
    }> => {
      if (!companyId) throw new Error('Sin empresa');
      const { parsed: rawParsed, mode = 'upsert' } = input;
      const parsed = dedupeTuPartnerLeadsByPhone(rawParsed);

      // 1) Asegurar etapas
      const { data: existingStages, error: stagesErr } = await supabase
        .from('marketing_lead_stages')
        .select('id, name, position')
        .eq('company_id', companyId);
      if (stagesErr) throw stagesErr;

      const stageByName = new Map<string, { id: string; position: number }>();
      for (const s of existingStages ?? []) {
        if (s.name) stageByName.set(s.name, { id: s.id, position: s.position });
      }

      const uniqueStages = new Map<string, number>();
      for (const p of parsed) {
        if (p.stage_name && !uniqueStages.has(p.stage_name)) {
          uniqueStages.set(p.stage_name, p.stage_index ?? uniqueStages.size);
        }
      }

      const DEFAULT_COLORS = [
        '#22c55e', '#3b82f6', '#f59e0b', '#06b6d4', '#0ea5e9',
        '#a855f7', '#10b981', '#ef4444', '#ec4899', '#94a3b8',
      ];

      const stagesToInsert: Array<{ company_id: string; name: string; position: number; color: string; is_default_intake: boolean; is_won: boolean }> = [];
      for (const [name, position] of uniqueStages) {
        if (!stageByName.has(name)) {
          stagesToInsert.push({
            company_id: companyId,
            name,
            position,
            color: DEFAULT_COLORS[position % DEFAULT_COLORS.length],
            is_default_intake: position === 0,
            is_won: /confirmada|ganado|éxito|exito|presentada/i.test(name),
          });
        }
      }

      let stagesCreated = 0;
      if (stagesToInsert.length > 0) {
        const { data: newStages, error: insertStagesErr } = await supabase
          .from('marketing_lead_stages')
          .insert(stagesToInsert)
          .select('id, name, position');
        if (insertStagesErr) throw insertStagesErr;
        for (const s of newStages ?? []) {
          if (s.name) stageByName.set(s.name, { id: s.id, position: s.position });
        }
        stagesCreated = newStages?.length ?? 0;
      }

      // 2) Localizar leads existentes (por external_id y últimos 9 dígitos de teléfono)
      const { data: existingLeads } = await supabase
        .from('marketing_leads')
        .select('id, external_id, phone')
        .eq('company_id', companyId);

      const existingByExternal = new Map<string, string>();
      const existingByPhone = new Map<string, string>();
      for (const row of existingLeads ?? []) {
        if (row.external_id) existingByExternal.set(row.external_id, row.id);
        const n9 = marketingLeadPhoneNorm(row.phone);
        if (n9) existingByPhone.set(n9, row.id);
      }

      const findExistingId = (p: ParsedTuPartnerLead): string | null => {
        if (p.external_id && existingByExternal.has(p.external_id)) {
          return existingByExternal.get(p.external_id)!;
        }
        const n9 = marketingLeadPhoneNorm(p.phone);
        if (n9) return existingByPhone.get(n9) ?? null;
        return null;
      };

      // 3) Procesar leads
      const toInsert: MarketingLeadInsert[] = [];
      const toUpdate: Array<{ id: string; values: MarketingLeadUpdate }> = [];
      let skipped = 0;

      for (const p of parsed) {
        const stage = p.stage_name ? stageByName.get(p.stage_name) : null;
        const existingId = findExistingId(p);

        if (existingId) {
          if (mode === 'skip-existing') {
            skipped++;
            continue;
          }
          toUpdate.push({
            id: existingId,
            values: {
              stage_id: stage?.id ?? null,
              position_in_stage: p.position_in_stage,
              value: p.value,
              campaign: p.campaign,
              source: 'tupartner',
              first_name: p.first_name,
              last_name: p.last_name,
              phone: p.phone,
              email: p.email,
              external_created_at: p.created_at_iso,
              appointment_at: p.appointment_at,
              appointment_label: p.appointment_label,
              assigned_to: p.assigned_to,
              tags: p.tags,
              win_status: p.win_status,
            },
          });
        } else {
          toInsert.push({
            company_id: companyId,
            stage_id: stage?.id ?? null,
            external_id: p.external_id,
            source: 'tupartner',
            campaign: p.campaign,
            first_name: p.first_name,
            last_name: p.last_name,
            phone: p.phone,
            email: p.email,
            value: p.value,
            position_in_stage: p.position_in_stage,
            external_created_at: p.created_at_iso,
            appointment_at: p.appointment_at,
            appointment_label: p.appointment_label,
            assigned_to: p.assigned_to,
            tags: p.tags,
            win_status: p.win_status,
          });
        }
      }

      // 4) Insertar nuevos (en chunks) y mapear external_id → nuevo id
      let inserted = 0;
      let errors = 0;
      const insertedIdByExternal = new Map<string, string>();
      const insertedIdByPhone = new Map<string, string>();
      const CHUNK = 200;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const slice = toInsert.slice(i, i + CHUNK);
        const { data: insertedRows, error } = await supabase
          .from('marketing_leads')
          .insert(slice)
          .select('id, external_id, phone');
        if (error) {
          errors += slice.length;
          console.error('Error en chunk de import (insert)', error);
        } else {
          inserted += insertedRows?.length ?? 0;
          for (const row of insertedRows ?? []) {
            if (row.external_id) insertedIdByExternal.set(row.external_id, row.id);
            const n9 = marketingLeadPhoneNorm(row.phone);
            if (n9) insertedIdByPhone.set(n9, row.id);
          }
        }
      }

      // 5) Actualizar existentes en paralelo
      let updated = 0;
      const updateResults = await Promise.all(
        toUpdate.map((u) =>
          supabase.from('marketing_leads').update(u.values).eq('id', u.id).select('id'),
        ),
      );
      for (const r of updateResults) {
        if (r.error) {
          errors++;
          console.error('Error en update', r.error);
        } else {
          updated += r.data?.length ?? 0;
        }
      }

      // 6) Insertar notas (si vienen), sin duplicar cuerpos ya guardados
      const { data: existingNoteRows, error: existingNotesErr } = await supabase
        .from('marketing_lead_notes')
        .select('lead_id, body')
        .eq('company_id', companyId);
      if (existingNotesErr) throw existingNotesErr;

      const existingNoteKeys = new Set<string>();
      for (const row of existingNoteRows ?? []) {
        if (!row.lead_id || !row.body) continue;
        existingNoteKeys.add(`${row.lead_id}\0${row.body.trim()}`);
      }

      const notesRows: Array<{
        company_id: string;
        lead_id: string;
        body: string;
        kind: string;
        created_at?: string;
      }> = [];
      const resolveLeadId = (p: ParsedTuPartnerLead): string | null => {
        if (p.external_id && insertedIdByExternal.has(p.external_id)) {
          return insertedIdByExternal.get(p.external_id)!;
        }
        const n9 = marketingLeadPhoneNorm(p.phone);
        if (n9) {
          const hit = insertedIdByPhone.get(n9);
          if (hit) return hit;
        }
        return findExistingId(p);
      };
      for (const p of parsed) {
        if (!p.notes || p.notes.length === 0) continue;
        const leadId = resolveLeadId(p);
        if (!leadId) continue;
        for (const n of p.notes) {
          const body = n.body?.trim();
          if (!body) continue;
          const dedupeKey = `${leadId}\0${body}`;
          if (existingNoteKeys.has(dedupeKey)) continue;
          existingNoteKeys.add(dedupeKey);
          notesRows.push({
            company_id: companyId,
            lead_id: leadId,
            body,
            kind: n.kind || 'note',
            ...(n.created_at ? { created_at: n.created_at } : {}),
          });
        }
      }

      let notesInserted = 0;
      if (notesRows.length > 0) {
        for (let i = 0; i < notesRows.length; i += CHUNK) {
          const slice = notesRows.slice(i, i + CHUNK);
          const { data: noteData, error: noteErr } = await supabase
            .from('marketing_lead_notes')
            .insert(slice)
            .select('id');
          if (noteErr) {
            errors += slice.length;
            console.error('Error insertando notas', noteErr);
          } else {
            notesInserted += noteData?.length ?? 0;
          }
        }
      }

      return { inserted, updated, skipped, errors, stagesCreated, notesInserted };
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['marketing-stages', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-lead-notes-counts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-lead-notes-index', companyId] });
    },
  });

  return {
    leads: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    updateLead,
    moveLeadToStage,
    createLead,
    deleteLead,
    archiveLead,
    importLeads: importLeadsMutation,
    importTuPartner: importTuPartnerMutation,
  };
};
