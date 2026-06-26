import { useState, useRef, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad, type SignaturePadHandle } from '@/components/consentimiento/SignaturePad';
import {
  applyConsentimientoVariables,
  buildConsentimientoVariables,
  buildCustomerAddress,
} from '@/lib/consentimientoVariables';
import { buildConsentimientoPdfHtml, generateConsentimientoPdfBlob } from '@/lib/consentimientoPdf';
import { uploadConsentPdf, uploadConsentSignaturePng } from '@/lib/consentimientoStorage';
import type {
  Consentimiento,
  ConsentimientoCustomer,
  ConsentimientoPlantilla,
  ConsentimientoSignContext,
  ConsentimientoSnapshot,
} from '@/lib/consentimientoTypes';
import { ChevronLeft, ChevronRight, FileSignature, Loader2, Sparkles } from 'lucide-react';
import { suggestedPlantillasForServiceLabel } from '@/lib/consentimientoPlantillaMatch';
import { cn } from '@/lib/utils';
import {
  ensureTreatmentHistorial,
  plantillaBadges,
  trackingFamilyFromPlantilla,
} from '@/lib/treatmentTracking';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ConsentimientoSignContext;
  onSigned?: () => void;
  variant?: 'dialog' | 'kiosk';
};

type Step = 'select' | 'read' | 'sign';

const LIBRE_VALUE = '__libre__';

