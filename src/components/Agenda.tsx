import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
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
import { useAgendaPreferences } from '@/hooks/useAgendaPreferences';
import { appointmentItemsQueryKey, syncAppointmentItems } from '@/hooks/useAppointmentItems';
import type { AppointmentItemDraft } from '@/types/agenda';

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
  serviceCode?: string;
  serviceName?: string;
  legacyEmployeeCode?: string;
  legacyClientCode?: string;
  legacyPlanincId?: number | null;
  legacyHourInText?: string;
  cabina_id?: string | null;
  recurso_id?: string | null;
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
  date: string;
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  cabina_id?: string | null;
  recurso_id?: string | null;
  items?: AppointmentItemDraft[];
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
  const queryClient = useQueryClient();

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
  const { preferences, isLoading: prefsLoading } = useAgendaPreferences();
  const appointmentIds = useMemo(() => dbAppointments.map((a) => a.id), [dbAppointments]);
  const { data: appointmentResources = {} } = useQuery({
    queryKey: ['appointment-resources', appointmentIds.join('|')],
    enabled: appointmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_resources')
        .select('appointment_id,cabina_id,recurso_id')
        .in('appointment_id', appointmentIds);
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') return {};
        throw error;
      }
      const out: Record<string, { cabina_id: string | null; recurso_id: string | null }> = {};
      for (const row of data || []) {
        out[row.appointment_id] = { cabina_id: row.cabina_id, recurso_id: row.recurso_id };
      }
      return out;
    },
  });

  // Map DB employees to grid employees with proper colors
  const employees: Employee[] = dbEmployees.map((emp, idx) => ({
    id: emp.id,
    name: emp.name,
    color: hexToTailwindBg(emp.color || '#3B82F6', idx),
  }));

  const parseServiceFromDescription = (
    description: string
  ): { code: string; service: string; hourInText: string } => {
    // Legacy sample: "[16:00] 214 - ZONA L..."
    const match = description.match(/\[(\d{1,2}:\d{2})\]\s*([^\s-]+)\s*-\s*(.+)$/);
    if (!match) return { code: '', service: '', hourInText: '' };
    return {
      hourInText: match[1]?.trim() || '',
      code: match[2]?.trim() || '',
      service: match[3]?.trim() || '',
    };
  };

  const normalizeTime = (value?: string | null): string => {
    if (!value) return '';
    const str = String(value);
    if (str.includes('T')) {
      const part = str.split('T')[1] || '';
      const hh = part.substring(0, 2);
      const mm = part.substring(3, 5);
      if (/^\d{2}$/.test(hh) && /^\d{2}$/.test(mm)) return `${hh}:${mm}`;
    }
    const m = str.match(/^(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    return str.substring(0, 5);
  };

  const normalizeDate = (start?: string | null, legacyDate?: string | null): string => {
    if (start && String(start).includes('T')) return String(start).split('T')[0];
    return legacyDate ? String(legacyDate) : format(selectedDate, 'yyyy-MM-dd');
  };

  // Map appointments (schema moderno + legado)
  const appointments: Appointment[] = dbAppointments.map((apt) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = apt;
    const description = row.description || '';
    const parsedService = parseServiceFromDescription(description);
    const clientName = row.client_name || row.title || '';
    return {
      id: row.id,
      employeeId: row.employee_id || '',
      clientName,
      description,
      serviceCode: parsedService.code,
      serviceName: parsedService.service,
      legacyEmployeeCode: row.legacy_codemp || undefined,
      legacyClientCode: row.legacy_codcli || undefined,
      legacyPlanincId: row.legacy_planinc_id ?? null,
      legacyHourInText: parsedService.hourInText || undefined,
      cabina_id: appointmentResources[row.id]?.cabina_id ?? row.cabina_id ?? null,
      recurso_id: appointmentResources[row.id]?.recurso_id ?? row.recurso_id ?? null,
      startTime: normalizeTime(row.start_time),
      endTime: normalizeTime(row.end_time),
      date: normalizeDate(row.start_time, row.appointment_date),
      color: row.color || '#3B82F6',
      status: (['confirmed', 'pending', 'cancelled'].includes(row.status) ? row.status : 'pending') as any,
    };
  });

  const effectiveSelectedIds = preferences.visibleEmployeeIds.length
    ? preferences.visibleEmployeeIds
    : employees.map((e) => e.id);
  const filteredEmployees = employees.filter((e) => effectiveSelectedIds.includes(e.id));
  const filteredAppointments = appointments.filter((apt) => effectiveSelectedIds.includes(apt.employeeId));

  // Allow overlaps on same employee, but not on same cabina/recurso.
  const checkResourceConflict = (
    date: string,
    startTime: string,
    endTime: string,
    cabinaId?: string | null,
    recursoId?: string | null,
    excludeId?: string
  ): boolean => {
    if (!cabinaId && !recursoId) return false;
    return appointments.some((apt) => {
      if (apt.id === excludeId) return false;
      if (apt.date !== date) return false;
      const overlaps =
        (startTime >= apt.startTime && startTime < apt.endTime) ||
        (endTime > apt.startTime && endTime <= apt.endTime) ||
        (startTime <= apt.startTime && endTime >= apt.endTime);
      if (!overlaps) return false;
      const sameCabina = !!cabinaId && apt.cabina_id === cabinaId;
      const sameRecurso = !!recursoId && apt.recurso_id === recursoId;
      return sameCabina || sameRecurso;
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

      if (checkResourceConflict(format(selectedDate, 'yyyy-MM-dd'), newTime, newEndTime, appointment.cabina_id, appointment.recurso_id, appointmentId)) {
        toast({ title: 'Conflicto de recurso/cabina', description: 'Ese recurso o cabina ya está ocupado en ese tramo.', variant: 'destructive' });
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
      try {
        if (appointment.cabina_id || appointment.recurso_id) {
          await supabase.from('appointment_resources').upsert({
            appointment_id: appointmentId,
            cabina_id: appointment.cabina_id || null,
            recurso_id: appointment.recurso_id || null,
          }, { onConflict: 'appointment_id' });
        }
      } catch {
        // noop for environments without appointment_resources
      }

      toast({ title: 'Cita movida' });
    } catch {
      toast({ title: 'Error al mover cita', variant: 'destructive' });
    }
  };

  const handleAppointmentSave = async (data: CreateAppointmentData) => {
    try {
      const dateStr = data.date || format(selectedDate, 'yyyy-MM-dd');
      const items = data.items ?? [];

      if (checkResourceConflict(dateStr, data.startTime, data.endTime, data.cabina_id, data.recurso_id)) {
        toast({ title: 'Conflicto de recurso/cabina', description: 'Ese recurso o cabina ya está ocupado en ese tramo.', variant: 'destructive' });
        return;
      }

      const created = await createAppointment.mutateAsync({
        employee_id: data.employeeId,
        title: data.clientName,
        description: data.description,
        start_time: `${dateStr}T${data.startTime}:00`,
        end_time: `${dateStr}T${data.endTime}:00`,
        color: data.color,
        status: data.status,
      });
      try {
        if (data.cabina_id || data.recurso_id) {
          await supabase.from('appointment_resources').upsert({
            appointment_id: created.id,
            cabina_id: data.cabina_id || null,
            recurso_id: data.recurso_id || null,
          }, { onConflict: 'appointment_id' });
        }
      } catch {
        // noop for environments without appointment_resources
      }

      try {
        await syncAppointmentItems(created.id, items);
        await queryClient.invalidateQueries({ queryKey: appointmentItemsQueryKey(created.id) });
      } catch (e) {
        console.error('appointment_items sync', e);
      }

      setShowAppointmentForm(false);
      setSelectedSlot(null);
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  const handleAppointmentUpdate = async (updated: Appointment, items: AppointmentItemDraft[]) => {
    try {
      if (checkResourceConflict(updated.date, updated.startTime, updated.endTime, updated.cabina_id, updated.recurso_id, updated.id)) {
        toast({ title: 'Conflicto de recurso/cabina', description: 'Ese recurso o cabina ya está ocupado en ese tramo.', variant: 'destructive' });
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
      try {
        if (updated.cabina_id || updated.recurso_id) {
          await supabase.from('appointment_resources').upsert({
            appointment_id: updated.id,
            cabina_id: updated.cabina_id || null,
            recurso_id: updated.recurso_id || null,
          }, { onConflict: 'appointment_id' });
        } else {
          await supabase.from('appointment_resources').delete().eq('appointment_id', updated.id);
        }
      } catch {
        // noop for environments without appointment_resources
      }

      try {
        await syncAppointmentItems(updated.id, items);
        await queryClient.invalidateQueries({ queryKey: appointmentItemsQueryKey(updated.id) });
      } catch (e) {
        console.error('appointment_items sync', e);
      }

      setShowEditForm(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const handleAppointmentDelete = async (appointmentId: string) => {
    try {
      await deleteAppointment.mutateAsync(appointmentId);
      try {
        await supabase.from('appointment_resources').delete().eq('appointment_id', appointmentId);
      } catch {
        // noop for environments without appointment_resources
      }
      setShowEditForm(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  if (employeesLoading || appointmentsLoading || prefsLoading) {
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
            {filteredEmployees.length} de {employees.length} empleada{employees.length !== 1 ? 's' : ''} visibles · Configurable en Configuración → Agenda
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
        {filteredEmployees.map((emp) => (
          <div key={emp.id} className="flex items-center gap-1.5 flex-shrink-0">
            <div className={`w-3 h-3 rounded-full border ${emp.color}`} />
            <span className="text-xs font-medium text-foreground">{emp.name}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <AgendaGrid
          employees={filteredEmployees}
          appointments={filteredAppointments}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentMove={handleAppointmentMove}
          visibleFields={preferences.visibleFields}
          slotMinutes={preferences.slotMinutes}
          cellHeight={preferences.cellHeight}
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
