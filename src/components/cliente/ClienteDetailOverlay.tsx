import React from 'react';
import { createPortal } from 'react-dom';
import { ClienteDetailView } from '@/components/ClienteDetailView';
import { useRoutePanelActive } from '@/contexts/RoutePanelContext';
import { AGENDA_CUSTOMER_DETAIL_OVERLAY_Z } from '@/lib/agendaResourceColors';
import { DOCK_CLEARANCE_BOTTOM } from '@/lib/dialogLayers';
import { cn } from '@/lib/utils';

import type { ClienteDetailTab } from '@/types/clienteDetail';

type Props = {
  open: boolean;
  customerId: string;
  initialTab?: ClienteDetailTab;
  onClose: () => void;
  onNewAppointment?: () => void;
  onAppointmentClick?: (appointmentId: string, dateYmd: string) => void;
  backLabel?: string;
  className?: string;
};

/** Ficha de cliente en capa superior; solo se cierra con «Volver a la cita». */
export const ClienteDetailOverlay: React.FC<Props> = ({
  open,
  customerId,
  initialTab = 'ficha',
  onClose,
  onNewAppointment,
  onAppointmentClick,
  backLabel = 'Volver a la cita',
  className,
}) => {
  const panelActive = useRoutePanelActive();
  if (!open || !panelActive || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        `fixed inset-x-0 top-0 ${DOCK_CLEARANCE_BOTTOM} flex items-start justify-center px-2 pt-2 pb-24 sm:px-3 sm:pt-3 sm:pb-20`,
        AGENDA_CUSTOMER_DETAIL_OVERLAY_Z,
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Ficha del cliente"
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-4xl max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border bg-background shadow-2xl">
        <div className="p-3">
          <ClienteDetailView
            key={`${customerId}-${initialTab}`}
            customerId={customerId}
            initialTab={initialTab}
            onBack={onClose}
            backLabel={backLabel}
            variant="compact"
            onNewAppointment={onNewAppointment ?? onClose}
            onAppointmentClick={onAppointmentClick}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};
