import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PersonalDataChange } from '@/lib/questionnairePersonalData';
import {
  suiteTopBannerSurfaceClassName,
  useSuiteTopBanner,
} from '@/contexts/SuiteTopBannerContext';

type Props = {
  changes: PersonalDataChange[];
  bannerId?: string;
};

export function PersonalDataChangesAlert({ changes, bannerId = 'personal-data-changes' }: Props) {
  const content = useMemo(() => {
    if (!changes.length) return null;
    return (
      <div className={suiteTopBannerSurfaceClassName()}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" aria-hidden />
          <div className="space-y-2 min-w-0">
            <p className="font-medium">
              El cliente modificó datos personales precargados en la tablet
            </p>
            <p className="text-xs opacity-90">
              Revise la ficha del cliente antes de completar los datos técnicos.
            </p>
            <ul className="text-xs space-y-1">
              {changes.map((c) => (
                <li key={c.field} className="rounded bg-white/60 dark:bg-black/20 px-2 py-1">
                  <span className="font-medium">{c.label}:</span>{' '}
                  <span className="line-through opacity-70">{c.before}</span>
                  {' → '}
                  <span className="font-medium">{c.after}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }, [changes]);

  useSuiteTopBanner(bannerId, content);
  return null;
}
