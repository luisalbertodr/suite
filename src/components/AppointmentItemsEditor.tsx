import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { AppointmentItemDraft, AppointmentItemKind, BonusPaymentMode } from '@/types/agenda';
import { calcEndFromStart, effectiveDurationMinutes } from '@/lib/agendaAppointmentItems';
import { appointmentItemLineTotal, appointmentItemsTotal } from '@/lib/agendaAppointmentPricing';

function newClientKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function reorderItems(items: AppointmentItemDraft[], from: number, to: number): AppointmentItemDraft[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export interface AppointmentItemsEditorProps {
  startTime: string;
  items: AppointmentItemDraft[];
  onChange: (items: AppointmentItemDraft[]) => void;
}

export const AppointmentItemsEditor: React.FC<AppointmentItemsEditorProps> = ({
  startTime,
  items,
  onChange,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const endPreview = calcEndFromStart(startTime, effectiveDurationMinutes(items));

  const updateAt = useCallback(
    (index: number, patch: Partial<AppointmentItemDraft>) => {
      onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    },
    [items, onChange]
  );

  const addItem = () => {
    onChange([
      ...items,
      {
        clientKey: newClientKey(),
        kind: 'service',
        label: '',
        duration_minutes: 15,
        occupies_time: true,
        quantity: 1,
        unit_price: 0,
        bonus_payment_mode: 'none',
      },
    ]);
  };

  const removeAt = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const totalPreview = appointmentItemsTotal(items);

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">Ítems de la cita</Label>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground tabular-nums">Fin: {endPreview}</span>
          <span className="text-[10px] font-medium tabular-nums">Total: {totalPreview.toFixed(2)} EUR</span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">
        Arrastra el asa para ordenar. Solo los ítems con «ocupa tiempo» suman duración.
      </p>
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
        {items.map((item, index) => (
          <div
            key={item.clientKey}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
              if (Number.isNaN(from)) return;
              onChange(reorderItems(items, from, index));
              setDragIndex(null);
            }}
            className={`flex flex-wrap items-center gap-1 rounded border bg-background p-1.5 text-xs ${
              dragIndex === index ? 'opacity-70 ring-1 ring-primary/40' : ''
            }`}
          >
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
              }}
              onDragEnd={() => setDragIndex(null)}
              className="cursor-grab touch-none text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Arrastrar para reordenar"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <Select
              value={item.kind}
              onValueChange={(v) => updateAt(index, { kind: v as AppointmentItemKind })}
            >
              <SelectTrigger className="h-7 w-[88px] text-[11px] px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Servicio</SelectItem>
                <SelectItem value="product">Producto</SelectItem>
                <SelectItem value="bonus">Bono</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-7 min-w-[100px] flex-1 text-xs px-1.5"
              placeholder="Nombre"
              value={item.label}
              onChange={(e) => updateAt(index, { label: e.target.value })}
            />
            <div className="flex items-center gap-0.5">
              <Input
                type="number"
                min={0}
                step={5}
                className="h-7 w-12 text-xs px-1"
                value={item.duration_minutes}
                onChange={(e) => updateAt(index, { duration_minutes: parseInt(e.target.value, 10) || 0 })}
              />
              <span className="text-[10px] text-muted-foreground">min</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Tiempo</span>
              <Switch
                checked={item.occupies_time}
                onCheckedChange={(checked) => updateAt(index, { occupies_time: checked })}
                className="scale-75 origin-center"
              />
            </div>
            {item.kind === 'bonus' ? (
              <div className="flex items-center gap-1">
                <Select
                  value={item.bonus_payment_mode ?? 'none'}
                  onValueChange={(v) => updateAt(index, { bonus_payment_mode: v as BonusPaymentMode })}
                >
                  <SelectTrigger className="h-7 w-[78px] text-[11px] px-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cobro</SelectItem>
                    <SelectItem value="full">100%</SelectItem>
                    <SelectItem value="60">60%</SelectItem>
                    <SelectItem value="40">40%</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-7 w-16 text-xs px-1"
                  value={item.unit_price ?? 0}
                  onChange={(e) => updateAt(index, { unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-7 w-14 text-xs px-1"
                  value={item.quantity ?? 1}
                  onChange={(e) => updateAt(index, { quantity: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-7 w-16 text-xs px-1"
                  value={item.unit_price ?? 0}
                  onChange={(e) => updateAt(index, { unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
            <span className="text-[10px] tabular-nums min-w-[55px] text-right">
              {appointmentItemLineTotal(item).toFixed(2)} EUR
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              disabled={items.length <= 1}
              onClick={() => removeAt(index)}
              aria-label="Quitar ítem"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="h-7 w-full text-xs gap-1" onClick={addItem}>
        <Plus className="w-3 h-3" /> Añadir ítem
      </Button>
    </div>
  );
}
