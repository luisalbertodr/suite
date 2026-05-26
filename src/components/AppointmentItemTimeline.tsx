import React from 'react';
import type { AppointmentTimeSegment } from '@/types/agenda';
import { hhmmToMinutes } from '@/lib/agendaAppointmentItems';
import { segmentAppearance } from '@/lib/agendaResourceColors';

export interface AppointmentItemTimelineProps {
  startTime: string;
  endTime: string;
  segments: AppointmentTimeSegment[];
  compact?: boolean;
  className?: string;
}

export const AppointmentItemTimeline: React.FC<AppointmentItemTimelineProps> = ({
  startTime,
  endTime,
  segments,
  compact = false,
  className = '',
}) => {
  const rangeStart = hhmmToMinutes(startTime);
  const rangeEnd = Math.max(rangeStart + 1, hhmmToMinutes(endTime));
  const span = rangeEnd - rangeStart;

  if (!segments.length) {
    return (
      <div
        className={`rounded border border-dashed border-muted-foreground/30 bg-muted/20 text-[10px] text-muted-foreground px-2 py-1 ${className}`}
      >
        Sin reserva de tiempo en esta cita
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div
        className={`relative w-full overflow-hidden rounded border bg-muted/30 ${
          compact ? 'h-3' : 'h-8'
        }`}
        aria-label="Línea de tiempo de la cita"
      >
        {segments.map((seg) => {
          const segStart = hhmmToMinutes(seg.startTime);
          const segEnd = hhmmToMinutes(seg.endTime);
          const left = ((segStart - rangeStart) / span) * 100;
          const width = Math.max(2, ((segEnd - segStart) / span) * 100);
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
              className={`absolute top-0 bottom-0 ${barClass}`}
              style={{ left: `${left}%`, width: `${width}%`, ...style }}
              title={title}
            />
          );
        })}
      </div>
      {!compact && (
        <div className="space-y-0.5">
          {segments.map((seg) => (
            <div key={`lbl-${seg.clientKey}`} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span
                className="w-2 h-2 rounded-full shrink-0 border border-black/10"
                style={
                  seg.recursoColor && /^#[0-9A-Fa-f]{6}$/.test(seg.recursoColor)
                    ? { backgroundColor: seg.recursoColor }
                    : undefined
                }
              />
              <span className="tabular-nums shrink-0 font-medium text-foreground">
                {seg.startTime}–{seg.endTime}
              </span>
              <span className="truncate">
                {seg.label}
                {seg.recursoName ? ` (${seg.recursoName})` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
