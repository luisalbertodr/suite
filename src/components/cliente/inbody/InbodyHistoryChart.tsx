import React, { useMemo, useState } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';
import {
  INBODY_CHART_PARAM_GROUPS,
  INBODY_CHART_PARAMS,
  buildInbodyChartSeries,
  formatChartValue,
  type InbodyChartParam,
  type InbodyChartParamId,
} from '@/lib/inbodyChartParams';
import { inbodyGlossaryForChartParam } from '@/lib/inbodyGlossary';
import { InbodyMetricHelp } from './InbodyMetricHelp';

interface Props {
  measurements: InbodyMeasurement[];
  selectedId?: string | null;
  compact?: boolean;
  onSelectSession?: (id: string) => void;
}

const chartConfig = {
  value: {
    label: 'Valor',
    theme: {
      light: 'hsl(199 89% 42%)',
      dark: 'hsl(199 95% 72%)',
    },
  },
} satisfies ChartConfig;

const CHART_GROUP_ORDER: InbodyChartParam['group'][] = [
  'composicion',
  'diagnostico',
  'control',
  'segmental',
];

export const InbodyHistoryChart: React.FC<Props> = ({
  measurements,
  selectedId,
  compact,
  onSelectSession,
}) => {
  const [paramId, setParamId] = useState<InbodyChartParamId>('weight_kg');
  const param = INBODY_CHART_PARAMS.find((p) => p.id === paramId)!;
  const glossaryId = inbodyGlossaryForChartParam(paramId);

  const series = useMemo(
    () => buildInbodyChartSeries(measurements, paramId, selectedId),
    [measurements, paramId, selectedId],
  );

  const rangeBand = useMemo(() => {
    const withRange = series.filter((p) => p.min != null && p.max != null);
    if (withRange.length === 0) return null;
    const latest = withRange[withRange.length - 1];
    return { min: latest.min!, max: latest.max! };
  }, [series]);

  if (measurements.length < 2) return null;

  const groupedParams = INBODY_CHART_PARAMS.reduce(
    (acc, p) => {
      (acc[p.group] ||= []).push(p);
      return acc;
    },
    {} as Record<string, typeof INBODY_CHART_PARAMS>,
  );

  return (
    <Card className="border-sky-100/50 dark:border-sky-900/20">
      <CardHeader className={cn('pb-2', compact && 'py-3')}>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
          <CardTitle className={cn('text-sm flex items-center gap-2', compact && 'text-xs')}>
            <TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-300" />
            Evolución por sesiones
          </CardTitle>
          <div className={cn('w-full sm:w-56 space-y-1', compact && 'sm:w-44')}>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Parámetro</Label>
            <Select value={paramId} onValueChange={(v) => setParamId(v as InbodyChartParamId)}>
              <SelectTrigger className={cn('h-9', compact && 'h-8 text-xs')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100] max-h-80">
                {CHART_GROUP_ORDER.map((group) => {
                  const params = groupedParams[group];
                  if (!params?.length) return null;
                  return (
                  <SelectGroup key={group}>
                    <SelectLabel>{INBODY_CHART_PARAM_GROUPS[group]}</SelectLabel>
                    {params.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                        {p.unit ? ` (${p.unit})` : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            {glossaryId && (
              <div className="pt-1">
                <InbodyMetricHelp
                  metricId={glossaryId}
                  label={param.label}
                  labelClassName="text-[11px] font-normal text-muted-foreground"
                />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn('pb-4', compact && 'px-3 pb-3')}>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay datos de «{param.label}» en las sesiones registradas.
          </p>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className={cn(
                'w-full [&_.recharts-cartesian-grid_line]:stroke-border/60',
                compact ? 'h-[200px]' : 'h-[260px]',
              )}
            >
              <LineChart
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
                  tickFormatter={(v) => Number(v).toFixed(param.decimals > 0 ? 1 : 0)}
                  domain={['auto', 'auto']}
                />
                {rangeBand && (
                  <>
                    <ReferenceLine
                      y={rangeBand.min}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                    />
                    <ReferenceLine
                      y={rangeBand.max}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                    />
                  </>
                )}
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as { tooltipLabel?: string } | undefined;
                        return row?.tooltipLabel ?? '';
                      }}
                      formatter={(value) =>
                        formatChartValue(Number(value), param.decimals, param.unit)
                      }
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-value)"
                  strokeWidth={2}
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
                        fill={selected ? 'hsl(var(--primary))' : 'var(--color-value)'}
                        stroke="hsl(var(--foreground) / 0.45)"
                        strokeWidth={selected ? 2.5 : 1.75}
                        className="drop-shadow-sm dark:drop-shadow-[0_0_4px_hsl(199_95%_72%/0.85)]"
                      />
                    );
                  }}
                  activeDot={{
                    r: 7,
                    fill: 'var(--color-value)',
                    stroke: 'hsl(var(--foreground) / 0.6)',
                    strokeWidth: 2.5,
                  }}
                  connectNulls
                />
              </LineChart>
            </ChartContainer>
            {rangeBand && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Líneas punteadas: rango normal de la última sesión (
                {formatChartValue(rangeBand.min, param.decimals, param.unit)} –{' '}
                {formatChartValue(rangeBand.max, param.decimals, param.unit)})
              </p>
            )}
            {onSelectSession && (
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Pulsa un punto para ver el informe de esa sesión.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
