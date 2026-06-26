import React from 'react';
import { PatientKioskShell } from '@/components/tablet/PatientKioskShell';

/** Shell del cuestionario en tablet. */
export function QuestionnaireKioskShell({
  children,
  companyId,
  locked = false,
}: {
  children: React.ReactNode;
  companyId?: string | null;
  locked?: boolean;
}) {
  return (
    <PatientKioskShell
      title="Cuestionario facial-corporal"
      companyId={companyId}
      locked={locked}
    >
      {children}
    </PatientKioskShell>
  );
}
