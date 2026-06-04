
import React from 'react';
import { format } from 'date-fns';
import { CheckCircle, Clock, XCircle, Receipt, Banknote, FileText } from 'lucide-react';
import { AppointmentAttachmentIcons } from '@/components/AppointmentAttachmentIcons';
import { hasAttachmentHints } from '@/lib/appointmentAttachmentHints';
import { Employee, Appointment, TimeSlot } from '@/types/agenda';
import { slotOverlapsOccupiedTime } from '@/lib/agendaAppointmentItems';
import { segmentAppearance } from '@/lib/agendaResourceColors';
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
const TIME_GUTTER_PX = 96;

/** Franjas fuera de horario / no disponibles: contraste alto + rayas diagonales. */
const UNAVAILABLE_TIME_GUTTER =
  'bg-neutral-300/95 text-neutral-700 dark:bg-neutral-800/95 dark:text-neutral-300 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(0,0,0,0.07)_5px,rgba(0,0,0,0.07)_10px)]';
const UNAVAILABLE_CELL =
  'bg-neutral-200/95 dark:bg-neutral-900/90 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(0,0,0,0.055)_5px,rgba(0,0,0,0.055)_10px)] dark:[background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(255,255,255,0.04)_5px,rgba(255,255,255,0.04)_10px)]';
const UNAVAILABLE_CELL_BLOCKED = `${UNAVAILABLE_CELL} cursor-not-allowed`;

/** Descripción legacy tipo `[16:00] 214 - SERVICIO` (ya parseada en servicio/hora). */
const LEGACY_DESCRIPTION_RE = /^\[\d{1,2}:\d{2}\]\s*[^\s-]+\s*-\s*.+$/;

const timeToMinutes = (hhmm: string): number => hhmmToMinutes(hhmm);

const formatSlotTimeRange = (appointment: Appointment): string => {
  const end =
    appointment.timeSegments?.length
      ? appointment.timeSegments[appointment.timeSegments.length - 1]!.endTime
      : appointment.occupiedEndTime || appointment.endTime;
  return `${appointment.startTime} - ${end}`;
};

