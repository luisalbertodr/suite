
import React from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { Employee, Appointment, TimeSlot } from '@/types/agenda';

interface AgendaGridProps {
  employees: Employee[];
  appointments: Appointment[];
  onSlotClick: (employeeId: string, time: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onAppointmentMove?: (appointmentId: string, newEmployeeId: string, newTime: string) => void;
}

export const AgendaGrid: React.FC<AgendaGridProps> = ({
  employees,
  appointments,
  onSlotClick,
  onAppointmentClick,
  onAppointmentMove
}) => {
  const [draggedAppointment, setDraggedAppointment] = React.useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = React.useState<{ employeeId: string; time: string } | null>(null);

  // Generar slots de tiempo cada 15 minutos de 8:00 a 20:00
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = 8; hour < 20; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({
          time: timeString,
          hour,
          minute
        });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Calcular la duración de una cita en slots de 15 minutos
  const calculateDurationInSlots = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    const durationMinutes = endMinutes - startMinutes;
    return Math.ceil(durationMinutes / 15);
  };

  // Verificar si una cita empieza exactamente en este slot
  const isAppointmentStart = (employeeId: string, time: string): boolean => {
    return appointments.some(apt => 
      apt.employeeId === employeeId && apt.startTime === time
    );
  };

  // Verificar si este slot está ocupado por una cita para este empleado
  const isSlotOccupiedByAppointment = (employeeId: string, time: string): boolean => {
    return appointments.some(apt => {
      if (apt.employeeId !== employeeId) return false;
      
      const [aptStartHour, aptStartMin] = apt.startTime.split(':').map(Number);
      const [aptEndHour, aptEndMin] = apt.endTime.split(':').map(Number);
      const [slotHour, slotMin] = time.split(':').map(Number);
      
      const aptStartMinutes = aptStartHour * 60 + aptStartMin;
      const aptEndMinutes = aptEndHour * 60 + aptEndMin;
      const slotMinutes = slotHour * 60 + slotMin;
      
      // El slot está ocupado si está dentro del rango de la cita
      return slotMinutes >= aptStartMinutes && slotMinutes < aptEndMinutes;
    });
  };

  // Obtener la cita que empieza en este slot específico
  const getAppointmentStartingAt = (employeeId: string, time: string): Appointment | undefined => {
    return appointments.find(apt => 
      apt.employeeId === employeeId && apt.startTime === time
    );
  };

  // Obtener el índice del slot actual
  const getSlotIndex = (time: string): number => {
    return timeSlots.findIndex(slot => slot.time === time);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
  };

