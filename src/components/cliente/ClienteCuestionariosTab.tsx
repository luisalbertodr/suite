import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Loader2, Monitor, PencilLine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { format } from 'date-fns';
import {
  createQuestionnaire,
  customerHasBaselineQuestionnaire,
  fetchCustomerQuestionnaires,
  openQuestionnaireKiosk,
} from '@/lib/questionnaireApi';
import { QUESTIONNAIRE_STATUS_LABELS } from '@/lib/questionnaireTypes';
import { QuestionnaireEmployeeDialog } from '@/components/questionnaire/QuestionnaireEmployeeDialog';
import { QuestionnaireAmendmentDialog } from '@/components/questionnaire/QuestionnaireAmendmentDialog';

interface Props {
  customerId: string;
  appointmentId?: string | null;
  employeeId?: string | null;
  initialManageQuestionnaireId?: string | null;
}

export const ClienteCuestionariosTab: React.FC<Props> = ({
  customerId,
  appointmentId,
  employeeId,
  initialManageQuestionnaireId,
}) => {
  const { companyId } = useCompanyFilter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [manageId, setManageId] = useState<string | null>(initialManageQuestionnaireId ?? null);
  const [amendmentOpen, setAmendmentOpen] = useState(false);

  useEffect(() => {
    if (initialManageQuestionnaireId) {
      setManageId(initialManageQuestionnaireId);
    }
  }, [initialManageQuestionnaireId]);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['customer-questionnaires', customerId],
    queryFn: () => fetchCustomerQuestionnaires(customerId),
  });

  const { data: hasBaseline = false } = useQuery({
    queryKey: ['customer-questionnaire-baseline', customerId],
    queryFn: () => customerHasBaselineQuestionnaire(customerId),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Empresa no identificada');
      return createQuestionnaire({
        customerId,
        companyId,
        appointmentId: appointmentId ?? null,
      });
    },
    onSuccess: (q) => {
      queryClient.invalidateQueries({ queryKey: ['customer-questionnaires', customerId] });
      openQuestionnaireKiosk(q.id);
      toast({
        title: 'Cuestionario abierto en tablet',
        description: 'Entregue la tablet al cliente. Esta pantalla no muestra el menú de Suite.',
      });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  if (!companyId) {
    return <div className="text-center py-8 text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Cuestionario facial-corporal
        </h3>
        <div className="flex flex-wrap gap-2">
          {hasBaseline ? (
            <Button size="sm" variant="outline" onClick={() => setAmendmentOpen(true)}>
              <PencilLine className="w-4 h-4 mr-1" />
              Modificar cuestionario
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
          {startMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Monitor className="w-4 h-4 mr-1" />
          )}
          {hasBaseline ? 'Confirmación en tablet' : 'Cuestionario completo en tablet'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {hasBaseline
          ? 'El cliente ya tiene cuestionario inicial. Solo confirmará el motivo de hoy y si ha cambiado algo en su salud.'
          : 'Primera visita: cuestionario completo válido para cualquier tratamiento posterior. El cliente rellena sin supervisión en una ventana sin menú.'}
      </p>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando…</div>
      ) : !list.length ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          Sin cuestionarios. Pulse «Abrir en tablet» al llegar el cliente.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((q) => (
            <Card key={q.id}>
              <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">Facial-corporal 2026</span>
                  <Badge variant="secondary">{QUESTIONNAIRE_STATUS_LABELS[q.status]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(q.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <div className="flex gap-2">
                  {q.status === 'patient_editing' && (
                    <Button size="sm" variant="outline" onClick={() => openQuestionnaireKiosk(q.id)}>
                      <Monitor className="w-4 h-4 mr-1" /> Tablet
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setManageId(q.id)}>
                    Gestionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <QuestionnaireEmployeeDialog
        questionnaireId={manageId}
        open={!!manageId}
        onOpenChange={(o) => !o && setManageId(null)}
        employeeId={employeeId}
      />

      <QuestionnaireAmendmentDialog
        customerId={customerId}
        open={amendmentOpen}
        onOpenChange={setAmendmentOpen}
        employeeId={employeeId}
      />
    </div>
  );
};
