import React from 'react';
import { cn } from '@/lib/utils';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { companyDisplayName } from '@/lib/billingCompany';

export type BillingEntityToggleValue = 'all' | string;

type BillingEntityToggleProps = {
  value: BillingEntityToggleValue;
  onChange: (value: BillingEntityToggleValue) => void;
  /** Muestra opción «Todas» (p. ej. agenda). */
  showAll?: boolean;
  allLabel?: string;
  className?: string;
  disabled?: boolean;
};

/** Selector compacto M / E (empresa emisora del centro laboral). */
export const BillingEntityToggle: React.FC<BillingEntityToggleProps> = ({
  value,
  onChange,
  showAll = false,
  allLabel = 'Todas',
  className,
  disabled = false,
}) => {
  const { isMultiEntity, billingCompanies, loading } = useWorkCenter();

  if (loading || !isMultiEntity || billingCompanies.length <= 1) {
    return null;
  }

  const labelFor = (id: string) => {
    const c = billingCompanies.find((x) => x.id === id);
    return c?.short_name?.trim() || companyDisplayName(c ?? { short_name: null, name: '?' });
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border bg-muted/40 p-0.5 shrink-0',
        disabled && 'opacity-45 pointer-events-none',
        className,
      )}
      role="group"
      aria-label="Empresa emisora"
    >
      {showAll && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('all')}
          className={cn(
            'px-2 py-0.5 text-xs font-semibold rounded transition-colors',
            value === 'all'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {allLabel}
        </button>
      )}
      {billingCompanies.map((c) => (
        <button
          key={c.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(c.id)}
          title={companyDisplayName(c)}
          className={cn(
            'min-w-[1.75rem] px-2 py-0.5 text-xs font-bold rounded transition-colors',
            value === c.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {labelFor(c.id)}
        </button>
      ))}
    </div>
  );
};
