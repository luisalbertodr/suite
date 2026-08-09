import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Save, Trash2, ArrowLeft } from 'lucide-react';
import { AppointmentItemsEditor } from '@/components/AppointmentItemsEditor';
import { AppointmentAttachmentsPanel } from '@/components/AppointmentAttachmentsPanel';
import { AppointmentCustomerSummaryBar } from '@/components/AppointmentCustomerSummaryBar';
import { AppointmentSelectContent } from '@/components/AppointmentSelectContent';
import { useAppointmentItems } from '@/hooks/useAppointmentItems';
import type { AppointmentItemDraft } from '@/types/agenda';
import type { Appointment as AgendaAppointment } from '@/types/agenda';
import { calcEndFromStart, effectiveDurationMinutes, minutesBetweenHHmm } from '@/lib/agendaAppointmentItems';
import { AGENDA_APPOINTMENT_MODAL_Z } from '@/lib/agendaResourceColors';
import { AGENDA_MODAL_SHELL } from '@/lib/dialogLayers';
import { toRecursoCatalogEntries } from '@/lib/agendaRecursoMatch';
import { appointmentItemsTotal } from '@/lib/agendaAppointmentPricing';
import { appointmentChargeableTotal, canChargeAppointment, summarizeAppointmentChargeState } from '@/lib/appointmentSales';
import { useAppointmentSales } from '@/hooks/useAppointmentSale';
import type { CustomerSearchRow } from '@/lib/customerSearch';
import { useCustomerActiveBonos } from '@/hooks/useCustomerActiveBonos';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useCustomerPendingInvoiceDebt } from '@/hooks/useCustomerPendingInvoiceDebt';
import {
  filterEmployeesForBillingCompanies,
  resolveRequiredBillingCompanyIds,
  buildFamilyBillingMap,
} from '@/lib/billingCompany';
import { useFamilies } from '@/hooks/useFamilies';
import { ClienteDetailOverlay } from '@/components/cliente/ClienteDetailOverlay';
import { PermissionButton } from '@/components/PermissionButton';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { useAppointmentEffectiveCustomer } from '@/hooks/useAppointmentEffectiveCustomer';
import { normalizeLegacyAppointmentDescription } from '@/lib/legacyAppointmentItems';
import { isAppointmentFinanciallyClosed } from '@/lib/appointmentLifecycle';
import { AppointmentResourceConflictDialog } from '@/components/AppointmentResourceConflictDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { AppointmentDocumentationDialog } from '@/components/clinical/AppointmentDocumentationDialog';
import { ConsentimientoSignDialog } from '@/components/consentimiento/ConsentimientoSignDialog';
import { TreatmentSessionDialog } from '@/components/clinical/TreatmentSessionDialog';
import type { ConsentimientoSignContext } from '@/lib/consentimientoTypes';
import type { TrackingFamily } from '@/lib/treatmentTracking';
import { createQuestionnaire, openQuestionnaireKiosk } from '@/lib/questionnaireApi';
import { useToast } from '@/hooks/use-toast';
import type { ClienteDetailTab } from '@/types/clienteDetail';

