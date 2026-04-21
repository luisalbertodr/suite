
import React from 'react';
import { format } from 'date-fns';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { Employee, Appointment, TimeSlot } from '@/types/agenda';
import {
  loadAgendaViewPersisted,
  mergePersistedScroll,
  saveAgendaViewPersisted,
} from '@/lib/agendaViewPersistence';
import {
  DEFAULT_AGENDA_CENTER_HOURS,
  generateAgendaSlots,
  getAgendaGridEnvelopeMinutes,
  hhmmToMinutes,
  slotBookableForAgenda,
  type AgendaDayHoursMap,
  type AgendaUnavailabilityEntry,
} from '@/lib/agendaHours';

interface AgendaGridProps {
  employees: Employee[];
  appointments: Appointment[];
  onSlotClick: (employeeId: string, time: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onAppointmentMove?: (appointmentId: string, newEmployeeId: string, newTime: string) => void;
  /** Usuario autenticado: restaura/guarda scroll y día en localStorage */
  persistUserId?: string | null;
  /** yyyy-MM-dd: clave del scroll guardado por día */
  viewDateYmd?: string;
  /** Incrementar al pulsar «Hoy» en la agenda: scroll a la hora actual */
  goToTodayRequestId?: number;
  /** Solicitud de scroll a hora específica (por ejemplo, deep-link de notificación) */
  scrollToTimeRequest?: { requestId: number; time: string } | null;
  centerHours?: AgendaDayHoursMap;
  employeeAgendaById?: Record<
    string,
    { weekly: AgendaDayHoursMap | null; blocks: AgendaUnavailabilityEntry[] }
  >;
  slotMinutes?: 15 | 30;
  cellHeight?: number;
  visibleFields?: {
    clientName: boolean;
    service: boolean;
    description: boolean;
    timeRange: boolean;
    status: boolean;
    legacyCodes: boolean;
  };
}

/** Ancho de la columna «Hora» (px); debe coincidir con gridTemplateColumns. */
const TIME_GUTTER_PX = 80;

/** Franjas fuera de horario / no disponibles: contraste alto + rayas diagonales. */
const UNAVAILABLE_TIME_GUTTER =
  'bg-neutral-300/95 text-neutral-700 dark:bg-neutral-800/95 dark:text-neutral-300 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(0,0,0,0.07)_5px,rgba(0,0,0,0.07)_10px)]';
const UNAVAILABLE_CELL =
  'bg-neutral-200/95 dark:bg-neutral-900/90 cursor-not-allowed [background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(0,0,0,0.055)_5px,rgba(0,0,0,0.055)_10px)] dark:[background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(255,255,255,0.04)_5px,rgba(255,255,255,0.04)_10px)]';

const timeToMinutes = (hhmm: string): number => hhmmToMinutes(hhmm);

export const AgendaGrid: React.FC<AgendaGridProps> = ({
  employees,
  appointments,
  onSlotClick,
  onAppointmentClick,
  onAppointmentMove,
  persistUserId = null,
  viewDateYmd,
  goToTodayRequestId = 0,
  scrollToTimeRequest = null,
  centerHours: centerHoursProp,
  employeeAgendaById = {},
  slotMinutes = 15,
  cellHeight = 32,
  visibleFields = {
    clientName: true,
    service: true,
    description: true,
    timeRange: true,
    status: true,
    legacyCodes: false,
  }
}) => {
  const scrollRootRef = React.useRef<HTMLDivElement>(null);
  const stickyHeaderRef = React.useRef<HTMLDivElement>(null);
  const lastHandledGoTodayRef = React.useRef(0);
  const lastHandledScrollToTimeRef = React.useRef(0);
  const scrollSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nowLineTick, setNowLineTick] = React.useState(0);

  const [draggedAppointment, setDraggedAppointment] = React.useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = React.useState<{ employeeId: string; time: string } | null>(null);

  const centerHours = centerHoursProp ?? DEFAULT_AGENDA_CENTER_HOURS;
  const { startMin: envStart, endMin: envEnd } = React.useMemo(
    () => getAgendaGridEnvelopeMinutes(centerHours),
    [centerHours],
  );
  const timeSlots = React.useMemo(
    () => generateAgendaSlots(envStart, envEnd, slotMinutes) as TimeSlot[],
    [envStart, envEnd, slotMinutes],
  );
  const gridStartMin = timeSlots.length ? timeToMinutes(timeSlots[0].time) : envStart;
  const gridEndMin = timeSlots.length ? timeToMinutes(timeSlots[timeSlots.length - 1].time) + slotMinutes : envEnd;