/** Comentarios/notas del slot omitiendo texto ya mostrado en horario o servicios. */
const slotDescriptionText = (appointment: Appointment): string | null => {
  const raw = (appointment.description || '').trim();
  if (!raw) return null;
  if (LEGACY_DESCRIPTION_RE.test(raw)) return null;

  const serviceLine = [appointment.serviceCode, appointment.serviceName].filter(Boolean).join(' - ');
  if (serviceLine && raw === serviceLine) return null;
  if (appointment.serviceName && raw === appointment.serviceName.trim()) return null;

  const segmentText = (appointment.timeSegments ?? [])
    .map((s) => (s.recursoName ? `${s.label} [${s.recursoName}]` : s.label))
    .join(' · ');
  if (segmentText && raw === segmentText) return null;

  const timeLine = formatSlotTimeRange(appointment);
  if (raw === timeLine || raw === `${appointment.startTime} - ${appointment.endTime}`) return null;

  return raw;
};

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
  const lastScrollTopRef = React.useRef(0);
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

  // Verificar si este slot está ocupado por tramos que reservan tiempo (no solo cobros)
  const isSlotOccupiedByAppointment = (employeeId: string, time: string): boolean => {
    const slotStartMinutes = timeToMinutes(time);
    const slotEndMinutes = slotStartMinutes + slotMinutes;
    return appointments.some((apt) => {
      if (apt.employeeId !== employeeId) return false;
      return slotOverlapsOccupiedTime(
        slotStartMinutes,
        slotEndMinutes,
        apt.startTime,
        apt.timeSegments,
        apt.occupiedEndTime || apt.endTime
      );
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

  const getPaymentIcon = (paymentStatus?: Appointment['paymentStatus']) => {
    switch (paymentStatus) {
      case 'invoiced':
        return (
          <span title="Cobrada y facturada">
            <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          </span>
        );
      case 'paid':
        return (
          <span title="Cobrada (TPV)">
            <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          </span>
        );
      case 'pending_charge':
        return (
          <span title="Pendiente de cobro">
            <Receipt className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          </span>
        );
      default:
        return null;
    }
  };

  // Funciones para drag & drop
  const handleDragStart = (e: React.DragEvent, appointment: Appointment) => {
    if (appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'invoiced') {
      e.preventDefault();
      return;
    }
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
    let scrollTop: number;
    if (el) {
      scrollTop = el.scrollTop;
      lastScrollTopRef.current = scrollTop;
    } else {
      scrollTop = lastScrollTopRef.current;
      // Desmontaje sin DOM: no guardar 0 y borrar la posición previa.
      if (scrollTop <= 0) return;
    }
    const prev = loadAgendaViewPersisted(persistUserId);
    saveAgendaViewPersisted(persistUserId, mergePersistedScroll(prev, viewDateYmd, scrollTop));
  }, [persistUserId, viewDateYmd]);

  React.useLayoutEffect(() => {
    if (!persistUserId || !viewDateYmd) return;
    const el = scrollRootRef.current;
    if (!el) return;
    const p = loadAgendaViewPersisted(persistUserId);
    const top = p?.scrollByYmd[viewDateYmd] ?? 0;
    lastScrollTopRef.current = top;
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
      if (scrollRootRef.current) {
        lastScrollTopRef.current = scrollRootRef.current.scrollTop;
      }
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
        <div ref={stickyHeaderRef} className="sticky top-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 z-30 border-b border-border shadow-sm">
          <div className="grid gap-0" style={{ gridTemplateColumns: `${TIME_GUTTER_PX}px repeat(${employees.length}, 1fr)` }}>
            <div className="sticky left-0 z-40 px-3 py-1.5 bg-muted border-r border-border shadow-[2px_0_4px_rgba(0,0,0,0.08)] font-semibold text-xs text-center leading-tight">
              Hora
            </div>
            {employees.map((employee) => (
              <div key={employee.id} className={`px-2 py-1.5 border-r border-border font-semibold text-xs text-center leading-tight ${employee.color}`}>
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

            const segments = appointment.timeSegments ?? [];
            let startMin = timeToMinutes(appointment.startTime);
            const storedEndMin = timeToMinutes(appointment.endTime);
            const occupiedEndMin = segments.length
              ? timeToMinutes(segments[segments.length - 1]!.endTime)
              : timeToMinutes(appointment.occupiedEndTime || appointment.endTime);
            let endMin = Math.max(storedEndMin, occupiedEndMin);
            if (endMin <= startMin && segments.length) {
              endMin = occupiedEndMin;
            }
            if (endMin <= startMin) return null;
            if (endMin <= gridStartMin || startMin >= gridEndMin) return null;
            if (startMin < gridStartMin) startMin = gridStartMin;
            if (endMin > gridEndMin) endMin = gridEndMin;

            const displaySpan = Math.max(1, endMin - startMin);
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
            const slotDesc =
              visibleFields.description ? slotDescriptionText(appointment) : null;
            const lockedByPayment = appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'invoiced';

            return (
              <div
                key={appointment.id}
                className={`absolute z-20 hover:opacity-80 ${lockedByPayment ? 'cursor-default' : 'cursor-move'}`}
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
                  className={`relative h-full p-0.5 text-[11px] overflow-hidden rounded border-2 border-border dark:border-border ${lockedByPayment ? 'cursor-default' : 'cursor-move'} ${employees[employeeIndex]?.color}`}
                  draggable={!lockedByPayment}
                  onDragStart={(e) => handleDragStart(e, appointment)}
                  onDragEnd={handleDragEnd}
                >
                  {segments.map((seg) => {
                    const segStart = timeToMinutes(seg.startTime);
                    const segEnd = timeToMinutes(seg.endTime);
                    const topPct = ((segStart - startMin) / displaySpan) * 100;
                    const heightPct = Math.max(4, ((segEnd - segStart) / displaySpan) * 100);
                    const { className: barClass, style } = segmentAppearance(seg.recursoColor, seg.kind);
                    const title = [
                      `${seg.startTime}–${seg.endTime}`,
                      seg.label,
                      seg.recursoName ? `→ ${seg.recursoName}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <div
                        key={seg.clientKey}
                        className={`absolute left-0.5 right-0.5 pointer-events-none ${barClass}`}
                        style={{ top: `${topPct}%`, height: `${heightPct}%`, ...style }}
                        title={title}
                      />
                    );
                  })}
                  {segments.length > 0 && endMin > occupiedEndMin && (
                    <div
                      className="absolute left-0.5 right-0.5 rounded-sm border border-dashed border-muted-foreground/25 bg-background/30 pointer-events-none"
                      style={{
                        top: `${((occupiedEndMin - startMin) / displaySpan) * 100}%`,
                        height: `${((endMin - occupiedEndMin) / displaySpan) * 100}%`,
                      }}
                      title="Tramo sin reserva de tiempo (solo cobros u holgura)"
                    />
                  )}
                  <div className="relative z-[1] bg-card/95 dark:bg-card/90 rounded px-1.5 py-1 text-foreground font-medium h-full leading-tight overflow-hidden">
                    <div className="flex items-center justify-between mb-0.5 gap-1">
                      {visibleFields.clientName && (
                        <div className="font-semibold truncate flex-1">{appointment.clientName}</div>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {appointment.attachments && hasAttachmentHints(appointment.attachments) ? (
                          <AppointmentAttachmentIcons
                            attachments={appointment.attachments}
                            iconClassName="h-3 w-3"
                          />
                        ) : null}
                        {getPaymentIcon(appointment.paymentStatus)}
                        {visibleFields.status && getStatusIcon(appointment.status)}
                      </div>
                    </div>
                    {visibleFields.timeRange && (
                      <div className="text-xs text-muted-foreground dark:text-foreground/80 truncate tabular-nums">
                        {formatSlotTimeRange(appointment)}
                      </div>
                    )}
                    {segments.length > 0 && visibleFields.service && (
                      <div className="text-[10px] text-muted-foreground dark:text-foreground/85 truncate mt-0.5">
                        {segments.map((s) => (s.recursoName ? `${s.label} [${s.recursoName}]` : s.label)).join(' · ')}
                      </div>
                    )}
                    {visibleFields.service && !segments.length && appointment.serviceName && (
                      <div className="text-xs text-muted-foreground dark:text-foreground/85 truncate mt-0.5 font-medium">
                        {appointment.serviceCode ? `${appointment.serviceCode} - ` : ''}{appointment.serviceName}
                      </div>
                    )}
                    {(appointment.paymentOnlyLabels?.length ?? 0) > 0 && (
                      <div className="text-[10px] text-amber-800 dark:text-amber-200 truncate mt-0.5" title="Solo cobro, no reservan slot">
                        + {appointment.paymentOnlyLabels!.join(' · ')}
                      </div>
                    )}
                    {slotDesc && (
                      <div className="text-xs text-muted-foreground dark:text-foreground/80 truncate mt-0.5">
                        {slotDesc}
                      </div>
                    )}
                    {typeof appointment.totalAmount === 'number' && (
                      <div className="text-xs text-foreground font-semibold truncate mt-0.5 tabular-nums">
                        {appointment.totalAmount.toFixed(2)} EUR
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
                {/* Columna de tiempo — etiqueta sobre la línea del slot */}
                <div
                  className={`sticky left-0 z-[26] relative border-r border-border shadow-[2px_0_4px_rgba(0,0,0,0.06)] ${
                    isHourMark
                      ? 'border-t-2 border-border bg-muted'
                      : 'border-t border-border bg-muted/60'
                  } ${timeShade ? UNAVAILABLE_TIME_GUTTER : ''}`}
                  style={{ height: `${cellHeight}px`, minHeight: `${cellHeight}px` }}
                >
                  <span
                    className={`absolute left-0 right-0 top-0 z-[1] -translate-y-1/2 text-center leading-none px-2.5 ${
                      isHourMark
                        ? 'text-sm font-semibold text-foreground tabular-nums'
                        : 'text-xs font-medium text-muted-foreground dark:text-foreground/75 tabular-nums'
                    } ${timeShade ? '!text-neutral-700 dark:!text-neutral-300' : ''}`}
                  >
                    <span
                      className={`inline-block px-1.5 ${
                        isHourMark ? 'bg-muted' : 'bg-muted/60'
                      } ${timeShade ? 'bg-neutral-300/95 dark:bg-neutral-800/95' : ''}`}
                    >
                      {slot.time}
                    </span>
                  </span>
                </div>

                {/* Columnas de empleados - siempre renderizar todas las celdas */}
                {employees.map((employee) => {
                  const isOccupied = isSlotOccupiedByAppointment(employee.id, slot.time);
                  const isHighlighted = isSlotHighlighted(employee.id, slot.time);
                  const meta = employeeAgendaById[employee.id] ?? { weekly: null, blocks: [] };
                  const { bookable, blocked, schedulingAllowed } = slotBookableForAgenda(
                    dateKey,
                    slotS,
                    slotE,
                    centerHours,
                    meta.weekly,
                    meta.blocks,
                  );
                  const shade = !bookable && !isOccupied;
                  const canSchedule = !isOccupied && schedulingAllowed;
                  
                  return (
                    <div
                      key={`${employee.id}-${slot.time}`}
                      className={`relative border-r border-border transition-colors ${
                        isHourMark ? 'border-t-2 border-border' : 'border-t border-border'
                      } ${
                        isOccupied
                          ? 'bg-muted/50'
                          : shade
                            ? blocked
                              ? UNAVAILABLE_CELL_BLOCKED
                              : `${UNAVAILABLE_CELL} cursor-pointer hover:bg-accent/50`
                            : 'bg-card cursor-pointer hover:bg-accent/40'
                      } ${isHighlighted ? 'bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700' : ''}`}
                      style={{ height: `${cellHeight}px` }}
                      title={
                        shade && canSchedule
                          ? 'Fuera del horario habitual — clic para cita excepcional'
                          : blocked
                            ? 'No disponible (bloqueo de agenda)'
                            : undefined
                      }
                      onClick={() => canSchedule && onSlotClick(employee.id, slot.time)}
                      onDragOver={(e) => canSchedule && handleDragOver(e, employee.id, slot.time)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => canSchedule && handleDrop(e, employee.id, slot.time)}
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
