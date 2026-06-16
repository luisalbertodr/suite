import { supabase } from '@/lib/supabase';
import type { CustomerQuestionnaire } from '@/lib/questionnaireTypes';
import { QUESTIONNAIRE_STATUS_LABELS } from '@/lib/questionnaireTypes';

export type QuestionnaireNotificationItem = {
  id: string;
  title: string;
  message: string | null;
  type: 'questionnaire_pending';
  read: boolean;
  link: string | null;
  metadata: {
    questionnaire_id: string;
    customer_id: string;
    customer_name: string;
    status: CustomerQuestionnaire['status'];
  };
  created_at: string;
};

export async function fetchPendingQuestionnaireNotifications(
  companyId: string,
): Promise<QuestionnaireNotificationItem[]> {
  const { data: pending, error } = await supabase
    .from('customer_questionnaires')
    .select('id, customer_id, status, patient_submitted_at, technical_started_at, created_at')
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

  return pending.map((q) => {
    const name = nameById.get(q.customer_id) ?? 'Cliente';
    const status = q.status as CustomerQuestionnaire['status'];
    const action =
      status === 'patient_submitted'
        ? 'Revisar respuestas y pasar a datos técnicos'
        : 'Completar datos técnicos y generar PDF';
    const ts = q.patient_submitted_at ?? q.technical_started_at ?? q.created_at;
    return {
      id: `questionnaire-pending:${q.id}`,
      title: `Cuestionario · ${name}`,
      message: `${QUESTIONNAIRE_STATUS_LABELS[status]} — ${action}`,
      type: 'questionnaire_pending' as const,
      read: false,
      link: `/clientes?customer=${q.customer_id}&tab=cuestionario&questionnaire=${q.id}`,
      metadata: {
        questionnaire_id: q.id,
        customer_id: q.customer_id,
        customer_name: name,
        status,
      },
      created_at: ts,
    };
  });
}
