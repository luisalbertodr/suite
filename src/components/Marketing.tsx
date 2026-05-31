import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  Settings2,
  ListFilter,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  useMarketingLeads,
  type MarketingLead,
} from '@/hooks/useMarketingLeads';
import {
  useMarketingStages,
  type MarketingLeadStage,
} from '@/hooks/useMarketingStages';
import { useMarketingFieldConfig } from '@/hooks/useMarketingFieldConfig';
import { useMarketingLeadNotesIndex } from '@/hooks/useMarketingLeadNotes';
import { useCustomerLookup, type CustomerLookupRow } from '@/hooks/useCustomerLookup';
import { MarketingStageColumn } from './marketing/MarketingStageColumn';
import { MarketingLeadDetailDialog } from './marketing/MarketingLeadDetailDialog';
import { MarketingStagesManager } from './marketing/MarketingStagesManager';
import { MarketingFieldsConfigDialog } from './marketing/MarketingFieldsConfigDialog';
import { MarketingLeadNotesDialog } from './marketing/MarketingLeadNotesDialog';
import { MarketingPromoteToCustomerDialog } from './marketing/MarketingPromoteToCustomerDialog';
import {
  useMetaConfig,
  formatMetaSyncErrorsSummary,
  type MetaSyncResponse,
} from '@/hooks/useMetaConfig';
import {
  useMarketingLeadViewedSet,
  useMarkMarketingLeadViewed,
} from '@/hooks/useMarketingUnread';
import {
  MarketingFiltersPopover,
  DEFAULT_MARKETING_FILTERS,
  type SortField,
  type SortDir,
  type MarketingFilters,
} from './marketing/MarketingFiltersPopover';
import {
  leadMatchesFilters,
  compareLeads,
  collectDistinctValues,
} from './marketing/marketingFilterUtils';

const COLLAPSED_STAGES_STORAGE_KEY = 'marketing-kanban-collapsed-stage-ids';
const COMPACT_CARDS_STORAGE_KEY = 'marketing-kanban-compact-cards';

