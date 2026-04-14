import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, User, Clock, DoorOpen, Cpu } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  color: string;
}

interface AppointmentFormProps {
  employeeId: string;
  time: string;
  employees: Employee[];
  cabinas?: any[];
  recursos?: any[];
  onSave: (appointment: any) => void;
  onCancel: () => void;
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({
  employeeId, time, employees, cabinas = [], recursos = [], onSave, onCancel
}) => {
  const [formData, setFormData] = useState({
    clientName: '',
    description: '',
    startTime: time,
    endTime: calcEnd(time, 30),
    status: 'confirmed' as const,
    cabina_id: null as string | null,
    recurso_id: null as string | null,
  });

  const employee = employees.find(e => e.id === employeeId);

  function calcEnd(start: string, mins: number): string {
    const [h, m] = start.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName.trim()) return;
    onSave({
      employeeId,
      clientName: formData.clientName,
      description: formData.description,
      startTime: formData.startTime,
      endTime: formData.endTime,
      color: employee?.color || '',
      status: formData.status,
      cabina_id: formData.cabina_id,
      recurso_id: formData.recurso_id,
      date: '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" /> Nueva Cita
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3" /> {employee?.name} · {time}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs">Cliente *</Label>
              <Input value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} placeholder="Nombre del cliente" required />
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Tratamiento o notas" />
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

            {/* Cabina & Recurso */}
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
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1 gap-1"><Save className="w-4 h-4" /> Guardar</Button>
              <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
