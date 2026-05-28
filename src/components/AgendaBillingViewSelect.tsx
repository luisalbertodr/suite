import React from 'react';
import { Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { companyDisplayName } from '@/lib/billingCompany';
import type { AgendaBillingView } from '@/lib/agendaBillingView';

type AgendaBillingViewSelectProps = {
  value: AgendaBillingView;
  onChange: (value: AgendaBillingView) => void;
  className?: string;
};

export const AgendaBillingViewSelect: React.FC<AgendaBillingViewSelectProps> = ({
  value,
  onChange,
  className,
}) => {
  const { isMultiEntity, billingCompanies, loading } = useWorkCenter();

  if (loading || !isMultiEntity || billingCompanies.length <= 1) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-7 text-xs w-[9.5rem] shrink-0 ${className ?? ''}`}>
        <Building2 className="w-3.5 h-3.5 mr-1 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Vista agenda" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Ambas empresas</SelectItem>
        {billingCompanies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {companyDisplayName(c)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