const matchesQuery = (lead: MarketingLead, q: string): boolean => {
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystack = [
    lead.first_name,
    lead.last_name,
    lead.phone,
    lead.email,
    lead.form_name,
    lead.campaign,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (haystack.includes(needle)) return true;
  const fd = Array.isArray(lead.field_data)
    ? (lead.field_data as Array<{ name: string; values?: string[] }>)
    : [];
  return fd.some(
    (f) =>
      f.name.toLowerCase().includes(needle) ||
      (f.values ?? []).some((v) => String(v).toLowerCase().includes(needle)),
  );
};

export const Marketing: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { leads, isLoading: leadsLoading, refetch, moveLeadToStage } = useMarketingLeads(companyId);
  const { stages, isLoading: stagesLoading } = useMarketingStages(companyId);
  const { fields, isLoading: fieldsLoading } = useMarketingFieldConfig(companyId);
  const { data: notesIndex } = useMarketingLeadNotesIndex();
  const { index: customerIndex } = useCustomerLookup();
  const { config: metaConfig, forms: metaForms, syncNow } = useMetaConfig();
  const { viewedLeadIds } = useMarketingLeadViewedSet(companyId ?? null);
  const markLeadViewed = useMarkMarketingLeadViewed();

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('external_created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<MarketingFilters>(DEFAULT_MARKETING_FILTERS);
  const [compactCards, setCompactCards] = useState(() => {
    try {
      return localStorage.getItem(COMPACT_CARDS_STORAGE_KEY) === '1';
    } catch {
      return true;
    }
  });
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<MarketingLead | null>(null);
  const [notesLead, setNotesLead] = useState<MarketingLead | null>(null);
  const [promoteLead, setPromoteLead] = useState<MarketingLead | null>(null);
  const [openStagesManager, setOpenStagesManager] = useState(false);
  const [openFieldsConfig, setOpenFieldsConfig] = useState(false);
  const autoSyncTriggered = useRef(false);

  const toastMetaSyncResult = useCallback(
    (data: MetaSyncResponse) => {
      if (data.errors > 0) {
        toast({
          title: 'Sincronización Meta con errores',
          description: formatMetaSyncErrorsSummary(data),
          variant: 'destructive',
        });
        return;
      }
      if (data.inserted > 0) {
        toast({
          title: 'Nuevos leads de Meta',
          description: `${data.inserted} leads añadidos al embudo.`,
        });
      }
    },
    [toast],
  );

  const [collapsedStageIds, setCollapsedStageIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_STAGES_STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as unknown;
      return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSED_STAGES_STORAGE_KEY, JSON.stringify([...collapsedStageIds]));
  }, [collapsedStageIds]);

  useEffect(() => {
    localStorage.setItem(COMPACT_CARDS_STORAGE_KEY, compactCards ? '1' : '0');
  }, [compactCards]);

  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  const toggleStageColumnCollapsed = useCallback((stageId: string) => {
    setCollapsedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }, []);

  const deferredSearch = useDeferredValue(search);

  const visibleCardFields = useMemo(
    () =>
      fields
        .filter((f) => {
          if (!f.visible_in_card) return false;
          if (
            f.field_key === 'form_name' ||
            f.field_key === 'created_at' ||
            f.field_key === 'first_name' ||
            f.field_key === 'last_name' ||
            f.field_key === 'campaign' ||
            f.field_key === 'source' ||
            f.field_key === 'appointment_label' ||
            f.field_key === 'appointment_at'
          ) {
            return false;
          }
          const label = (f.display_label ?? '').trim();
          if (/lipoout|medicina\s*est[eé]tica|triple\s*glow/i.test(label)) return false;
          return true;
        })
        .sort((a, b) => a.sort_order - b.sort_order),
    [fields],
  );

  // Auto-sync con Meta cuando se abre Marketing y ha pasado el intervalo configurado.
  useEffect(() => {
    if (autoSyncTriggered.current) return;
    if (!metaConfig || !metaConfig.enabled || !metaConfig.access_token) return;
    if (!metaForms.some((f) => f.enabled)) return;
    const intervalMs = Math.max(5, metaConfig.sync_interval_minutes ?? 60) * 60 * 1000;
    const last = metaConfig.last_sync_at ? new Date(metaConfig.last_sync_at).getTime() : 0;
    if (Date.now() - last < intervalMs) return;
    autoSyncTriggered.current = true;
    syncNow.mutate(undefined, {
      onSuccess: toastMetaSyncResult,
      onError: (e) => {
        const message = e instanceof Error ? e.message : 'Error sincronizando con Meta';
        toast({ title: 'Sincronización Meta', description: message, variant: 'destructive' });
      },
    });
  }, [metaConfig, metaForms, syncNow, toastMetaSyncResult, toast]);

  const { matchedCustomerByLead } = useMemo(() => {
    const map = new Map<string, CustomerLookupRow | null>();
    for (const lead of leads) {
      const m = customerIndex.match({ phone: lead.phone, email: lead.email });
      map.set(lead.id, m);
    }
    return { matchedCustomerByLead: map };
  }, [leads, customerIndex]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (!matchesQuery(l, deferredSearch)) return false;
      return leadMatchesFilters(l, filters, matchedCustomerByLead.get(l.id) ?? null);
    });
  }, [leads, deferredSearch, filters, matchedCustomerByLead]);

  const formNames = useMemo(
    () => collectDistinctValues(leads, (l) => l.form_name),
    [leads],
  );
  const sources = useMemo(
    () => collectDistinctValues(leads, (l) => l.source),
    [leads],
  );
  const filterableFields = useMemo(
    () => fields.filter((f) => f.visible_in_card || f.visible_in_detail),
    [fields],
  );

  const leadsByStage = useMemo(() => {
    const map = new Map<string, MarketingLead[]>();
    for (const stage of stages) map.set(stage.id, []);
    const unassigned: MarketingLead[] = [];
    for (const lead of filteredLeads) {
      if (lead.stage_id && map.has(lead.stage_id)) {
        map.get(lead.stage_id)!.push(lead);
      } else {
        unassigned.push(lead);
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => compareLeads(a, b, sortField, sortDir));
    }
    unassigned.sort((a, b) => compareLeads(a, b, sortField, sortDir));
    return { map, unassigned };
  }, [filteredLeads, stages, sortField, sortDir]);

  const handleLeadDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, lead: MarketingLead) => {
      setDraggedLeadId(lead.id);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', lead.id);
    },
    [],
  );

  const handleLeadDragEnd = useCallback(() => {
    setDraggedLeadId(null);
    setDragOverStageId(null);
  }, []);

  const handleStageDragOver = useCallback((event: React.DragEvent<HTMLDivElement>, stageId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStageId((prev) => (prev === stageId ? prev : stageId));
  }, []);

  const handleStageDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const isInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!isInside) setDragOverStageId(null);
  }, []);

  const handleStageDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>, stageId: string) => {
      event.preventDefault();
      const leadId = event.dataTransfer.getData('text/plain');
      if (!leadId) return;
      const lead = leads.find((l) => l.id === leadId);
      setDraggedLeadId(null);
      setDragOverStageId(null);
      if (!lead || lead.stage_id === stageId) return;
      const targetLeads = leadsByStage.map.get(stageId) ?? [];
      const newPosition = targetLeads.length;
      try {
        await moveLeadToStage.mutateAsync({
          id: leadId,
          stage_id: stageId,
          position_in_stage: newPosition,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Error al mover lead';
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
    },
    [leads, leadsByStage, moveLeadToStage, toast],
  );

  const handleEditStage = useCallback((_stage: MarketingLeadStage) => {
    setOpenStagesManager(true);
  }, []);

  const handleDeleteStage = useCallback((_stage: MarketingLeadStage) => {
    setOpenStagesManager(true);
  }, []);

  const handleLeadClickById = useCallback(
    (leadId: string) => {
      const lead = leadsRef.current.find((l) => l.id === leadId);
      if (!lead) return;
      if (lead.company_id && !viewedLeadIds.has(lead.id)) {
        markLeadViewed.mutate({ leadId: lead.id, companyId: lead.company_id });
      }
      setActiveLead(lead);
    },
    [viewedLeadIds, markLeadViewed],
  );

  const handleLeadOpenNotesById = useCallback(
    (leadId: string) => {
      const lead = leadsRef.current.find((l) => l.id === leadId);
      if (!lead) return;
      if (lead.company_id && !viewedLeadIds.has(lead.id)) {
        markLeadViewed.mutate({ leadId: lead.id, companyId: lead.company_id });
      }
      setNotesLead(lead);
    },
    [viewedLeadIds, markLeadViewed],
  );

  const handleLeadPromoteById = useCallback((leadId: string) => {
    const lead = leadsRef.current.find((l) => l.id === leadId);
    if (lead) setPromoteLead(lead);
  }, []);

  const handleLeadClick = useCallback(
    (lead: MarketingLead) => handleLeadClickById(lead.id),
    [handleLeadClickById],
  );

  const totalLeads = filteredLeads.length;
  const totalValue = filteredLeads.reduce((acc, l) => acc + Number(l.value ?? 0), 0);
  const linkedInView = filteredLeads.filter((l) => matchedCustomerByLead.get(l.id)).length;
  const currencyFmt = useMemo(
    () =>
      new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
    [],
  );

  if (companyLoading || stagesLoading || leadsLoading || fieldsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-64 text-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">No se encontró empresa</h2>
          <p className="text-muted-foreground mt-2">Contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  const handleManualRefresh = async () => {
    await refetch();
    if (metaConfig?.enabled && metaConfig.access_token && metaForms.some((f) => f.enabled)) {
      syncNow.mutate(undefined, {
        onSuccess: toastMetaSyncResult,
        onError: (e) => {
          const message = e instanceof Error ? e.message : 'Error sincronizando con Meta';
          toast({ title: 'Sincronización Meta', description: message, variant: 'destructive' });
        },
      });
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-500/10 p-2">
              <LayoutGrid className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <CardTitle className="text-2xl">Marketing</CardTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{totalLeads}</span>{' '}
                  {totalLeads === 1 ? 'cliente potencial' : 'clientes potenciales'}
                </span>
                {totalValue > 0 ? (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span>
                      Valor total{' '}
                      <span className="font-semibold text-foreground">
                        {currencyFmt.format(totalValue)}
                      </span>
                    </span>
                  </>
                ) : null}
                {linkedInView > 0 ? (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {linkedInView} ya en clientes
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar leads…"
                className="h-9 w-[220px] pl-8 text-xs"
              />
            </div>

            <MarketingFiltersPopover
              sortField={sortField}
              sortDir={sortDir}
              onSortFieldChange={setSortField}
              onSortDirChange={setSortDir}
              filters={filters}
              onFiltersChange={setFilters}
              formNames={formNames}
              sources={sources}
              filterableFields={filterableFields}
              compactCards={compactCards}
              onCompactCardsChange={setCompactCards}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              title="Refrescar y sincronizar con Meta"
              disabled={syncNow.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncNow.isPending ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpenFieldsConfig(true)}>
              <ListFilter className="mr-2 h-3.5 w-3.5" /> Campos
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpenStagesManager(true)}>
              <Settings2 className="mr-2 h-3.5 w-3.5" /> Etapas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/configuracion?tab=meta')}
              title="Configuración de Meta (formularios, token, intervalo, importar)"
            >
              <SettingsIcon className="mr-2 h-3.5 w-3.5" /> Meta
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {stages.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no tienes etapas configuradas.
            </p>
            <Button className="mt-3" size="sm" onClick={() => setOpenStagesManager(true)}>
              Crear primera etapa
            </Button>
          </div>
        ) : (
          <div
            className={[
              'w-full min-w-0 overflow-x-scroll overflow-y-hidden scrollbar-kanban h-[calc(100vh-180px)] -mb-24',
              draggedLeadId ? '[&_*]:!transition-none' : '',
            ].join(' ')}
          >
            <div className="inline-flex h-full gap-3 pr-1">
              {stages.map((stage) => (
                <MarketingStageColumn
                  key={stage.id}
                  stage={stage}
                  leads={leadsByStage.map.get(stage.id) ?? []}
                  visibleFields={visibleCardFields}
                  draggedLeadId={draggedLeadId}
                  dragOverStageId={dragOverStageId}
                  matchedCustomerByLead={matchedCustomerByLead}
                  noteCountByLead={notesIndex?.counts ?? {}}
                  notePreviewsByLead={notesIndex?.previews ?? {}}
                  viewedLeadIds={viewedLeadIds}
                  collapsed={collapsedStageIds.has(stage.id)}
                  compact={compactCards}
                  onToggleCollapsed={() => toggleStageColumnCollapsed(stage.id)}
                  onLeadClickById={handleLeadClickById}
                  onLeadOpenNotesById={handleLeadOpenNotesById}
                  onLeadPromoteById={handleLeadPromoteById}
                  onLeadDragStart={handleLeadDragStart}
                  onLeadDragEnd={handleLeadDragEnd}
                  onStageDragOver={handleStageDragOver}
                  onStageDragLeave={handleStageDragLeave}
                  onStageDrop={handleStageDrop}
                  onEditStage={handleEditStage}
                  onDeleteStage={handleDeleteStage}
                />
              ))}

              {leadsByStage.unassigned.length > 0 ? (
                <div className="flex h-full w-[260px] shrink-0 flex-col rounded-2xl border border-dashed bg-muted/20">
                  <div className="border-b px-3 py-2 text-sm font-semibold text-muted-foreground">
                    Sin etapa ({leadsByStage.unassigned.length})
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto p-2">
                    {leadsByStage.unassigned.map((lead) => (
                      <div
                        key={lead.id}
                        className="cursor-pointer rounded-lg border bg-card p-2 text-xs hover:bg-accent"
                        onClick={() => handleLeadClick(lead)}
                      >
                        <p className="font-semibold">
                          {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Sin nombre'}
                        </p>
                        <p className="text-muted-foreground">{lead.phone ?? lead.email ?? ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>

      {activeLead ? (
        <MarketingLeadDetailDialog
          lead={activeLead}
          stages={stages}
          matchedCustomer={matchedCustomerByLead.get(activeLead.id) ?? null}
          open
          onOpenChange={(open) => {
            if (!open) setActiveLead(null);
          }}
        />
      ) : null}
      {notesLead ? (
        <MarketingLeadNotesDialog
          lead={notesLead}
          open
          onOpenChange={(open) => {
            if (!open) setNotesLead(null);
          }}
        />
      ) : null}
      {promoteLead ? (
        <MarketingPromoteToCustomerDialog
          lead={promoteLead}
          open
          onOpenChange={(open) => {
            if (!open) setPromoteLead(null);
          }}
        />
      ) : null}
      <MarketingStagesManager open={openStagesManager} onOpenChange={setOpenStagesManager} />
      <MarketingFieldsConfigDialog open={openFieldsConfig} onOpenChange={setOpenFieldsConfig} />
    </Card>
  );
};
