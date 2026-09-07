import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ACTIVITY_FACTORS,
  buildWeeklyExercisePlan,
  recommendedDailyKcal,
  type ActivityLevel,
  type InbodyGoal,
} from '@/lib/inbodyNutrition';
import { formatInbodyNumber, type InbodyMeasurement } from '@/lib/inbodyMeasurements';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentario (1,2)',
  light: 'Ligero (1,375)',
  moderate: 'Moderado (1,55)',
  active: 'Activo (1,725)',
  very_active: 'Muy activo (1,9)',
};

const GOAL_LABELS: Record<InbodyGoal, string> = {
  fat_loss: 'Reducir grasa',
  maintain: 'Mantener',
  muscle_gain: 'Ganar músculo',
};

type Props = {
  measurement: InbodyMeasurement;
  compact?: boolean;
};

export const InbodyNutritionPanel: React.FC<Props> = ({ measurement, compact }) => {
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<InbodyGoal>('maintain');

  const weight = measurement.weight_kg ?? 0;
  const height = measurement.height_cm ?? 0;
  const age = measurement.age_years ?? 0;

  const dailyKcal = useMemo(() => {
    if (weight <= 0 || height <= 0 || age <= 0) return null;
    return recommendedDailyKcal(measurement.sex, weight, height, age, activity);
  }, [measurement.sex, weight, height, age, activity]);

  const weeklyPlan = useMemo(
    () => (weight > 0 ? buildWeeklyExercisePlan(goal, weight) : []),
    [goal, weight],
  );

  const canCalculate = weight > 0 && height > 0 && age > 0;

  return (
    <div className="space-y-3">
      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-2">
          <CardTitle className={compact ? 'text-sm' : 'text-base'}>
            Ingesta calórica recomendada
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Mifflin-St Jeor (TMB × factor de actividad). IMC, PGC, RCC y MB del dispositivo se
            muestran arriba sin recalcular.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Nivel de actividad</label>
              <Select value={activity} onValueChange={(v) => setActivity(v as ActivityLevel)}>
                <SelectTrigger className={compact ? 'h-8 text-xs' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {ACTIVITY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canCalculate && dailyKcal != null ? (
              <div className="text-lg font-semibold tabular-nums text-teal-700 dark:text-teal-300">
                {dailyKcal.toLocaleString('es-ES')} kcal/día
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Faltan peso, talla o edad en la medición para calcular.
              </p>
            )}
          </div>
          {measurement.bmr_kcal != null && (
            <p className="text-xs text-muted-foreground">
              MB del InBody: {formatInbodyNumber(measurement.bmr_kcal, 0, ' kcal')}
              {measurement.bmr_min_kcal != null && measurement.bmr_max_kcal != null
                ? ` (rango ${formatInbodyNumber(Math.min(measurement.bmr_min_kcal, measurement.bmr_max_kcal), 0)}–${formatInbodyNumber(Math.max(measurement.bmr_min_kcal, measurement.bmr_max_kcal), 0)})`
                : ''}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-2">
          <CardTitle className={compact ? 'text-sm' : 'text-base'}>Planificador semanal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">Objetivo</label>
            <Select value={goal} onValueChange={(v) => setGoal(v as InbodyGoal)}>
              <SelectTrigger className={compact ? 'h-8 text-xs' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GOAL_LABELS) as InbodyGoal[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {GOAL_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {goal === 'muscle_gain' &&
            measurement.muscle_control_kg != null &&
            measurement.fat_control_kg != null && (
              <p className="text-xs text-muted-foreground">
                Control músculo InBody: {formatInbodyNumber(measurement.muscle_control_kg, 1, ' kg')}
                {' · '}
                Control grasa: {formatInbodyNumber(measurement.fat_control_kg, 1, ' kg')}
              </p>
            )}
          {weeklyPlan.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin peso no se puede planificar.</p>
          ) : (
            <ul className="text-xs space-y-1.5">
              {weeklyPlan.map((slot) => (
                <li key={`${slot.day}-${slot.activity}`} className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="font-medium min-w-[4.5rem]">{slot.day}</span>
                  <span>{slot.activity}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {slot.minutes} min · ~{slot.kcal} kcal
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
