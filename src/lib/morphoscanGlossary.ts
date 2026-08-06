/** Glosario corto MorphoScan / interpretación Suite LookInBody-like (paralelo a inbodyGlossary). */

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
    description: 'Kilogramos de grasa: peso − FFM (Suite BIA vía TBW/0,73 cuando hay Z).',
  },
  pbf_pct: {
    shortLabel: '% grasa',
    fullName: 'Porcentaje de grasa corporal',
    description: 'Proporción de grasa respecto al peso total (misma base que BFM).',
  },
  bone_mass_kg: {
    shortLabel: 'Hueso',
    fullName: 'Masa ósea',
    description: 'Estimación ~7 % de la FFM (fracción LookInBody-like).',
  },
  protein_mass_kg: {
    shortLabel: 'Proteína',
    fullName: 'Masa proteica',
    description: 'Estimación ~18 % de la FFM.',
  },
  tbw_kg: {
    shortLabel: 'Agua',
    fullName: 'Agua corporal total',
    description: 'TBW desde impedancia efectiva (~50 kHz) y perfil H/A/S; base del resto de la composición.',
  },
  slm_kg: {
    shortLabel: 'Masa muscular',
    fullName: 'Masa magra blanda (SLM)',
    description: 'FFM − hueso (soft lean): músculo + agua, sin masa ósea.',
  },
  smm_kg: {
    shortLabel: 'MME',
    fullName: 'Masa muscular esquelética',
    description: 'SMM / MME (Janssen-like sobre FFM); base del SMI.',
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
    description: 'Índice estimado de grasa alrededor de órganos (heurística Morpho; no calibrado InBody).',
  },
  subcutaneous_fat_pct: {
    shortLabel: 'Subcutánea',
    fullName: 'Grasa subcutánea',
    description: 'Porcentaje estimado de grasa bajo la piel.',
  },
  bmr_kcal: {
    shortLabel: 'BMR',
    fullName: 'Metabolismo basal',
    description: 'Cunningham: 370 + 21,6 × FFM (kcal/día).',
  },
  ffm_kg: {
    shortLabel: 'FFM',
    fullName: 'Masa libre de grasa',
    description: 'TBW / 0,73 cuando hay BIA Suite; si no, peso − grasa.',
  },
  metabolic_age: {
    shortLabel: 'Edad met.',
    fullName: 'Edad metabólica',
    description:
      'Edad estimada vs cronológica según exceso de grasa y déficit de músculo (criterio LookInBody-like), no solo por edad.',
  },
  whr: {
    shortLabel: 'WHR',
    fullName: 'Relación cintura-cadera',
    description: 'Si la báscula lo aporta; si no, no se inventa en Suite.',
  },
  body_type: {
    shortLabel: 'Tipo',
    fullName: 'Tipo corporal',
    description: 'Clasificación orientativa según IMC (OMS) y % grasa respecto a objetivos InBody-like.',
  },
  body_score: {
    shortLabel: 'Score',
    fullName: 'Puntuación corporal',
    description: 'Puntuación 0–100 por desviación de IMC y % grasa respecto a bandas clínicas Suite.',
  },
};

export function morphoScanMetricTitle(id: MorphoScanMetricId): string {
  const e = MORPHOSCAN_GLOSSARY[id];
  return `${e.fullName}: ${e.description}`;
}
