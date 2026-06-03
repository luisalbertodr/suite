import React from 'react';
import { Button } from '@/components/ui/button';
import { AppointmentSelectContent } from '@/components/AppointmentSelectContent';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  customerContactFallback,
  formatCustomerContactLine,
  type AppointmentCustomerSummary,
} from '@/lib/appointmentCustomerSummary';

type Props = {
  customer: AppointmentCustomerSummary;
  status: 'confirmed' | 'pending' | 'cancelled';
  onStatusChange: (status: 'confirmed' | 'pending' | 'cancelled') => void;
  onOpenFicha: () => void;
  activeVouchersCount: number;
  pendingDebt: number;
  chargeableTotal: number;
  chargedTotal?: number;
  saleTicket?: string | null;
  invoiceNumber?: string | null;
  chargeBlockedReason?: string | null;
  onOpenVouchers: () => void;
  onOpenFacturacion: () => void;
  onViewInvoice?: () => void;
  onCharge?: () => void;
  onOpenClinicalHistory?: () => void;
  showCrearBono?: boolean;
};

export const AppointmentCustomerSummaryBar: React.FC<Props> = ({
  customer,
  status,
  onStatusChange,
  onOpenFicha,
  activeVouchersCount,
  pendingDebt,
  chargeableTotal,
  chargedTotal = 0,
  saleTicket,
  invoiceNumber,
  chargeBlockedReason,
  onOpenVouchers,
  onOpenFacturacion,
  onViewInvoice,
  onCharge,
  onOpenClinicalHistory,
  showCrearBono = true,
}) => {
  const contactLine = formatCustomerContactLine(customer);
  const displayContact = contactLine || customerContactFallback(customer);
  const displayName = String(customer.name ?? '').trim();
  const isCancelled = status === 'cancelled';
  const isCharged = chargedTotal > 0 && Boolean(saleTicket);
  const pendingCharge = Math.max(0, chargeableTotal - chargedTotal);

  return (
    <div className="rounded-md border bg-muted/30 p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 leading-snug">
          {displayName && (
            <div className="font-medium text-foreground truncate">{displayName}</div>
          )}
          <div className="text-muted-foreground">{displayContact}</div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={onOpenFicha}>
            Ficha
          </Button>
          {onOpenClinicalHistory && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2"
              onClick={onOpenClinicalHistory}
            >
              Hist. clínico
            </Button>
          )}
          <Select value={status} onValueChange={(v) => onStatusChange(v as typeof status)}>
            <SelectTrigger className="h-6 text-[11px] px-2 min-w-[104px]">
              <SelectValue />
            </SelectTrigger>
            <AppointmentSelectContent>
              <SelectItem value="confirmed">Confirmada</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </AppointmentSelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 items-center">
        <button type="button" className="hover:underline" onClick={onOpenVouchers}>
          Bonos activos: <strong>{activeVouchersCount}</strong>
        </button>
        {showCrearBono && (
          <button type="button" className="hover:underline text-primary" onClick={onOpenVouchers}>
            Crear/editar bono
          </button>
        )}
        <button type="button" className="hover:underline" onClick={onOpenFacturacion}>
          Deuda facturas: <strong>{pendingDebt.toFixed(2)} €</strong>
        </button>
        <span>
          Importe cita: <strong>{chargeableTotal.toFixed(2)} €</strong>
        </span>
        {isCharged ? (
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
            Cobrada TPV: {chargedTotal.toFixed(2)} € · {saleTicket}
            {invoiceNumber && onViewInvoice ? (
              <>
                {' · '}
                <button type="button" className="hover:underline font-semibold" onClick={onViewInvoice}>
                  Factura {invoiceNumber}
                </button>
              </>
            ) : !invoiceNumber && isCharged ? (
              <span className="text-amber-700 dark:text-amber-400"> · Sin factura emitida</span>
            ) : null}
          </span>
        ) : pendingCharge > 0 && !isCancelled ? (
          onCharge ? (
            <button type="button" className="hover:underline text-primary font-medium" onClick={onCharge}>
              Pendiente cobro: <strong>{pendingCharge.toFixed(2)} €</strong>
            </button>
          ) : (
            <span>
              Pendiente cobro: <strong>{pendingCharge.toFixed(2)} €</strong>
            </span>
          )
        ) : isCancelled ? (
          <span className="text-muted-foreground">Cita cancelada — sin cobro</span>
        ) : (
          <span className="text-muted-foreground">Sin importe a cobrar</span>
        )}
        {chargeBlockedReason && onCharge && (
          <span className="text-amber-700">{chargeBlockedReason}</span>
        )}
      </div>
    </div>
  );
};
