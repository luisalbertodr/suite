import React from 'react';
import { BillingEntityToggle, type BillingEntityToggleValue } from '@/components/BillingEntityToggle';

export type BillingEntityTabValue = BillingEntityToggleValue;

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
}) => (
  <BillingEntityToggle
    value={value}
    onChange={onChange}
    showAll={showAllTab}
    allLabel={allLabel}
    className={className}
  />
);

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