  const isTodayView = viewDateYmd === format(new Date(), 'yyyy-MM-dd');

  React.useEffect(() => {
    if (!isTodayView) return;
    const bump = () => setNowLineTick((t) => t + 1);
    const id = setInterval(bump, 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') bump();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isTodayView]);

  // Verificar si este slot está ocupado por una cita para este empleado
  const isSlotOccupiedByAppointment = (employeeId: string, time: string): boolean => {
    return appointments.some(apt => {
      if (apt.employeeId !== employeeId) return false;
      
      const [aptStartHour, aptStartMin] = apt.startTime.split(':').map(Number);
      const [aptEndHour, aptEndMin] = apt.endTime.split(':').map(Number);
      const [slotHour, slotMin] = time.split(':').map(Number);
      
      const aptStartMinutes = aptStartHour * 60 + aptStartMin;
      const aptEndMinutes = aptEndHour * 60 + aptEndMin;
      const slotStartMinutes = slotHour * 60 + slotMin;
      
      // El slot está ocupado si está dentro del rango de la cita
      return slotStartMinutes >= aptStartMinutes && slotStartMinutes < aptEndMinutes;
    });
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

  const overlapMap = React.useMemo(() => {
    const byKey: Record<string, Appointment[]> = {};
    for (const apt of appointments) {
      const key = `${apt.employeeId}|${apt.startTime}`;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(apt);
    }
    const out: Record<string, { index: number; total: number }> = {};
    for (const key of Object.keys(byKey)) {
      const items = byKey[key].slice().sort((a, b) => a.id.localeCompare(b.id));
      const total = items.length;
      items.forEach((apt, idx) => {
        out[apt.id] = { index: idx, total };
      });
    }
    return out;
  }, [appointments]);

  const flushScrollToStorage = React.useCallback(() => {
    if (!persistUserId || !viewDateYmd) return;
    const el = scrollRootRef.current;
    if (!el) return;
    const prev = loadAgendaViewPersisted(persistUserId);
    saveAgendaViewPersisted(persistUserId, mergePersistedScroll(prev, viewDateYmd, el.scrollTop));
  }, [persistUserId, viewDateYmd]);

  React.useLayoutEffect(() => {
    if (!persistUserId || !viewDateYmd) return;
    const el = scrollRootRef.current;
    if (!el) return;
    const p = loadAgendaViewPersisted(persistUserId);
    const top = p?.scrollByYmd[viewDateYmd] ?? 0;
    const run = () => {
      if (!scrollRootRef.current) return;
      scrollRootRef.current.scrollTop = top;
    };
    run();
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => cancelAnimationFrame(id);
  }, [persistUserId, viewDateYmd, employees.length, slotMinutes, cellHeight, appointments.length]);

  /** Tras restaurar scroll guardado: «Hoy» vuelve a posicionar en la hora actual. */
  React.useLayoutEffect(() => {
    if (!goToTodayRequestId || goToTodayRequestId === lastHandledGoTodayRef.current) return;
    if (!viewDateYmd || viewDateYmd !== format(new Date(), 'yyyy-MM-dd')) return;
    const scrollEl = scrollRootRef.current;
    const headerEl = stickyHeaderRef.current;
    if (!scrollEl) return;
    lastHandledGoTodayRef.current = goToTodayRequestId;

    const d = new Date();
    const nowDec = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    const clamped = Math.max(gridStartMin, Math.min(gridEndMin, nowDec));
    const lineTopInGrid = ((clamped - gridStartMin) / slotMinutes) * cellHeight;
    const headerH = headerEl?.offsetHeight ?? 52;
    const anchor = headerH + lineTopInGrid - scrollEl.clientHeight * 0.35;
    const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
    const run = () => {
      if (!scrollRootRef.current) return;
      scrollRootRef.current.scrollTop = Math.max(0, Math.min(anchor, maxScroll));
    };
    run();
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [goToTodayRequestId, viewDateYmd, gridStartMin, gridEndMin, slotMinutes, cellHeight]);

  React.useLayoutEffect(() => {
    if (!scrollToTimeRequest?.requestId) return;
    if (scrollToTimeRequest.requestId === lastHandledScrollToTimeRef.current) return;
    const scrollEl = scrollRootRef.current;
    const headerEl = stickyHeaderRef.current;
    if (!scrollEl) return;
    const [hStr, mStr] = String(scrollToTimeRequest.time || '').split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;

    lastHandledScrollToTimeRef.current = scrollToTimeRequest.requestId;
    const targetMin = h * 60 + m;
    const clamped = Math.max(gridStartMin, Math.min(gridEndMin, targetMin));
    const lineTopInGrid = ((clamped - gridStartMin) / slotMinutes) * cellHeight;
    const headerH = headerEl?.offsetHeight ?? 52;
    const anchor = headerH + lineTopInGrid - scrollEl.clientHeight * 0.35;
    const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
    const run = () => {
      if (!scrollRootRef.current) return;
      scrollRootRef.current.scrollTop = Math.max(0, Math.min(anchor, maxScroll));
    };
    run();
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [scrollToTimeRequest, gridStartMin, gridEndMin, slotMinutes, cellHeight]);

  React.useEffect(() => {
    if (!persistUserId || !viewDateYmd) return;
    const el = scrollRootRef.current;
    if (!el) return;
    const onScroll = () => {
      if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
      scrollSaveTimerRef.current = setTimeout(() => flushScrollToStorage(), 220);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushScrollToStorage();
    };
    window.addEventListener('pagehide', flushScrollToStorage);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', flushScrollToStorage);
      document.removeEventListener('visibilitychange', onHide);
      if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
      flushScrollToStorage();
    };
  }, [persistUserId, viewDateYmd, flushScrollToStorage]);

  return (
    <div ref={scrollRootRef} className="h-full overflow-auto bg-card">
      <div className="min-w-[900px] relative">
        {/* Header con nombres de empleados */}
        <div ref={stickyHeaderRef} className="sticky top-0 bg-card z-10 border-b-2 border-border">
          <div className="grid gap-0" style={{ gridTemplateColumns: `${TIME_GUTTER_PX}px repeat(${employees.length}, 1fr)` }}>
            <div className="p-3 bg-muted border-r border-border font-semibold text-sm text-center">
              Hora
            </div>
            {employees.map((employee) => (
              <div key={employee.id} className={`p-3 border-r border-border font-semibold text-sm text-center ${employee.color}`}>
                {employee.name}
              </div>
            ))}
          </div>
        </div>

        {/* Grid de tiempo - usando CSS Grid */}
        <div className="grid gap-0 relative" style={{ gridTemplateColumns: `${TIME_GUTTER_PX}px repeat(${employees.length}, 1fr)` }}>
          {/* Renderizar las citas como elementos posicionados absolutamente */}
          {appointments.map((appointment) => {
            const employeeIndex = employees.findIndex(emp => emp.id === appointment.employeeId);
            if (employeeIndex === -1) return null;

            let startMin = timeToMinutes(appointment.startTime);
            let endMin = timeToMinutes(appointment.endTime);
            if (endMin <= startMin) return null;
            if (endMin <= gridStartMin || startMin >= gridEndMin) return null;
            if (startMin < gridStartMin) startMin = gridStartMin;
            if (endMin > gridEndMin) endMin = gridEndMin;

            const topPosition = ((startMin - gridStartMin) / slotMinutes) * cellHeight;
            const height = Math.max(
              ((endMin - startMin) / slotMinutes) * cellHeight,
              cellHeight * 0.5
            );

            const n = employees.length;
            const overlap = overlapMap[appointment.id] || { index: 0, total: 1 };
            const colFrac = overlap.total > 0 ? overlap.index / overlap.total : 0;
            const left = `calc(${TIME_GUTTER_PX}px + (100% - ${TIME_GUTTER_PX}px) * ${employeeIndex / n} + (100% - ${TIME_GUTTER_PX}px) / ${n} * ${colFrac})`;
            const width = `calc((100% - ${TIME_GUTTER_PX}px) / ${n} / ${overlap.total})`;

            return (
              <div
                key={appointment.id}
                className="absolute z-20 cursor-move hover:opacity-80"
                style={{
                  top: `${topPosition}px`,
                  left,
                  width,
                  height: `${height}px`,
                  paddingRight: '1px'
                }}
                onClick={() => onAppointmentClick?.(appointment)}
                onDragOver={(e) => handleDragOver(e, appointment.employeeId, appointment.startTime)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, appointment.employeeId, appointment.startTime)}
              >
                <div
                  className={`h-full p-1 text-[11px] overflow-hidden rounded border-2 border-gray-400 cursor-move ${employees[employeeIndex]?.color}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, appointment)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="bg-white/90 rounded px-1.5 py-1 text-gray-800 font-medium h-full leading-tight">
                    <div className="flex items-center justify-between mb-1 gap-1">
                      {visibleFields.clientName && (
                        <div className="font-semibold truncate flex-1">{appointment.clientName}</div>
                      )}
                      {visibleFields.status && getStatusIcon(appointment.status)}
                    </div>
                    {visibleFields.timeRange && (
                      <div className="text-xs text-gray-600 truncate mt-1">
                        {appointment.startTime} - {appointment.endTime}
                      </div>
                    )}
                    {visibleFields.service && appointment.serviceName && (
                      <div className="text-xs text-gray-700 truncate mt-1 font-medium">
                        {appointment.serviceCode ? `${appointment.serviceCode} - ` : ''}{appointment.serviceName}
                      </div>
                    )}
                    {visibleFields.description && appointment.description && (
                      <div className="text-xs text-gray-600 truncate mt-1">
                        {appointment.description}
                      </div>
                    )}
                    {visibleFields.legacyCodes && (
                      <div className="text-[10px] text-gray-600 truncate mt-1">
                        {appointment.legacyEmployeeCode ? `EMP:${appointment.legacyEmployeeCode}` : ''}
                        {appointment.legacyClientCode ? ` · CLI:${appointment.legacyClientCode}` : ''}
                        {appointment.legacyPlanincId ? ` · ID:${appointment.legacyPlanincId}` : ''}
                        {appointment.legacyHourInText ? ` · H:${appointment.legacyHourInText}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isTodayView && (() => {
            const d = new Date();
            const nowDec = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
            const clamped = Math.max(gridStartMin, Math.min(gridEndMin, nowDec));
            const topPx = ((clamped - gridStartMin) / slotMinutes) * cellHeight;
            return (
              <div
                key={`agenda-now-line-${nowLineTick}`}
                className="pointer-events-none absolute left-0 right-0 z-[25]"
                style={{
                  top: `${topPx}px`,
                  height: 0,
                  borderTop: '2px solid rgb(220 38 38)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.6)',
                }}
                aria-hidden
              />
            );
          })()}

          {/* Renderizar todas las celdas del grid */}
          {timeSlots.map((slot) => {
            const isHourMark = slot.minute === 0;
            const dateKey = viewDateYmd ?? format(new Date(), 'yyyy-MM-dd');
            const slotS = timeToMinutes(slot.time);
            const slotE = slotS + slotMinutes;
            const { centerOpen } = slotBookableForAgenda(dateKey, slotS, slotE, centerHours, null, []);
            const timeShade = !centerOpen;

            return (
              <div key={slot.time} className="contents">
                {/* Columna de tiempo */}
                <div
                  className={`p-2 border-r border-gray-300 text-xs text-center font-medium ${
                  isHourMark 
                    ? 'border-t-2 border-gray-400 bg-gray-100' 
                    : 'border-t border-gray-200 bg-gray-50'
                } ${timeShade ? UNAVAILABLE_TIME_GUTTER : ''}`}
                  style={{ height: `${cellHeight}px`, minHeight: `${cellHeight}px` }}
                >
                  <div className={`${isHourMark ? 'text-gray-700 font-semibold' : 'text-gray-600'} ${timeShade ? '!text-neutral-700 dark:!text-neutral-300' : ''}`}>
                    {slot.time}
                  </div>
                </div>

                {/* Columnas de empleados - siempre renderizar todas las celdas */}
                {employees.map((employee) => {
                  const isOccupied = isSlotOccupiedByAppointment(employee.id, slot.time);
                  const isHighlighted = isSlotHighlighted(employee.id, slot.time);
                  const meta = employeeAgendaById[employee.id] ?? { weekly: null, blocks: [] };
                  const { bookable } = slotBookableForAgenda(
                    dateKey,
                    slotS,
                    slotE,
                    centerHours,
                    meta.weekly,
                    meta.blocks,
                  );
                  const shade = !bookable && !isOccupied;
                  
                  return (
                    <div
                      key={`${employee.id}-${slot.time}`}
                      className={`relative border-r border-gray-300 transition-colors ${
                        isHourMark ? 'border-t-2 border-gray-400' : 'border-t border-gray-200'
                      } ${isOccupied ? 'bg-gray-50' : shade ? UNAVAILABLE_CELL : 'bg-white cursor-pointer hover:bg-blue-50'} ${
                        isHighlighted ? 'bg-blue-100 border-blue-300' : ''
                      }`}
                      style={{ height: `${cellHeight}px` }}
                      onClick={() => !isOccupied && bookable && onSlotClick(employee.id, slot.time)}
                      onDragOver={(e) => bookable && handleDragOver(e, employee.id, slot.time)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => bookable && handleDrop(e, employee.id, slot.time)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
