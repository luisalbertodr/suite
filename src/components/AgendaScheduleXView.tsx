import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react';
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  type CalendarEvent,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import 'temporal-polyfill/global';
import '@schedule-x/theme-default/dist/index.css';
import type { Appointment, Employee } from '@/types/agenda';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toZoned(ymd: string, hhmm: string): Temporal.ZonedDateTime {
  const [h, m] = hhmm.split(':').map((x) => Number(x));
  const hour = Number.isFinite(h) ? h : 0;
  const minute = Number.isFinite(m) ? m : 0;
  return Temporal.ZonedDateTime.from(
    `${ymd}T${pad2(hour)}:${pad2(minute)}:00[Europe/Madrid]`,
  );
}

function hexToCalendarColors(hex: string): {
  main: string;
  container: string;
  onContainer: string;
} {
  const raw = (hex || '#3b82f6').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return {
    main: `#${full}`,
    container: `rgba(${r},${g},${b},0.18)`,
    onContainer: '#111827',
  };
}

function appointmentsToEvents(
  appointments: Appointment[],
  employees: Employee[],
): CalendarEvent[] {
  const empName = new Map(employees.map((e) => [e.id, e.name]));
  return appointments.map((apt) => {
    const end = apt.occupiedEndTime || apt.endTime || apt.startTime;
    const title = [apt.clientName, apt.serviceName || apt.description]
      .filter(Boolean)
      .join(' · ');
    const people = empName.get(apt.employeeId) ? [empName.get(apt.employeeId)!] : [];
    const endHhmm = end <= apt.startTime ? apt.startTime : end;
    return {
      id: apt.id,
      title: title || 'Cita',
      start: toZoned(apt.date, apt.startTime),
      end: toZoned(apt.date, endHhmm),
      calendarId: apt.employeeId,
      people,
      description: apt.description || undefined,
    };
  });
}

export type AgendaScheduleXViewProps = {
  selectedDateYmd: string;
  employees: Employee[];
  appointments: Appointment[];
  onSlotClick: (employeeId: string, time: string, opts?: { forceNew?: boolean }) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onSelectedDateChange?: (ymd: string) => void;
};

/**
 * Vista alternativa Agenda con Schedule-X (día/semana/mes).
 * La rejilla clásica por columnas de empleado sigue siendo la vista por defecto.
 */
export const AgendaScheduleXView: React.FC<AgendaScheduleXViewProps> = ({
  selectedDateYmd,
  employees,
  appointments,
  onSlotClick,
  onAppointmentClick,
  onSelectedDateChange,
}) => {
  const [eventsService] = useState(() => createEventsServicePlugin());
  const appointmentsRef = useRef(appointments);
  const employeesRef = useRef(employees);
  const onSlotClickRef = useRef(onSlotClick);
  const onAppointmentClickRef = useRef(onAppointmentClick);
  const onSelectedDateChangeRef = useRef(onSelectedDateChange);
  appointmentsRef.current = appointments;
  employeesRef.current = employees;
  onSlotClickRef.current = onSlotClick;
  onAppointmentClickRef.current = onAppointmentClick;
  onSelectedDateChangeRef.current = onSelectedDateChange;

  const calendars = useMemo(() => {
    const out: Record<
      string,
      {
        colorName: string;
        lightColors: { main: string; container: string; onContainer: string };
        darkColors: { main: string; container: string; onContainer: string };
      }
    > = {};
    for (const emp of employees) {
      const c = hexToCalendarColors(emp.color);
      out[emp.id] = {
        colorName: emp.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'emp',
        lightColors: c,
        darkColors: {
          main: c.main,
          container: c.container,
          onContainer: '#f8fafc',
        },
      };
    }
    return out;
  }, [employees]);

  const calendar = useCalendarApp({
    views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
    defaultView: 'day',
    selectedDate: Temporal.PlainDate.from(selectedDateYmd),
    timezone: 'Europe/Madrid',
    locale: 'es-ES',
    calendars,
    events: appointmentsToEvents(appointments, employees),
    callbacks: {
      onEventClick(event) {
        const apt = appointmentsRef.current.find((a) => a.id === String(event.id));
        if (apt) onAppointmentClickRef.current?.(apt);
      },
      onClickDateTime(dateTime) {
        const empId = employeesRef.current[0]?.id;
        if (!empId) return;
        const time = `${pad2(dateTime.hour)}:${pad2(dateTime.minute)}`;
        onSlotClickRef.current(empId, time, { forceNew: true });
      },
      onSelectedDateUpdate(date) {
        const ymd = `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
        onSelectedDateChangeRef.current?.(ymd);
      },
    },
    plugins: [eventsService],
  });

  useEffect(() => {
    eventsService.set(appointmentsToEvents(appointments, employees));
  }, [appointments, employees, eventsService]);

  if (!calendar) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
        Cargando calendario…
      </div>
    );
  }

  return (
    <div className="agenda-sx flex h-full min-h-0 flex-col overflow-hidden [&_.sx-react-calendar-wrapper]:h-full [&_.sx__calendar-wrapper]:h-full">
      <p className="shrink-0 border-b bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
        Vista Schedule-X (día/semana/mes). Colores = empleado. Click vacío asigna al primer profesional
        visible; para columnas por empleado usa la vista clásica.
      </p>
      <div className="min-h-0 flex-1 overflow-auto p-1">
        <ScheduleXCalendar calendarApp={calendar} />
      </div>
    </div>
  );
};
