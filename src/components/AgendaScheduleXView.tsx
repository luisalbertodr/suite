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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SX_EMPLOYEE_KEY = 'suite.agenda.sx.employeeId';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function readStoredEmployeeId(employees: Employee[]): string {
  try {
    const stored = localStorage.getItem(SX_EMPLOYEE_KEY);
    if (stored && employees.some((e) => e.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return employees[0]?.id ?? '';
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
  const [preferredEmployeeId, setPreferredEmployeeId] = useState(() =>
    readStoredEmployeeId(employees),
  );
  const [pendingSlot, setPendingSlot] = useState<{ time: string } | null>(null);
  const [pickEmployeeId, setPickEmployeeId] = useState('');

  const appointmentsRef = useRef(appointments);
  const employeesRef = useRef(employees);
  const preferredRef = useRef(preferredEmployeeId);
  const onSlotClickRef = useRef(onSlotClick);
  const onAppointmentClickRef = useRef(onAppointmentClick);
  const onSelectedDateChangeRef = useRef(onSelectedDateChange);
  appointmentsRef.current = appointments;
  employeesRef.current = employees;
  preferredRef.current = preferredEmployeeId;
  onSlotClickRef.current = onSlotClick;
  onAppointmentClickRef.current = onAppointmentClick;
  onSelectedDateChangeRef.current = onSelectedDateChange;

  useEffect(() => {
    if (!employees.some((e) => e.id === preferredEmployeeId)) {
      const next = employees[0]?.id ?? '';
      setPreferredEmployeeId(next);
    }
  }, [employees, preferredEmployeeId]);

  const persistPreferred = (id: string) => {
    setPreferredEmployeeId(id);
    try {
      localStorage.setItem(SX_EMPLOYEE_KEY, id);
    } catch {
      /* ignore */
    }
  };

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
        const list = employeesRef.current;
        if (!list.length) return;
        const time = `${pad2(dateTime.hour)}:${pad2(dateTime.minute)}`;
        if (list.length === 1) {
          onSlotClickRef.current(list[0]!.id, time, { forceNew: true });
          return;
        }
        const pref =
          preferredRef.current && list.some((e) => e.id === preferredRef.current)
            ? preferredRef.current
            : list[0]!.id;
        setPickEmployeeId(pref);
        setPendingSlot({ time });
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

  const preferredName =
    employees.find((e) => e.id === preferredEmployeeId)?.name ?? '—';

  if (!calendar) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
        Cargando calendario…
      </div>
    );
  }

  return (
    <div className="agenda-sx flex h-full min-h-0 flex-col overflow-hidden [&_.sx-react-calendar-wrapper]:h-full [&_.sx__calendar-wrapper]:h-full">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-2 py-1">
        <p className="text-[10px] text-muted-foreground">
          Schedule-X · colores = empleado · click vacío → elegir profesional
        </p>
        {employees.length > 1 ? (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Preferido:</span>
            <Select value={preferredEmployeeId} onValueChange={persistPreferred}>
              <SelectTrigger className="h-7 w-[160px] text-xs">
                <SelectValue placeholder="Profesional">{preferredName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1">
        <ScheduleXCalendar calendarApp={calendar} />
      </div>

      <Dialog open={!!pendingSlot} onOpenChange={(open) => !open && setPendingSlot(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Nueva cita · {pendingSlot?.time}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <p className="text-xs text-muted-foreground">Profesional</p>
            <Select value={pickEmployeeId} onValueChange={setPickEmployeeId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Elegir profesional" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => setPendingSlot(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!pickEmployeeId || !pendingSlot}
              onClick={() => {
                if (!pendingSlot || !pickEmployeeId) return;
                persistPreferred(pickEmployeeId);
                onSlotClick(pickEmployeeId, pendingSlot.time, { forceNew: true });
                setPendingSlot(null);
              }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
