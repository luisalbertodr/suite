import React from 'react';

import type { BillingEntityView } from '@/lib/salesRevenue';

export type DashboardSeriesId =
  | 'fact_total'
  | 'fact_med'
  | 'fact_est'
  | 'gasto_total'
  | 'gasto_med'
  | 'gasto_est'
  | 'benef_total'
  | 'benef_med'
  | 'benef_est';

export type DashboardSeriesMeta = {
  id: DashboardSeriesId;
  label: string;
  group: 'facturacion' | 'gasto' | 'beneficio';
  entity: 'total' | 'medicina' | 'estetica';
  dataKey: (year: number) => string;
  strokeForYear: (yearColor: string) => string;
  strokeWidth: number;
  strokeDasharray?: string;
  defaultOn: boolean;
};

export const DASHBOARD_SERIES: DashboardSeriesMeta[] = [
  {
    id: 'fact_total',
    label: 'Fact. Total',
    group: 'facturacion',
    entity: 'total',
    dataKey: (y) => String(y),
    strokeForYear: (c) => c,
    strokeWidth: 3,
    defaultOn: true,
  },
  {
    id: 'fact_med',
    label: 'Fact. Medicina',
    group: 'facturacion',
    entity: 'medicina',
    dataKey: (y) => `${y}_medicina`,
    strokeForYear: (c) => c,
    strokeWidth: 2,
    strokeDasharray: '6 3 2 3',
    defaultOn: true,
  },
  {
    id: 'fact_est',
    label: 'Fact. Estética',
    group: 'facturacion',
    entity: 'estetica',
    dataKey: (y) => `${y}_estetica`,
    strokeForYear: (c) => c,
    strokeWidth: 2,
    strokeDasharray: '4 3',
    defaultOn: true,
  },
  {
    id: 'gasto_total',
    label: 'Gasto Total',
    group: 'gasto',
    entity: 'total',
    dataKey: (y) => `${y}_gasto`,
    strokeForYear: () => '#dc2626',
    strokeWidth: 2.5,
    defaultOn: true,
  },
  {
    id: 'gasto_med',
    label: 'Gasto Medicina',
    group: 'gasto',
    entity: 'medicina',
    dataKey: (y) => `${y}_gasto_medicina`,
    strokeForYear: () => '#f97316',
    strokeWidth: 2,
    strokeDasharray: '6 3 2 3',
    defaultOn: true,
  },
  {
    id: 'gasto_est',
    label: 'Gasto Estética',
    group: 'gasto',
    entity: 'estetica',
    dataKey: (y) => `${y}_gasto_estetica`,
    strokeForYear: () => '#fb7185',
    strokeWidth: 2,
    strokeDasharray: '4 3',
    defaultOn: true,
  },
  {
    id: 'benef_total',
    label: 'Benef. Total',
    group: 'beneficio',
    entity: 'total',
    dataKey: (y) => `${y}_beneficio`,
    strokeForYear: () => '#059669',
    strokeWidth: 2.5,
    defaultOn: true,
  },
  {
    id: 'benef_med',
    label: 'Benef. Medicina',
    group: 'beneficio',
    entity: 'medicina',
    dataKey: (y) => `${y}_beneficio_medicina`,
    strokeForYear: () => '#0d9488',
    strokeWidth: 2,
    strokeDasharray: '6 3 2 3',
    defaultOn: true,
  },
  {
    id: 'benef_est',
    label: 'Benef. Estética',
    group: 'beneficio',
    entity: 'estetica',
    dataKey: (y) => `${y}_beneficio_estetica`,
    strokeForYear: () => '#14b8a6',
    strokeWidth: 2,
    strokeDasharray: '4 3',
    defaultOn: true,
  },
];

export function seriesForBillingView(
  isMultiEntity: boolean,
  billingView: BillingEntityView,
): DashboardSeriesMeta[] {
  if (!isMultiEntity) {
    return DASHBOARD_SERIES.filter((s) => s.entity === 'total');
  }
  if (billingView === 'medicina') {
    return DASHBOARD_SERIES.filter((s) => s.entity === 'medicina');
  }
  if (billingView === 'estetica') {
    return DASHBOARD_SERIES.filter((s) => s.entity === 'estetica');
  }
  return DASHBOARD_SERIES;
}

export function defaultDashboardSeriesVisibility(
  isMultiEntity: boolean,
  billingView: BillingEntityView,
): Record<DashboardSeriesId, boolean> {
  const enabled = new Set(seriesForBillingView(isMultiEntity, billingView).map((s) => s.id));
  const out = {} as Record<DashboardSeriesId, boolean>;
  for (const series of DASHBOARD_SERIES) {
    out[series.id] = enabled.has(series.id) ? series.defaultOn : false;
  }
  return out;
}

type Props = {
  years: number[];
  yearColor: (idx: number) => string;
  visibility: Record<DashboardSeriesId, boolean>;
  onToggle: (id: DashboardSeriesId) => void;
  series: DashboardSeriesMeta[];
};

export function DashboardSeriesLegend({
  years,
  yearColor,
  visibility,
  onToggle,
  series,
}: Props) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-44">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Años
        </p>
        <div className="flex flex-col gap-1">
          {years.map((year, idx) => (
            <div key={year} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ backgroundColor: yearColor(idx) }}
              />
              <span className="font-semibold tabular-nums text-foreground">{year}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Curvas
        </p>
        <div className="flex flex-col gap-0.5">
          {series.map((item) => {
            const on = visibility[item.id];
            const sample = item.strokeForYear(yearColor(0));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors ${
                  on
                    ? 'bg-muted/60 text-foreground'
                    : 'text-muted-foreground/60 hover:bg-muted/40'
                }`}
                aria-pressed={on}
                title={on ? 'Ocultar curva' : 'Mostrar curva'}
              >
                <svg width="18" height="8" aria-hidden className="shrink-0">
                  <line
                    x1="0"
                    y1="4"
                    x2="18"
                    y2="4"
                    stroke={sample}
                    strokeWidth={item.strokeWidth}
                    strokeDasharray={item.strokeDasharray}
                    opacity={on ? 1 : 0.35}
                  />
                </svg>
                <span className={on ? '' : 'line-through'}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
