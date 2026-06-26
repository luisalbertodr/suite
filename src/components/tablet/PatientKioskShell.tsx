import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { SuiteTopBannerProvider } from '@/contexts/SuiteTopBannerContext';
import { TabletKioskUnlockButton } from '@/components/tablet/TabletKioskUnlockButton';

type Props = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  companyId?: string | null;
  /** Pantalla bloqueada tras envío / firma (muestra botón de desbloqueo). */
  locked?: boolean;
};

/** Shell mínimo para modo tablet: sin menú, barra ni dock. */
export function PatientKioskShell({
  children,
  title,
  subtitle = 'Lipoout',
  companyId,
  locked = false,
}: Props) {
  return (
    <SuiteTopBannerProvider topClassName="top-16">
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-sky-950 dark:to-background">
        <header className="sticky top-0 z-10 border-b bg-white/90 dark:bg-background/90 backdrop-blur px-4 py-3 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{subtitle}</p>
            <p className="font-semibold text-sm">{title}</p>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6 pb-12">{children}</main>
        <TabletKioskUnlockButton companyId={companyId} onlyWhenLocked locked={locked} />
        <Toaster />
      </div>
    </SuiteTopBannerProvider>
  );
}
