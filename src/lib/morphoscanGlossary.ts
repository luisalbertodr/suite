/** Glosario corto MorphoScan / Renpho (paralelo a inbodyGlossary). */

export type MorphoScanMetricId =
  | 'weight_kg'
  | 'body_fat_kg'
  | 'pbf_pct'
  | 'bone_mass_kg'
  | 'protein_mass_kg'
  | 'tbw_kg'
  | 'slm_kg'
  | 'smm_kg'
  | 'bmi'
  | 'smi'
  | 'visceral_fat_index'
  | 'subcutaneous_fat_pct'
  | 'bmr_kcal'
  | 'ffm_kg'
  | 'metabolic_age'
  | 'whr'
  | 'body_type'
  | 'body_score';

export interface MorphoScanGlossaryEntry {
  shortLabel: string;
  fullName: string;
  description: string;
}

export const MORPHOSCAN_GLOSSARY: Record<MorphoScanMetricId, MorphoScanGlossaryEntry> = {
  weight_kg: {
    shortLabel: 'Peso',
    fullName: 'Peso corporal',
    description: 'Masa total medida por la báscula MorphoScan.',
  },
  body_fat_kg: {
    shortLabel: 'Grasa',
    fullName: 'Masa grasa corporal',
    description: 'Kilogramos de grasa estimados por BIA (a menudo vía FFM).',
  },
  pbf_pct: {
    shortLabel: '% grasa',
    fullName: 'Porcentaje de grasa corporal',
    description: 'Proporción de grasa respecto al peso total.',
  },
  bone_mass_kg: {
    shortLabel: 'Hueso',
    fullName: 'Masa ósea',
    description: 'Estimación de masa mineral ósea del informe MorphoScan.',
  },
  protein_mass_kg: {
    shortLabel: 'Proteína',
    fullName: 'Masa proteica',
    description: 'Componente proteico estimado de la composición corporal.',
  },
  tbw_kg: {
    shortLabel: 'Agua',
    fullName: 'Agua corporal total',
    description: 'Litros / kg de agua corporal estimada (TBW).',
  },
  slm_kg: {
    shortLabel: 'Masa muscular',
    fullName: 'Masa magra blanda (SLM)',
    description: 'Masa muscular “soft lean” Renpho: músculo + agua, sin hueso.',
  },
  smm_kg: {
    shortLabel: 'MME',
    fullName: 'Masa muscular esquelética',
    description: 'Músculo esquelético (SMM / MME) usado también para SMI.',
  },
  bmi: {
    shortLabel: 'IMC',
    fullName: 'Índice de masa corporal',
    description: 'Peso / altura². Orientativo; no distingue grasa de músculo.',
  },
  smi: {
    shortLabel: 'SMI',
    fullName: 'Índice de masa esquelética',
    description: 'MME / altura² (m²). Indicador de reserva muscular relativa.',
  },
  visceral_fat_index: {
    shortLabel: 'Visceral',
    fullName: 'Nivel de grasa visceral',
    description: 'Índice estimado de grasa alrededor de órganos (no kg absolutos).',
  },
  subcutaneous_fat_pct: {
    shortLabel: 'Subcutánea',
    fullName: 'Grasa subcutánea',
    description: 'Porcentaje estimado de grasa bajo la piel.',
  },
  bmr_kcal: {
    shortLabel: 'BMR',
    fullName: 'Metabolismo basal',
    description: 'Calorías en reposo estimadas a partir de la composición.',
  },
  ffm_kg: {
    shortLabel: 'FFM',
    fullName: 'Masa libre de grasa',
    description: 'Peso menos grasa (músculo, hueso, agua, etc.).',
  },
  metabolic_age: {
    shortLabel: 'Edad met.',
    fullName: 'Edad metabólica',
    description: 'Edad estimada según metabolismo / composición frente a la cronológica.',
  },
  whr: {
    shortLabel: 'WHR',
    fullName: 'Relación cintura-cadera',
    description: 'Si la báscula lo aporta; si no, no se inventa en Suite.',
  },
  body_type: {
    shortLabel: 'Tipo',
    fullName: 'Tipo corporal',
    description: 'Clasificación orientativa según IMC y % grasa (matriz Renpho-like).',
  },
  body_score: {
    shortLabel: 'Score',
    fullName: 'Puntuación corporal',
    description: 'Puntuación 0–100 del informe; si no viene en payload, se deriva de forma estable.',
  },
};

export function morphoScanMetricTitle(id: MorphoScanMetricId): string {
  const e = MORPHOSCAN_GLOSSARY[id];
  return `${e.fullName}: ${e.description}`;
}
