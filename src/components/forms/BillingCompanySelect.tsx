import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { companyDisplayName } from '@/lib/billingCompany';

const INHERIT_VALUE = '__inherit__';

type BillingCompanySelectProps = {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  label?: string;
  inheritLabel?: string;
  disabled?: boolean;
  className?: string;
};

export const BillingCompanySelect: React.FC<BillingCompanySelectProps> = ({
  value,
  onChange,
  label = 'Empresa emisora',
  inheritLabel = 'Por defecto (tenant / heredar familia)',
  disabled = false,
  className,
}) => {
  const { billingCompanies, isMultiEntity, loading } = useWorkCenter();

  if (loading) return null;
  if (!isMultiEntity || billingCompanies.length <= 1) return null;

  const selectValue = value ?? INHERIT_VALUE;

  return (
    <div className={className}>
      <Label className="text-sm font-medium text-gray-700 mb-1 block">{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === INHERIT_VALUE ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={inheritLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT_VALUE}>{inheritLabel}</SelectItem>
          {billingCompanies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {companyDisplayName(c)}
              {c.tpv_ticket_prefix ? ` (${c.tpv_ticket_prefix})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-1">
        Define qué razón social factura este elemento en el centro laboral.
      </p>
    </div>
  );
};