export function ConsentimientoSignDialog({
  open,
  onOpenChange,
  context,
  onSigned,
  variant = 'dialog',
}: Props) {
  const isKiosk = variant === 'kiosk';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const signatureRef = useRef<SignaturePadHandle>(null);
  const [step, setStep] = useState<Step>(context.consentId ? 'read' : 'select');
  const [plantillaId, setPlantillaId] = useState<string>(LIBRE_VALUE);
  const [accepted, setAccepted] = useState(false);
  const [libreForm, setLibreForm] = useState({ tipo: '', titulo: '', contenido: '' });

  useEffect(() => {
    if (open) {
      const preselect = context.initialPlantillaId ?? null;
      setStep(context.consentId ? 'read' : preselect ? 'read' : 'select');
      setAccepted(false);
      setPlantillaId(preselect ?? LIBRE_VALUE);
      setLibreForm({ tipo: '', titulo: '', contenido: '' });
      signatureRef.current?.clear();
    }
  }, [open, context.consentId, context.initialPlantillaId]);

  const { data: plantillas = [] } = useQuery({
    queryKey: ['consentimiento-plantillas', context.companyId],
    enabled: open && !!context.companyId && !context.consentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consentimiento_plantillas')
        .select('*')
        .eq('company_id', context.companyId)
        .eq('activo', true)
        .order('titulo', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ConsentimientoPlantilla[];
    },
  });

  useEffect(() => {
    if (!open || context.consentId || !context.initialPlantillaId) return;
    if (plantillas.some((p) => p.id === context.initialPlantillaId)) {
      setPlantillaId(context.initialPlantillaId);
      setStep('read');
    }
  }, [open, context.consentId, context.initialPlantillaId, plantillas]);

  const { data: existingConsent } = useQuery({
    queryKey: ['consentimiento-pending', context.consentId],
    enabled: open && !!context.consentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consentimientos')
        .select('*')
        .eq('id', context.consentId!)
        .single();
      if (error) throw error;
      return data as Consentimiento;
    },
  });

  const { data: customer } = useQuery({
    queryKey: ['consentimiento-customer', context.customerId],
    enabled: open && !!context.customerId && !context.customer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id,name,tax_id,email,phone,phone_mobile,address_street,address_city,address_postal_code')
        .eq('id', context.customerId)
        .single();
      if (error) throw error;
      return data as ConsentimientoCustomer;
    },
  });

  const { data: company } = useQuery({
    queryKey: ['consentimiento-company', context.companyId],
    enabled: open && !!context.companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id,name')
        .eq('id', context.companyId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const resolvedCustomer = context.customer ?? customer ?? null;
  const consentPlantillas = useMemo(
    () => plantillas.filter((p) => !p.document_kind || p.document_kind === 'consent'),
    [plantillas],
  );
  const selectedPlantilla = consentPlantillas.find((p) => p.id === plantillaId) ?? null;
  const suggestedPlantillas = useMemo(
    () => suggestedPlantillasForServiceLabel(consentPlantillas, context.tratamiento),
    [consentPlantillas, context.tratamiento],
  );
  const suggestedIds = useMemo(
    () => new Set(suggestedPlantillas.map((p) => p.id)),
    [suggestedPlantillas],
  );

  const draftMeta = useMemo(() => {
    if (existingConsent) {
      return {
        tipo: existingConsent.tipo,
        titulo: existingConsent.titulo,
        contenido: existingConsent.contenido ?? '',
        plantillaId: existingConsent.plantilla_id,
        plantillaVersion: existingConsent.plantilla_version,
      };
    }
    if (plantillaId === LIBRE_VALUE) {
      return {
        tipo: libreForm.tipo.trim(),
        titulo: libreForm.titulo.trim(),
        contenido: libreForm.contenido,
        plantillaId: null as string | null,
        plantillaVersion: null as number | null,
      };
    }
    if (selectedPlantilla) {
      const vars = buildConsentimientoVariables({
        customer: resolvedCustomer,
        companyName: company?.name,
        tratamiento: context.tratamiento,
        profesional: context.profesional,
      });
      return {
        tipo: selectedPlantilla.tipo,
        titulo: selectedPlantilla.titulo,
        contenido: applyConsentimientoVariables(selectedPlantilla.contenido, vars),
        plantillaId: selectedPlantilla.id,
        plantillaVersion: selectedPlantilla.version,
      };
    }
    return null;
  }, [
    existingConsent,
    plantillaId,
    libreForm,
    selectedPlantilla,
    resolvedCustomer,
    company?.name,
    context.tratamiento,
    context.profesional,
  ]);

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!draftMeta?.tipo || !draftMeta.titulo || !draftMeta.contenido.trim()) {
        throw new Error('Completa tipo, título y contenido del consentimiento');
      }
      const signatureDataUrl = signatureRef.current?.toDataUrl();
      if (!signatureDataUrl) throw new Error('Dibuja la firma en el recuadro');

      const signedAt = new Date();
      const snapshot: ConsentimientoSnapshot = {
        customer_name: resolvedCustomer?.name ?? null,
        customer_tax_id: resolvedCustomer?.tax_id ?? null,
        customer_email: resolvedCustomer?.email ?? null,
        customer_phone: (resolvedCustomer?.phone_mobile || resolvedCustomer?.phone) ?? null,
        customer_address: buildCustomerAddress(resolvedCustomer),
        company_name: company?.name ?? null,
        tratamiento: context.tratamiento ?? null,
        profesional: context.profesional ?? null,
        appointment_id: context.appointmentId ?? null,
        signed_at: signedAt.toISOString(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      };

      let consentId = context.consentId ?? existingConsent?.id;
      if (!consentId) {
        const { data: inserted, error: insertErr } = await supabase
          .from('consentimientos')
          .insert({
            customer_id: context.customerId,
            company_id: context.companyId,
            tipo: draftMeta.tipo,
            titulo: draftMeta.titulo,
            contenido: draftMeta.contenido,
            plantilla_id: draftMeta.plantillaId,
            plantilla_version: draftMeta.plantillaVersion,
            appointment_id: context.appointmentId ?? null,
            firmado: false,
          })
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        consentId = inserted.id;
      }

      const firmaPath = await uploadConsentSignaturePng(
        context.companyId,
        context.customerId,
        consentId,
        signatureDataUrl,
      );

      const pdfHtml = buildConsentimientoPdfHtml({
        titulo: draftMeta.titulo,
        tipo: draftMeta.tipo,
        contenido: draftMeta.contenido,
        signatureDataUrl,
        snapshot,
        signedAt,
      });
      const pdfBlob = await generateConsentimientoPdfBlob(pdfHtml);
      const pdfPath = await uploadConsentPdf(
        context.companyId,
        context.customerId,
        consentId,
        pdfBlob,
      );

      const { error: updateErr } = await supabase
        .from('consentimientos')
        .update({
          tipo: draftMeta.tipo,
          titulo: draftMeta.titulo,
          contenido: draftMeta.contenido,
          plantilla_id: draftMeta.plantillaId,
          plantilla_version: draftMeta.plantillaVersion,
          firmado: true,
          firma_url: firmaPath,
          documento_pdf_url: pdfPath,
          fecha_firma: signedAt.toISOString(),
          datos_snapshot: snapshot,
          firmado_por_empleado_id: context.profesionalEmpleadoId ?? null,
          appointment_id: context.appointmentId ?? null,
        })
        .eq('id', consentId);
      if (updateErr) throw updateErr;

      return consentId;
    },
    onSuccess: async (consentId) => {
      queryClient.invalidateQueries({ queryKey: ['consentimientos', context.customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', context.customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-attachments', context.customerId] });

      const plantilla =
        selectedPlantilla ??
        (draftMeta?.plantillaId
          ? plantillas.find((p) => p.id === draftMeta.plantillaId) ?? null
          : null);
      const trackingFamily = plantilla ? trackingFamilyFromPlantilla(plantilla) : null;
      if (trackingFamily && plantilla?.linked_tracking_codigo) {
        try {
          await ensureTreatmentHistorial({
            customerId: context.customerId,
            companyId: context.companyId,
            trackingFamily,
            tratamiento: context.tratamiento ?? plantilla.titulo,
            plantillaCodigo: plantilla.codigo ?? plantilla.linked_tracking_codigo,
            consentimientoId: consentId,
            appointmentId: context.appointmentId ?? null,
            employeeId: context.profesionalEmpleadoId ?? null,
          });
          queryClient.invalidateQueries({ queryKey: ['clinical_history_list', context.customerId] });
        } catch {
          // No bloquear firma si falla el historial
        }
      }

      if (!isKiosk) {
        toast({ title: 'Consentimiento firmado y guardado' });
      }
      if (isKiosk) {
        onSigned?.();
      } else {
        handleClose(false);
        onSigned?.();
      }
    },
    onError: (e: Error) => {
      toast({ title: e.message || 'Error al firmar', variant: 'destructive' });
    },
  });

  const handleClose = (next: boolean) => {
    if (!next) {
      setStep(context.consentId ? 'read' : 'select');
      setPlantillaId(LIBRE_VALUE);
      setAccepted(false);
      setLibreForm({ tipo: '', titulo: '', contenido: '' });
      signatureRef.current?.clear();
    }
    onOpenChange(next);
  };

  const canGoRead =
    !!draftMeta?.tipo &&
    !!draftMeta.titulo &&
    !!draftMeta.contenido.trim();

  const title =
    step === 'sign' ? 'Firma del cliente' : 'Consentimiento informado';

  const body = (
    <div className={cn('flex-1 min-h-0', isKiosk ? 'pb-2' : 'px-6 pb-2')}>
          {step === 'select' && !context.consentId ? (
            <div className="space-y-4">
              {suggestedPlantillas.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-sky-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Sugerido para {context.tratamiento || 'esta cita'}
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {suggestedPlantillas.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPlantillaId(p.id);
                          setStep('read');
                        }}
                        className="w-full text-left rounded-lg border border-sky-300 bg-sky-50/70 dark:bg-sky-950/20 px-3 py-2.5 hover:bg-sky-100/80 transition-colors"
                      >
                        <span className="font-medium text-sm block truncate">{p.titulo}</span>
                        <span className="text-xs text-muted-foreground">{p.tipo}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Todas las plantillas</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[min(40vh,280px)] overflow-y-auto pr-1">
                  {consentPlantillas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPlantillaId(p.id);
                        setStep('read');
                      }}
                      className={cn(
                        'w-full text-left rounded-lg border px-3 py-2 hover:bg-muted/60 transition-colors',
                        plantillaId === p.id ? 'border-sky-400 bg-sky-50/50' : 'border-border/70',
                        suggestedIds.has(p.id) && plantillaId !== p.id && 'border-sky-200',
                      )}
                    >
                      <span className="font-medium text-sm block truncate">{p.titulo}</span>
                      <span className="text-xs text-muted-foreground truncate block">{p.tipo}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setPlantillaId(LIBRE_VALUE)}
              >
                Documento libre (sin plantilla)
              </Button>

              {plantillaId === LIBRE_VALUE ? (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tipo *</Label>
                      <Input
                        value={libreForm.tipo}
                        onChange={(e) => setLibreForm((f) => ({ ...f, tipo: e.target.value }))}
                        placeholder="Ej: Tratamiento láser"
                      />
                    </div>
                    <div>
                      <Label>Título *</Label>
                      <Input
                        value={libreForm.titulo}
                        onChange={(e) => setLibreForm((f) => ({ ...f, titulo: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Contenido *</Label>
                    <Textarea
                      value={libreForm.contenido}
                      onChange={(e) => setLibreForm((f) => ({ ...f, contenido: e.target.value }))}
                      rows={8}
                    />
                  </div>
                </div>
              ) : selectedPlantilla ? (
                <p className="text-sm text-muted-foreground">
                  Plantilla «{selectedPlantilla.titulo}» — pulse Continuar para revisar el texto con los datos del cliente.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 'read' ? (
            <div className="space-y-4">
              {draftMeta ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    {draftMeta.tipo} · {resolvedCustomer?.name}
                  </div>
                  <ScrollArea className="h-[min(50vh,420px)] rounded-md border p-4 bg-muted/20">
                    <h3 className="font-semibold mb-3">{draftMeta.titulo}</h3>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{draftMeta.contenido}</div>
                  </ScrollArea>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
                    <span>El cliente declara haber leído y comprendido el contenido de este consentimiento informado.</span>
                  </label>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Cargando documento…</p>
              )}
            </div>
          ) : null}

          {step === 'sign' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pida al cliente que firme con el dedo o un lápiz en el recuadro inferior.
              </p>
              <SignaturePad ref={signatureRef} height={200} />
            </div>
          ) : null}
    </div>
  );

  const footerButtons = (
    <>
          {step === 'select' && !context.consentId ? (
            <>
              {!isKiosk ? (
                <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              ) : null}
              <Button disabled={!canGoRead} onClick={() => setStep('read')}>
                Continuar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : null}
          {step === 'read' ? (
            <>
              {!isKiosk && !context.consentId ? (
                <Button variant="outline" onClick={() => setStep('select')}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Atrás
                </Button>
              ) : !isKiosk ? (
                <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              ) : null}
              <Button disabled={!accepted || !draftMeta} onClick={() => setStep('sign')} className={isKiosk ? 'ml-auto' : undefined}>
                Firmar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : null}
          {step === 'sign' ? (
            <>
              <Button variant="outline" onClick={() => setStep('read')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Atrás
              </Button>
              <Button onClick={() => signMutation.mutate()} disabled={signMutation.isPending} className={isKiosk ? 'ml-auto' : undefined}>
                {signMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando…</>
                ) : (
                  'Confirmar firma'
                )}
              </Button>
            </>
          ) : null}
    </>
  );

  const footer = (
    <div
      className={cn(
        'shrink-0 gap-2 sm:gap-2 flex flex-wrap',
        isKiosk ? 'pt-4 border-t' : 'px-6 py-4 border-t',
      )}
    >
      {footerButtons}
    </div>
  );

  if (isKiosk) {
    if (!open) return null;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-sky-800">
          <FileSignature className="w-5 h-5" />
          {title}
        </h2>
        {body}
        {footer}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        {body}
        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-2">
          {footerButtons}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