  // Funciones para drag & drop
  const handleDragStart = (e: React.DragEvent, appointment: Appointment) => {
    setDraggedAppointment(appointment.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appointment.id);
    
    // Agregar una clase visual al elemento que se está arrastrando
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedAppointment(null);
    setDragOverSlot(null);
    
    // Restaurar la opacidad
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, employeeId: string, time: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Solo permitir soltar en slots vacíos
    const isOccupied = isSlotOccupiedByAppointment(employeeId, time);
    if (!isOccupied) {
      setDragOverSlot({ employeeId, time });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Solo limpiar si realmente salimos del elemento
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isInside = e.clientX >= rect.left && e.clientX <= rect.right && 
                     e.clientY >= rect.top && e.clientY <= rect.bottom;
    
    if (!isInside) {
      setDragOverSlot(null);
    }
  };

  const handleDrop = (e: React.DragEvent, employeeId: string, time: string) => {
    e.preventDefault();
    
    const appointmentId = e.dataTransfer.getData('text/plain');
    if (appointmentId && draggedAppointment && onAppointmentMove) {
      // Verificar que el slot esté disponible
      const isOccupied = isSlotOccupiedByAppointment(employeeId, time);
      if (!isOccupied) {
        onAppointmentMove(appointmentId, employeeId, time);
      }
    }
    
    setDraggedAppointment(null);
    setDragOverSlot(null);
  };

  const isSlotHighlighted = (employeeId: string, time: string): boolean => {
    return dragOverSlot?.employeeId === employeeId && dragOverSlot?.time === time;
  };

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="min-w-[900px] relative">
        {/* Header con nombres de empleados */}
        <div className="sticky top-0 bg-white z-10 border-b-2 border-gray-300">
          <div className="grid grid-cols-7 gap-0">
            <div className="p-3 bg-gray-100 border-r border-gray-300 font-semibold text-sm text-center">
              Hora
            </div>
            {employees.map((employee) => (
              <div
                key={employee.id}
                className={`p-3 border-r border-gray-300 font-semibold text-sm text-center ${employee.color}`}
              >
                {employee.name}
              </div>
            ))}
          </div>
        </div>

        {/* Grid de tiempo - usando CSS Grid */}
        <div className="grid grid-cols-7 gap-0 relative">
          {/* Renderizar las citas como elementos posicionados absolutamente */}
          {appointments.map((appointment) => {
            const startSlotIndex = getSlotIndex(appointment.startTime);
            const durationInSlots = calculateDurationInSlots(appointment.startTime, appointment.endTime);
            const employeeIndex = employees.findIndex(emp => emp.id === appointment.employeeId);
            
            if (startSlotIndex === -1 || employeeIndex === -1) return null;
            
            const topPosition = startSlotIndex * 32; // 32px por slot
            const leftPosition = (employeeIndex + 1) * (100 / 7); // Porcentaje para cada columna
            const height = durationInSlots * 32;
            
            return (
              <div
                key={appointment.id}
                className="absolute z-20 cursor-move hover:opacity-80"
                style={{
                  top: `${topPosition}px`,
                  left: `${leftPosition}%`,
                  width: `${100 / 7}%`,
                  height: `${height}px`,
                  paddingRight: '1px' // Para el borde
                }}
                onClick={() => onAppointmentClick?.(appointment)}
                onDragOver={(e) => handleDragOver(e, appointment.employeeId, appointment.startTime)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, appointment.employeeId, appointment.startTime)}
              >
                <div 
                  className={`h-full p-2 text-xs overflow-hidden rounded border-2 border-gray-400 cursor-move ${employees[employeeIndex]?.color}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, appointment)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="bg-white bg-opacity-90 rounded px-2 py-1 text-gray-800 font-medium h-full">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold truncate flex-1">{appointment.clientName}</div>
                      {getStatusIcon(appointment.status)}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {appointment.startTime} - {appointment.endTime}
                    </div>
                    {appointment.description && (
                      <div className="text-xs text-gray-600 truncate mt-1">
                        {appointment.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Renderizar todas las celdas del grid */}
          {timeSlots.map((slot) => {
            const isHourMark = slot.minute === 0;
            
            return (
              <React.Fragment key={slot.time}>
                {/* Columna de tiempo */}
                <div className={`p-2 border-r border-gray-300 text-xs text-center font-medium h-8 ${
                  isHourMark 
                    ? 'border-t-2 border-gray-400 bg-gray-100' 
                    : 'border-t border-gray-200 bg-gray-50'
                }`}>
                  <div className={`${isHourMark ? 'text-gray-700 font-semibold' : 'text-gray-600'}`}>
                    {slot.time}
                  </div>
                </div>

                {/* Columnas de empleados - siempre renderizar todas las celdas */}
                {employees.map((employee) => {
                  const isOccupied = isSlotOccupiedByAppointment(employee.id, slot.time);
                  const isHighlighted = isSlotHighlighted(employee.id, slot.time);
                  
                  return (
                    <div
                      key={`${employee.id}-${slot.time}`}
                      className={`relative border-r border-gray-300 transition-colors ${
                        isHourMark ? 'border-t-2 border-gray-400' : 'border-t border-gray-200'
                      } ${isOccupied ? 'bg-gray-50' : 'bg-white cursor-pointer hover:bg-blue-50'} ${
                        isHighlighted ? 'bg-blue-100 border-blue-300' : ''
                      }`}
                      style={{ height: '32px' }}
                      onClick={() => !isOccupied && onSlotClick(employee.id, slot.time)}
                      onDragOver={(e) => handleDragOver(e, employee.id, slot.time)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, employee.id, slot.time)}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
