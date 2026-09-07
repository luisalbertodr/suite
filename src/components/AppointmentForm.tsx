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
import { AGENDA_MODAL_SHELL } from '@/lib/dialogLayers';
import { toRecursoCatalogEntries } from '@/lib/agendaRecursoMatch';
import { appointmentItemLineTotal } from '@/lib/agendaAppointmentPricing';
import { appointmentChargeableTotal, canChargeAppointment } from '@/lib/appointmentSales';
import { AppointmentClientePicker, type AppointmentClientPick } from '@/components/forms/AppointmentClientePicker';
import { useCustomerActiveBonos } from '@/hooks/useCustomerActiveBonos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useCustomerPendingInvoiceDebt } from '@/hooks/useCustomerPendingInvoiceDebt';
import { ClienteDetailOverlay } from '@/components/cliente/ClienteDetailOverlay';
import { AppointmentResourceConflictDialog } from '@/components/AppointmentResourceConflictDialog';
import {
  filterEmployeesForBillingCompanies,
  resolveRequiredBillingCompanyIds,
  buildFamilyBillingMap,
} from '@/lib/billingCompany';
import { useFamilies } from '@/hooks/useFamilies';
import { useNavigate } from 'react-router-dom';
import { openSuiteWhatsappChat, normalizeWhatsappPhoneParam } from '@/lib/openSuiteWhatsappChat';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import { usePermissions } from '@/hooks/usePermissions';

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
  items?: AppointmentItemDraft[];
};

