import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Receipt, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  computeInvoicePendingAmount,
  fetchCustomerPendingInvoiceDebt,
  filterInvoicesForDebtCalculation,
} from '@/lib/customerInvoiceDebt';
import type { InvoiceDebtRow } from '@/lib/customerInvoiceDebt';

interface Props {
  customerId: string;
}

export const ClienteFacturacionTab: React.FC<Props> = ({ customerId }) => {
  const { companyId } = useCompanyFilter();

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['customer_invoices', customerId, companyId],
    queryFn: async () => {
      let q = supabase
        .from('invoices')
        .select('id, number, issue_date, total_amount, amount_paid, paid_status, status, company_id')
        .eq('customer_id', customerId)
        .order('issue_date', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q;
      if (error) {
        if ((error as { code?: string }).code === '42703') {
          let q2 = supabase
            .from('invoices')
            .select('id, number, issue_date, total_amount, paid_status, status, company_id')
            .eq('customer_id', customerId)
            .order('issue_date', { ascending: false });
          if (companyId) q2 = q2.eq('company_id', companyId);
          const res = await q2;
          if (res.error) throw res.error;
          return (res.data ?? []).map((row) => ({ ...row, amount_paid: null }));
        }
        throw error;
      }
      return data;
    },
  });

  const { data: pendingDebt = 0 } = useQuery({
    queryKey: ['customer-pending-invoice-debt-tab', companyId, customerId],
    enabled: !!companyId && !!customerId,
    queryFn: () => fetchCustomerPendingInvoiceDebt(companyId!, customerId),
  });

  const invoiceRowsForDisplay = useMemo(
    () => filterInvoicesForDebtCalculation((invoices ?? []) as InvoiceDebtRow[]),
    [invoices],
  );

  const { data: quotes, isLoading: loadingQuotes } = useQuery({
    queryKey: ['customer_quotes', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('customer_id', customerId)
        .order('issue_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loadingInvoices || loadingQuotes) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {pendingDebt > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Deuda pendiente en facturas: <strong>{pendingDebt.toFixed(2)} €</strong>
            <span className="block text-xs opacity-80 mt-0.5">
              Incluye cobros parciales importados de Dunasoft.
            </span>
          </p>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Receipt className="w-5 h-5" /> Facturas ({invoiceRowsForDisplay.length || invoices?.length || 0})
        </h3>
        {!invoices?.length ? (
          <p className="text-sm text-muted-foreground">No hay facturas</p>
        ) : (
          <div className="space-y-2">
            {invoiceRowsForDisplay.map((inv) => {
              const pending = computeInvoicePendingAmount(inv as InvoiceDebtRow);
              const paid = Number(inv.amount_paid ?? 0);
              const statusLabel =
                inv.status === 'paid' || pending <= 0
                  ? 'Pagada'
                  : pending < Number(inv.total_amount ?? 0) - 0.01
                    ? `Pendiente ${pending.toFixed(2)} €`
                    : inv.status === 'sent'
                      ? 'Pendiente'
                      : inv.status === 'pending'
                        ? 'Pendiente'
                        : inv.status;
              return (
                <Card key={inv.id}>
                  <CardContent className="pt-4 flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <span className="font-medium">{inv.number}</span>
                      <span className="text-sm text-muted-foreground ml-3">
                        {format(new Date(inv.issue_date), 'dd/MM/yyyy')}
                      </span>
                      {paid > 0.005 && pending > 0.005 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Cobrado {paid.toFixed(2)} € de {Number(inv.total_amount ?? 0).toFixed(2)} €
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold">{Number(inv.total_amount ?? 0).toFixed(2)} €</span>
                      <span
                        className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          pending <= 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Presupuestos ({quotes?.length || 0})
        </h3>
        {!quotes?.length ? (
          <p className="text-sm text-muted-foreground">No hay presupuestos</p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <Card key={q.id}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{q.number}</span>
                    <span className="text-sm text-muted-foreground ml-3">
                      {format(new Date(q.issue_date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <span className="font-semibold">{q.total_amount.toFixed(2)} €</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
