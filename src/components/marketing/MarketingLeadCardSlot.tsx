import React, { memo } from 'react';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { MarketingFieldConfig } from '@/hooks/useMarketingFieldConfig';
import type { CustomerLookupRow } from '@/hooks/useCustomerLookup';
import type { MarketingLeadNotePreview } from '@/hooks/useMarketingLeadNotes';
import { MarketingLeadCard } from './MarketingLeadCard';

type MarketingLeadCardSlotProps = {
  lead: MarketingLead;
  visibleFields: MarketingFieldConfig[];
  stageColor: string;
  expectAgendaContext: boolean;
  compact: boolean;
  matchedCustomer: CustomerLookupRow | null;
  noteCount: number;
  notePreviews: MarketingLeadNotePreview[];
  isDragging: boolean;
  isUnread: boolean;
  waQueuePending?: boolean;
  onLeadClick: (leadId: string) => void;
  onOpenCustomer: (customerId: string) => void;
  onLeadOpenNotes: (leadId: string) => void;
  onLeadPromote: (leadId: string) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, lead: MarketingLead) => void;
  onDragEnd: (event: React.DragEvent<HTMLDivElement>) => void;
};

export const MarketingLeadCardSlot = memo(function MarketingLeadCardSlot({
  lead,
  visibleFields,
  stageColor,
  expectAgendaContext,
  compact,
  matchedCustomer,
  noteCount,
  notePreviews,
  isDragging,
  isUnread,
  waQueuePending = false,
  onLeadClick,
  onOpenCustomer,
  onLeadOpenNotes,
  onLeadPromote,
  onDragStart,
  onDragEnd,
}: MarketingLeadCardSlotProps) {
  return (
    <MarketingLeadCard
      lead={lead}
      visibleFields={visibleFields}
      stageColor={stageColor}
      expectAgendaContext={expectAgendaContext}
      compact={compact}
      matchedCustomer={matchedCustomer}
      noteCount={noteCount}
      notePreviews={notePreviews}
      isDragging={isDragging}
      isUnread={isUnread}
      waQueuePending={waQueuePending}
      onClick={() => onLeadClick(lead.id)}
      onOpenCustomer={onOpenCustomer}
      onOpenNotes={() => onLeadOpenNotes(lead.id)}
      onPromote={() => onLeadPromote(lead.id)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    />
  );
});
