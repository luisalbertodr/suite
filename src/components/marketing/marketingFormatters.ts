import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { MarketingFieldConfig } from '@/hooks/useMarketingFieldConfig';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatLeadFieldValue = (
  value: unknown,
  type: MarketingFieldConfig['field_type'],
): string => {
  if (value === null || value === undefined || value === '') return '—';
  const str = Array.isArray(value) ? value.join(', ') : String(value);

  switch (type) {
    case 'currency': {
      const n = Number(value);
      if (Number.isFinite(n)) return currencyFormatter.format(n);
      return str;
    }
    case 'number': {
      const n = Number(value);
      if (Number.isFinite(n)) return new Intl.NumberFormat('es-ES').format(n);
      return str;
    }
    case 'datetime': {
      const d = new Date(str);
      if (!Number.isNaN(d.getTime())) return dateFormatter.format(d);
      return str;
    }
    case 'phone':
      return str;
    case 'email':
      return str;
    default:
      return str;
  }
};

const isStandardKey = (key: string) =>
  [
    'value',
    'phone',
    'email',
    'first_name',
    'last_name',
    'form_name',
    'campaign',
    'source',
    'created_at',
    'external_created_at',
    'last_contacted_at',
  ].includes(key);

export const readLeadField = (lead: MarketingLead, fieldKey: string): unknown => {
  if (isStandardKey(fieldKey)) {
    switch (fieldKey) {
      case 'created_at':
        return lead.external_created_at ?? lead.created_at;
      case 'value':
        return lead.value;
      default:
        return (lead as unknown as Record<string, unknown>)[fieldKey];
    }
  }
  const fieldData = Array.isArray(lead.field_data)
    ? (lead.field_data as Array<{ name: string; values?: string[] }>)
    : [];
  const entry = fieldData.find((f) => f.name === fieldKey);
  if (!entry) return null;
  const v = entry.values && entry.values.length > 0 ? entry.values[0] : null;
  return v;
};

export const getLeadFullName = (lead: MarketingLead): string => {
  const parts = [lead.first_name, lead.last_name].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(' ');
  if (lead.email) return lead.email;
  if (lead.phone) return lead.phone;
  return 'Sin nombre';
};

export const getLeadSubtitle = (lead: MarketingLead): string => {
  const candidates = [lead.form_name, lead.campaign, lead.source]
    .filter(Boolean) as string[];
  return candidates[0] ?? '';
};

export const humanizeFieldKey = (key: string): string => {
  return key
    .replace(/[_\-]+/g, ' ')
    .replace(/\?/g, '')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
};
