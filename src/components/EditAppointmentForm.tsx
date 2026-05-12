import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Save, User, Trash2, DoorOpen, Cpu } from 'lucide-react';
import { AppointmentItemsEditor } from '@/components/AppointmentItemsEditor';
import { useAppointmentItems } from '@/hooks/useAppointmentItems';
import type { AppointmentItemDraft } from '@/types/agenda';
import { calcEndFromStart, effectiveDurationMinutes, minutesBetweenHHmm } from '@/lib/agendaAppointmentItems';
import { appointmentItemsTotal } from '@/lib/agendaAppointmentPricing';
import { AppointmentClientePicker, type AppointmentClientPick } from '@/components/forms/AppointmentClientePicker';
import type { CustomerSearchRow } from '@/lib/customerSearch';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { ClienteDetailView } from '@/components/ClienteDetailView';
import { PermissionButton } from '@/components/PermissionButton';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';

interface Employee { id: string; name: string; color: string; }
interface Appointment {
  id: string;
  employeeId: string;
  clientName: string;
  customerId?: string | null;
  description: string;
  startTime: string;
  endTime: string;
  date: string;
  color: string;
  cabina_id?: string | null;
  recurso_id?: string | null;
  status: 'confirmed' | 'pending' | 'cancelled';
}

interface EditAppointmentFormProps {
  appointment: Appointment;
  employees: Employee[];
  customers: CustomerSearchRow[];
  notifyRecipients?: { userId: string; label: string }[];
  cabinas?: any[];
  recursos?: any[];
  onSave: (appointment: Appointment, items: AppointmentItemDraft[]) => void;
  onCharge?: (appointment: Appointment, items: AppointmentItemDraft[]) => void;
  onNotify?: (appointment: Appointment, recipientUserId: string, message: string) => Promise<void> | void;
  onDelete: (appointmentId: string) => void;
  onCancel: () => void;
}

