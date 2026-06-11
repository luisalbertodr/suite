import React, { memo } from 'react';
import { ChevronLeft, ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { MarketingLeadStage } from '@/hooks/useMarketingStages';
import type { MarketingFieldConfig } from '@/hooks/useMarketingFieldConfig';
import type { CustomerLookupRow } from '@/hooks/useCustomerLookup';
import type { MarketingLeadNotePreview } from '@/hooks/useMarketingLeadNotes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MarketingLeadCardSlot } from './MarketingLeadCardSlot';

interface MarketingStageColumnProps {
  stage: MarketingLeadStage;
  leads: MarketingLead[];
  visibleFields: MarketingFieldConfig[];
  draggedLeadId: string | null;
  dragOverStageId: string | null;
  matchedCustomerByLead: Map<string, CustomerLookupRow | null>;
  noteCountByLead: Record<string, number>;
  notePreviewsByLead: Record<string, MarketingLeadNotePreview[]>;
  viewedLeadIds: Set<string>;
  onLeadClickById: (leadId: string) => void;
  onOpenCustomer: (customerId: string) => void;
  onLeadOpenNotesById: (leadId: string) => void;
  onLeadPromoteById: (leadId: string) => void;
  onLeadDragStart: (event: React.DragEvent<HTMLDivElement>, lead: MarketingLead) => void;
  onLeadDragEnd: (event: React.DragEvent<HTMLDivElement>) => void;
  onStageDragOver: (event: React.DragEvent<HTMLDivElement>, stageId: string) => void;
  onStageDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onStageDrop: (event: React.DragEvent<HTMLDivElement>, stageId: string) => void;
  onEditStage: (stage: MarketingLeadStage) => void;
  onDeleteStage: (stage: MarketingLeadStage) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  compact?: boolean;
}

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const stageExpectsAgendaContext = (stageName: string): boolean =>
  /formulario\s*\+\s*agenda ficticia|formulario\+agenda ficticia/i.test(stageName);

export const MarketingStageColumn = memo(function MarketingStageColumn({
  stage,
  leads,
  visibleFields,
  draggedLeadId,
  dragOverStageId,
  matchedCustomerByLead,
  noteCountByLead,
  notePreviewsByLead,
  viewedLeadIds,
  onLeadClickById,
  onLeadOpenNotesById,
  onLeadPromoteById,
  onLeadDragStart,
  onLeadDragEnd,
  onStageDragOver,
  onStageDragLeave,
  onStageDrop,
  onEditStage,
  onDeleteStage,
  collapsed = false,
  onToggleCollapsed,
  onOpenCustomer,
  compact = false,
}: MarketingStageColumnProps) {
  const totalValue = leads.reduce((acc, l) => acc + Number(l.value ?? 0), 0);
  const isDropTarget = dragOverStageId === stage.id;
  const expectAgendaContext = stageExpectsAgendaContext(stage.name);

  return (
    <div
      className={[
        'flex h-full shrink-0 flex-col rounded-2xl border border-border/60',
        'bg-muted/40 transition-[width] duration-200',
        collapsed ? 'w-[52px] overflow-hidden' : compact ? 'w-[228px]' : 'w-[260px]',
        isDropTarget ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : '',
      ].join(' ')}
      onDragOver={(e) => onStageDragOver(e, stage.id)}
      onDragLeave={onStageDragLeave}
      onDrop={(e) => onStageDrop(e, stage.id)}
    >
      {collapsed ? (
        <>
          <div className="flex flex-col items-center gap-1 border-b border-border/60 px-1 py-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: stage.color }}
              title={stage.name}
              aria-hidden
            />
            <span
              className="tabular-nums text-lg font-bold leading-none text-foreground"
              title={stage.name}
            >
              {leads.length}
            </span>
            <div className="flex flex-col items-center gap-0.5">
              {onToggleCollapsed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Expandir columna"
                  aria-label="Expandir columna"
                  onClick={onToggleCollapsed}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Opciones de etapa">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditStage(stage)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Renombrar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeleteStage(stage)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex min-h-[120px] flex-1 flex-col items-center justify-center px-1 pb-2 pt-1">
            <span className="text-center text-[9px] leading-tight text-muted-foreground">
              {leads.length === 1 ? '1 potencial' : `${leads.length} potenciales`}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-1 border-b border-border/60 px-2 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
                aria-hidden
              />
              <span className="truncate text-sm font-semibold text-foreground" title={stage.name}>
                {stage.name}
              </span>
              <span
                className="shrink-0 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground"
                title={`${leads.length} ${leads.length === 1 ? 'cliente potencial' : 'clientes potenciales'}`}
              >
                {leads.length}
              </span>
              {totalValue > 0 ? (
                <span
                  className="hidden shrink-0 text-[10px] tabular-nums text-muted-foreground xl:inline"
                  title="Valor total en etapa"
                >
                  {currencyFormatter.format(totalValue)}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {onToggleCollapsed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Colapsar columna"
                  aria-label="Colapsar columna"
                  onClick={onToggleCollapsed}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditStage(stage)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Renombrar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeleteStage(stage)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <TooltipProvider delayDuration={300}>
            <div
              className={[
                'flex-1 overflow-y-auto px-2 pb-3 scrollbar-kanban min-h-0',
                compact ? 'space-y-1' : 'space-y-2',
              ].join(' ')}
            >
              {leads.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
                  Arrastra aquí
                </div>
              ) : (
                leads.map((lead) => (
                  <MarketingLeadCardSlot
                    key={lead.id}
                    lead={lead}
                    visibleFields={visibleFields}
                    stageColor={stage.color}
                    expectAgendaContext={expectAgendaContext}
                    compact={compact}
                    matchedCustomer={matchedCustomerByLead.get(lead.id) ?? null}
                    noteCount={noteCountByLead[lead.id] ?? 0}
                    notePreviews={notePreviewsByLead[lead.id] ?? []}
                    isDragging={draggedLeadId === lead.id}
                    isUnread={!viewedLeadIds.has(lead.id)}
                    onLeadClick={onLeadClickById}
                    onOpenCustomer={onOpenCustomer}
                    onLeadOpenNotes={onLeadOpenNotesById}
                    onLeadPromote={onLeadPromoteById}
                    onDragStart={onLeadDragStart}
                    onDragEnd={onLeadDragEnd}
                  />
                ))
              )}
            </div>
          </TooltipProvider>
        </>
      )}
    </div>
  );
});
