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
import { cn } from '@/lib/utils';
import {
  ABOVE_DOCK_DIALOG_POSITION,
  ABOVE_DOCK_DIALOG_Z,
} from '@/lib/dialogLayers';

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
      <DialogContent
        overlayClassName={ABOVE_DOCK_DIALOG_Z}
        className={cn(
          ABOVE_DOCK_DIALOG_Z,
          ABOVE_DOCK_DIALOG_POSITION,
          'max-h-full max-w-xl overflow-y-auto',
        )}
      >
        <DialogHeader>
          <DialogTitle>Notas · {getLeadFullName(lead)}</DialogTitle>
          <DialogDescription>
            Registra llamadas, motivos de rechazo, próximos contactos…
          </DialogDescription>
        </DialogHeader>
        <MarketingLeadNotesPanel
          key={lead.id}
          leadId={lead.id}
          companyId={lead.company_id ?? undefined}
        />
      </DialogContent>
    </Dialog>
  );
};
