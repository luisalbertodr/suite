import React from 'react';
import { CheckCircle2 } from 'lucide-react';

type Props = {
  customerName?: string;
  title?: string;
};

export function ConsentPatientWaitScreen({ customerName, title }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 space-y-6">
      <CheckCircle2 className="w-16 h-16 text-green-600" />
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Consentimiento firmado</h2>
        {title ? <p className="text-sm text-muted-foreground">{title}</p> : null}
        {customerName ? <p className="text-muted-foreground">{customerName}</p> : null}
        <p className="text-sm text-muted-foreground max-w-md">
          Gracias. Entregue la tablet a su profesional. No cierre esta pantalla hasta que se lo indiquen.
        </p>
      </div>
    </div>
  );
}
