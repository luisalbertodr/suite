import { normalizeMatchText, parseMatchKeywords } from '@/lib/agendaRecursoMatch';
import type { ConsentimientoPlantilla } from '@/lib/consentimientoTypes';

export function plantillaKeywords(plantilla: Pick<ConsentimientoPlantilla, 'keywords' | 'tipo' | 'titulo'>): string[] {
  const fromField = parseMatchKeywords(plantilla.keywords);
  if (fromField.length) return fromField;
  return [
    ...parseMatchKeywords(plantilla.tipo),
    ...parseMatchKeywords(plantilla.titulo),
  ].filter(Boolean);
}

export function scorePlantillaForServiceLabel(
  plantilla: ConsentimientoPlantilla,
  serviceLabel: string | null | undefined,
): number {
  const normalizedLabel = normalizeMatchText(serviceLabel);
  if (!normalizedLabel) return 0;
  let best = 0;
  for (const keyword of plantillaKeywords(plantilla)) {
    if (keyword.length < 2) continue;
    if (!normalizedLabel.includes(keyword)) continue;
    best = Math.max(best, keyword.length);
  }
  return best;
}

export function rankPlantillasForServiceLabel(
  plantillas: ConsentimientoPlantilla[],
  serviceLabel: string | null | undefined,
): ConsentimientoPlantilla[] {
  return [...plantillas]
    .map((p) => ({ p, score: scorePlantillaForServiceLabel(p, serviceLabel) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.p.orden ?? 0) - (b.p.orden ?? 0) || a.p.titulo.localeCompare(b.p.titulo, 'es');
    })
    .map(({ p }) => p);
}

export function suggestedPlantillasForServiceLabel(
  plantillas: ConsentimientoPlantilla[],
  serviceLabel: string | null | undefined,
  limit = 3,
): ConsentimientoPlantilla[] {
  return rankPlantillasForServiceLabel(plantillas, serviceLabel)
    .filter((p) => scorePlantillaForServiceLabel(p, serviceLabel) > 0)
    .slice(0, limit);
}

export function findPlantillaByCodigo(
  plantillas: ConsentimientoPlantilla[],
  codigo: string | null | undefined,
): ConsentimientoPlantilla | null {
  const key = normalizeMatchText(codigo);
  if (!key) return null;
  return plantillas.find((p) => normalizeMatchText(p.codigo) === key) ?? null;
}
