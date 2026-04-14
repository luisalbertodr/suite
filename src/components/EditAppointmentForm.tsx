import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, User, Clock, Trash2, CheckCircle, Clock as ClockIcon, XCircle, DoorOpen, Cpu } from 'lucide-react';

interface Employee { id: string; name: string; color: string; }
interface Appointment {
  id: string; employeeId: string; clientName: string; description: string;
  startTime: string; endTime: string; date: string; color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

interface EditAppointmentFormProps {
  appointment: Appointment;
  employees: Employee[];
  cabinas?: any[];
  recursos?: any[];
  onSave: (appointment: Appointment) => void;
  onDelete: (appointmentId: string) => void;
  onCancel: () => void;
}

export const EditAppointmentForm: React.FC<EditAppointmentFormProps> = ({
  appointment, employees, cabinas = [], recursos = [], onSave, onDelete, onCancel
}) => {
  const [formData, setFormData] = useState({
    clientName: appointment.clientName,
    description: appointment.description,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    employeeId: appointment.employeeId,
    status: appointment.status,
  });

  const employee = employees.find(e => e.id === formData.employeeId);

  function calcEnd(start: string, mins: number): string {
    const [h, m] = start.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName.trim()) return;
    onSave({ ...appointment, ...formData });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
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
                <Label className="text-xs">Hora inicio</Label>
                <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value, endTime: calcEnd(e.target.value, 30) })} />
              </div>
              <div>
                <Label className="text-xs">Duración</Label>
                <Select defaultValue="30" onValueChange={(v) => setFormData({ ...formData, endTime: calcEnd(formData.startTime, parseInt(v)) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1.5 h</SelectItem>
                    <SelectItem value="120">2 h</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