interface Employee { id: string; name: string; color: string; billing_company_id?: string | null; }
interface Appointment {
  id: string;
  employeeId: string;
  clientName: string;
  customerId?: string | null;
  legacyClientCode?: string | null;
  legacyEmployeeCode?: string | null;
  legacyIdPlan?: string | null;
  /** Réplica de plan2009.tel1cli: respaldo cuando la ficha Suite no tiene teléfono. */
  clientPhone?: string | null;
  description: string;
  startTime: string;
  endTime: string;
  date: string;
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

interface EditAppointmentFormProps {
  appointment: Appointment;
  employees: Employee[];
  customers: CustomerSearchRow[];
  notifyRecipients?: { userId: string; label: string }[];
  cabinas?: any[];
  recursos?: any[];
  dayAppointments?: AgendaAppointment[];
  onSave: (appointment: Appointment, items: AppointmentItemDraft[]) => void;
  onCharge?: (appointment: Appointment, items: AppointmentItemDraft[]) => void;
  onNotify?: (appointment: Appointment, recipientUserId: string, message: string) => Promise<void> | void;
  onDelete: (appointmentId: string) => void;
  onCancelAndRefund?: (appointmentId: string) => void | Promise<void>;
  paymentStatus?: AgendaAppointment['paymentStatus'];
  onCancel: () => void;
  /** True mientras el padre persiste (dual-sync incluido). */
  saving?: boolean;
  returnCustomerId?: string | null;
  onReturnToCustomerHistory?: () => void;
  onHistoryAppointmentClick?: (appointmentId: string, dateYmd: string) => void;
}

function defaultLabelFromDescription(description: string): string {
  const t = description.trim();
  if (!t) return 'Servicio';
  return t.split('\n')[0]!.slice(0, 80);
}

function seedItemsFromAppointment(appointment: Appointment): AppointmentItemDraft[] {
  const span = minutesBetweenHHmm(appointment.startTime, appointment.endTime);
  const duration = span > 0 ? span : 30;
  return [
    {
      clientKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}`,
      kind: 'service',
      label: defaultLabelFromDescription(appointment.description),
      duration_minutes: duration,
      occupies_time: true,
      quantity: 1,
      unit_price: 0,
      bonus_payment_mode: 'none',
    },
  ];
}

function normalizeItemLabel(label: string): string {
  return (label || '')
    .replace(/\[\d{1,2}:\d{2}\]/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function removeRedundantProducts(items: AppointmentItemDraft[]): AppointmentItemDraft[] {
  const serviceNames = new Set(
    items
      .filter((i) => i.kind === 'service')
      .map((i) => normalizeItemLabel(i.label))
      .filter(Boolean)
  );
  if (!serviceNames.size) return items;
  return items.filter((i) => {
    if (i.kind !== 'product') return true;
    const sameNameAsService = serviceNames.has(normalizeItemLabel(i.label));
    const zeroAmount = Number(i.unit_price ?? 0) <= 0 || Number(i.quantity ?? 0) <= 0;
    const noLinkedArticle = !i.article_id;
    return !(sameNameAsService && zeroAmount && noLinkedArticle);
  });
}

export const EditAppointmentForm: React.FC<EditAppointmentFormProps> = ({
  appointment,
  employees,
  customers,
  notifyRecipients = [],
  cabinas = [],
  recursos = [],
  dayAppointments = [],
  onSave,
  onCharge,
  onNotify,
  onDelete,
  onCancelAndRefund,
  paymentStatus,
  onCancel,
  saving = false,
  returnCustomerId,
  onReturnToCustomerHistory,
  onHistoryAppointmentClick,
}) => {
  const navigate = useNavigate();
  const { companyId } = useCompanyFilter();
  const { families: familyRecords } = useFamilies({ scope: 'all' });
  const familyBillingMap = useMemo(
    () => buildFamilyBillingMap(familyRecords.map((f) => ({ name: f.name, billing_company_id: f.billing_company_id }))),
    [familyRecords],
  );

  const { requireOrToast: requirePermissionOrToast } = usePermissionGuard();
  const { hasPermission } = usePermissions();
  const canSeeClinicalHistory = hasPermission('clinical_history', 'read');
  const openClinicalHistoryTab = () => {
    setCustomerHistoryTab('historial');
    setShowCustomerHistory(true);
  };
  const { toast } = useToast();
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [customerHistoryTab, setCustomerHistoryTab] = useState<ClienteDetailTab>('ficha');
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [consentSignContext, setConsentSignContext] = useState<ConsentimientoSignContext | null>(null);
  const [sessionContext, setSessionContext] = useState<{
    trackingFamily: TrackingFamily;
    plantillaCodigo?: string | null;
  } | null>(null);
  const [resourceConflictMessages, setResourceConflictMessages] = useState<string[]>([]);
  const [showResourceConflictDialog, setShowResourceConflictDialog] = useState(false);

  const [formData, setFormData] = useState({
    description: normalizeLegacyAppointmentDescription(appointment.description),
    date: appointment.date,
    startTime: appointment.startTime,
    employeeId: appointment.employeeId,
    status: appointment.status,
  });

  const { data: loadedItems, isLoading: itemsLoading } = useAppointmentItems(appointment.id);
  const [items, setItems] = useState<AppointmentItemDraft[]>([]);
  const [showNotify, setShowNotify] = useState(false);
  const [notifyTo, setNotifyTo] = useState('');
  const [notifyMsg, setNotifyMsg] = useState('');

  useLayoutEffect(() => {
    if (itemsLoading || loadedItems === undefined) return;
    const normalizeQty = (list: AppointmentItemDraft[]) =>
      list.map((it) => ({ ...it, quantity: 1 }));
    if (loadedItems.length > 0) {
      setItems(normalizeQty(removeRedundantProducts(loadedItems)));
      return;
    }
    // Cita ya guardada sin ítems visibles: no inventar línea a 0 € desde observaciones (p. ej. "cab 3").
    if (appointment.id) {
      setItems([]);
      return;
    }
    setItems(normalizeQty(seedItemsFromAppointment(appointment)));
  }, [itemsLoading, loadedItems, appointment]);

  const articleIdsForItems = useMemo(
    () => items.map((it) => it.article_id).filter(Boolean) as string[],
    [items],
  );

  const { data: itemArticles = [] } = useQuery({
    queryKey: ['edit-appointment-item-articles', companyId, articleIdsForItems.join(',')],
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
        ? resolveRequiredBillingCompanyIds(articleIdsForItems, articlesMap, familyBillingMap, companyId)
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

  const employee = employees.find(e => e.id === formData.employeeId);
  const chargeableTotal = appointmentChargeableTotal(items);
  const { data: appointmentSales = [] } = useAppointmentSales(appointment.id);
  const chargeState = summarizeAppointmentChargeState(appointmentSales, chargeableTotal);
  const chargeCheck = canChargeAppointment({
    status: formData.status,
    chargeableTotal,
    existingSales: appointmentSales,
  });
  const chargedTotal = chargeState.completedTotal;
  const paidLocked =
    isAppointmentFinanciallyClosed(paymentStatus) || chargeState.completedTotal > 0;
  const financiallyClosed = isAppointmentFinanciallyClosed(paymentStatus);
  const saleTicketsLabel = appointmentSales
    .map((s) => s.ticket_number)
    .filter(Boolean)
    .join(' · ') || null;

  const { data: linkedInvoice } = useQuery({
    queryKey: ['appointment-linked-invoice', appointment.id, appointmentSales.map((s) => s.invoice_id).join(',')],
    enabled: appointmentSales.some((s) => s.invoice_id),
    queryFn: async () => {
      const invoiceId = appointmentSales.find((s) => s.invoice_id)?.invoice_id;
      if (!invoiceId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id, number, total_amount')
        .eq('id', invoiceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const recursosCatalog = useMemo(() => toRecursoCatalogEntries(recursos), [recursos]);
  const {
    effectiveCustomerId,
    summaryCustomer,
    isLoading: customerResolveLoading,
  } = useAppointmentEffectiveCustomer({
    companyId,
    appointment,
    customers,
    autoHeal: true,
  });

  const stylePhone = String(
    summaryCustomer?.phone_mobile ||
      summaryCustomer?.phone ||
      summaryCustomer?.phone_home ||
      appointment.clientPhone ||
      '',
  ).trim();
  const showUnlinkedStyleHint =
    Boolean(appointment.legacyClientCode?.trim()) &&
    !effectiveCustomerId &&
    Boolean(companyId) &&
    !customerResolveLoading;
  const computedEndTime = calcEndFromStart(formData.startTime, effectiveDurationMinutes(items));
  const styleFacturado = paymentStatus === 'paid' || paymentStatus === 'invoiced';

  const serviceLabel = useMemo(
    () =>
      items
        .filter((i) => i.kind === 'service')
        .map((i) => i.label.trim())
        .filter(Boolean)
        .join(' · ') || undefined,
    [items],
  );

  const handleOpenQuestionnaire = async () => {
    if (!companyId || !effectiveCustomerId) return;
    try {
      const q = await createQuestionnaire({
        customerId: effectiveCustomerId,
        companyId,
        appointmentId: appointment.id,
      });
      openQuestionnaireKiosk(q.id);
      toast({ title: 'Cuestionario abierto en tablet (modo cliente)' });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : 'Error al abrir cuestionario',
        variant: 'destructive',
      });
    }
  };

  const { data: activeBonos = [] } = useCustomerActiveBonos(effectiveCustomerId);
  const activeVouchersCount = activeBonos.length;

  const { data: pendingDebt = 0 } = useCustomerPendingInvoiceDebt(companyId, effectiveCustomerId);

  const handleItemsChange = (next: AppointmentItemDraft[]) => {
    setItems(next.map((it) => ({ ...it, quantity: 1 })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resourceConflictMessages.length > 0) {
      setShowResourceConflictDialog(true);
      return;
    }
    const clientName = (appointment.clientName || summaryCustomer?.name || '').trim();
    if (!clientName) return;
    const endTime = calcEndFromStart(formData.startTime, effectiveDurationMinutes(items));
    onSave({
      ...appointment,
      ...formData,
      clientName,
      customerId: effectiveCustomerId ?? null,
      endTime,
    }, items.map((it) => ({ ...it, quantity: 1 })));
  };

  return (
    <div className={`${AGENDA_MODAL_SHELL} bg-black/50 ${AGENDA_APPOINTMENT_MODAL_Z}`}>
      <Card className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden">
        <CardHeader className="shrink-0 space-y-2 px-4 pb-2 pt-3">
          <div className="flex items-start gap-2">
            {returnCustomerId && onReturnToCustomerHistory && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1 text-xs"
                onClick={onReturnToCustomerHistory}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Historial
              </Button>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <CardTitle
                  className="text-base shrink-0"
                  title={appointment.legacyIdPlan ? `IDPLAN ${appointment.legacyIdPlan}` : undefined}
                >
                  {appointment.legacyIdPlan ? `Cita · ${appointment.legacyIdPlan}` : 'Cita'}
                </CardTitle>
                <span className="inline-flex h-5 items-center rounded border border-border/70 bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground">
                  Style · dual sync
                </span>
                {styleFacturado ? (
                  <span className="inline-flex h-5 items-center rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                    Facturado Style/TPV
                  </span>
                ) : null}
                {(appointment.legacyClientCode ||
                  appointment.legacyEmployeeCode ||
                  stylePhone) && (
                  <p
                    className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground tabular-nums"
                    title="Códigos Style / dual-sync"
                  >
                    {[
                      appointment.legacyClientCode ? `cli ${appointment.legacyClientCode}` : null,
                      appointment.legacyEmployeeCode ? `emp ${appointment.legacyEmployeeCode}` : null,
                      stylePhone ? `tel ${stylePhone}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="min-w-0">
                  <Label className="text-[10px] text-muted-foreground">Fecha</Label>
                  <Input
                    type="date"
                    aria-label="Fecha"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    disabled={paidLocked || saving}
                    className="h-8 text-xs px-2"
                  />
                </div>
                <div className="min-w-0">
                  <Label className="text-[10px] text-muted-foreground">Inicio</Label>
                  <Input
                    type="time"
                    aria-label="Hora inicio"
                    className="h-8 text-xs px-1.5 tabular-nums"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    disabled={paidLocked || saving}
                  />
                </div>
                <div className="min-w-0">
                  <Label className="text-[10px] text-muted-foreground">Fin (calc.)</Label>
                  <Input
                    type="time"
                    aria-label="Hora fin calculada"
                    title="Fin calculado según servicios"
                    className="h-8 text-xs px-1.5 tabular-nums bg-muted/40"
                    value={computedEndTime}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
                <div className="min-w-0">
                  <Label className="text-[10px] text-muted-foreground">Empleada</Label>
                  <Select
                    value={formData.employeeId}
                    onValueChange={(v) => setFormData({ ...formData, employeeId: v })}
                    disabled={paidLocked || saving}
                  >
                    <SelectTrigger
                      className="h-8 text-xs"
                      title={hasMixedBillingServices ? 'Servicios de distintas empresas en la misma cita' : 'Empleada'}
                    >
                      <SelectValue placeholder="Empleada" />
                    </SelectTrigger>
                    <AppointmentSelectContent>
                      {eligibleEmployees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </AppointmentSelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onCancel} disabled={saving} title="Cerrar y volver a la agenda">
              <X className="w-4 h-4" />
            </Button>
          </div>
          {showUnlinkedStyleHint ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Cliente Style sin ficha en Suite (cód. {appointment.legacyClientCode}). Vincule el
              cliente en Clientes con el mismo código legacy para usar cuestionarios y documentación.
            </p>
          ) : null}
          {appointment.customerId &&
          effectiveCustomerId &&
          appointment.customerId !== effectiveCustomerId ? (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
              Enlace de ficha corregido: se mostraba un Paciente InBody por error. Cliente de la cita:{' '}
              <strong>{appointment.clientName}</strong>.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-0">
          <form onSubmit={handleSubmit} className="space-y-2.5">
            {summaryCustomer && (
              <AppointmentCustomerSummaryBar
                customer={summaryCustomer}
                status={formData.status}
                onStatusChange={(status) => setFormData({ ...formData, status })}
                onOpenFicha={() => { setCustomerHistoryTab('ficha'); setShowCustomerHistory(true); }}
                activeVouchersCount={activeVouchersCount}
                pendingDebt={pendingDebt}
                chargeableTotal={chargeableTotal}
                chargedTotal={chargedTotal}
                saleTicket={saleTicketsLabel}
                invoiceNumber={linkedInvoice?.number ?? null}
                chargeBlockedReason={!chargeCheck.allowed ? chargeCheck.reason : null}
                onOpenVouchers={() => { setCustomerHistoryTab('vouchers'); setShowCustomerHistory(true); }}
                onOpenFacturacion={() => { setCustomerHistoryTab('timeline'); setShowCustomerHistory(true); }}
                onOpenClinicalHistory={canSeeClinicalHistory ? openClinicalHistoryTab : undefined}
                onOpenQuestionnaire={
                  effectiveCustomerId && companyId
                    ? () => { void handleOpenQuestionnaire(); }
                    : undefined
                }
                onOpenDocs={
                  effectiveCustomerId && companyId
                    ? () => setDocPickerOpen(true)
                    : undefined
                }
                lockStatusSelect={paidLocked}
                onViewInvoice={linkedInvoice
                  ? () => navigate(`/facturacion?invoice=${linkedInvoice.id}`)
                  : undefined}
                onCharge={chargeCheck.allowed && onCharge
                  ? () => onCharge({ ...appointment, ...formData }, items)
                  : undefined}
              />
            )}
            {!itemsLoading && loadedItems !== undefined && loadedItems.length === 0 && appointment.id && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                No se han podido cargar los servicios de esta cita. Recarga la página; si persiste,
                contacta con soporte (los ítems pueden existir en base de datos pero no ser visibles por permisos).
              </div>
            )}
            {itemsLoading || loadedItems === undefined ? (
              <Skeleton className="h-28 w-full rounded-md" />
            ) : (
              <AppointmentItemsEditor
                startTime={formData.startTime}
                items={items}
                onChange={handleItemsChange}
                customerId={effectiveCustomerId}
                recursosCatalog={recursosCatalog}
                cabinasCatalog={cabinas}
                appointmentDate={formData.date}
                dayAppointments={dayAppointments}
                excludeAppointmentId={appointment.id}
                compactHeader
                compactSlots
                timeSlotsServicesOnly
                articlePicker="by-family"
                onResourceConflictsChange={setResourceConflictMessages}
                itemsLocked={paidLocked}
              />
            )}

            {paidLocked && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Esta cita está cerrada (cobrada o facturada). No se puede modificar el servicio ni
                borrar el registro. Usa «Cancelar y devolver» para anular tickets no facturados y
                dejar la cita como cancelada; luego puedes crear una cita nueva con los cambios.
                {financiallyClosed && linkedInvoice
                  ? ' Los importes facturados requieren factura rectificativa.'
                  : null}
              </div>
            )}

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

            {effectiveCustomerId && companyId && (
              <AppointmentAttachmentsPanel
                appointmentId={appointment.id}
                customerId={effectiveCustomerId}
                companyId={companyId}
                logDate={formData.date}
                customerLabel={summaryCustomer?.name?.trim() || appointment.clientName || 'Cliente'}
              />
            )}

            <div className="flex justify-between pt-1">
              {paidLocked && onCancelAndRefund ? (
                <PermissionButton
                  resource="agenda"
                  action="delete"
                  type="button"
                  variant="destructive"
                  size="sm"
                  forbiddenLabel="No tienes permiso para cancelar citas."
                  onClick={() => {
                    if (!requirePermissionOrToast('agenda', 'delete', 'No tienes permiso para cancelar citas.')) {
                      return;
                    }
                    onCancelAndRefund(appointment.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Cancelar y devolver
                </PermissionButton>
              ) : (
                <PermissionButton
                  resource="agenda"
                  action="delete"
                  type="button"
                  variant="destructive"
                  size="sm"
                  forbiddenLabel="No tienes permiso para eliminar citas."
                  onClick={() => {
                    if (!requirePermissionOrToast('agenda', 'delete', 'No tienes permiso para eliminar citas.')) return;
                    if (window.confirm('¿Eliminar esta cita? El borrado quedará registrado en el historial de actividad.')) {
                      onDelete(appointment.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                </PermissionButton>
              )}
              <div className="flex gap-2">
                {onNotify && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNotify((v) => !v);
                      if (!notifyMsg) {
                        setNotifyMsg(`Observación para seguimiento de ${appointment.clientName}: `);
                      }
                    }}
                  >
                    Notificar
                  </Button>
                )}
                {onCharge && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={itemsLoading || !chargeCheck.allowed}
                    title={chargeCheck.reason}
                    onClick={() => onCharge({ ...appointment, ...formData }, items)}
                  >
                    {chargeState.allCompleted
                      ? 'Cobrada'
                      : chargeCheck.partial
                        ? 'Cobrar resto en TPV'
                        : 'Cobrar en TPV'}
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={resourceConflictMessages.length > 0 || saving}
                  title={resourceConflictMessages.length > 0 ? 'Hay conflicto de cabina o recurso' : undefined}
                >
                  <Save className="w-4 h-4 mr-1" />{' '}
                  {saving ? 'Guardando…' : paidLocked ? 'Guardar observaciones' : 'Guardar'}
                </Button>
              </div>
            </div>
            {showNotify && onNotify && (
              <div className="rounded-md border bg-muted/30 p-2 space-y-2">
                <Label className="text-xs">Enviar aviso a</Label>
                <Select value={notifyTo} onValueChange={setNotifyTo}>
                  <SelectTrigger><SelectValue placeholder="Selecciona usuario" /></SelectTrigger>
                  <AppointmentSelectContent>
                    {notifyRecipients.map((r) => (
                      <SelectItem key={r.userId} value={r.userId}>{r.label}</SelectItem>
                    ))}
                  </AppointmentSelectContent>
                </Select>
                <Textarea
                  rows={2}
                  value={notifyMsg}
                  onChange={(e) => setNotifyMsg(e.target.value)}
                  placeholder="Escribe la observación para el equipo"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowNotify(false)}>
                    Cerrar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!notifyTo || !notifyMsg.trim()}
                    onClick={async () => {
                      await onNotify(appointment, notifyTo, notifyMsg.trim());
                      setShowNotify(false);
                      setNotifyTo('');
                      setNotifyMsg('');
                    }}
                  >
                    Enviar aviso
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
      <AppointmentResourceConflictDialog
        open={showResourceConflictDialog}
        onOpenChange={setShowResourceConflictDialog}
        messages={resourceConflictMessages}
      />
      <ClienteDetailOverlay
        open={showCustomerHistory && !!effectiveCustomerId}
        customerId={effectiveCustomerId ?? ''}
        initialTab={customerHistoryTab}
        onClose={() => setShowCustomerHistory(false)}
        onAppointmentClick={(appointmentId, dateYmd) => {
          setShowCustomerHistory(false);
          onHistoryAppointmentClick?.(appointmentId, dateYmd);
        }}
      />
      {effectiveCustomerId && companyId && (
        <AppointmentDocumentationDialog
          open={docPickerOpen}
          onOpenChange={setDocPickerOpen}
          companyId={companyId}
          clientName={summaryCustomer?.name?.trim() || appointment.clientName || 'Cliente'}
          serviceLabel={serviceLabel}
          onSelectConsent={(plantillaId) => {
            setDocPickerOpen(false);
            setConsentSignContext({
              customerId: effectiveCustomerId,
              companyId,
              appointmentId: appointment.id,
              tratamiento: serviceLabel,
              profesional: employee?.name,
              profesionalEmpleadoId: formData.employeeId,
              initialPlantillaId: plantillaId,
            });
          }}
          onSelectQuestionnaire={() => {
            setDocPickerOpen(false);
            void handleOpenQuestionnaire();
          }}
          onRegisterSession={(trackingFamily, plantillaCodigo) => {
            setDocPickerOpen(false);
            setSessionContext({ trackingFamily, plantillaCodigo });
          }}
          onSelectFreeConsent={() => {
            setDocPickerOpen(false);
            setConsentSignContext({
              customerId: effectiveCustomerId,
              companyId,
              appointmentId: appointment.id,
              tratamiento: serviceLabel,
              profesional: employee?.name,
              profesionalEmpleadoId: formData.employeeId,
            });
          }}
        />
      )}
      {consentSignContext ? (
        <ConsentimientoSignDialog
          open={!!consentSignContext}
          onOpenChange={(o) => !o && setConsentSignContext(null)}
          context={consentSignContext}
        />
      ) : null}
      {sessionContext && effectiveCustomerId && companyId ? (
        <TreatmentSessionDialog
          open={!!sessionContext}
          onOpenChange={(o) => !o && setSessionContext(null)}
          customerId={effectiveCustomerId}
          companyId={companyId}
          appointmentId={appointment.id}
          appointmentDate={formData.date}
          trackingFamily={sessionContext.trackingFamily}
          tratamiento={serviceLabel ?? 'Tratamiento'}
          plantillaCodigo={sessionContext.plantillaCodigo}
          customerName={summaryCustomer?.name?.trim() || appointment.clientName || 'Cliente'}
          employeeId={formData.employeeId}
        />
      ) : null}
    </div>
  );
};
