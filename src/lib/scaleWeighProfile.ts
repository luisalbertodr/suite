/** Utilidades de perfil para MorphoScan / «Pesar ahora». */

export type ScaleSex = 'M' | 'F';

export function sexFromClinicalProfile(
  clinicalProfile: unknown,
): ScaleSex | null {
  const profile =
    clinicalProfile && typeof clinicalProfile === 'object'
      ? (clinicalProfile as Record<string, unknown>)
      : {};
  const raw = String(profile.sex ?? profile.gender ?? profile.sexo ?? '').trim();
  if (/^(m|male|hombre|h)$/i.test(raw)) return 'M';
  if (/^(f|female|mujer)$/i.test(raw)) return 'F';
  return null;
}

export function ageYearsFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate.slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 5 && age < 120 ? age : null;
}

export function mergeClinicalSex(
  clinicalProfile: unknown,
  sex: ScaleSex,
): Record<string, unknown> {
  const base =
    clinicalProfile && typeof clinicalProfile === 'object'
      ? { ...(clinicalProfile as Record<string, unknown>) }
      : {};
  base.sex = sex;
  return base;
}

export type ScaleProfileSnapshot = {
  height_cm: number;
  age_years: number;
  sex: ScaleSex;
  profile_name: string;
  birth_date: string;
};

export function missingScaleProfileFields(input: {
  heightCm?: number | null;
  birthDate?: string | null;
  clinicalProfile?: unknown;
}): Array<'height' | 'birth' | 'sex'> {
  const missing: Array<'height' | 'birth' | 'sex'> = [];
  if (input.heightCm == null || !(Number(input.heightCm) > 0)) missing.push('height');
  if (!input.birthDate || !ageYearsFromBirthDate(input.birthDate)) missing.push('birth');
  if (!sexFromClinicalProfile(input.clinicalProfile)) missing.push('sex');
  return missing;
}

export function buildScaleProfileSnapshot(input: {
  heightCm: number;
  birthDate: string;
  sex: ScaleSex;
  name?: string | null;
}): ScaleProfileSnapshot {
  const age = ageYearsFromBirthDate(input.birthDate);
  if (age == null) throw new Error('Fecha de nacimiento inválida');
  const profile_name = (input.name || 'Suite').trim().slice(0, 8) || 'Suite';
  return {
    height_cm: Math.round(Number(input.heightCm) * 10) / 10,
    age_years: age,
    sex: input.sex,
    profile_name,
    birth_date: input.birthDate.slice(0, 10),
  };
}
