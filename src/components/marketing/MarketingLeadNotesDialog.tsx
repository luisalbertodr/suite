import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MarketingLeadNotesPanel } from './MarketingLeadNotesPanel';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import { getLeadFullName } from './marketingFormatters';

interface MarketingLeadNotesDialogProps {
  lead: MarketingLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MarketingLeadNotesDialog: React.FC<MarketingLeadNotesDialogProps> = ({
  lead,
  open,
  onOpenChange,
}) => {
  if (!lead) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Notas · {getLeadFullName(lead)}</DialogTitle>
          <DialogDescription>
            Registra llamadas, motivos de rechazo, próximos contactos…
          </DialogDescription>
        </DialogHeader>
        <MarketingLeadNotesPanel leadId={lead.id} />
      </DialogContent>
    </Dialog>
  );
};
