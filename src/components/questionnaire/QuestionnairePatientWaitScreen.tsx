import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import type { QuestionnaireStatus } from '@/lib/questionnaireTypes';

type Props = {
  customerName?: string;
  status: QuestionnaireStatus;
  returnNote?: string | null;
};

export function QuestionnairePatientWaitScreen({ customerName, status, returnNote }: Props) {
  const completed = status === 'completed';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 space-y-6">
      {completed ? (
        <CheckCircle2 className="w-16 h-16 text-green-600" />
      ) : (
        <Clock className="w-16 h-16 text-sky-600" />
      )}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {completed ? 'Cuestionario completado' : 'Gracias, espere a su profesional'}
        </h2>
        {customerName ? (
          <p className="text-muted-foreground">{customerName}</p>
        ) : null}
        {!completed && (
          <p className="text-sm text-muted-foreground max-w-md">
            Sus datos han sido enviados. Una profesional revisará el cuestionario y completará la valoración
            técnica. No cierre esta pantalla hasta que le indiquen lo contrario.
          </p>
        )}
        {returnNote ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 max-w-md mx-auto">
            {returnNote}
          </p>
        ) : null}
      </div>
    </div>
  );
}
