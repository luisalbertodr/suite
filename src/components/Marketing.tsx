import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutGrid,
  ListOrdered,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { MarketingLeadNotesDialog } from './marketing/MarketingLeadNotesDialog';
import { MarketingPromoteToCustomerDialog } from './marketing/MarketingPromoteToCustomerDialog';
import { ClienteDetailOverlay } from '@/components/cliente/ClienteDetailOverlay';
import {
  useMetaConfig,
  formatMetaSyncErrorsSummary,
  type MetaSyncResponse,
} from '@/hooks/useMetaConfig';
import {
  isMarketingLeadUnread,
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
import { useMarketingInvoicedValueSync } from '@/hooks/useMarketingInvoicedValueSync';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';
import { useMarketingPermissions } from '@/hooks/useMarketingPermissions';
import { MarketingSearchInput } from './marketing/MarketingSearchInput';
import { MarketingWhatsappQueueTab } from './marketing/MarketingWhatsappQueueTab';
import { useMarketingWhatsappQueue } from '@/hooks/useMarketingWhatsappQueue';
import { findMarketingIntakeStage } from '@/lib/marketingIntakeStage';

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
  const queryClient = useQueryClient();
  const { loading: companyLoading } = useCompanyFilter();
  const { canWrite: canEditMarketing, loading: marketingPermsLoading, marketingCompanyId } = useMarketingPermissions();
  const marketingCompanyIdStable = marketingCompanyId;

  const { leads, isLoading: leadsLoading, refetch, moveLeadToStage } = useMarketingLeads(marketingCompanyIdStable);
  const { stages, isLoading: stagesLoading } = useMarketingStages(marketingCompanyIdStable);
  const { fields, isLoading: fieldsLoading } = useMarketingFieldConfig(marketingCompanyIdStable);
  const { config: metaConfig, forms: metaForms, syncNow } = useMetaConfig(marketingCompanyIdStable);
  const { data: notesIndex } = useMarketingLeadNotesIndex(marketingCompanyIdStable);
  const { index: customerIndex } = useCustomerLookup();
  const markLeadViewed = useMarkMarketingLeadViewed();
  const { queueRows } = useMarketingWhatsappQueue(marketingCompanyIdStable);
  const intakeStageId = useMemo(
    () => findMarketingIntakeStage(stages ?? [])?.id ?? null,
    [stages],
  );
  const waQueuePendingLeadIds = useMemo(
    () =>
      new Set(
        queueRows
          .filter(
            (row) =>
              row.status === 'pending' &&
              intakeStageId &&
              row.marketing_leads?.stage_id === intakeStageId,
          )
          .map((row) => row.marketing_lead_id),
      ),
    [queueRows, intakeStageId],
  );

  const [filterQuery, setFilterQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('external_created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<MarketingFilters>(DEFAULT_MARKETING_FILTERS);
  const [compactCards, setCompactCards] = useState(() => {
    try {
      const stored = localStorage.getItem(COMPACT_CARDS_STORAGE_KEY);
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  });
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<MarketingLead | null>(null);
  const [notesLead, setNotesLead] = useState<MarketingLead | null>(null);
  const [promoteLead, setPromoteLead] = useState<MarketingLead | null>(null);
  const [customerDetailId, setCustomerDetailId] = useState<string | null>(null);
  const [marketingView, setMarketingView] = useState<'board' | 'queue'>('board');

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

  const activeLeadLive = useMemo(() => {
    if (!activeLead) return null;
    return leads.find((l) => l.id === activeLead.id) ?? activeLead;
  }, [activeLead, leads]);

  const notesLeadLive = useMemo(() => {
    if (!notesLead) return null;
    return leads.find((l) => l.id === notesLead.id) ?? notesLead;
  }, [notesLead, leads]);

  const prefetchLeadNotes = useCallback(
    (lead: MarketingLead) => {
      const notesCompanyId = lead.company_id ?? marketingCompanyIdStable;
      void queryClient.invalidateQueries({
        queryKey: ['marketing-lead-notes', notesCompanyId, lead.id],
      });
    },
    [queryClient, marketingCompanyIdStable],
  );

  const toggleStageColumnCollapsed = useCallback((stageId: string) => {
    setCollapsedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }, []);

  const handleFilterQueryChange = useCallback((q: string) => {
    setFilterQuery(q);
  }, []);

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

  // Sincronización periódica con Meta mientras Marketing está abierto.
  useEffect(() => {
    if (!metaConfig?.enabled || !metaConfig.access_token) return;
    if (!metaForms.some((f) => f.enabled)) return;

    const runSyncIfDue = () => {
      const intervalMs = Math.max(5, metaConfig.sync_interval_minutes ?? 60) * 60 * 1000;
      const last = metaConfig.last_sync_at ? new Date(metaConfig.last_sync_at).getTime() : 0;
      if (Date.now() - last < intervalMs) return;
      if (syncNow.isPending) return;
      syncNow.mutate(undefined, {
        onSuccess: toastMetaSyncResult,
        onError: (e) => {
          const message = e instanceof Error ? e.message : 'Error sincronizando con Meta';
          toast({ title: 'Sincronización Meta', description: message, variant: 'destructive' });
        },
      });
    };

    runSyncIfDue();
    const timerId = window.setInterval(runSyncIfDue, 60_000);
    return () => window.clearInterval(timerId);
  }, [metaConfig, metaForms, syncNow, toastMetaSyncResult, toast]);

  const matchLeadToCustomer = useCallback(
    (lead: Pick<MarketingLead, 'id' | 'phone' | 'email' | 'customer_id'>) => {
      if (lead.customer_id) {
        const linked = customerIndex.customers.find((c) => c.id === lead.customer_id);
        if (linked) return linked;
      }
      return customerIndex.match({ phone: lead.phone, email: lead.email });
    },
    [customerIndex],
  );

  const { matchedCustomerByLead } = useMemo(() => {
    const map = new Map<string, CustomerLookupRow | null>();
    for (const lead of leads) {
      map.set(lead.id, matchLeadToCustomer(lead));
    }
    return { matchedCustomerByLead: map };
  }, [leads, matchLeadToCustomer]);

  const { runSync: syncPresentadaInvoicedValues } = useMarketingInvoicedValueSync({
    companyId: marketingCompanyIdStable,
    stages,
    leads,
    matchCustomer: matchLeadToCustomer,
    enabled: !companyLoading && !leadsLoading && !stagesLoading,
  });

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (!matchesQuery(l, filterQuery)) return false;
      return leadMatchesFilters(l, filters, matchedCustomerByLead.get(l.id) ?? null);
    });
  }, [leads, filterQuery, filters, matchedCustomerByLead]);

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
      if (!marketingPermsLoading && !canEditMarketing) {
        toast({
          title: 'Sin permiso de edición',
          description: 'No puedes mover tarjetas sin el permiso «Editar Marketing» en Estética.',
          variant: 'destructive',
        });
        return;
      }
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
    [leads, leadsByStage, moveLeadToStage, toast, canEditMarketing, marketingPermsLoading],
  );

  const handleEditStage = useCallback((_stage: MarketingLeadStage) => {
    navigate('/configuracion?tab=marketing');
  }, [navigate]);

  const handleDeleteStage = useCallback((_stage: MarketingLeadStage) => {
    navigate('/configuracion?tab=marketing');
  }, [navigate]);

  const handleLeadClickById = useCallback(
    (leadId: string) => {
      const lead = leadsRef.current.find((l) => l.id === leadId);
      if (!lead) return;
      if (lead.company_id && isMarketingLeadUnread(lead)) {
        markLeadViewed.mutate({ leadId: lead.id, companyId: lead.company_id });
      }
      prefetchLeadNotes(lead);
      setActiveLead(lead);
    },
    [markLeadViewed, prefetchLeadNotes],
  );

  const handleLeadOpenNotesById = useCallback(
    (leadId: string) => {
      const lead = leadsRef.current.find((l) => l.id === leadId);
      if (!lead) return;
      if (lead.company_id && isMarketingLeadUnread(lead)) {
        markLeadViewed.mutate({ leadId: lead.id, companyId: lead.company_id });
      }
      prefetchLeadNotes(lead);
      setNotesLead(lead);
    },
    [markLeadViewed, prefetchLeadNotes],
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

  const handleManualRefresh = useCallback(async () => {
    await refetch();
    try {
      const invoiced = await syncPresentadaInvoicedValues();
      const parts: string[] = [];
      if (invoiced.moved > 0) {
        parts.push(`${invoiced.moved} movido(s) a «${invoiced.stageName}»`);
      }
      if (invoiced.updated > 0) {
        parts.push(`${invoiced.updated} valor(es) actualizado(s)`);
      }
      if (parts.length > 0) {
        toast({
          title: 'Facturación sincronizada',
          description: parts.join(' · '),
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al sincronizar facturación';
      toast({ title: 'Facturación → Marketing', description: message, variant: 'destructive' });
    }
    if (metaConfig?.enabled && metaConfig.access_token && metaForms.some((f) => f.enabled)) {
      syncNow.mutate(undefined, {
        onSuccess: toastMetaSyncResult,
        onError: (e) => {
          const message = e instanceof Error ? e.message : 'Error sincronizando con Meta';
          toast({ title: 'Sincronización Meta', description: message, variant: 'destructive' });
        },
      });
    }
  }, [
    metaConfig,
    metaForms,
    refetch,
    syncNow,
    syncPresentadaInvoicedValues,
    toast,
    toastMetaSyncResult,
  ]);

  const topBarActions = useMemo(() => (
    <>
      <div className="hidden items-center gap-2 text-xs text-muted-foreground xl:flex">
        <span>
          <span className="font-semibold text-foreground">{totalLeads}</span>{' '}
          {totalLeads === 1 ? 'cliente potencial' : 'clientes potenciales'}
        </span>
        {totalValue > 0 ? (
          <>
            <span>·</span>
            <span>
              Valor <span className="font-semibold text-foreground">{currencyFmt.format(totalValue)}</span>
            </span>
          </>
        ) : null}
        {linkedInView > 0 ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {linkedInView} ya en clientes
          </span>
        ) : null}
      </div>

      <MarketingSearchInput onQueryChange={handleFilterQueryChange} />

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
        className="h-7 px-2"
        onClick={handleManualRefresh}
        title="Refrescar y sincronizar con Meta"
        disabled={syncNow.isPending}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncNow.isPending ? 'animate-spin' : ''}`} />
      </Button>
    </>
  ), [
    compactCards,
    currencyFmt,
    filterableFields,
    filters,
    formNames,
    handleManualRefresh,
    handleFilterQueryChange,
    linkedInView,
    sortDir,
    sortField,
    sources,
    syncNow.isPending,
    totalLeads,
    totalValue,
  ]);

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-rose-500" />
          Marketing
        </span>
      ),
      actions: marketingView === 'board' ? topBarActions : null,
    },
    [topBarActions, marketingView],
  );

  if (companyLoading || stagesLoading || leadsLoading || fieldsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (!marketingCompanyIdStable) {
    return (
      <div className="flex justify-center items-center h-64 text-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">No se encontró empresa</h2>
          <p className="text-muted-foreground mt-2">Contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="px-0 pb-0">
        <Tabs
          value={marketingView}
          onValueChange={(v) => setMarketingView(v === 'queue' ? 'queue' : 'board')}
          className="w-full"
        >
          <TabsList className="mb-3 h-9 w-full max-w-md grid grid-cols-2">
            <TabsTrigger value="board" className="gap-1.5 text-xs sm:text-sm">
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              Tablero
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-1.5 text-xs sm:text-sm">
              <ListOrdered className="h-3.5 w-3.5 shrink-0" />
              Cola WhatsApp
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-0">
            <MarketingWhatsappQueueTab
              companyId={marketingCompanyIdStable}
              canWrite={canEditMarketing}
            />
          </TabsContent>

          <TabsContent value="board" className="mt-0">
        {stages.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no tienes etapas configuradas.
            </p>
            <Button className="mt-3" size="sm" onClick={() => navigate('/configuracion?tab=marketing')}>
              Configurar etapas
            </Button>
          </div>
        ) : (
          <div
            className={[
              'w-full min-w-0 overflow-x-scroll overflow-y-hidden scrollbar-kanban h-[calc(100vh-128px)] -mb-24',
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
                  waQueuePendingLeadIds={waQueuePendingLeadIds}
                  collapsed={collapsedStageIds.has(stage.id)}
                  compact={compactCards}
                  onToggleCollapsed={() => toggleStageColumnCollapsed(stage.id)}
                  onLeadClickById={handleLeadClickById}
                  onOpenCustomer={setCustomerDetailId}
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
          </TabsContent>
        </Tabs>
      </CardContent>

      {activeLeadLive ? (
        <MarketingLeadDetailDialog
          lead={activeLeadLive}
          companyId={marketingCompanyIdStable}
          stages={stages}
          matchedCustomer={matchedCustomerByLead.get(activeLeadLive.id) ?? null}
          open
          onOpenChange={(open) => {
            if (!open) setActiveLead(null);
          }}
        />
      ) : null}
      {notesLeadLive ? (
        <MarketingLeadNotesDialog
          lead={notesLeadLive}
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
      {customerDetailId ? (
        <ClienteDetailOverlay
          open
          customerId={customerDetailId}
          initialTab="ficha"
          backLabel="Volver a Marketing"
          onClose={() => setCustomerDetailId(null)}
        />
      ) : null}
    </Card>
  );
};