function initialClientPick(apt: Appointment, custs: CustomerSearchRow[]): AppointmentClientPick | null {
  if (apt.customerId) {
    const c = custs.find((x) => x.id === apt.customerId);
    if (c) return { kind: 'customer', customerId: c.id, displayName: c.name };
    return { kind: 'customer', customerId: apt.customerId, displayName: apt.clientName };
  }
  // Compatibilidad legacy: si no hay customerId, intenta vincular por nombre exacto.
  const byName = custs.find((x) => x.name.trim().toLowerCase() === apt.clientName.trim().toLowerCase());
  if (byName) return { kind: 'customer', customerId: byName.id, displayName: byName.name };
  if (apt.clientName.trim()) return { kind: 'manual', name: apt.clientName };
  return null;
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
  onSave,
  onCharge,
  onNotify,
  onDelete,
  onCancel,
}) => {
  const { companyId } = useCompanyFilter();
  const { requireOrToast: requirePermissionOrToast } = usePermissionGuard();
  const [clientPick, setClientPick] = useState<AppointmentClientPick | null>(() =>
    initialClientPick(appointment, customers)
  );
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [customerHistoryTab, setCustomerHistoryTab] = useState<'timeline' | 'vouchers' | 'ficha' | 'facturacion'>('timeline');

  const [formData, setFormData] = useState({
    description: appointment.description,
    date: appointment.date,
    startTime: appointment.startTime,
    employeeId: appointment.employeeId,
    cabina_id: appointment.cabina_id ?? null,
    recurso_id: appointment.recurso_id ?? null,
    status: appointment.status,
  });

  const { data: loadedItems, isLoading: itemsLoading } = useAppointmentItems(appointment.id);
  const [items, setItems] = useState<AppointmentItemDraft[]>([]);
  const [showNotify, setShowNotify] = useState(false);
  const [notifyTo, setNotifyTo] = useState('');
  const [notifyMsg, setNotifyMsg] = useState('');

  useLayoutEffect(() => {
    setClientPick(initialClientPick(appointment, customers));
  }, [appointment.id]);

  useEffect(() => {
    if (!appointment.customerId || customers.length === 0) return;
    const c = customers.find((x) => x.id === appointment.customerId);
    if (!c) return;
    setClientPick((prev) => {
      if (prev?.kind === 'customer' && prev.customerId === c.id) {
        return { kind: 'customer', customerId: c.id, displayName: c.name };
      }
      if (!prev && appointment.customerId === c.id) {
        return { kind: 'customer', customerId: c.id, displayName: c.name };
      }
      return prev;
    });
  }, [customers, appointment.customerId, appointment.id]);

  useLayoutEffect(() => {
    if (itemsLoading || loadedItems === undefined) return;
    if (loadedItems.length > 0) setItems(removeRedundantProducts(loadedItems));
    else setItems(seedItemsFromAppointment(appointment));
  }, [itemsLoading, loadedItems, appointment]);

  const employee = employees.find(e => e.id === formData.employeeId);
  const total = appointmentItemsTotal(items);
  const selectedCustomerId = clientPick?.kind === 'customer'
    ? clientPick.customerId
    : (appointment.customerId ?? null);

  const { data: selectedCustomer } = useQuery({
    queryKey: ['edit-appointment-customer-summary', selectedCustomerId],
    enabled: !!selectedCustomerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id,name,tax_id,email,phone,phone_mobile,phone_home,notes')
        .eq('id', selectedCustomerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: activeVouchersCount = 0 } = useQuery({
    queryKey: ['edit-appointment-active-vouchers-count', companyId, selectedCustomerId],
    enabled: !!companyId && !!selectedCustomerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_vouchers')
        .select('id,total_sessions,used_sessions,is_active')
        .eq('company_id', companyId)
        .eq('customer_id', selectedCustomerId)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).filter((v: any) => Number(v.total_sessions || 0) > Number(v.used_sessions || 0)).length;
    },
  });

  const { data: pendingDebt = 0 } = useQuery({
    queryKey: ['edit-appointment-customer-debt-summary', companyId, selectedCustomerId],
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
    const endTime = calcEndFromStart(formData.startTime, effectiveDurationMinutes(items));
    onSave({
      ...appointment,
      ...formData,
      clientName: clientName.trim(),
      customerId: clientPick.kind === 'customer' ? clientPick.customerId : null,
      endTime,
    }, items);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 px-4 pt-3 pb-24 sm:p-4">
      <Card className="w-full max-w-lg max-h-[calc(100dvh-7rem)] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <CardTitle className="text-base flex items-center gap-2 shrink-0 pt-1">
              <User className="w-4 h-4" /> Editar Cita
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
              <div className="rounded-md border bg-muted/30 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground truncate">
                    {[selectedCustomer.tax_id, selectedCustomer.phone_mobile || selectedCustomer.phone || selectedCustomer.phone_home, selectedCustomer.email]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => setShowCustomerHistory(true)}>
                      Ficha
                    </Button>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as Appointment['status'] })}>
                      <SelectTrigger className="h-6 text-[11px] px-2 min-w-[104px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmada</SelectItem>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-3 mt-1">
                  <button type="button" className="hover:underline" onClick={() => { setCustomerHistoryTab('vouchers'); setShowCustomerHistory(true); }}>
                    Bonos activos: <strong>{activeVouchersCount}</strong>
                  </button>
                  <button
                    type="button"
                    className="hover:underline text-primary"
                    onClick={() => { setCustomerHistoryTab('vouchers'); setShowCustomerHistory(true); }}
                  >
                    Crear/editar bono
                  </button>
                  <button type="button" className="hover:underline" onClick={() => { setCustomerHistoryTab('facturacion'); setShowCustomerHistory(true); }}>
                    Deuda: <strong>{pendingDebt.toFixed(2)} EUR</strong>
                  </button>
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => onCharge?.({ ...appointment, ...formData }, items)}
                  >
                    Total cita: <strong>{total.toFixed(2)} EUR</strong>
                  </button>
                </div>
              </div>
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
                <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {itemsLoading || loadedItems === undefined ? (
              <Skeleton className="h-28 w-full rounded-md" />
            ) : (
              <AppointmentItemsEditor
                startTime={formData.startTime}
                items={items}
                onChange={setItems}
                customerId={clientPick?.kind === 'customer' ? clientPick.customerId : null}
                compactHeader
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              {cabinas.length > 0 && (
                <div>
                  <Label className="text-xs flex items-center gap-1"><DoorOpen className="w-3 h-3" /> Cabina</Label>
                  <Select value={formData.cabina_id || 'none'} onValueChange={(v) => setFormData({ ...formData, cabina_id: v === 'none' ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {cabinas.filter((c: { activa?: boolean }) => c.activa).map((c: { id: string; nombre: string }) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {recursos.length > 0 && (
                <div>
                  <Label className="text-xs flex items-center gap-1"><Cpu className="w-3 h-3" /> Recurso</Label>
                  <Select value={formData.recurso_id || 'none'} onValueChange={(v) => setFormData({ ...formData, recurso_id: v === 'none' ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {recursos.filter((r: { activo?: boolean }) => r.activo).map((r: { id: string; nombre: string }) => (
                        <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Observaciones</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notas rápidas de la cita"
              />
            </div>

            <div className="flex justify-between pt-2">
              <PermissionButton
                resource="agenda"
                action="delete"
                type="button"
                variant="destructive"
                size="sm"
                forbiddenLabel="No tienes permiso para eliminar citas."
                onClick={() => {
                  if (!requirePermissionOrToast('agenda', 'delete', 'No tienes permiso para eliminar citas.')) return;
                  if (window.confirm('¿Eliminar esta cita?')) onDelete(appointment.id);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </PermissionButton>
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
                    disabled={itemsLoading}
                    onClick={() => onCharge({ ...appointment, ...formData }, items)}
                  >
                    Cobrar
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={!clientPick}><Save className="w-4 h-4 mr-1" /> Guardar</Button>
              </div>
            </div>
            {showNotify && onNotify && (
              <div className="rounded-md border bg-muted/30 p-2 space-y-2">
                <Label className="text-xs">Enviar aviso a</Label>
                <Select value={notifyTo} onValueChange={setNotifyTo}>
                  <SelectTrigger><SelectValue placeholder="Selecciona usuario" /></SelectTrigger>
                  <SelectContent>
                    {notifyRecipients.map((r) => (
                      <SelectItem key={r.userId} value={r.userId}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
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
      {showCustomerHistory && selectedCustomerId && (
        <div className="fixed inset-0 bg-background z-[70] overflow-auto p-4">
          <ClienteDetailView
            customerId={selectedCustomerId}
            initialTab={customerHistoryTab}
            onBack={() => setShowCustomerHistory(false)}
          />
        </div>
      )}
    </div>
  );
};
