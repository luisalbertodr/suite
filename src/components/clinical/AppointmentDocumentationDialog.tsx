import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import type { ConsentimientoPlantilla } from '@/lib/consentimientoTypes';
import {
  rankPlantillasForServiceLabel,
  suggestedPlantillasForServiceLabel,
} from '@/lib/consentimientoPlantillaMatch';
import {
  CLINICAL_QUESTIONNAIRE_OPTIONS,
  suggestedQuestionnairesForServiceLabel,
} from '@/lib/clinicalDocumentationCatalog';
import {
  plantillaBadges,
  trackingFamilyFromPlantilla,
  type TrackingFamily,
} from '@/lib/treatmentTracking';
import { ClipboardList, FileSignature, History, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  clientName: string;
  serviceLabel?: string | null;
  onSelectConsent: (plantillaId: string) => void;
  onSelectQuestionnaire: (formKey: string) => void;
  onRegisterSession?: (trackingFamily: TrackingFamily, plantillaCodigo?: string | null) => void;
  onSelectFreeConsent?: () => void;
};

function isConsentPlantilla(p: ConsentimientoPlantilla) {
  return !p.document_kind || p.document_kind === 'consent';
}

function isTrackingPlantilla(p: ConsentimientoPlantilla) {
  return p.document_kind === 'tracking';
}

