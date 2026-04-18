import React, { useLayoutEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Save, User, Clock, Trash2, CheckCircle, Clock as ClockIcon, XCircle, DoorOpen, Cpu } from 'lucide-react';
import { AppointmentItemsEditor } from '@/components/AppointmentItemsEditor';
import { useAppointmentItems } from '@/hooks/useAppointmentItems';
import type { AppointmentItemDraft } from '@/types/agenda';
import { calcEndFromStart, effectiveDurationMinutes, minutesBetweenHHmm } from '@/lib/agendaAppointmentItems';

interface Employee { id: string; name: string; color: string; }
interface Appointment {
  id: string; employeeId: string; clientName: string; description: string;
  startTime: string; endTime: string; date: string; color: string;
  cabina_id?: string | null;
  recurso_id?: string | null;
  status: 'confirmed' | 'pending' | 'cancelled';
}

interface EditAppointmentFormProps {
  appointment: Appointment;
  employees: Employee[];
  cabinas?: any[];
  recursos?: any[];
  onSave: (appointment: Appointment, items: AppointmentItemDraft[]) => void;
  onDelete: (appointmentId: string) => void;
  onCancel: () => void;
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
    },
  ];
}

export const EditAppointmentForm: React.FC<EditAppointmentFormProps> = ({
  appointment, employees, cabinas = [], recursos = [], onSave, onDelete, onCancel
}) => {
  const [formData, setFormData] = useState({
    clientName: appointment.clientName,
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

  useLayoutEffect(() => {
    if (itemsLoading || loadedItems === undefined) return;
    if (loadedItems.length > 0) setItems(loadedItems);
    else setItems(seedItemsFromAppointment(appointment));
  }, [itemsLoading, loadedItems, appointment]);

  const employee = employees.find(e => e.id === formData.employeeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName.trim()) return;
    const endTime = calcEndFromStart(formData.startTime, effectiveDurationMinutes(items));
    onSave({ ...appointment, ...formData, endTime }, items);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" /> Editar Cita
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3" /> {employee?.name} · {appointment.startTime}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs">Cliente *</Label>
              <Input value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>

            {/* Employee selector */}
            <div>
              <Label className="text-xs">Empleada</Label>
              <Select value={formData.employeeId} onValueChange={(v) => setFormData({ ...formData, employeeId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            {itemsLoading || loadedItems === undefined ? (
              <Skeleton className="h-28 w-full rounded-md" />
            ) : (
              <AppointmentItemsEditor startTime={formData.startTime} items={items} onChange={setItems} />
            )}

            <div className="grid grid-cols-2 gap-3">
              {cabinas.length > 0 && (
                <div>
                  <Label className="text-xs flex items-center gap-1"><DoorOpen className="w-3 h-3" /> Cabina</Label>
                  <Select value={formData.cabina_id || 'none'} onValueChange={(v) => setFormData({ ...formData, cabina_id: v === 'none' ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {cabinas.filter(c => c.activa).map(c => (
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
                      {recursos.filter(r => r.activo).map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Confirmada</span>
                  </SelectItem>
                  <SelectItem value="pending">
                    <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3 text-yellow-600" /> Pendiente</span>
                  </SelectItem>
                  <SelectItem value="cancelled">
                    <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-600" /> Cancelada</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="destructive" size="sm" onClick={() => {
                if (window.confirm('¿Eliminar esta cita?')) onDelete(appointment.id);
              }}>
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" size="sm"><Save className="w-4 h-4 mr-1" /> Guardar</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
