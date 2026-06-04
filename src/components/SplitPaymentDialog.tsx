import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Receipt, X, CheckCircle2, Loader2 } from 'lucide-react';
import type { BillingPaymentGroup } from '@/lib/billingCompany';

export type SplitPaymentState = {
  groups: BillingPaymentGroup[];
  paidGroupIds: Set<string>;
  saleGroupId: string | null;
  completedSales: Array<{ saleId: string; billingCompanyId: string; ticket_number: string; total: number }>;
};

type SplitPaymentDialogProps = {
  groups: BillingPaymentGroup[];
  onClose: () => void;
  onComplete: (state: SplitPaymentState) => void;
  onPayGroup: (params: {
    group: BillingPaymentGroup;
    paymentMethod: 'cash' | 'card';
    amountPaid: number;
    change: number;
    saleGroupId: string | null;
    paidCount: number;
    isLastPayment: boolean;
  }) => Promise<{ saleId: string; saleGroupId: string; ticket_number: string; total: number }>;
  processing: boolean;
};

export const SplitPaymentDialog: React.FC<SplitPaymentDialogProps> = ({
  groups,
  onClose,
  onComplete,
  onPayGroup,
  processing,
}) => {
  const [paidGroupIds, setPaidGroupIds] = useState<Set<string>>(new Set());
  const [saleGroupId, setSaleGroupId] = useState<string | null>(null);
  const [completedSales, setCompletedSales] = useState<
    SplitPaymentState['completedSales']
  >([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    groups[0]?.billingCompanyId ?? null,
  );
  const [paymentMethods, setPaymentMethods] = useState<
    Record<string, 'cash' | 'card'>
  >(() => Object.fromEntries(groups.map((g) => [g.billingCompanyId, 'card' as const])));
  const [amountsPaid, setAmountsPaid] = useState<Record<string, string>>({});
  const [payingGroupId, setPayingGroupId] = useState<string | null>(null);

  const allPaid = groups.every((g) => paidGroupIds.has(g.billingCompanyId));
  const globalTotal = groups.reduce((s, g) => s + g.total, 0);

  const handlePay = async (group: BillingPaymentGroup) => {
    const method = paymentMethods[group.billingCompanyId] ?? 'card';
    const paid = parseFloat(amountsPaid[group.billingCompanyId] ?? '') || 0;
    if (method === 'cash' && paid < group.total) return;

    const change = method === 'cash' ? Math.max(0, paid - group.total) : 0;
    setPayingGroupId(group.billingCompanyId);

    try {
      const result = await onPayGroup({
        group,
        paymentMethod: method,
        amountPaid: method === 'cash' ? paid : group.total,
        change,
        saleGroupId,
        paidCount: paidGroupIds.size,
        isLastPayment: paidGroupIds.size + 1 >= groups.length,
      });

      setSaleGroupId(result.saleGroupId);
      setPaidGroupIds((prev) => new Set([...prev, group.billingCompanyId]));
      setCompletedSales((prev) => [
        ...prev,
        {
          saleId: result.saleId,
          billingCompanyId: group.billingCompanyId,
          ticket_number: result.ticket_number,
          total: result.total,
        },
      ]);

      const next = groups.find((g) => !paidGroupIds.has(g.billingCompanyId) && g.billingCompanyId !== group.billingCompanyId);
      if (next) setActiveGroupId(next.billingCompanyId);

      if (paidGroupIds.size + 1 >= groups.length) {
        onComplete({
          groups,
          paidGroupIds: new Set([...paidGroupIds, group.billingCompanyId]),
          saleGroupId: result.saleGroupId,
          completedSales: [
            ...completedSales,
            {
              saleId: result.saleId,
              billingCompanyId: group.billingCompanyId,
              ticket_number: result.ticket_number,
              total: result.total,
            },
          ],
        });
      }
    } finally {
      setPayingGroupId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Cobro dividido por empresa</h3>
            <p className="text-sm text-muted-foreground">
              Total visita: {globalTotal.toFixed(2)} € · {groups.length} pagos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={processing || !!payingGroupId}
            title="Cerrar cobro dividido"
            aria-label="Cerrar cobro dividido"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {groups.map((group, index) => {
            const isPaid = paidGroupIds.has(group.billingCompanyId);
            const isActive = activeGroupId === group.billingCompanyId;
            const method = paymentMethods[group.billingCompanyId] ?? 'card';
            const isPaying = payingGroupId === group.billingCompanyId;

            return (
              <div
                key={group.billingCompanyId}
                className={`rounded-lg border p-4 transition-colors ${
                  isPaid
                    ? 'border-emerald-200 bg-emerald-50'
                    : isActive
                      ? 'border-blue-300 bg-blue-50/50'
                      : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Pago {index + 1}
                    </p>
                    <p className="font-semibold text-gray-900">{group.companyLabel}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      {group.total.toFixed(2)} €
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {group.items.length} línea{group.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isPaid && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  )}
                </div>

                {!isPaid && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={method === 'cash' ? 'default' : 'outline'}
                        onClick={() =>
                          setPaymentMethods((m) => ({
                            ...m,
                            [group.billingCompanyId]: 'cash',
                          }))
                        }
                      >
                        Efectivo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={method === 'card' ? 'default' : 'outline'}
                        onClick={() =>
                          setPaymentMethods((m) => ({
                            ...m,
                            [group.billingCompanyId]: 'card',
                          }))
                        }
                      >
                        Tarjeta / TPV
                      </Button>
                    </div>

                    {method === 'cash' && (
                      <div>
                        <Label className="text-xs">Importe recibido</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="mt-1"
                          value={amountsPaid[group.billingCompanyId] ?? ''}
                          onChange={(e) =>
                            setAmountsPaid((a) => ({
                              ...a,
                              [group.billingCompanyId]: e.target.value,
                            }))
                          }
                          placeholder={group.total.toFixed(2)}
                        />
                      </div>
                    )}

                    <Button
                      type="button"
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={processing || isPaying || (!isActive && paidGroupIds.size > 0 && !isPaid)}
                      onClick={() => handlePay(group)}
                    >
                      {isPaying ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Procesando…
                        </>
                      ) : (
                        <>
                          <Receipt className="w-4 h-4 mr-2" />
                          Confirmar cobro · {group.companyLabel}
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {isPaid && (
                  <p className="text-sm text-emerald-700 font-medium">
                    Ticket{' '}
                    {completedSales.find((s) => s.billingCompanyId === group.billingCompanyId)
                      ?.ticket_number ?? '—'}{' '}
                    · Cobrado
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t flex justify-end gap-2">
          {allPaid ? (
            <Button type="button" onClick={onClose}>
              Finalizar
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onClose} disabled={!!payingGroupId}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
