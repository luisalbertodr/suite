import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  Settings2,
  Filter as FilterIcon,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useMetaConfig } from '@/hooks/useMetaConfig';

type SortField =
  | 'created_at'
  | 'external_created_at'
  | 'updated_at'
  | 'first_name'
  | 'phone'
  | 'value'
  | 'form_name';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'external_created_at', label: 'Fecha del lead (Meta)' },
  { value: 'created_at',          label: 'Fecha de importación' },
  { value: 'updated_at',          label: 'Última actualización' },
  { value: 'first_name',          label: 'Nombre' },
  { value: 'phone',               label: 'Teléfono' },
  { value: 'value',               label: 'Valor del cliente' },
  { value: 'form_name',           label: 'Formulario' },
];

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

const compareLeads = (a: MarketingLead, b: MarketingLead, field: SortField, dir: SortDir): number => {
  const mul = dir === 'asc' ? 1 : -1;
  const read = (l: MarketingLead): string | number | null => {
    switch (field) {
      case 'created_at': return l.created_at;
      case 'external_created_at': return l.external_created_at ?? l.created_at;
      case 'updated_at': return l.updated_at;
      case 'first_name': return (l.first_name ?? '').toLowerCase();
      case 'phone': return (l.phone ?? '').replace(/\D/g, '');
      case 'value': return Number(l.value ?? 0);
      case 'form_name': return (l.form_name ?? '').toLowerCase();
      default: return null;
    }
  };
  const va = read(a);
  const vb = read(b);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  if (typeof va === 'number' && typeof vb === 'number') {
    return (va - vb) * mul;
  }
  const sa = String(va);
  const sb = String(vb);
  if (field === 'created_at' || field === 'external_created_at' || field === 'updated_at') {
    return (new Date(sa).getTime() - new Date(sb).getTime()) * mul;
  }
  return sa.localeCompare(sb, 'es') * mul;
};

