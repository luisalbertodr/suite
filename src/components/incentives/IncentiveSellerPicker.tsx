import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import type { IncentiveShare } from '@/lib/incentives';

type Props = {
  value: IncentiveShare[];
  onChange: (shares: IncentiveShare[]) => void;
  disabled?: boolean;
};

export const IncentiveSellerPicker: React.FC<Props> = ({ value, onChange, disabled }) => {
  const { employees, isLoading } = useAgendaEmployees({ agendaOnly: true });
  const selected = new Map(value.map((s) => [s.employee_id, s.share_pct]));

  const redistribute = (shares: IncentiveShare[]) => {
    if (shares.length === 0) {
      onChange([]);
      return;
    }
    const even = Math.floor((100 / shares.length) * 100) / 100;
    const next = shares.map((s, i) => ({
      ...s,
      share_pct:
        i === shares.length - 1
          ? Math.round((100 - even * (shares.length - 1)) * 100) / 100
          : even,
    }));
    onChange(next);
  };

  const toggle = (id: string, checked: boolean) => {
    if (!checked) {
      redistribute(value.filter((s) => s.employee_id !== id));
      return;
    }
    redistribute([...value, { employee_id: id, share_pct: 0 }]);
  };

  const setPct = (id: string, pct: number) => {
    onChange(value.map((s) => (s.employee_id === id ? { ...s, share_pct: pct } : s)));
  };

  return (
    <div className="space-y-2">
      <Label>Imputar venta a empleada(s)</Label>
      <p className="text-xs text-muted-foreground">
        Si la venta es compartida, reparte el porcentaje de horas. El cupo mensual cuenta para cada una.
      </p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando empleadas…</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {employees.map((emp) => {
            const checked = selected.has(emp.id);
            const pct = selected.get(emp.id) ?? 0;
            return (
              <label key={emp.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(v) => toggle(emp.id, v === true)}
                />
                <span className="flex-1 truncate">{emp.name}</span>
                {checked ? (
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    className="h-7 w-16"
                    disabled={disabled}
                    value={pct}
                    onChange={(e) => setPct(emp.id, Number(e.target.value) || 0)}
                  />
                ) : null}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};
