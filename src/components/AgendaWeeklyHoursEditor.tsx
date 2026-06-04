import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import {
  type AgendaDayHoursMap,
  type AgendaTimeSegment,
  hhmmToMinutes,
  minutesToHHmm,
} from '@/lib/agendaHours';

const DAY_ROWS: { key: string; label: string }[] = [
  { key: '0', label: 'Domingo' },
  { key: '1', label: 'Lunes' },
  { key: '2', label: 'Martes' },
  { key: '3', label: 'Miércoles' },
  { key: '4', label: 'Jueves' },
  { key: '5', label: 'Viernes' },
  { key: '6', label: 'Sábado' },
];

function suggestNextSegment(segs: AgendaTimeSegment[]): AgendaTimeSegment {
  if (segs.length === 0) return { open: '10:00', close: '14:00' };
  const last = segs[segs.length - 1]!;
  const afterClose = hhmmToMinutes(last.close) + 60;
  const openMin = Math.min(Math.max(afterClose, 8 * 60), 20 * 60);
  const closeMin = Math.min(openMin + 4 * 60, 23 * 60 + 30);
  return { open: minutesToHHmm(openMin), close: minutesToHHmm(closeMin) };
}

function patchDay(
  map: AgendaDayHoursMap,
  dayKey: string,
  segments: AgendaTimeSegment[],
): AgendaDayHoursMap {
  return { ...map, [dayKey]: segments };
}

function patchSegment(
  map: AgendaDayHoursMap,
  dayKey: string,
  index: number,
  patch: Partial<AgendaTimeSegment>,
): AgendaDayHoursMap {
  const segs = [...(map[dayKey] ?? [])];
  const cur = segs[index];
  if (!cur) return map;
  segs[index] = { ...cur, ...patch };
  return patchDay(map, dayKey, segs);
}

export type AgendaWeeklyHoursEditorProps = {
  value: AgendaDayHoursMap;
  onChange: (next: AgendaDayHoursMap) => void;
  /** Prefijo para ids de accesibilidad (p. ej. empleado o centro). */
  idPrefix: string;
  dayLabelClassName?: string;
};

export const AgendaWeeklyHoursEditor: React.FC<AgendaWeeklyHoursEditorProps> = ({
  value,
  onChange,
  idPrefix,
  dayLabelClassName = 'w-24 text-xs font-medium text-muted-foreground shrink-0',
}) => {
  return (
    <div className="space-y-3">
      {DAY_ROWS.map(({ key, label }) => {
        const segs = value[key] ?? [];
        const closed = segs.length === 0;

        return (
          <div key={key} className="border-b border-dashed pb-3 space-y-2 last:border-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className={dayLabelClassName}>{label}</div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${idPrefix}-${key}-closed`}
                  checked={closed}
                  onCheckedChange={(v) => {
                    const on = v === true;
                    onChange(patchDay(value, key, on ? [] : [{ open: '10:00', close: '14:00' }]));
                  }}
                />
                <Label htmlFor={`${idPrefix}-${key}-closed`} className="text-xs cursor-pointer">
                  Cerrado
                </Label>
              </div>
              {!closed && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => onChange(patchDay(value, key, [...segs, suggestNextSegment(segs)]))}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir franja
                </Button>
              )}
            </div>

            {!closed && (
              <div className="space-y-1.5 pl-0 sm:pl-[calc(theme(spacing.24)+0.75rem)]">
                {segs.map((seg, idx) => (
                  <div
                    key={`${key}-${idx}`}
                    className="flex flex-wrap items-end gap-2 rounded-md bg-muted/30 px-2 py-1.5"
                  >
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Desde</Label>
                      <Input
                        type="time"
                        className="h-8 w-28"
                        value={seg.open}
                        onChange={(e) => onChange(patchSegment(value, key, idx, { open: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground">Hasta</Label>
                      <Input
                        type="time"
                        className="h-8 w-28"
                        step={300}
                        value={seg.close}
                        onChange={(e) => onChange(patchSegment(value, key, idx, { close: e.target.value }))}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      title={segs.length <= 1 ? 'Marcar día como cerrado' : 'Quitar franja'}
                      onClick={() => {
                        const next = segs.filter((_, i) => i !== idx);
                        onChange(patchDay(value, key, next));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {segs.length > 1 && (
                  <p className="text-[10px] text-muted-foreground px-0.5">
                    Puedes definir varios tramos el mismo día (p. ej. mañana y tarde).
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
