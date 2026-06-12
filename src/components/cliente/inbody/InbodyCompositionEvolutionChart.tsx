import React, { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';
import {
  buildInbodyCompositionSeries,
  formatChartValue,
  INBODY_COMPOSITION_SERIES,
} from '@/lib/inbodyChartParams';
import { InbodySectionHelp } from './InbodyMetricHelp';

interface Props {
  measurements: InbodyMeasurement[];
  selectedId?: string | null;
  compact?: boolean;
  onSelectSession?: (id: string) => void;
}

const chartConfig = {
  weight_kg: {
    label: 'Peso',
    theme: { light: 'hsl(199 89% 42%)', dark: 'hsl(199 95% 72%)' },
  },
  smm_kg: {
    label: 'MME',
    theme: { light: 'hsl(142 55% 40%)', dark: 'hsl(142 60% 55%)' },
  },
  body_fat_kg: {
    label: 'Masa grasa',
    theme: { light: 'hsl(32 90% 48%)', dark: 'hsl(32 95% 58%)' },
  },
} satisfies ChartConfig;

function dedupeTooltipPayload<T extends { dataKey?: string | number }>(
  payload: T[] | undefined,
): T[] | undefined {
  if (!payload?.length) return payload;
  const byKey = new Map<string, T>();
  for (const item of payload) {
    byKey.set(String(item.dataKey ?? ''), item);
  }
  return INBODY_COMPOSITION_SERIES.map((key) => byKey.get(key)).filter(Boolean) as T[];
}

export const InbodyCompositionEvolutionChart: React.FC<Props> = ({
  measurements,
  selectedId,
  compact,
  onSelectSession,
}) => {
  const series = useMemo(
    () => buildInbodyCompositionSeries(measurements, selectedId),
    [measurements, selectedId],
  );

  if (measurements.length < 2 || series.length < 2) return null;

  return (
    <Card className="border-sky-100/50 dark:border-sky-900/20">
      <CardHeader className={cn('pb-2', compact && 'py-3')}>
        <CardTitle className={cn('text-sm flex items-center gap-2', compact && 'text-xs')}>
          <Activity className="h-4 w-4 text-sky-600 dark:text-sky-300" />
          <InbodySectionHelp metricId="weight_kg" title="Evolución composición corporal" />
        </CardTitle>
        <p className="text-[10px] text-muted-foreground mt-1">
          Barras por sesión y curvas de tendencia para peso, MME y masa grasa (kg).
        </p>
      </CardHeader>
      <CardContent className={cn('pb-4', compact && 'px-3 pb-3')}>
        <ChartContainer
          config={chartConfig}
          className={cn(
            'w-full [&_.recharts-cartesian-grid_line]:stroke-border/60',
            compact ? 'h-[240px]' : 'h-[300px]',
          )}
        >
          <ComposedChart
            data={series}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            onClick={(state) => {
              const payload = state?.activePayload?.[0]?.payload as { id?: string } | undefined;
              if (payload?.id && onSelectSession) onSelectSession(payload.id);
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              tickFormatter={(v) => Number(v).toFixed(0)}
              domain={['auto', 'auto']}
              unit=" kg"
            />
            <ChartTooltip
              content={(tooltipProps) => (
                <ChartTooltipContent
                  {...tooltipProps}
                  payload={dedupeTooltipPayload(tooltipProps.payload)}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { tooltipLabel?: string } | undefined;
                    return row?.tooltipLabel ?? '';
                  }}
                  formatter={(value, name) => {
                    if (value == null || Number.isNaN(Number(value))) return null;
                    return formatChartValue(Number(value), 1, 'kg');
                  }}
                />
              )}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {INBODY_COMPOSITION_SERIES.map((key) => (
              <Bar
                key={`bar-${key}`}
                dataKey={key}
                fill={`var(--color-${key})`}
                radius={[3, 3, 0, 0]}
                barSize={compact ? 10 : 14}
                fillOpacity={0.35}
                legendType="none"
                isAnimationActive={false}
              />
            ))}
            {INBODY_COMPOSITION_SERIES.map((key) => (
              <Line
                key={`line-${key}`}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={2.5}
                connectNulls
                dot={(props) => {
                  const { cx, cy, payload, index } = props;
                  const row = payload as { id?: string; isSelected?: boolean };
                  const selected = row.isSelected;
                  if (cx == null || cy == null) return <g key={`dot-empty-${index ?? 0}`} />;
                  return (
                    <circle
                      key={row.id ?? `dot-${index ?? 0}`}
                      cx={cx}
                      cy={cy}
                      r={selected ? 5.5 : 4}
                      fill={`var(--color-${key})`}
                      stroke="hsl(var(--background))"
                      strokeWidth={selected ? 2.5 : 1.75}
                    />
                  );
                }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ChartContainer>
        {onSelectSession && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Pulsa una sesión para ver su informe detallado.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
