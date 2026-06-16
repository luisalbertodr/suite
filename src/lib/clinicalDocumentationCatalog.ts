import { normalizeMatchText, parseMatchKeywords } from '@/lib/agendaRecursoMatch';
import { FACIAL_CORPORAL_FORM_KEY } from '@/lib/questionnaireTypes';

export type ClinicalQuestionnaireOption = {
  id: string;
  formKey: string;
  label: string;
  description: string;
  keywords: string;
};

export const CLINICAL_QUESTIONNAIRE_OPTIONS: ClinicalQuestionnaireOption[] = [
  {
    id: 'facial_corporal_2026',
    formKey: FACIAL_CORPORAL_FORM_KEY,
    label: 'Cuestionario facial-corporal 2026',
    description: 'Tablet para la clienta. Revisión y datos técnicos en recepción.',
    keywords:
      'facial,corporal,cuestionario,primera visita,anamnesis,ficha,consulta inicial,evaluacion,evaluación',
  },
];

export function scoreQuestionnaireForServiceLabel(
  option: ClinicalQuestionnaireOption,
  serviceLabel: string | null | undefined,
): number {
  const normalizedLabel = normalizeMatchText(serviceLabel);
  if (!normalizedLabel) return 0;
  let best = 0;
  for (const keyword of parseMatchKeywords(option.keywords)) {
    if (keyword.length < 3) continue;
    if (!normalizedLabel.includes(keyword)) continue;
    best = Math.max(best, keyword.length);
  }
  return best;
}

export function suggestedQuestionnairesForServiceLabel(
  serviceLabel: string | null | undefined,
  limit = 2,
): ClinicalQuestionnaireOption[] {
  return [...CLINICAL_QUESTIONNAIRE_OPTIONS]
    .map((o) => ({ o, score: scoreQuestionnaireForServiceLabel(o, serviceLabel) }))
    .sort((a, b) => b.score - a.score || a.o.label.localeCompare(b.o.label, 'es'))
    .filter(({ score }) => score > 0)
    .slice(0, limit)
    .map(({ o }) => o);
}
