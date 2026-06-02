import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';

export type InbodyChartParamId =
  | 'weight_kg'
  | 'smm_kg'
  | 'body_fat_kg'
  | 'tbw_kg'
  | 'ffm_kg'
  | 'slm_kg'
  | 'bmi'
  | 'pbf_pct'
  | 'whr'
  | 'bmr_kcal'
  | 'fat_control_kg'
  | 'muscle_control_kg'
  | 'lean_right_arm'
  | 'lean_left_arm'
  | 'lean_trunk'
  | 'lean_right_leg'
  | 'lean_left_leg'
  | 'fat_pct_trunk';

export interface InbodyChartParam {
  id: InbodyChartParamId;
  label: string;
  unit: string;
  decimals: number;
  group: 'composicion' | 'diagnostico' | 'control' | 'segmental';
  getValue: (m: InbodyMeasurement) => number | null | undefined;
  getMin?: (m: InbodyMeasurement) => number | null | undefined;
  getMax?: (m: InbodyMeasurement) => number | null | undefined;
}

export const INBODY_CHART_PARAMS: InbodyChartParam[] = [
  {
    id: 'weight_kg',
    label: 'Peso',
    unit: 'kg',
    decimals: 1,
    group: 'composicion',
    getValue: (m) => m.weight_kg,
    getMin: (m) => m.weight_min_kg,
    getMax: (m) => m.weight_max_kg,
  },
  {
    id: 'smm_kg',
    label: 'MME',
    unit: 'kg',
    decimals: 1,
    group: 'composicion',
    getValue: (m) => m.smm_kg,
    getMin: (m) => m.smm_min_kg,
    getMax: (m) => m.smm_max_kg,
  },
  {
    id: 'body_fat_kg',
    label: 'Masa grasa',
    unit: 'kg',
    decimals: 1,
    group: 'composicion',
    getValue: (m) => m.body_fat_kg,
    getMin: (m) => m.body_fat_min_kg,
    getMax: (m) => m.body_fat_max_kg,
  },
  {
    id: 'tbw_kg',
    label: 'ACT',
    unit: 'kg',
    decimals: 1,
    group: 'composicion',
    getValue: (m) => m.tbw_kg,
    getMin: (m) => m.tbw_min_kg,
    getMax: (m) => m.tbw_max_kg,
  },
  {
    id: 'ffm_kg',
    label: 'MLG',
    unit: 'kg',
    decimals: 1,
    group: 'composicion',
    getValue: (m) => m.ffm_kg,
    getMin: (m) => m.ffm_min_kg,
    getMax: (m) => m.ffm_max_kg,
  },
  {
    id: 'slm_kg',
    label: 'Masa blanda',
    unit: 'kg',
    decimals: 1,
    group: 'composicion',
    getValue: (m) => m.slm_kg,
  },
  {
    id: 'bmi',
    label: 'IMC',
    unit: '',
    decimals: 1,
    group: 'diagnostico',
    getValue: (m) => m.bmi,
    getMin: (m) => m.bmi_min,
    getMax: (m) => m.bmi_max,
  },
  {
    id: 'pbf_pct',
    label: 'PGC',
    unit: '%',
    decimals: 1,
    group: 'diagnostico',
    getValue: (m) => m.pbf_pct,
    getMin: (m) => m.pbf_min_pct,
    getMax: (m) => m.pbf_max_pct,
  },
  {
    id: 'whr',
    label: 'RCC',
    unit: '',
    decimals: 2,
    group: 'diagnostico',
    getValue: (m) => m.whr,
    getMin: (m) => m.whr_min,
    getMax: (m) => m.whr_max,
  },
  {
    id: 'bmr_kcal',
    label: 'Metabolismo basal',
    unit: 'kcal',
    decimals: 0,
    group: 'diagnostico',
    getValue: (m) => m.bmr_kcal,
    getMin: (m) => m.bmr_min_kcal,
    getMax: (m) => m.bmr_max_kcal,
  },
  {
    id: 'fat_control_kg',
    label: 'Control grasa',
    unit: 'kg',
    decimals: 1,
    group: 'control',
    getValue: (m) => m.fat_control_kg,
  },
  {
    id: 'muscle_control_kg',
    label: 'Control músculo',
    unit: 'kg',
    decimals: 1,
    group: 'control',
    getValue: (m) => m.muscle_control_kg,
  },
  {
    id: 'lean_right_arm',
    label: 'MME brazo der.',
    unit: 'kg',
    decimals: 1,
    group: 'segmental',
    getValue: (m) => m.segmental_lean?.right_arm?.kg,
  },
  {
    id: 'lean_left_arm',
    label: 'MME brazo izq.',
    unit: 'kg',
    decimals: 1,
    group: 'segmental',
    getValue: (m) => m.segmental_lean?.left_arm?.kg,
  },
  {
    id: 'lean_trunk',
    label: 'MME tronco',
    unit: 'kg',
    decimals: 1,
    group: 'segmental',
    getValue: (m) => m.segmental_lean?.trunk?.kg,
  },
  {
    id: 'lean_right_leg',
    label: 'MME pierna der.',
    unit: 'kg',
    decimals: 1,
    group: 'segmental',
    getValue: (m) => m.segmental_lean?.right_leg?.kg,
  },
  {
    id: 'lean_left_leg',
    label: 'MME pierna izq.',
    unit: 'kg',
    decimals: 1,
    group: 'segmental',
    getValue: (m) => m.segmental_lean?.left_leg?.kg,
  },
  {
    id: 'fat_pct_trunk',
    label: 'PGC tronco',
    unit: '%',
    decimals: 1,
    group: 'segmental',
    getValue: (m) => m.segmental_fat?.trunk?.pct,
  },
];

export const INBODY_CHART_PARAM_GROUPS: Record<InbodyChartParam['group'], string> = {
  composicion: 'Composición corporal',
  diagnostico: 'Diagnóstico',
  control: 'Control',
  segmental: 'Segmental',
};

export function getInbodyChartParam(id: InbodyChartParamId): InbodyChartParam {
  return INBODY_CHART_PARAMS.find((p) => p.id === id) ?? INBODY_CHART_PARAMS[0];
}

export interface InbodyChartPoint {
  id: string;
  measuredAt: string;
  label: string;
  tooltipLabel: string;
  value: number;
  min: number | null;
  max: number | null;
  isSelected: boolean;
}

export function buildInbodyChartSeries(
  measurements: InbodyMeasurement[],
  paramId: InbodyChartParamId,
  selectedId?: string | null,
): InbodyChartPoint[] {
  const param = getInbodyChartParam(paramId);

  return [...measurements]
    .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
    .map((m) => {
      const raw = param.getValue(m);
      if (raw == null || Number.isNaN(raw)) return null;

      const date = new Date(m.measured_at);
      return {
        id: m.id,
        measuredAt: m.measured_at,
        label: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }),
        tooltipLabel: date.toLocaleString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        value: raw,
        min: param.getMin?.(m) ?? null,
        max: param.getMax?.(m) ?? null,
        isSelected: selectedId ? m.id === selectedId : false,
      };
    })
    .filter((row): row is InbodyChartPoint => row != null);
}

export function formatChartValue(value: number, decimals: number, unit: string): string {
  const formatted = value.toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}
