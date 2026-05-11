import React from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
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
import { MarketingLeadCard } from './MarketingLeadCard';

interface MarketingStageColumnProps {
  stage: MarketingLeadStage;
  leads: MarketingLead[];
  visibleFields: MarketingFieldConfig[];
  draggedLeadId: string | null;
  dragOverStageId: string | null;
  matchedCustomerByLead: Map<string, CustomerLookupRow | null>;
  noteCountByLead: Record<string, number>;
  notePreviewsByLead: Record<string, MarketingLeadNotePreview[]>;
  onLeadClick: (lead: MarketingLead) => void;
  onLeadOpenNotes: (lead: MarketingLead) => void;
  onLeadPromote: (lead: MarketingLead) => void;
  onLeadDragStart: (event: React.DragEvent<HTMLDivElement>, lead: MarketingLead) => void;
  onLeadDragEnd: (event: React.DragEvent<HTMLDivElement>) => void;
  onStageDragOver: (event: React.DragEvent<HTMLDivElement>, stageId: string) => void;
  onStageDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onStageDrop: (event: React.DragEvent<HTMLDivElement>, stageId: string) => void;
  onEditStage: (stage: MarketingLeadStage) => void;
  onDeleteStage: (stage: MarketingLeadStage) => void;
}

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const MarketingStageColumn: React.FC<MarketingStageColumnProps> = ({
  stage,
  leads,
  visibleFields,
  draggedLeadId,
  dragOverStageId,
  matchedCustomerByLead,
  noteCountByLead,
  notePreviewsByLead,
  onLeadClick,
  onLeadOpenNotes,
  onLeadPromote,
  onLeadDragStart,
  onLeadDragEnd,
  onStageDragOver,
  onStageDragLeave,
  onStageDrop,
  onEditStage,
  onDeleteStage,
}) => {
  const totalValue = leads.reduce((acc, l) => acc + Number(l.value ?? 0), 0);
  const isDropTarget = dragOverStageId === stage.id;

  return (
    <div
      className={[
        'flex h-full w-[260px] shrink-0 flex-col rounded-2xl border border-border/60',
        'bg-muted/40 transition-colors',
        isDropTarget ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : '',
      ].join(' ')}
      onDragOver={(e) => onStageDragOver(e, stage.id)}
      onDragLeave={onStageDragLeave}
      onDrop={(e) => onStageDrop(e, stage.id)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: stage.color }}
            aria-hidden
          />
          <span className="truncate text-sm font-semibold text-foreground" title={stage.name}>
            {stage.name}
          </span>
        </div>
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

      <div className="flex items-baseline justify-between px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>
          {leads.length} {leads.length === 1 ? 'cliente potencial' : 'clientes potenciales'}
        </span>
        <span className="tabular-nums">{currencyFormatter.format(totalValue)}</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3 scrollbar-kanban">
        {leads.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
            Arrastra aquí
          </div>
        ) : (
          leads.map((lead) => (
            <MarketingLeadCard
              key={lead.id}
              lead={lead}
              visibleFields={visibleFields}
              stageColor={stage.color}
              matchedCustomer={matchedCustomerByLead.get(lead.id) ?? null}
              noteCount={noteCountByLead[lead.id] ?? 0}
              notePreviews={notePreviewsByLead[lead.id] ?? []}
              isDragging={draggedLeadId === lead.id}
              onClick={() => onLeadClick(lead)}
              onOpenNotes={() => onLeadOpenNotes(lead)}
              onPromote={() => onLeadPromote(lead)}
              onDragStart={onLeadDragStart}
              onDragEnd={onLeadDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
};
