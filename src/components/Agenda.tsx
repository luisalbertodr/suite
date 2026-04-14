import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, ChevronLeft, ChevronRight, Plus, AlertCircle } from 'lucide-react';
import { AgendaGrid } from './AgendaGrid';
import { AppointmentForm } from './AppointmentForm';
import { EditAppointmentForm } from './EditAppointmentForm';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { useAgendaAppointments } from '@/hooks/useAgendaAppointments';
import { useCabinas, useRecursos } from '@/hooks/useRecursosCabinas';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface Employee {
  id: string;
  name: string;
  color: string;
}

interface Appointment {
  id: string;
  employeeId: string;
  clientName: string;
  description: string;
  startTime: string;
  endTime: string;
  date: string;
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

type CreateAppointmentData = {
  employeeId: string;
  clientName: string;
  description: string;
  startTime: string;
  endTime: string;
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  cabina_id?: string | null;
  recurso_id?: string | null;
};

// Generate a Tailwind bg class from a hex color
const hexToTailwindBg = (hex: string, index: number): string => {
  const fallbacks = [
    'bg-sky-100 border-sky-300',
    'bg-violet-100 border-violet-300',
    'bg-emerald-100 border-emerald-300',
    'bg-amber-100 border-amber-300',
    'bg-rose-100 border-rose-300',
    'bg-indigo-100 border-indigo-300',
    'bg-teal-100 border-teal-300',
    'bg-orange-100 border-orange-300',
  ];
  return fallbacks[index % fallbacks.length];
};

export const Agenda: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ employeeId: string; time: string } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const { toast } = useToast();

  const { employees: dbEmployees, isLoading: employeesLoading } = useAgendaEmployees();
  const {
    appointments: dbAppointments,
    isLoading: appointmentsLoading,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  } = useAgendaAppointments(format(selectedDate, 'yyyy-MM-dd'));

  const { cabinas } = useCabinas();
  const { recursos } = useRecursos();

  // Map DB employees to grid employees with proper colors
  const employees: Employee[] = dbEmployees.map((emp, idx) => ({
    id: emp.id,
    name: emp.name,
    color: hexToTailwindBg(emp.color || '#3B82F6', idx),
  }));

  // Map appointments
  const appointments: Appointment[] = dbAppointments.map((apt) => ({
    id: apt.id,
    employeeId: apt.employee_id || '',
    clientName: apt.title || '',
    description: apt.description || '',
    startTime: apt.start_time ? apt.start_time.split('T')[1]?.substring(0, 5) || '' : '',
    endTime: apt.end_time ? apt.end_time.split('T')[1]?.substring(0, 5) || '' : '',
    date: apt.start_time ? apt.start_time.split('T')[0] : '',
    color: apt.color || '#3B82F6',
    status: (['confirmed', 'pending', 'cancelled'].includes(apt.status) ? apt.status : 'pending') as any,
  }));

  // Overlap check helper
  const checkOverlap = (employeeId: string, startTime: string, endTime: string, excludeId?: string): boolean => {
    return appointments.some((apt) => {
      if (apt.id === excludeId) return false;
      if (apt.employeeId !== employeeId) return false;
      return (
        (startTime >= apt.startTime && startTime < apt.endTime) ||
        (endTime > apt.startTime && endTime <= apt.endTime) ||
        (startTime <= apt.startTime && endTime >= apt.endTime)
      );
    });
  };

  const handleSlotClick = (employeeId: string, time: string) => {
    setSelectedSlot({ employeeId, time });
    setShowAppointmentForm(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowEditForm(true);
  };

  const handleAppointmentMove = async (appointmentId: string, newEmployeeId: string, newTime: string) => {
    try {
      const appointment = appointments.find((apt) => apt.id === appointmentId);
      if (!appointment) return;

      const [startH, startM] = appointment.startTime.split(':').map(Number);
      const [endH, endM] = appointment.endTime.split(':').map(Number);
      const duration = (endH * 60 + endM) - (startH * 60 + startM);

      const [newH, newM] = newTime.split(':').map(Number);
      const newEndMin = newH * 60 + newM + duration;
      const newEndTime = `${Math.floor(newEndMin / 60).toString().padStart(2, '0')}:${(newEndMin % 60).toString().padStart(2, '0')}`;

      if (checkOverlap(newEmployeeId, newTime, newEndTime, appointmentId)) {
        toast({ title: 'Conflicto de horario', description: 'Ya existe una cita en ese horario.', variant: 'destructive' });
        return;
      }

      await updateAppointment.mutateAsync({
        id: appointmentId,
        employee_id: newEmployeeId,
        title: appointment.clientName,
        description: appointment.description,
        start_time: `${format(selectedDate, 'yyyy-MM-dd')}T${newTime}:00`,
        end_time: `${format(selectedDate, 'yyyy-MM-dd')}T${newEndTime}:00`,
        color: appointment.color,
        status: appointment.status,
      });

      toast({ title: 'Cita movida' });
    } catch {
      toast({ title: 'Error al mover cita', variant: 'destructive' });
    }
  };

  const handleAppointmentSave = async (data: CreateAppointmentData) => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Calculate end time for overlap check
      if (checkOverlap(data.employeeId, data.startTime, data.endTime)) {
        toast({ title: 'Conflicto de horario', description: 'Ya existe una cita en ese horario para esta empleada.', variant: 'destructive' });
        return;
      }

      await createAppointment.mutateAsync({
        employee_id: data.employeeId,
        title: data.clientName,
        description: data.description,
        start_time: `${dateStr}T${data.startTime}:00`,
        end_time: `${dateStr}T${data.endTime}:00`,
        color: data.color,
        status: data.status,
      });

      setShowAppointmentForm(false);
      setSelectedSlot(null);
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  const handleAppointmentUpdate = async (updated: Appointment) => {
    try {
      if (checkOverlap(updated.employeeId, updated.startTime, updated.endTime, updated.id)) {
        toast({ title: 'Conflicto de horario', description: 'Ya existe una cita en ese horario.', variant: 'destructive' });
        return;
      }

      await updateAppointment.mutateAsync({
        id: updated.id,
        employee_id: updated.employeeId,
        title: updated.clientName,
        description: updated.description,
        start_time: `${updated.date}T${updated.startTime}:00`,
        end_time: `${updated.date}T${updated.endTime}:00`,
        color: updated.color,
        status: updated.status,
      });

      setShowEditForm(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const handleAppointmentDelete = async (appointmentId: string) => {
    try {
      await deleteAppointment.mutateAsync(appointmentId);
      setShowEditForm(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  if (employeesLoading || appointmentsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!employees.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Sin empleados configurados</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configura empleados en Configuración → Agenda para ver la agenda.
        </p>
      </div>
    );
  }

  // Dynamic grid columns based on employee count
  const gridCols = employees.length + 1; // +1 for time column

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-500" />
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {employees.length} empleada{employees.length !== 1 ? 's' : ''} · Arrastra para mover citas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-3 py-1 text-sm font-medium min-w-[160px] text-center capitalize">
              {format(selectedDate, 'EEEE, d MMM yyyy', { locale: es })}
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
            <Clock className="w-4 h-4 mr-1" /> Hoy
          </Button>
        </div>
      </div>

      {/* Employee legend */}
      <div className="flex items-center gap-4 overflow-x-auto pb-3 mb-2">
        {employees.map((emp) => (
          <div key={emp.id} className="flex items-center gap-1.5 flex-shrink-0">
            <div className={`w-3 h-3 rounded-full border ${emp.color}`} />
            <span className="text-xs font-medium text-foreground">{emp.name}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <AgendaGrid
          employees={employees}
          appointments={appointments}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentMove={handleAppointmentMove}
        />
      </div>

      {/* Create form */}
      {showAppointmentForm && selectedSlot && (
        <AppointmentForm
          employeeId={selectedSlot.employeeId}
          time={selectedSlot.time}
          employees={employees}
          cabinas={cabinas.data || []}
          recursos={recursos.data || []}
          onSave={handleAppointmentSave}
          onCancel={() => { setShowAppointmentForm(false); setSelectedSlot(null); }}
        />
      )}

      {/* Edit form */}
      {showEditForm && selectedAppointment && (
        <EditAppointmentForm
          appointment={selectedAppointment}
          employees={employees}
          cabinas={cabinas.data || []}
          recursos={recursos.data || []}
          onSave={handleAppointmentUpdate}
          onDelete={handleAppointmentDelete}
          onCancel={() => { setShowEditForm(false); setSelectedAppointment(null); }}
        />
      )}
    </div>
  );
};
