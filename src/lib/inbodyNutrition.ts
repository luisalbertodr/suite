/** Factores de actividad (Mifflin-St Jeor × factor). */
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;

export type InbodyGoal = 'fat_loss' | 'maintain' | 'muscle_gain';

export type InbodySexInput = string | null | undefined;

/** Grid 3×6 alineado con la plantilla del informe InBody (filas × columnas). */
export const INBODY_EXERCISE_GRID: Array<Array<{ name: string; met: number }>> = [
  [
    { name: 'Caminata (5 km/h)', met: 3.5 },
    { name: 'Trote (8 km/h)', met: 7.0 },
    { name: 'Bicicleta (14-16 km/h)', met: 6.0 },
    { name: 'Natación (general)', met: 6.0 },
    { name: 'Alpinismo', met: 7.5 },
    { name: 'Aerobic', met: 6.5 },
  ],
  [
    { name: 'Ping pong', met: 4.0 },
    { name: 'Tenis (individual)', met: 7.0 },
    { name: 'Fútbol', met: 7.5 },
    { name: 'Esgrima oriental', met: 6.0 },
    { name: 'Gateball', met: 3.0 },
    { name: 'Bádminton', met: 5.5 },
  ],
  [
    { name: 'Racketball', met: 7.0 },
    { name: 'Taekwondo', met: 10.0 },
    { name: 'Squash', met: 7.5 },
    { name: 'Baloncesto', met: 6.5 },
    { name: 'Saltar la cuerda', met: 10.0 },
    { name: 'Golf (con carrito)', met: 3.5 },
  ],
];

export function isMaleSex(sex: InbodySexInput): boolean {
  const s = (sex || '').trim().toUpperCase();
  return s === 'M' || s === 'MALE' || s === 'H' || s === 'HOMBRE' || s === '1';
}

/** Tasa metabólica basal — Mifflin-St Jeor (kcal/día). */
export function mifflinStJeorTmb(
  sex: InbodySexInput,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return isMaleSex(sex) ? base + 5 : base - 161;
}

/** Ingesta calórica diaria recomendada = TMB × factor actividad. */
export function recommendedDailyKcal(
  sex: InbodySexInput,
  weightKg: number,
  heightCm: number,
  ageYears: number,
  activity: ActivityLevel = 'light',
): number | null {
  if (weightKg <= 0 || heightCm <= 0 || ageYears <= 0) return null;
  const tmb = mifflinStJeorTmb(sex, weightKg, heightCm, ageYears);
  return Math.round(tmb * ACTIVITY_FACTORS[activity]);
}

/** Gasto en kcal = MET × peso(kg) × (minutos / 60). */
export function exerciseKcal(
  met: number,
  weightKg: number,
  minutes = 30,
): number {
  if (met <= 0 || weightKg <= 0 || minutes <= 0) return 0;
  return Math.round(met * weightKg * (minutes / 60) * 10) / 10;
}

export type WeeklyExerciseSlot = {
  day: string;
  activity: string;
  met: number;
  minutes: number;
  kcal: number;
};

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Plan semanal orientativo según objetivo (30 min por sesión salvo indicación). */
export function buildWeeklyExercisePlan(
  goal: InbodyGoal,
  weightKg: number,
  minutes = 30,
): WeeklyExerciseSlot[] {
  if (weightKg <= 0) return [];

  const pick = (name: string): { name: string; met: number } | undefined => {
    for (const row of INBODY_EXERCISE_GRID) {
      const found = row.find((a) => a.name === name);
      if (found) return found;
    }
    return undefined;
  };

  const slot = (day: string, activityName: string, mins = minutes): WeeklyExerciseSlot | null => {
    const act = pick(activityName);
    if (!act) return null;
    return {
      day,
      activity: act.name,
      met: act.met,
      minutes: mins,
      kcal: exerciseKcal(act.met, weightKg, mins),
    };
  };

  if (goal === 'fat_loss') {
    return [
      slot('Lunes', 'Trote (8 km/h)'),
      slot('Miércoles', 'Bicicleta (14-16 km/h)'),
      slot('Viernes', 'Saltar la cuerda'),
      slot('Sábado', 'Natación (general)', 45),
    ].filter((s): s is WeeklyExerciseSlot => s != null);
  }

  if (goal === 'maintain') {
    return [
      slot('Lunes', 'Caminata (5 km/h)'),
      slot('Miércoles', 'Ping pong'),
      slot('Viernes', 'Bádminton'),
      slot('Sábado', 'Golf (con carrito)'),
    ].filter((s): s is WeeklyExerciseSlot => s != null);
  }

  // muscle_gain: priorizar sobrecarga; cardio moderado de apoyo
  return [
    slot('Lunes', 'Baloncesto'),
    slot('Miércoles', 'Caminata (5 km/h)'),
    slot('Viernes', 'Taekwondo'),
  ].filter((s): s is WeeklyExerciseSlot => s != null);
}

export function flattenExerciseMets(): number[][] {
  return INBODY_EXERCISE_GRID.map((row) => row.map((a) => a.met));
}

/** Ingesta para informe: Mifflin si hay antropometría; si no, MB del dispositivo × moderado. */
export function recommendedDailyKcalForMeasurement(input: {
  sex: InbodySexInput;
  weight_kg: number | null | undefined;
  height_cm: number | null | undefined;
  age_years: number | null | undefined;
  bmr_kcal: number | null | undefined;
  activity?: ActivityLevel;
}): number | null {
  const activity = input.activity ?? 'moderate';
  const w = input.weight_kg ?? 0;
  const h = input.height_cm ?? 0;
  const age = input.age_years ?? 0;

  if (w > 0 && h > 0 && age > 0) {
    return recommendedDailyKcal(input.sex, w, h, age, activity);
  }
  if (input.bmr_kcal != null && !Number.isNaN(input.bmr_kcal)) {
    return Math.round(input.bmr_kcal * ACTIVITY_FACTORS[activity]);
  }
  return null;
}
