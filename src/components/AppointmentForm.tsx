import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, User, DoorOpen, Cpu } from 'lucide-react';
import { format } from 'date-fns';
import { AppointmentItemsEditor } from '@/components/AppointmentItemsEditor';
import type { AppointmentItemDraft } from '@/types/agenda';
import { calcEndFromStart, effectiveDurationMinutes } from '@/lib/agendaAppointmentItems';
import { appointmentItemLineTotal, appointmentItemsTotal } from '@/lib/agendaAppointmentPricing';
import { AppointmentClientePicker, type AppointmentClientPick } from '@/components/forms/AppointmentClientePicker';
import type { CustomerSearchRow } from '@/lib/customerSearch';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { ClienteDetailView } from '@/components/ClienteDetailView';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  name: string;
  color: string;
}

interface AppointmentFormProps {
  employeeId: string;
  time: string;
  employees: Employee[];
  customers: CustomerSearchRow[];
  cabinas?: any[];
  recursos?: any[];
  onSave: (appointment: any) => void;
  onCancel: () => void;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({
  employeeId, time, employees, customers, cabinas = [], recursos = [], onSave, onCancel
}) => {
  const navigate = useNavigate();
  const { companyId } = useCompanyFilter();
  const [clientPick, setClientPick] = useState<AppointmentClientPick | null>(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [customerHistoryTab, setCustomerHistoryTab] = useState<'timeline' | 'vouchers' | 'ficha' | 'facturacion'>('timeline');

  const [formData, setFormData] = useState({
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    employeeId,
    startTime: time,
    status: 'confirmed' as const,
    cabina_id: null as string | null,
    recurso_id: null as string | null,
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

  const employee = employees.find(e => e.id === employeeId);
  const total = appointmentItemsTotal(items);
  const selectedCustomerId = clientPick?.kind === 'customer' ? clientPick.customerId : null;
  const computedEndTime = calcEndFromStart(formData.startTime, effectiveDurationMinutes(items));

  const openTpvWithCurrentItems = () => {
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
        .select('id,name,tax_id,email,phone,phone_mobile,phone_home,notes')
        .eq('id', selectedCustomerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: activeVouchersCount = 0 } = useQuery({
    queryKey: ['appointment-customer-active-vouchers-count', companyId, selectedCustomerId],
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

    const selectedEmployee = employees.find(e => e.id === formData.employeeId);
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
      cabina_id: formData.cabina_id,
      recurso_id: formData.recurso_id,
      items,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 px-4 pt-3 pb-24 sm:p-4">
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
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as 'confirmed' | 'pending' | 'cancelled' })}>
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
                  <button type="button" className="hover:underline" onClick={openTpvWithCurrentItems}>
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

            <AppointmentItemsEditor
              startTime={formData.startTime}
              items={items}
              onChange={setItems}
              customerId={clientPick?.kind === 'customer' ? clientPick.customerId : null}
              compactHeader
            />

            {/* Cabina & Recurso */}
            <div className="grid grid-cols-2 gap-3">
              {cabinas.length > 0 && (
                <div>
                  <Label className="text-xs flex items-center gap-1"><DoorOpen className="w-3 h-3" /> Cabina</Label>
                  <Select value={formData.cabina_id || 'none'} onValueChange={(v) => setFormData({ ...formData, cabina_id: v === 'none' ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {cabinas.filter((c: any) => c.activa).map((c: any) => (
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
                      {recursos.filter((r: any) => r.activo).map((r: any) => (
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

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1 gap-1" disabled={!clientPick}>
                <Save className="w-4 h-4" /> Guardar
              </Button>
            </div>
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
