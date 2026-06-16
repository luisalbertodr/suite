import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  TRACKING_FAMILY_LABELS,
  addTreatmentSessionRevision,
  emptySessionForm,
  ensureTreatmentHistorial,
  fetchPlantillaByCodigo,
  measurementAssetForCustomer,
  type SessionFormValues,
  type TrackingFamily,
} from '@/lib/treatmentTracking';
import { supabase } from '@/lib/supabase';
import { ExternalLink, Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  companyId: string;
  customerName: string;
  trackingFamily: TrackingFamily;
  tratamiento: string;
  plantillaCodigo?: string | null;
  appointmentId?: string | null;
  appointmentDate?: string;
  employeeId?: string | null;
};

export function TreatmentSessionDialog({
  open,
  onOpenChange,
  customerId,
  companyId,
  customerName,
  trackingFamily,
  tratamiento,
  plantillaCodigo,
  appointmentId,
  appointmentDate,
  employeeId,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionFormValues>(emptySessionForm());
  const fecha = appointmentDate ?? new Date().toISOString().slice(0, 10);

  const { data: customer } = useQuery({
    queryKey: ['treatment-session-customer', customerId],
    enabled: open && !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, gender')
        .eq('id', customerId)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; gender?: string | null };
    },
  });

  const trackingCodigo =
    plantillaCodigo ??
    (trackingFamily === 'depilacion' ? 'tracking_depilacion' : 'tracking_aesthetic');

  const { data: trackingPlantilla } = useQuery({
    queryKey: ['tracking-plantilla', companyId, trackingCodigo],
    enabled: open && !!companyId,
    queryFn: () => fetchPlantillaByCodigo(companyId, trackingCodigo),
  });

  const measurementUrl = useMemo(
    () => measurementAssetForCustomer(trackingPlantilla?.measurement_assets ?? null, customer),
    [trackingPlantilla, customer],
  );

  useEffect(() => {
    if (open) setSession(emptySessionForm());
  }, [open, appointmentId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const historialId = await ensureTreatmentHistorial({
        customerId,
        companyId,
        trackingFamily,
        tratamiento,
        plantillaCodigo: plantillaCodigo ?? trackingCodigo,
        appointmentId,
        appointmentDate: fecha,
        employeeId,
      });
      await addTreatmentSessionRevision({
        historialId,
        customerId,
        companyId,
        appointmentId,
        fecha,
        session,
        trackingFamily,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical_history_list', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
      toast({ title: 'Sesión registrada en el historial del tratamiento' });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const isDepilacion = trackingFamily === 'depilacion';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="z-[125]" className="max-w-lg z-[125]">
        <DialogHeader>
          <DialogTitle className="text-base pr-6">
            Sesión · {TRACKING_FAMILY_LABELS[trackingFamily]}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {customerName} — {tratamiento}
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {measurementUrl ? (
            <div className="rounded-md border bg-muted/30 p-2 text-xs">
              <span className="text-muted-foreground">Referencia de medidas: </span>
              <a
                href={measurementUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-700 hover:underline"
              >
                Abrir plantilla <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Zona / área tratada</Label>
              <Input
                value={session.zona}
                onChange={(e) => setSession((s) => ({ ...s, zona: e.target.value }))}
                placeholder={isDepilacion ? 'Ej: axilas, piernas…' : 'Ej: abdomen, facial…'}
              />
            </div>
            {isDepilacion ? (
              <>
                <div>
                  <Label>Fluencia / potencia</Label>
                  <Input
                    value={session.fluencia}
                    onChange={(e) => setSession((s) => ({ ...s, fluencia: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Pulso / ms</Label>
                  <Input
                    value={session.pulso}
                    onChange={(e) => setSession((s) => ({ ...s, pulso: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <Label>Parámetros / cabezal / programa</Label>
                <Input
                  value={session.parametros}
                  onChange={(e) => setSession((s) => ({ ...s, parametros: e.target.value }))}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>Observaciones de la sesión</Label>
              <Textarea
                rows={3}
                value={session.observaciones}
                onChange={(e) => setSession((s) => ({ ...s, observaciones: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (!session.zona.trim() && !session.observaciones.trim())}
          >
            {saveMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando…</>
            ) : (
              'Guardar sesión'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