interface AppointmentFormProps {
  employeeId: string;
  time: string;
  /** Día visible en la agenda (yyyy-MM-dd); evita guardar en «hoy» por defecto. */
  defaultDate: string;
  employees: Employee[];
  cabinas?: any[];
  recursos?: any[];
  dayAppointments?: Appointment[];
  onSave: (appointment: any) => void | Promise<void>;
  onCancel: () => void;
  initialPrefill?: AppointmentFormInitialPrefill | null;
  /** True mientras el padre persiste la cita (dual-sync incluido). */
  saving?: boolean;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({
  employeeId,
  time,
  defaultDate,
  employees,
  cabinas = [],
  recursos = [],
  dayAppointments = [],
  onSave,
  onCancel,
  initialPrefill = null,
  saving = false,
}) => {
  const navigate = useNavigate();
  const { companyId } = useCompanyFilter();
  const { companyId: whatsappCompanyId } = useWhatsappCompanyId();
  const { hasPermission } = usePermissions();
  const canUseWhatsapp = hasPermission('whatsapp', 'read');
  const { families: familyRecords } = useFamilies({ scope: 'all' });
  const familyBillingMap = useMemo(
    () => buildFamilyBillingMap(familyRecords.map((f) => ({ name: f.name, billing_company_id: f.billing_company_id }))),
    [familyRecords],
  );

  const [clientPick, setClientPick] = useState<AppointmentClientPick | null>(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [customerHistoryTab, setCustomerHistoryTab] = useState<'timeline' | 'vouchers' | 'ficha'>('ficha');
  const [resourceConflictMessages, setResourceConflictMessages] = useState<string[]>([]);
  const [showResourceConflictDialog, setShowResourceConflictDialog] = useState(false);

  const [formData, setFormData] = useState({
    description: '',
    date: defaultDate,
    employeeId,
    startTime: time,
    status: 'confirmed' as const,
  });

  const [items, setItems] = useState<AppointmentItemDraft[]>(() => [
    {
      clientKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}`,
      kind: 'service',
      label: '',
      duration_minutes: 15,
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
    if (initialPrefill.items?.length) {
      setItems(initialPrefill.items);
    }
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

  const styleCodcli =
    (clientPick?.kind === 'customer' ? clientPick.legacyCodcli : null)?.trim() ||
    String(selectedCustomer?.legacy_codcli ?? '').trim() ||
    '';
  const stylePhone =
    (clientPick?.kind === 'customer' ? clientPick.phone : null)?.trim() ||
    String(
      selectedCustomer?.phone_mobile ||
        selectedCustomer?.phone ||
        selectedCustomer?.phone_home ||
        '',
    ).trim() ||
    '';
  const selectedEmployeeName =
    employees.find((e) => e.id === formData.employeeId)?.name ?? formData.employeeId;

  const { data: activeBonos = [] } = useCustomerActiveBonos(selectedCustomerId);
  const activeVouchersCount = activeBonos.length;

  const { data: pendingDebt = 0 } = useCustomerPendingInvoiceDebt(companyId, selectedCustomerId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientPick) return;
    if (resourceConflictMessages.length > 0) {
      setShowResourceConflictDialog(true);
      return;
    }
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
    <div className={`${AGENDA_MODAL_SHELL} bg-black/50 ${AGENDA_APPOINTMENT_MODAL_Z}`}>
      <Card className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden">
        <CardHeader className="shrink-0 space-y-2 px-4 pb-2 pt-3">
          <div className="flex items-start gap-2">
            <CardTitle className="text-base flex items-center gap-2 shrink-0 pt-0.5">
              <User className="w-4 h-4" /> Nueva Cita
            </CardTitle>
            <div className="min-w-0 flex-1">
              <AppointmentClientePicker lazySearch value={clientPick} onChange={setClientPick} />
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onCancel} disabled={saving}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              Profesional: <strong className="text-foreground">{selectedEmployeeName}</strong>
              <span className="ml-1">· Style (cola DBF)</span>
            </span>
            {(stylePhone || styleCodcli) && (
              <span className="tabular-nums truncate">
                {[stylePhone ? `tel ${stylePhone}` : null, styleCodcli ? `cli ${styleCodcli}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-0">
          <form onSubmit={handleSubmit} className="space-y-2.5">
            {selectedCustomerId && selectedCustomer && (
              <AppointmentCustomerSummaryBar
                customer={selectedCustomer}
                status={formData.status}
                onStatusChange={(status) => setFormData({ ...formData, status })}
                onOpenFicha={() => { setCustomerHistoryTab('ficha'); setShowCustomerHistory(true); }}
                onOpenWhatsapp={
                  canUseWhatsapp && stylePhone
                    ? () => {
                        void openSuiteWhatsappChat(
                          navigate,
                          whatsappCompanyId ?? companyId,
                          stylePhone,
                          selectedCustomer.name ?? undefined,
                        );
                      }
                    : stylePhone
                      ? () => {
                          const digits = normalizeWhatsappPhoneParam(stylePhone);
                          if (digits) {
                            window.open(`https://wa.me/${digits}`, '_blank', 'noopener,noreferrer');
                          }
                        }
                      : undefined
                }
                whatsappPhoneFallback={stylePhone}
                activeVouchersCount={activeVouchersCount}
                pendingDebt={pendingDebt}
                chargeableTotal={chargeableTotal}
                chargeBlockedReason={!chargeCheck.allowed ? chargeCheck.reason : null}
                onOpenVouchers={() => { setCustomerHistoryTab('vouchers'); setShowCustomerHistory(true); }}
                onOpenFacturacion={() => { setCustomerHistoryTab('timeline'); setShowCustomerHistory(true); }}
                onCharge={chargeCheck.allowed ? openTpvWithCurrentItems : undefined}
              />
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="min-w-0">
                <Label className="text-[10px] text-muted-foreground">Fecha</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  disabled={saving}
                  className="h-8 text-xs"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-[10px] text-muted-foreground">Inicio</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  disabled={saving}
                  className="h-8 text-xs tabular-nums"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-[10px] text-muted-foreground">Fin (calc.)</Label>
                <Input type="time" value={computedEndTime} readOnly tabIndex={-1} className="h-8 text-xs tabular-nums bg-muted/40" />
              </div>
              <div className="min-w-0">
                <Label className="text-[10px] text-muted-foreground">Empleada</Label>
                {hasMixedBillingServices && (
                  <p className="text-[10px] text-amber-600 mb-0.5">
                    Servicios de distintas empresas: asigna empleada del tenant o divide la cita.
                  </p>
                )}
                <Select
                  value={formData.employeeId}
                  onValueChange={(v) => setFormData({ ...formData, employeeId: v })}
                  disabled={saving}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
              articlePicker="by-family"
              compactHeader
              compactSlots
              timeSlotsServicesOnly
              onResourceConflictsChange={setResourceConflictMessages}
            />

            <div className="min-w-0">
              <Label className="text-xs">Observaciones</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notas rápidas de la cita"
                rows={3}
                className="min-h-[4.5rem] resize-y text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 gap-1"
                disabled={!clientPick || resourceConflictMessages.length > 0 || saving}
                title={resourceConflictMessages.length > 0 ? 'Hay conflicto de cabina o recurso' : undefined}
              >
                <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <AppointmentResourceConflictDialog
        open={showResourceConflictDialog}
        onOpenChange={setShowResourceConflictDialog}
        messages={resourceConflictMessages}
      />
      <ClienteDetailOverlay
        open={showCustomerHistory && !!selectedCustomerId}
        customerId={selectedCustomerId ?? ''}
        initialTab={customerHistoryTab}
        onClose={() => setShowCustomerHistory(false)}
      />
    </div>
  );
};
