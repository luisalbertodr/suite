import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { CustomerLookupRow } from '@/hooks/useCustomerLookup';
import { readLeadField } from './marketingFormatters';
import type { MarketingFilters, SortField, SortDir } from './MarketingFiltersPopover';

const readDateField = (lead: MarketingLead, field: MarketingFilters['dateField']): string | null => {
  switch (field) {
    case 'external_created_at':
      return lead.external_created_at ?? lead.created_at;
    case 'created_at':
      return lead.created_at;
    case 'updated_at':
      return lead.updated_at;
    default:
      return null;
  }
};

const dayStart = (isoDate: string): number => new Date(`${isoDate}T00:00:00`).getTime();
const dayEnd = (isoDate: string): number => new Date(`${isoDate}T23:59:59.999`).getTime();

export const leadMatchesFilters = (
  lead: MarketingLead,
  filters: MarketingFilters,
  matchedCustomer: CustomerLookupRow | null,
): boolean => {
  if (filters.hideLinked && matchedCustomer) return false;

  if (filters.dateFrom || filters.dateTo) {
    const raw = readDateField(lead, filters.dateField);
    if (!raw) return false;
    const ts = new Date(raw).getTime();
    if (Number.isNaN(ts)) return false;
    if (filters.dateFrom && ts < dayStart(filters.dateFrom)) return false;
    if (filters.dateTo && ts > dayEnd(filters.dateTo)) return false;
  }

  if (filters.formName && (lead.form_name ?? '') !== filters.formName) return false;
  if (filters.source && (lead.source ?? '') !== filters.source) return false;

  const win = (lead.win_status ?? '').toUpperCase();
  if (filters.winStatus === 'won' && win !== 'GANADO') return false;
  if (filters.winStatus === 'lost' && win !== 'PERDIDO') return false;
  if (filters.winStatus === 'open' && (win === 'GANADO' || win === 'PERDIDO')) return false;

  const value = Number(lead.value ?? 0);
  if (filters.valueMin) {
    const min = Number(filters.valueMin);
    if (Number.isFinite(min) && value < min) return false;
  }
  if (filters.valueMax) {
    const max = Number(filters.valueMax);
    if (Number.isFinite(max) && value > max) return false;
  }

  if (filters.fieldKey && filters.fieldContains.trim()) {
    const raw = readLeadField(lead, filters.fieldKey);
    const hay = String(raw ?? '').toLowerCase();
    if (!hay.includes(filters.fieldContains.trim().toLowerCase())) return false;
  }

  return true;
};

export const compareLeads = (
  a: MarketingLead,
  b: MarketingLead,
  field: SortField,
  dir: SortDir,
): number => {
  const mul = dir === 'asc' ? 1 : -1;
  const read = (l: MarketingLead): string | number | null => {
    switch (field) {
      case 'created_at': return l.created_at;
      case 'external_created_at': return l.external_created_at ?? l.created_at;
      case 'updated_at': return l.updated_at;
      case 'first_name': return (l.first_name ?? '').toLowerCase();
      case 'phone': return (l.phone ?? '').replace(/\D/g, '');
      case 'value': return Number(l.value ?? 0);
      case 'form_name': return (l.form_name ?? '').toLowerCase();
      default: return null;
    }
  };
  const va = read(a);
  const vb = read(b);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  if (typeof va === 'number' && typeof vb === 'number') {
    return (va - vb) * mul;
  }
  const sa = String(va);
  const sb = String(vb);
  if (field === 'created_at' || field === 'external_created_at' || field === 'updated_at') {
    return (new Date(sa).getTime() - new Date(sb).getTime()) * mul;
  }
  return sa.localeCompare(sb, 'es') * mul;
};

export const collectDistinctValues = (
  leads: MarketingLead[],
  pick: (l: MarketingLead) => string | null | undefined,
): string[] => {
  const set = new Set<string>();
  for (const lead of leads) {
    const v = pick(lead)?.trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
};
