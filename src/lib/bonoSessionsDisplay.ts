export type BonoCoverageLike = {
  covered_quantity?: number | null;
  used_quantity?: number | null;
  remaining?: number;
};

export type BonoSessionsSource = {
  sesiones_totales?: number | null;
  sesiones_usadas?: number | null;
  remaining?: number;
  coverage_items?: BonoCoverageLike[];
};

/** Sesiones restantes: prioriza cobertura por servicio; si no hay, contador global del bono. */
export function bonoSessionsDisplay(b: BonoSessionsSource): { remaining: number; total: number } {
  const items = b.coverage_items ?? [];
  if (items.length > 0) {
    const remaining = items.reduce((sum, it) => {
      if (typeof it.remaining === 'number') return sum + Math.max(0, it.remaining);
      const covered = Number(it.covered_quantity ?? 0);
      const used = Number(it.used_quantity ?? 0);
      return sum + Math.max(0, covered - used);
    }, 0);
    const total = items.reduce((sum, it) => sum + Number(it.covered_quantity ?? 0), 0);
    if (total > 0) return { remaining, total };
  }
  const total = Math.max(0, Number(b.sesiones_totales ?? 0));
  const remaining =
    typeof b.remaining === 'number'
      ? Math.max(0, b.remaining)
      : Math.max(0, total - Number(b.sesiones_usadas ?? 0));
  return { remaining, total };
}

export function formatBonoSessionsLabel(b: BonoSessionsSource): string {
  const { remaining, total } = bonoSessionsDisplay(b);
  return `${remaining}/${total} ses.`;
}