export function AppointmentDocumentationDialog({
  open,
  onOpenChange,
  companyId,
  clientName,
  serviceLabel,
  onSelectConsent,
  onSelectQuestionnaire,
  onRegisterSession,
  onSelectFreeConsent,
}: Props) {
  const { data: plantillas = [], isLoading } = useQuery({
    queryKey: ['consentimiento-plantillas', companyId],
    enabled: open && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consentimiento_plantillas')
        .select('*')
        .eq('company_id', companyId)
        .eq('activo', true)
        .order('orden', { ascending: true })
        .order('titulo', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ConsentimientoPlantilla[];
    },
  });

  const consentPlantillas = useMemo(
    () => plantillas.filter(isConsentPlantilla),
    [plantillas],
  );
  const trackingPlantillas = useMemo(
    () => plantillas.filter(isTrackingPlantilla),
    [plantillas],
  );
  const medicinaPlantillas = useMemo(
    () => consentPlantillas.filter((p) => p.category === 'medicina'),
    [consentPlantillas],
  );
  const esteticaConsents = useMemo(
    () => consentPlantillas.filter((p) => p.category !== 'medicina'),
    [consentPlantillas],
  );

  const suggestedConsents = useMemo(
    () => suggestedPlantillasForServiceLabel(esteticaConsents, serviceLabel),
    [esteticaConsents, serviceLabel],
  );
  const suggestedMedicina = useMemo(
    () => suggestedPlantillasForServiceLabel(medicinaPlantillas, serviceLabel),
    [medicinaPlantillas, serviceLabel],
  );
  const suggestedTracking = useMemo(
    () => suggestedPlantillasForServiceLabel(trackingPlantillas, serviceLabel),
    [trackingPlantillas, serviceLabel],
  );
  const suggestedQuestionnaires = useMemo(
    () => suggestedQuestionnairesForServiceLabel(serviceLabel),
    [serviceLabel],
  );
  const rankedConsents = useMemo(
    () => rankPlantillasForServiceLabel(esteticaConsents, serviceLabel),
    [esteticaConsents, serviceLabel],
  );
  const suggestedConsentIds = useMemo(
    () => new Set(suggestedConsents.map((p) => p.id)),
    [suggestedConsents],
  );

  const hasSuggestions =
    suggestedConsents.length > 0 ||
    suggestedMedicina.length > 0 ||
    suggestedTracking.length > 0 ||
    suggestedQuestionnaires.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[125]" className="max-w-lg max-h-[min(90vh,calc(100dvh-7.5rem))] !flex flex-col overflow-hidden p-0 gap-0 z-[125]">
        <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
          <DialogTitle className="text-base pr-6">Documentación — {clientName}</DialogTitle>
          {serviceLabel ? (
            <p className="text-xs text-muted-foreground truncate">Cita: {serviceLabel}</p>
          ) : null}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Cargando opciones…</p>
          ) : (
            <>
              {hasSuggestions ? (
                <section className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                    <Sparkles className="w-3.5 h-3.5" />
                    Recomendado para esta cita
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[...suggestedConsents, ...suggestedMedicina].map((p) => (
                      <DocActionButton
                        key={p.id}
                        icon={<FileSignature className="w-4 h-4" />}
                        title={p.titulo}
                        subtitle={p.tipo}
                        badges={plantillaBadges(p)}
                        highlighted
                        onClick={() => {
                          onOpenChange(false);
                          onSelectConsent(p.id);
                        }}
                      />
                    ))}
                    {suggestedTracking.map((p) => {
                      const family = trackingFamilyFromPlantilla(p);
                      if (!family || !onRegisterSession) return null;
                      return (
                        <DocActionButton
                          key={p.id}
                          icon={<History className="w-4 h-4" />}
                          title={`Registrar sesión · ${p.titulo}`}
                          subtitle="Historial cronológico del tratamiento"
                          badges={plantillaBadges(p)}
                          highlighted
                          onClick={() => {
                            onOpenChange(false);
                            onRegisterSession(family, p.codigo);
                          }}
                        />
                      );
                    })}
                    {suggestedQuestionnaires.map((q) => (
                      <DocActionButton
                        key={q.id}
                        icon={<ClipboardList className="w-4 h-4" />}
                        title={q.label}
                        subtitle={q.description}
                        highlighted
                        onClick={() => {
                          onOpenChange(false);
                          onSelectQuestionnaire(q.formKey);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Consentimientos (solo informativos)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rankedConsents.map((p) => (
                    <DocActionButton
                      key={p.id}
                      icon={<FileSignature className="w-4 h-4" />}
                      title={p.titulo}
                      subtitle={p.tipo}
                      badges={plantillaBadges(p)}
                      compact
                      highlighted={suggestedConsentIds.has(p.id)}
                      onClick={() => {
                        onOpenChange(false);
                        onSelectConsent(p.id);
                      }}
                    />
                  ))}
                </div>
                {onSelectFreeConsent ? (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                    onOpenChange(false);
                    onSelectFreeConsent();
                  }}>
                    Documento libre (sin plantilla)
                  </Button>
                ) : null}
              </section>

              {medicinaPlantillas.length > 0 ? (
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Medicina estética
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {medicinaPlantillas.map((p) => (
                      <DocActionButton
                        key={p.id}
                        icon={<FileSignature className="w-4 h-4" />}
                        title={p.titulo}
                        subtitle={p.tipo}
                        badges={plantillaBadges(p)}
                        compact
                        onClick={() => {
                          onOpenChange(false);
                          onSelectConsent(p.id);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {onRegisterSession && trackingPlantillas.length > 0 ? (
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Seguimiento por sesiones
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {trackingPlantillas.map((p) => {
                      const family = trackingFamilyFromPlantilla(p);
                      if (!family) return null;
                      return (
                        <DocActionButton
                          key={p.id}
                          icon={<History className="w-4 h-4" />}
                          title={p.titulo}
                          subtitle="Añadir sesión al historial del tratamiento"
                          badges={plantillaBadges(p)}
                          compact
                          onClick={() => {
                            onOpenChange(false);
                            onRegisterSession(family, p.codigo);
                          }}
                        />
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cuestionarios
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {CLINICAL_QUESTIONNAIRE_OPTIONS.map((q) => (
                    <DocActionButton
                      key={q.id}
                      icon={<ClipboardList className="w-4 h-4" />}
                      title={q.label}
                      subtitle={q.description}
                      compact
                      onClick={() => {
                        onOpenChange(false);
                        onSelectQuestionnaire(q.formKey);
                      }}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocActionButton({
  icon,
  title,
  subtitle,
  badges,
  onClick,
  highlighted,
  compact,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badges?: string[];
  onClick: () => void;
  highlighted?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/60',
        highlighted ? 'border-sky-300 bg-sky-50/80 dark:bg-sky-950/20' : 'border-border/70',
        compact && 'py-2',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-sky-600 shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 flex-wrap">
            <span className="font-medium text-sm truncate max-w-full">{title}</span>
            {highlighted ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                Sugerido
              </Badge>
            ) : null}
            {badges?.map((b) => (
              <Badge key={b} variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                {b}
              </Badge>
            ))}
          </span>
          {subtitle ? (
            <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</span>
          ) : null}
        </span>
      </div>
    </button>
  );
}
