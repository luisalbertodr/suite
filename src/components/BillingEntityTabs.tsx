import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { companyDisplayName } from '@/lib/billingCompany';

export type BillingEntityTabValue = 'all' | string;

type BillingEntityTabsProps = {
  value: BillingEntityTabValue;
  onChange: (value: BillingEntityTabValue) => void;
  showAllTab?: boolean;
  allLabel?: string;
  className?: string;
};

export const BillingEntityTabs: React.FC<BillingEntityTabsProps> = ({
  value,
  onChange,
  showAllTab = false,
  allLabel = 'Todas',
  className,
}) => {
  const { isMultiEntity, billingCompanies, loading } = useWorkCenter();

  if (loading || !isMultiEntity || billingCompanies.length <= 1) return null;

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as BillingEntityTabValue)}
      className={className}
    >
      <TabsList className="h-8 flex-wrap">
        {showAllTab && (
          <TabsTrigger value="all" className="text-xs px-3">
            {allLabel}
          </TabsTrigger>
        )}
        {billingCompanies.map((c) => (
          <TabsTrigger key={c.id} value={c.id} className="text-xs px-3">
            {companyDisplayName(c)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

/** company_id efectivo para consultas filtradas por pestaña. */
export function resolveBillingScopeCompanyId(
  tab: BillingEntityTabValue,
  hostCompanyId: string | null | undefined,
): string | null {
  if (!hostCompanyId) return null;
  if (tab === 'all') return hostCompanyId;
  return tab;
}

/** IDs de empresa emisora para listados (facturas, etc.). */
export function billingCompanyIdsForTab(
  tab: BillingEntityTabValue,
  hostCompanyId: string | null | undefined,
  billingCompanies: Array<{ id: string }>,
): string[] {
  if (!hostCompanyId) return [];
  if (tab !== 'all') return [tab];
  if (billingCompanies.length > 1) return billingCompanies.map((c) => c.id);
  return [hostCompanyId];
}
