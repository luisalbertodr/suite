
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Plus, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { AgendaGrid } from './AgendaGrid';
import { AppointmentForm } from './AppointmentForm';
import { EditAppointmentForm } from './EditAppointmentForm';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { useAgendaAppointments } from '@/hooks/useAgendaAppointments';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// Mapear los tipos de datos para compatibilidad
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

// Type for appointment creation without company_id
type CreateAppointmentData = {
  employeeId: string;
  clientName: string;
  description: string;
  startTime: string;
  endTime: string;
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
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
    deleteAppointment
  } = useAgendaAppointments(format(selectedDate, 'yyyy-MM-dd'));

  // Función para obtener colores por defecto
  const getDefaultColor = (index: number): string => {
    const colors = [
      'bg-blue-100 border-blue-300',
      'bg-green-100 border-green-300',
      'bg-purple-100 border-purple-300',
      'bg-yellow-100 border-yellow-300',
      'bg-pink-100 border-pink-300',
      'bg-indigo-100 border-indigo-300'
    ];
    return colors[index] || 'bg-gray-100 border-gray-300';
  };

  // Crear empleados fijos para mostrar en la agenda - usar identificadores fijos
  const employees: Employee[] = Array.from({ length: 6 }, (_, index) => {
    const employeeId = `empleado${index + 1}`;
    return {
      id: employeeId,
      name: `Empleado${index + 1}`,
      color: getDefaultColor(index)
    };
  });

  // Mapear citas desde la base de datos
  const appointments: Appointment[] = dbAppointments.map(apt => ({
    id: apt.id,
    employeeId: apt.employee_id,
    clientName: apt.client_name,
    description: apt.description || '',
    startTime: apt.start_time,
    endTime: apt.end_time,
    date: apt.appointment_date,
    color: apt.color,
    status: apt.status
  }));

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
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) return;

      // Calcular la duración de la cita
      const [startHour, startMin] = appointment.startTime.split(':').map(Number);
      const [endHour, endMin] = appointment.endTime.split(':').map(Number);
      const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

      // Calcular la nueva hora de fin
      const [newStartHour, newStartMin] = newTime.split(':').map(Number);
      const newEndMinutes = (newStartHour * 60 + newStartMin) + durationMinutes;
      const newEndHour = Math.floor(newEndMinutes / 60);
      const newEndMin = newEndMinutes % 60;
      const newEndTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMin.toString().padStart(2, '0')}`;

      // Verificar que no haya conflictos en el nuevo horario
      const hasConflict = appointments.some(apt => 
        apt.id !== appointmentId &&
        apt.employeeId === newEmployeeId &&
        apt.date === appointment.date &&
        ((newTime >= apt.startTime && newTime < apt.endTime) ||
         (newEndTime > apt.startTime && newEndTime <= apt.endTime) ||
         (newTime <= apt.startTime && newEndTime >= apt.endTime))
      );

      if (hasConflict) {
        toast({
          title: 'Conflicto de horario',
          description: 'Ya existe una cita en ese horario para el empleado seleccionado.',
          variant: 'destructive',
        });
        return;
      }

      await updateAppointment.mutateAsync({
        id: appointmentId,
        employee_id: newEmployeeId,
        client_name: appointment.clientName,
        description: appointment.description,
        start_time: newTime,
        end_time: newEndTime,
        color: appointment.color,
        status: appointment.status
      });

      toast({
        title: 'Cita movida',
        description: 'La cita ha sido movida exitosamente.',
      });
    } catch (error) {
      console.error('Error moving appointment:', error);
      toast({
        title: 'Error al mover cita',
        description: 'Ha ocurrido un error al mover la cita.',
        variant: 'destructive',
      });
    }
  };

  const handleAppointmentSave = async (appointment: CreateAppointmentData) => {
    try {
      await createAppointment.mutateAsync({
        employee_id: appointment.employeeId,
        client_name: appointment.clientName,
        description: appointment.description,
        start_time: appointment.startTime,
        end_time: appointment.endTime,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        color: appointment.color,
        status: appointment.status
      });
      
      setShowAppointmentForm(false);
      setSelectedSlot(null);
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  const handleAppointmentUpdate = async (updatedAppointment: Appointment) => {
    try {
      await updateAppointment.mutateAsync({
        id: updatedAppointment.id,
        employee_id: updatedAppointment.employeeId,
        client_name: updatedAppointment.clientName,
        description: updatedAppointment.description,
        start_time: updatedAppointment.startTime,
        end_time: updatedAppointment.endTime,
        color: updatedAppointment.color,
        status: updatedAppointment.status
      });
      
      setShowEditForm(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error updating appointment:', error);
    }
  };

  const handleAppointmentDelete = async (appointmentId: string) => {
    try {
      await deleteAppointment.mutateAsync(appointmentId);
      setShowEditForm(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error deleting appointment:', error);
    }
  };

  if (appointmentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="w-6 h-6 mr-2 text-blue-600" />
              Agenda de Empleados
            </h1>
            <p className="text-gray-600 mt-1">
              Gestiona las citas y horarios del personal • Arrastra las citas para moverlas
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="px-3 py-1 bg-white rounded border text-sm font-medium min-w-[140px] text-center">
                {format(selectedDate, 'EEEE, d MMM yyyy', { locale: es })}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setSelectedDate(new Date())}
              size="sm"
            >
              <Clock className="w-4 h-4 mr-2" />
              Hoy
            </Button>
          </div>
        </div>
      </div>

      {/* Legend - Employee list */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center space-x-6 overflow-x-auto">
          <span className="text-sm font-medium text-gray-700 flex-shrink-0">Empleados:</span>
          {employees.map((employee) => (
            <div key={employee.id} className="flex items-center space-x-2 flex-shrink-0">
              <div className={`w-4 h-4 rounded border-2 ${employee.color}`}></div>
              <span className="text-sm text-gray-700">{employee.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agenda Grid */}
      <div className="flex-1 overflow-hidden">
        <AgendaGrid
          employees={employees}
          appointments={appointments}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentMove={handleAppointmentMove}
        />
      </div>

      {/* Appointment Form Modal */}
      {showAppointmentForm && selectedSlot && (
        <AppointmentForm
          employeeId={selectedSlot.employeeId}
          time={selectedSlot.time}
          employees={employees}
          onSave={handleAppointmentSave}
          onCancel={() => {
            setShowAppointmentForm(false);
            setSelectedSlot(null);
          }}
        />
      )}

      {/* Edit Appointment Form Modal */}
      {showEditForm && selectedAppointment && (
        <EditAppointmentForm
          appointment={selectedAppointment}
          employees={employees}
          onSave={handleAppointmentUpdate}
          onDelete={handleAppointmentDelete}
          onCancel={() => {
            setShowEditForm(false);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
};
