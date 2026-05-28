import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, User } from 'lucide-react';
import { format } from 'date-fns';
import { AppointmentItemsEditor } from '@/components/AppointmentItemsEditor';
import { AppointmentCustomerSummaryBar } from '@/components/AppointmentCustomerSummaryBar';
import { AppointmentSelectContent } from '@/components/AppointmentSelectContent';
import { APPOINTMENT_CUSTOMER_SUMMARY_FIELDS } from '@/lib/appointmentCustomerSummary';
import type { Appointment, AppointmentItemDraft } from '@/types/agenda';
import { calcEndFromStart, effectiveDurationMinutes } from '@/lib/agendaAppointmentItems';
import { AGENDA_APPOINTMENT_MODAL_Z } from '@/lib/agendaResourceColors';
import { toRecursoCatalogEntries } from '@/lib/agendaRecursoMatch';
import { appointmentItemLineTotal } from '@/lib/agendaAppointmentPricing';
import { appointmentChargeableTotal, canChargeAppointment } from '@/lib/appointmentSales';
import { AppointmentClientePicker, type AppointmentClientPick } from '@/components/forms/AppointmentClientePicker';
import type { CustomerSearchRow } from '@/lib/customerSearch';
import { useCustomerActiveBonos } from '@/hooks/useCustomerActiveBonos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { ClienteDetailOverlay } from '@/components/cliente/ClienteDetailOverlay';
import {
  filterEmployeesForBillingCompanies,
  resolveRequiredBillingCompanyIds,
  buildFamilyBillingMap,
} from '@/lib/billingCompany';
import { useFamilies } from '@/hooks/useFamilies';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  name: string;
  color: string;
  billing_company_id?: string | null;
}

export type AppointmentFormInitialPrefill = {
  clientPick: AppointmentClientPick | null;
  description?: string;
  date?: string;
  startTime?: string;
  employeeId?: string;
};

