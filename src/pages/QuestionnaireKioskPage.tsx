import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { QuestionnaireKioskShell } from '@/components/questionnaire/QuestionnaireKioskShell';
import { QuestionnairePatientForm } from '@/components/questionnaire/QuestionnairePatientForm';
import { QuestionnairePatientWaitScreen } from '@/components/questionnaire/QuestionnairePatientWaitScreen';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchQuestionnaire,
  fetchQuestionnaireCustomer,
} from '@/lib/questionnaireApi';

function KioskContent() {
  const { questionnaireId } = useParams<{ questionnaireId: string }>();
  const queryClient = useQueryClient();
  const [poll, setPoll] = useState(0);

  const { data: questionnaire, isLoading, refetch } = useQuery({
    queryKey: ['questionnaire-kiosk', questionnaireId, poll],
    enabled: !!questionnaireId,
    queryFn: () => fetchQuestionnaire(questionnaireId!),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === 'patient_submitted' || s === 'technical_editing' || s === 'completed') return 8000;
      return false;
    },
  });

  const { data: customer } = useQuery({
    queryKey: ['questionnaire-kiosk-customer', questionnaire?.customer_id],
    enabled: !!questionnaire?.customer_id,
    queryFn: () => fetchQuestionnaireCustomer(questionnaire!.customer_id),
  });

  useEffect(() => {
    const blockBack = (e: PopStateEvent) => {
      if (questionnaire?.status && questionnaire.status !== 'patient_editing') {
        window.history.pushState(null, '', window.location.href);
        e.preventDefault();
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockBack);
    return () => window.removeEventListener('popstate', blockBack);
  }, [questionnaire?.status]);

  const onSubmitted = useCallback(() => {
    setPoll((n) => n + 1);
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['customer-questionnaires'] });
  }, [refetch, queryClient]);

  if (isLoading || !questionnaireId) {
    return (
      <QuestionnaireKioskShell>
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </QuestionnaireKioskShell>
    );
  }

  if (!questionnaire) {
    return (
      <QuestionnaireKioskShell>
        <p className="text-center text-muted-foreground py-20">Cuestionario no encontrado.</p>
      </QuestionnaireKioskShell>
    );
  }

  if (questionnaire.status !== 'patient_editing') {
    return (
      <QuestionnaireKioskShell>
        <QuestionnairePatientWaitScreen
          customerName={customer?.name}
          status={questionnaire.status}
          returnNote={questionnaire.return_note}
        />
      </QuestionnaireKioskShell>
    );
  }

  if (!customer) {
    return (
      <QuestionnaireKioskShell>
        <Skeleton className="h-64 w-full" />
      </QuestionnaireKioskShell>
    );
  }

  return (
    <QuestionnaireKioskShell>
      <QuestionnairePatientForm
        questionnaireId={questionnaire.id}
        companyId={questionnaire.company_id}
        customer={customer}
        initialAnswers={(questionnaire.answers ?? {}) as Record<string, unknown>}
        returnNote={questionnaire.return_note}
        onSubmitted={onSubmitted}
      />
    </QuestionnaireKioskShell>
  );
}

export default function QuestionnaireKioskPage() {
  return (
    <ProtectedRoute>
      <KioskContent />
    </ProtectedRoute>
  );
}
