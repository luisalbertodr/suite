import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { QuestionnaireField } from '@/lib/questionnaireTypes';

type Props = {
  field: QuestionnaireField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
};

export function QuestionnaireFieldInput({ field, value, onChange, disabled }: Props) {
  const id = `qf-${field.key}`;

  if (field.type === 'textarea') {
    return (
      <div className={cn('space-y-1', field.fullWidth && 'col-span-full')}>
        <Label htmlFor={id}>{field.label}</Label>
        <Textarea
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === 'single' && field.options) {
    return (
      <div className={cn('space-y-2', field.fullWidth && 'col-span-full')}>
        <Label>{field.label}</Label>
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => (
            <label
              key={opt}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer',
                value === opt ? 'border-sky-500 bg-sky-50' : 'border-border',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <input
                type="radio"
                name={field.key}
                checked={value === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
                className="accent-sky-600"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'multi' && field.options) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (opt: string) => {
      if (disabled) return;
      if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt));
      else onChange([...selected, opt]);
    };
    return (
      <div className={cn('space-y-2', field.fullWidth && 'col-span-full')}>
        <Label>{field.label}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {field.options.map((opt) => (
            <label
              key={opt}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer',
                selected.includes(opt) ? 'border-sky-500 bg-sky-50' : 'border-border',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} disabled={disabled} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className={cn('space-y-1', field.fullWidth && 'col-span-full')}>
        <label className={cn('flex items-start gap-2 text-sm cursor-pointer', disabled && 'opacity-60 cursor-not-allowed')}>
          <Checkbox
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(v) => onChange(v === true)}
          />
          <span>{field.label}{field.required ? ' *' : ''}</span>
        </label>
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{field.label}</Label>
        <Input
          id={id}
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{field.label}</Label>
        <Input
          id={id}
          type="number"
          value={value != null && value !== '' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', field.fullWidth && 'col-span-full')}>
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={field.placeholder}
      />
    </div>
  );
}