interface AppointmentFormProps {
  employeeId: string;
  time: string;
  employees: Employee[];
  customers: CustomerSearchRow[];
  cabinas?: any[];
  recursos?: any[];
  dayAppointments?: Appointment[];
  onSave: (appointment: any) => void;
  onCancel: () => void;
  initialPrefill?: AppointmentFormInitialPrefill | null;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({
  employeeId,
  time,
  employees,
  customers,
  cabinas = [],
  recursos = [],
  dayAppointments = [],
  onSave,
  onCancel,
  initialPrefill = null,
}) => {
  const navigate = useNavigate();
  const { companyId } = useCompanyFilter();
  const { families: familyRecords } = useFamilies({ scope: 'all' });
  const familyBillingMap = useMemo(
    () => buildFamilyBillingMap(familyRecords.map((f) => ({ name: f.name, billing_company_id: f.billing_company_id }))),
    [familyRecords],
  );

  const [clientPick, setClientPick] = useState<AppointmentClientPick | null>(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [customerHistoryTab, setCustomerHistoryTab] = useState<'timeline' | 'vouchers' | 'ficha'>('ficha');

  const [formData, setFormData] = useState({
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    employeeId,
    startTime: time,
    status: 'confirmed' as const,
  });

  const [items, setItems] = useState<AppointmentItemDraft[]>(() => [
    {
      clientKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}`,
      kind: 'service',
      label: '',
      duration_minutes: 30,
      occupies_time: true,
      quantity: 1,
      unit_price: 0,
      bonus_payment_mode: 'none',
    },
  ]);

  const articleIdsForItems = useMemo(
    () => items.map((it) => it.article_id).filter(Boolean) as string[],
    [items],
  );

  const { data: itemArticles = [] } = useQuery({
    queryKey: ['appointment-item-articles', companyId, articleIdsForItems.join(',')],
    enabled: !!companyId && articleIdsForItems.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, familia, billing_company_id, company_id')
        .in('id', articleIdsForItems);
      if (error) throw error;
      return data ?? [];
    },
  });

  const articlesMap = useMemo(
    () => new Map(itemArticles.map((a) => [a.id, a])),
    [itemArticles],
  );

  const requiredBillingIds = useMemo(
    () =>
      companyId
        ? resolveRequiredBillingCompanyIds(
            articleIdsForItems,
            articlesMap,
            familyBillingMap,
            companyId,
          )
        : [],
    [articleIdsForItems, articlesMap, familyBillingMap, companyId],
  );

  const eligibleEmployees = useMemo(
    () =>
      companyId
        ? filterEmployeesForBillingCompanies(employees, requiredBillingIds, companyId)
        : employees,
    [employees, requiredBillingIds, companyId],
  );

  const hasMixedBillingServices = requiredBillingIds.length > 1;

  useLayoutEffect(() => {
    if (!initialPrefill) return;
    setClientPick(initialPrefill.clientPick);
    setFormData((f) => ({
      ...f,
      description: initialPrefill.description ?? f.description,
      date: initialPrefill.date ?? f.date,
      startTime: initialPrefill.startTime ?? f.startTime,
      employeeId: initialPrefill.employeeId ?? f.employeeId,
    }));
  }, [initialPrefill]);

  const selectedCustomerId = clientPick?.kind === 'customer' ? clientPick.customerId : null;
  const computedEndTime = calcEndFromStart(formData.startTime, effectiveDurationMinutes(items));
  const recursosCatalog = useMemo(() => toRecursoCatalogEntries(recursos), [recursos]);

  const chargeableTotal = appointmentChargeableTotal(items);
  const chargeCheck = canChargeAppointment({
    status: formData.status,
    chargeableTotal,
    existingSale: null,
  });

  const openTpvWithCurrentItems = () => {
    if (!chargeCheck.allowed) return;
    const prefilledCart = items
      .filter((it) => appointmentItemLineTotal(it) > 0)
      .map((it, idx) => {
        const bonusMode = it.kind === 'bonus' ? (it.bonus_payment_mode ?? 'none') : null;
        const lineTotal = appointmentItemLineTotal(it);
        const qty = it.kind === 'bonus' ? 1 : Math.max(1, Number(it.quantity ?? 1));
        const unit = it.kind === 'bonus' ? lineTotal : Math.max(0, Number(it.unit_price ?? 0));
        return {
          id: it.article_id || `draft-${idx}`,
          name: it.label || 'Ítem',
          price: unit,
          quantity: qty,
          total: lineTotal,
          variationId: undefined as string | undefined,
          size: undefined as string | undefined,
          color: undefined as string | undefined,
          sourceKind: it.kind,
          sourceBonusMode: bonusMode,
        };
      });
    navigate('/tpv', {
      state: {
        prefillFromAppointment: {
          appointmentId: `draft-${Date.now()}`,
          customerId: selectedCustomerId ?? null,
          customerName: clientPick?.kind === 'customer' ? clientPick.displayName : (clientPick?.kind === 'manual' ? clientPick.name : null),
          date: formData.date,
          appointmentStatus: formData.status,
          items: prefilledCart,
        },
      },
    });
  };

  const { data: selectedCustomer } = useQuery({
    queryKey: ['appointment-customer-summary', selectedCustomerId],
    enabled: !!selectedCustomerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select(APPOINTMENT_CUSTOMER_SUMMARY_FIELDS)
        .eq('id', selectedCustomerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: activeBonos = [] } = useCustomerActiveBonos(selectedCustomerId);
  const activeVouchersCount = activeBonos.length;

  const { data: pendingDebt = 0 } = useQuery({
    queryKey: ['appointment-customer-debt-summary', companyId, selectedCustomerId],
    enabled: !!companyId && !!selectedCustomerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('total_amount,paid_status,status')
        .eq('company_id', companyId)
        .eq('customer_id', selectedCustomerId)
        .eq('status', 'issued')
        .or('paid_status.is.null,paid_status.eq.false');
      if (error) throw error;
      return (data || []).reduce((sum: number, r: any) => sum + Math.max(0, Number(r.total_amount || 0)), 0);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientPick) return;
    const clientName = clientPick.kind === 'customer' ? clientPick.displayName : clientPick.name;
    if (!clientName.trim()) return;

    const selectedEmployee = employees.find((e) => e.id === formData.employeeId);
    const endTime = calcEndFromStart(formData.startTime, effectiveDurationMinutes(items));
    onSave({
      employeeId: formData.employeeId,
      clientName: clientName.trim(),
      customerId: clientPick.kind === 'customer' ? clientPick.customerId : null,
      description: formData.description,
      date: formData.date,
      startTime: formData.startTime,
      endTime,
      color: selectedEmployee?.color || '',
      status: formData.status,
      items,
    });
  };

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center ${AGENDA_APPOINTMENT_MODAL_Z} px-4 pt-3 pb-28 sm:pb-24 sm:p-4`}>
      <Card className="w-full max-w-md max-h-[calc(100dvh-7rem)] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <CardTitle className="text-base flex items-center gap-2 shrink-0 pt-1">
              <User className="w-4 h-4" /> Nueva Cita
            </CardTitle>
            <div className="flex-1 min-w-0">
              <AppointmentClientePicker customers={customers} value={clientPick} onChange={setClientPick} />
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 mt-0.5" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            {selectedCustomerId && selectedCustomer && (
              <AppointmentCustomerSummaryBar
                customer={selectedCustomer}
                status={formData.status}
                onStatusChange={(status) => setFormData({ ...formData, status })}
                onOpenFicha={() => { setCustomerHistoryTab('ficha'); setShowCustomerHistory(true); }}
                activeVouchersCount={activeVouchersCount}
                pendingDebt={pendingDebt}
                chargeableTotal={chargeableTotal}
                chargeBlockedReason={!chargeCheck.allowed ? chargeCheck.reason : null}
                onOpenVouchers={() => { setCustomerHistoryTab('vouchers'); setShowCustomerHistory(true); }}
                onOpenFacturacion={() => { setCustomerHistoryTab('timeline'); setShowCustomerHistory(true); }}
                onCharge={chargeCheck.allowed ? openTpvWithCurrentItems : undefined}
              />
            )}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Hora inicio</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Empleada</Label>
                {hasMixedBillingServices && (
                  <p className="text-[10px] text-amber-600 mb-1">
                    Cita con servicios de distintas empresas: asigna empleada del tenant o divide la cita.
                  </p>
                )}
                <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <AppointmentSelectContent>
                    {eligibleEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </AppointmentSelectContent>
                </Select>
              </div>
            </div>

            <AppointmentItemsEditor
              startTime={formData.startTime}
              items={items}
              onChange={setItems}
              customerId={clientPick?.kind === 'customer' ? clientPick.customerId : null}
              recursosCatalog={recursosCatalog}
              cabinasCatalog={cabinas}
              appointmentDate={formData.date}
              dayAppointments={dayAppointments}
              compactHeader
            />

            <div>
              <Label className="text-xs">Observaciones</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notas rápidas de la cita"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1 gap-1" disabled={!clientPick}>
                <Save className="w-4 h-4" /> Guardar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <ClienteDetailOverlay
        open={showCustomerHistory && !!selectedCustomerId}
        customerId={selectedCustomerId ?? ''}
        initialTab={customerHistoryTab}
        onClose={() => setShowCustomerHistory(false)}
      />
    </div>
  );
};
