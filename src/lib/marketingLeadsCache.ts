import type { MarketingLead } from '@/hooks/useMarketingLeads';

export function sortMarketingLeadsNewestFirst(leads: MarketingLead[]): MarketingLead[] {
  return [...leads].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** Aplica un evento realtime de marketing_leads sobre la caché de React Query. */
export function patchMarketingLeadsCache(
  prev: MarketingLead[] | undefined,
  payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown> | null;
    old: Record<string, unknown> | null;
  },
): MarketingLead[] | undefined {
  if (!prev) return prev;

  if (payload.eventType === 'DELETE') {
    const id = String(payload.old?.id ?? '');
    if (!id) return prev;
    return prev.filter((l) => l.id !== id);
  }

  const row = payload.new as MarketingLead | null;
  if (!row?.id) return prev;

  if (row.archived_at != null) {
    return prev.filter((l) => l.id !== row.id);
  }

  const idx = prev.findIndex((l) => l.id === row.id);
  if (idx >= 0) {
    const next = [...prev];
    next[idx] = row;
    return next;
  }

  return sortMarketingLeadsNewestFirst([row, ...prev]);
}