export const Marketing: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { leads, isLoading: leadsLoading, refetch, moveLeadToStage } = useMarketingLeads();
  const { stages, isLoading: stagesLoading } = useMarketingStages();
  const { fields, isLoading: fieldsLoading } = useMarketingFieldConfig();
  const { data: notesIndex } = useMarketingLeadNotesIndex();
  const { index: customerIndex } = useCustomerLookup();
  const { config: metaConfig, forms: metaForms, syncNow } = useMetaConfig();

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('external_created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [hideLinked, setHideLinked] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<MarketingLead | null>(null);
  const [notesLead, setNotesLead] = useState<MarketingLead | null>(null);
  const [promoteLead, setPromoteLead] = useState<MarketingLead | null>(null);
  const [openStagesManager, setOpenStagesManager] = useState(false);
  const [openFieldsConfig, setOpenFieldsConfig] = useState(false);
  const autoSyncTriggered = useRef(false);

  const visibleCardFields = useMemo(
    () => fields.filter((f) => f.visible_in_card).sort((a, b) => a.sort_order - b.sort_order),
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
      onSuccess: (data) => {
        if (data.inserted > 0) {
          toast({
            title: 'Nuevos leads de Meta',
            description: `${data.inserted} leads añadidos al embudo.`,
          });
        }
      },
      onError: (e) => {
        const message = e instanceof Error ? e.message : 'Error sincronizando con Meta';
        toast({ title: 'Sincronización Meta', description: message, variant: 'destructive' });
      },
    });
  }, [metaConfig, metaForms, syncNow, toast]);

  const matchedCustomerByLead = useMemo(() => {
    const map = new Map<string, CustomerLookupRow | null>();
    for (const lead of leads) {
      map.set(lead.id, customerIndex.match({ phone: lead.phone, email: lead.email }));
    }
    return map;
  }, [leads, customerIndex]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (!matchesQuery(l, search)) return false;
      if (hideLinked && matchedCustomerByLead.get(l.id)) return false;
      return true;
    });
  }, [leads, search, hideLinked, matchedCustomerByLead]);

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

  const handleLeadDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    lead: MarketingLead,
  ) => {
    setDraggedLeadId(lead.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', lead.id);
  };

  const handleLeadDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverStageId(null);
  };

  const handleStageDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    stageId: string,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStageId(stageId);
  };

  const handleStageDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const isInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!isInside) setDragOverStageId(null);
  };

  const handleStageDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    stageId: string,
  ) => {
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
  };

  const handleEditStage = (_stage: MarketingLeadStage) => {
    setOpenStagesManager(true);
  };

  const handleDeleteStage = (_stage: MarketingLeadStage) => {
    setOpenStagesManager(true);
  };

  const totalLeads = filteredLeads.length;
  const totalValue = filteredLeads.reduce((acc, l) => acc + Number(l.value ?? 0), 0);
  const linkedCount = useMemo(
    () => leads.filter((l) => matchedCustomerByLead.get(l.id)).length,
    [leads, matchedCustomerByLead],
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

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.value === sortField)?.label ?? 'Ordenar';
  const sortDirLabel = sortDir === 'asc' ? 'Asc' : 'Desc';

  const handleManualRefresh = async () => {
    await refetch();
    if (metaConfig?.enabled && metaConfig.access_token && metaForms.some((f) => f.enabled)) {
      syncNow.mutate(undefined, {
        onSuccess: (data) => {
          if (data.inserted > 0) {
            toast({
              title: 'Nuevos leads de Meta',
              description: `${data.inserted} leads añadidos al embudo.`,
            });
          }
        },
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
              <p className="text-xs text-muted-foreground">
                Embudo de clientes potenciales de Meta (Facebook · Instagram)
              </p>
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" title="Ordenar por…">
                  <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{currentSortLabel}</span>
                  <span className="sm:hidden">Ordenar</span>
                  <span className="ml-1 inline-flex items-center text-[10px] uppercase tracking-wide text-muted-foreground">
                    {sortDir === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )}
                    <span className="ml-0.5 hidden md:inline">{sortDirLabel}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortField}
                  onValueChange={(v) => setSortField(v as SortField)}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Dirección</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortDir}
                  onValueChange={(v) => setSortDir(v as SortDir)}
                >
                  <DropdownMenuRadioItem value="asc">
                    <ArrowUp className="mr-2 h-3.5 w-3.5" /> Ascendente
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc">
                    <ArrowDown className="mr-2 h-3.5 w-3.5" /> Descendente
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={hideLinked}
                  onCheckedChange={(v) => setHideLinked(!!v)}
                >
                  Ocultar leads ya clientes
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
              <FilterIcon className="mr-2 h-3.5 w-3.5" /> Campos
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

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{totalLeads}</span>{' '}
            {totalLeads === 1 ? 'cliente potencial' : 'clientes potenciales'}
          </span>
          {totalValue > 0 ? (
            <span>
              · Valor total:{' '}
              <span className="font-semibold text-foreground">
                {new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(totalValue)}
              </span>
            </span>
          ) : null}
          {linkedCount > 0 ? (
            <span>
              ·{' '}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {linkedCount} ya en clientes
              </span>
            </span>
          ) : null}
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
          <div className="w-full min-w-0 overflow-x-scroll overflow-y-hidden scrollbar-kanban h-[calc(100vh-180px)] -mb-24">
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
                  onLeadClick={(lead) => setActiveLead(lead)}
                  onLeadOpenNotes={(lead) => setNotesLead(lead)}
                  onLeadPromote={(lead) => setPromoteLead(lead)}
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
                        onClick={() => setActiveLead(lead)}
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

      <MarketingLeadDetailDialog
        lead={activeLead}
        stages={stages}
        matchedCustomer={activeLead ? matchedCustomerByLead.get(activeLead.id) ?? null : null}
        open={!!activeLead}
        onOpenChange={(open) => {
          if (!open) setActiveLead(null);
        }}
      />
      <MarketingLeadNotesDialog
        lead={notesLead}
        open={!!notesLead}
        onOpenChange={(open) => {
          if (!open) setNotesLead(null);
        }}
      />
      <MarketingPromoteToCustomerDialog
        lead={promoteLead}
        open={!!promoteLead}
        onOpenChange={(open) => {
          if (!open) setPromoteLead(null);
        }}
      />
      <MarketingStagesManager open={openStagesManager} onOpenChange={setOpenStagesManager} />
      <MarketingFieldsConfigDialog open={openFieldsConfig} onOpenChange={setOpenFieldsConfig} />
    </Card>
  );
};
