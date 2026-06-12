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
  exerciseKcal,
  INBODY_EXERCISE_GRID,
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
                ? ` (rango ${formatInbodyNumber(measurement.bmr_min_kcal, 0)}–${formatInbodyNumber(measurement.bmr_max_kcal, 0)})`
                : ''}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-2">
          <CardTitle className={compact ? 'text-sm' : 'text-base'}>
            Gasto energético (30 min)
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            MET × peso (kg) × 0,5 h — compendio de actividades físicas.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {weight <= 0 ? (
            <p className="text-xs text-muted-foreground">Sin peso en la medición.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-1 pr-2">Actividad</th>
                  <th className="text-right py-1 px-2">MET</th>
                  <th className="text-right py-1 pl-2">kcal / 30 min</th>
                </tr>
              </thead>
              <tbody>
                {INBODY_EXERCISE_GRID.flat().map((act) => (
                  <tr key={act.name} className="border-b border-border/30 last:border-0">
                    <td className="py-1 pr-2">{act.name}</td>
                    <td className="text-right py-1 px-2 tabular-nums">{act.met}</td>
                    <td className="text-right py-1 pl-2 tabular-nums font-medium">
                      {exerciseKcal(act.met, weight, 30)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
