import { supabase } from '@/lib/supabase';
import type { CustomerQuestionnaire } from '@/lib/questionnaireTypes';
import { QUESTIONNAIRE_STATUS_LABELS } from '@/lib/questionnaireTypes';
import {
  formatPersonalDataChangesSummary,
  getPersonalDataChangesFromAnswers,
} from '@/lib/questionnairePersonalData';

export type QuestionnaireNotificationItem = {
  id: string;
  title: string;
  message: string | null;
  type: 'questionnaire_pending' | 'questionnaire_personal_data_changed';
  read: boolean;
  link: string | null;
  metadata: {
    questionnaire_id: string;
    customer_id: string;
    customer_name: string;
    status: CustomerQuestionnaire['status'];
    personal_data_changed?: boolean;
  };
  created_at: string;
};

export async function fetchPendingQuestionnaireNotifications(
  companyId: string,
): Promise<QuestionnaireNotificationItem[]> {
  const { data: pending, error } = await supabase
    .from('customer_questionnaires')
    .select('id, customer_id, status, answers, patient_submitted_at, technical_started_at, created_at')
    .eq('company_id', companyId)
    .in('status', ['patient_submitted', 'technical_editing'])
    .order('patient_submitted_at', { ascending: false });
  if (error) throw error;
  if (!pending?.length) return [];

  const customerIds = [...new Set(pending.map((p) => p.customer_id))];
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('id, name')
    .in('id', customerIds);
  if (custErr) throw custErr;

  const nameById = new Map((customers ?? []).map((c) => [c.id, c.name as string]));
  const items: QuestionnaireNotificationItem[] = [];

  for (const q of pending) {
    const name = nameById.get(q.customer_id) ?? 'Cliente';
    const status = q.status as CustomerQuestionnaire['status'];
    const action =
      status === 'patient_submitted'
        ? 'Revisar respuestas y pasar a datos técnicos'
        : 'Completar datos técnicos y generar PDF';
    const ts = q.patient_submitted_at ?? q.technical_started_at ?? q.created_at;
    const personalChanges = getPersonalDataChangesFromAnswers(
      (q.answers ?? {}) as Record<string, unknown>,
    );
    const link = `/clientes?customer=${q.customer_id}&tab=cuestionario&questionnaire=${q.id}`;

    if (personalChanges.length > 0) {
      const summary = formatPersonalDataChangesSummary(personalChanges);
      items.push({
        id: `questionnaire-personal-changes:${q.id}`,
        title: `Cuestionario · ${name} · datos modificados`,
        message: `Cambios en ${summary}. Revise la ficha antes de los datos técnicos.`,
        type: 'questionnaire_personal_data_changed',
        read: false,
        link,
        metadata: {
          questionnaire_id: q.id,
          customer_id: q.customer_id,
          customer_name: name,
          status,
          personal_data_changed: true,
        },
        created_at: ts,
      });
    }

    items.push({
      id: `questionnaire-pending:${q.id}`,
      title: `Cuestionario · ${name}`,
      message: `${QUESTIONNAIRE_STATUS_LABELS[status]} — ${action}`,
      type: 'questionnaire_pending',
      read: false,
      link,
      metadata: {
        questionnaire_id: q.id,
        customer_id: q.customer_id,
        customer_name: name,
        status,
        personal_data_changed: personalChanges.length > 0,
      },
      created_at: ts,
    });
  }

  return items;
}
