import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, ChevronDown, Loader2, Scale, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInbodyMeasurements } from '@/hooks/useInbodyMeasurements';
import {
  SCALE_WEIGH_TTL_SECONDS,
  useActiveScaleWeighRequest,
  useCancelScaleWeighRequest,
  useStartScaleWeighRequest,
} from '@/hooks/useScaleWeighRequest';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dniMatchKeys,
  formatInbodyNumber,
  inbodySexLabel,
  isMorphoScanMeasurement,
  scaleDeviceFromMeasurement,
  scaleDeviceLabel,
  type InbodyMeasurement,
} from '@/lib/inbodyMeasurements';
import {
  ageYearsFromBirthDate,
  buildScaleProfileSnapshot,
  mergeClinicalSex,
  missingScaleProfileFields,
  sexFromClinicalProfile,
  type ScaleSex,
} from '@/lib/scaleWeighProfile';
import { ABOVE_TOP_BANNER_Z } from '@/lib/dialogLayers';
import { InbodyQualityWarningIcon } from './inbody/InbodyQualityAlert';
import { InbodyMetricRow, InbodyRangeBar } from './inbody/InbodyRangeBar';
import { InbodyCompositionRangeGroup } from './inbody/InbodyCompositionRangeGroup';
import { InbodyHistoryChart } from './inbody/InbodyHistoryChart';
import { InbodyCompositionEvolutionChart } from './inbody/InbodyCompositionEvolutionChart';
import { InbodySegmentalSilhouette } from './inbody/InbodySegmentalSilhouette';
import { InbodyReportExport } from './inbody/InbodyReportExport';
import { MorphoScanMeasurementReport } from './inbody/MorphoScanMeasurementReport';
import { MorphoScanReportExport } from './inbody/MorphoScanReportExport';
import { InbodyNutritionPanel } from './inbody/InbodyNutritionPanel';
import { InbodyMetricHelp, InbodySectionHelp } from './inbody/InbodyMetricHelp';
import { InbodyCsvImportPanel } from '@/components/InbodyCsvImportPanel';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  customerId: string;
  taxId?: string | null;
  companyId?: string | null;
  customerName?: string | null;
  heightCm?: number | null;
  birthDate?: string | null;
  clinicalProfile?: unknown;
  compact?: boolean;
}

function ImpedanceTable({ measurement }: { measurement: InbodyMeasurement }) {
  const freqs = ['20khz', '100khz'] as const;
  const segments = [
    ['BD', 'right_arm'],
    ['BI', 'left_arm'],
    ['TR', 'trunk'],
    ['PD', 'right_leg'],
    ['PI', 'left_leg'],
  ] as const;

  const hasData = freqs.some((f) => measurement.impedance?.[f]);
  if (!hasData) return null;

  return (
    <Card className="border-sky-100/50 dark:border-sky-900/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          <InbodySectionHelp metricId="impedance" title="Impedancia (Ω)" />
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-1 pr-3">Hz</th>
              {segments.map(([label]) => (
                <th key={label} className="text-right py-1 px-2 tabular-nums">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {freqs.map((freq) => {
              const block = measurement.impedance?.[freq];
              if (!block) return null;
              const label = freq === '20khz' ? '20 kHz' : '100 kHz';
              return (
                <tr key={freq} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 pr-3 font-medium">{label}</td>
                  {segments.map(([_, key]) => (
                    <td key={key} className="text-right py-1.5 px-2 tabular-nums">
                      {formatInbodyNumber(block[key], 1)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function sessionLabel(m: InbodyMeasurement, index: number, total: number): string {
  const device = scaleDeviceLabel(scaleDeviceFromMeasurement(m));
  const date = format(new Date(m.measured_at), 'dd/MM/yyyy HH:mm', { locale: es });
  const weight = m.weight_kg != null ? formatInbodyNumber(m.weight_kg, 1, ' kg') : 'sin peso';
  const pbf = m.pbf_pct != null ? ` · PGC ${formatInbodyNumber(m.pbf_pct, 1, '%')}` : '';
  return `${total - index}. [${device}] ${date} · ${weight}${pbf}`;
}

function useWeighCountdown(expiresAt: string | null | undefined): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) {
      setLeft(0);
      return;
    }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  return left;
}

function ScaleWeighNowControls({
  customerId,
  taxId,
  companyId,
  customerName,
  heightCm,
  birthDate,
  clinicalProfile,
  compact,
}: {
  customerId: string;
  taxId?: string | null;
  companyId?: string | null;
  customerName?: string | null;
  heightCm?: number | null;
  birthDate?: string | null;
  clinicalProfile?: unknown;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: active, isLoading } = useActiveScaleWeighRequest(companyId, customerId);
  const start = useStartScaleWeighRequest();
  const cancel = useCancelScaleWeighRequest();
  const toastedMeasurementRef = React.useRef<string | null>(null);
  const secondsLeft = useWeighCountdown(
    active?.status === 'open' ? active.expires_at : null,
  );

  const [profileOpen, setProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formHeight, setFormHeight] = useState('');
  const [formBirth, setFormBirth] = useState('');
  const [formSex, setFormSex] = useState<ScaleSex | ''>('');

  useEffect(() => {
    if (active?.status !== 'fulfilled' || !active.measurement_id || !companyId) return;
    const key = active.measurement_id;
    if (toastedMeasurementRef.current === key) return;
    toastedMeasurementRef.current = key;
    const taxKeys = taxId ? dniMatchKeys(taxId) : [];
    void queryClient.invalidateQueries({
      queryKey: ['inbody_measurements', companyId, customerId, taxKeys.join('|')],
    });
    void queryClient.invalidateQueries({
      queryKey: ['scale_weigh_request', companyId, customerId],
    });
    toast({
      title: 'Medición recibida',
      description:
        active.matched_weight_kg != null
          ? `Peso ${formatInbodyNumber(active.matched_weight_kg, 1, ' kg')} vinculado a este cliente.`
          : 'La medición MorphoScan se ha vinculado a este cliente.',
    });
  }, [active?.status, active?.measurement_id, active?.matched_weight_kg, companyId, customerId, taxId, queryClient, toast]);

  const beginWeigh = (snapshot: {
    height_cm: number;
    age_years: number;
    sex: ScaleSex;
    profile_name: string;
  }) => {
    if (!companyId) return;
    start.mutate(
      {
        companyId,
        customerId,
        heightCm: snapshot.height_cm,
        ageYears: snapshot.age_years,
        sex: snapshot.sex,
        profileName: snapshot.profile_name,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Esperando báscula',
            description: `Sube el paciente a la MorphoScan en los próximos ${Math.round(SCALE_WEIGH_TTL_SECONDS / 60)} minutos.`,
          });
        },
        onError: (e: Error) =>
          toast({
            title: 'No se pudo iniciar',
            description: e.message,
            variant: 'destructive',
          }),
      },
    );
  };

  const openProfileDialog = () => {
    setFormHeight(heightCm != null && heightCm > 0 ? String(heightCm) : '');
    setFormBirth(birthDate ? birthDate.slice(0, 10) : '');
    setFormSex(sexFromClinicalProfile(clinicalProfile) ?? '');
    setProfileOpen(true);
  };

  const onClickWeighNow = () => {
    if (!companyId) return;
    const missing = missingScaleProfileFields({
      heightCm,
      birthDate,
      clinicalProfile,
    });
    if (missing.length > 0) {
      openProfileDialog();
      return;
    }
    try {
      const snap = buildScaleProfileSnapshot({
        heightCm: Number(heightCm),
        birthDate: String(birthDate),
        sex: sexFromClinicalProfile(clinicalProfile)!,
        name: customerName,
      });
      beginWeigh(snap);
    } catch (e) {
      toast({
        title: 'Datos incompletos',
        description: e instanceof Error ? e.message : 'Revisa altura, edad y sexo.',
        variant: 'destructive',
      });
      openProfileDialog();
    }
  };

  const confirmProfileAndWeigh = async () => {
    if (!companyId) return;
    const height = Number(formHeight.replace(',', '.'));
    if (!(height >= 100 && height <= 230)) {
      toast({
        title: 'Altura inválida',
        description: 'Introduce la altura en cm (100–230).',
        variant: 'destructive',
      });
      return;
    }
    if (!formBirth || ageYearsFromBirthDate(formBirth) == null) {
      toast({
        title: 'Fecha inválida',
        description: 'Introduce la fecha de nacimiento.',
        variant: 'destructive',
      });
      return;
    }
    if (formSex !== 'M' && formSex !== 'F') {
      toast({
        title: 'Sexo requerido',
        description: 'Selecciona hombre o mujer (necesario para la composición corporal).',
        variant: 'destructive',
      });
      return;
    }

    setSavingProfile(true);
    try {
      const snap = buildScaleProfileSnapshot({
        heightCm: height,
        birthDate: formBirth,
        sex: formSex,
        name: customerName,
      });
      const { error } = await supabase
        .from('customers')
        .update({
          height_cm: snap.height_cm,
          birth_date: snap.birth_date,
          clinical_profile: mergeClinicalSex(clinicalProfile, snap.sex) as any,
        })
        .eq('id', customerId)
        .eq('company_id', companyId);
      if (error) throw error;

      void queryClient.invalidateQueries({ queryKey: ['customer_detail', customerId] });
      setProfileOpen(false);
      beginWeigh(snap);
    } catch (e) {
      toast({
        title: 'No se pudo guardar el perfil',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const profileDialog = (
    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
      <DialogContent className="sm:max-w-md" overlayClassName={ABOVE_TOP_BANNER_Z}>
        <DialogHeader>
          <DialogTitle>Datos para la báscula</DialogTitle>
          <DialogDescription>
            La MorphoScan necesita altura, edad y sexo para calcular la composición corporal.
            Se guardarán en la ficha del cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="scale-height">Altura (cm)</Label>
            <Input
              id="scale-height"
              type="number"
              min={100}
              max={230}
              step={0.1}
              value={formHeight}
              onChange={(e) => setFormHeight(e.target.value)}
              placeholder="170"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="scale-birth">Fecha de nacimiento</Label>
            <Input
              id="scale-birth"
              type="date"
              value={formBirth}
              onChange={(e) => setFormBirth(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Sexo</Label>
            <Select
              value={formSex || undefined}
              onValueChange={(v) => setFormSex(v as ScaleSex)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Mujer</SelectItem>
                <SelectItem value="M">Hombre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={savingProfile || start.isPending}
            onClick={() => void confirmProfileAndWeigh()}
          >
            {savingProfile || start.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Scale className="h-4 w-4" />
            )}
            <span className="ml-1.5">Guardar y pesar</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!companyId) {
    return (
      <Button type="button" variant="outline" size={compact ? 'sm' : 'default'} disabled>
        <Scale className="h-4 w-4" />
        <span className="ml-1.5">Pesar ahora</span>
      </Button>
    );
  }

  if (active?.status === 'open') {
    const mm = Math.floor(secondsLeft / 60);
    const ss = String(secondsLeft % 60).padStart(2, '0');
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="default"
          className={cn('tabular-nums gap-1.5 py-1.5 px-2.5', compact ? 'text-[10px]' : 'text-xs')}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Esperando báscula {mm}:{ss}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          disabled={cancel.isPending}
          onClick={() => {
            cancel.mutate(
              { id: active.id, companyId, customerId },
              {
                onError: (e: Error) =>
                  toast({
                    title: 'No se pudo cancelar',
                    description: e.message,
                    variant: 'destructive',
                  }),
              },
            );
          }}
          title="Cancelar espera"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (active?.status === 'fulfilled') {
    return (
      <Badge variant="secondary" className={cn('gap-1', compact ? 'text-[10px]' : 'text-xs')}>
        <Scale className="h-3.5 w-3.5" />
        Medición vinculada
      </Badge>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        size={compact ? 'sm' : 'default'}
        disabled={isLoading || start.isPending || savingProfile}
        onClick={onClickWeighNow}
      >
        {start.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Scale className="h-4 w-4" />
        )}
        <span className="ml-1.5">Pesar ahora</span>
      </Button>
      {profileDialog}
    </>
  );
}

function MeasurementSessionBar({
  measurements,
  selected,
  onSelect,
  customerId,
  taxId,
  companyId,
  customerName,
  heightCm,
  birthDate,
  clinicalProfile,
  compact,
}: {
  measurements: InbodyMeasurement[];
  selected: InbodyMeasurement;
  onSelect: (id: string) => void;
  customerId: string;
  taxId?: string | null;
  companyId?: string | null;
  customerName?: string | null;
  heightCm?: number | null;
  birthDate?: string | null;
  clinicalProfile?: unknown;
  compact?: boolean;
}) {
  const measuredLabel = format(new Date(selected.measured_at), 'yyyy-MM-dd HH:mm:ss', { locale: es });
  const deviceLabel = scaleDeviceLabel(scaleDeviceFromMeasurement(selected));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[min(100%,18rem)] flex-1 flex items-center gap-1.5">
          <Select value={selected.id} onValueChange={onSelect}>
            <SelectTrigger className={cn('flex-1', compact ? 'h-8 text-xs' : '')}>
              <SelectValue placeholder="Seleccionar medición" />
            </SelectTrigger>
            <SelectContent>
              {measurements.map((m, idx) => (
                <SelectItem key={m.id} value={m.id} className="pr-8">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{sessionLabel(m, idx, measurements.length)}</span>
                    <InbodyQualityWarningIcon
                      measurement={m}
                      siblings={measurements}
                      side="right"
                    />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Fuera del Select: hover funciona con el desplegable cerrado */}
          <InbodyQualityWarningIcon
            measurement={selected}
            siblings={measurements}
            side="bottom"
            className="shrink-0"
          />
        </div>
        <ScaleWeighNowControls
          customerId={customerId}
          taxId={taxId}
          companyId={companyId}
          customerName={customerName}
          heightCm={heightCm}
          birthDate={birthDate}
          clinicalProfile={clinicalProfile}
          compact={compact}
        />
      </div>

      <div className={compact ? 'text-xs' : 'text-sm'}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <Badge variant="outline" className="text-[10px] font-medium">
            {deviceLabel}
          </Badge>
          <span className="font-medium text-foreground">{selected.inbody_user_id}</span>
          {selected.age_years != null && (
            <span>{formatInbodyNumber(selected.age_years, 0)} Edad</span>
          )}
          {selected.height_cm != null && (
            <span>{formatInbodyNumber(selected.height_cm, 1, 'cm')}</span>
          )}
          {selected.sex && <span>{inbodySexLabel(selected.sex)}</span>}
          <span className="ml-auto flex items-center gap-1 tabular-nums">
            <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
            Fecha {measuredLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function MeasurementReport({
  measurement,
  siblings,
  compact,
}: {
  measurement: InbodyMeasurement;
  siblings: InbodyMeasurement[];
  onSelectReference?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            <InbodySectionHelp metricId="weight_kg" title="Composición corporal" />
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Banda verde = rango normal InBody. Línea azul = valor medido; la curva une peso, MME y masa grasa.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <InbodyCompositionRangeGroup measurement={measurement} />
          <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-border/40">
            <InbodyRangeBar metricId="tbw_kg" value={measurement.tbw_kg} min={measurement.tbw_min_kg} max={measurement.tbw_max_kg} className="col-span-1" />
            <InbodyRangeBar metricId="ffm_kg" value={measurement.ffm_kg} min={measurement.ffm_min_kg} max={measurement.ffm_max_kg} className="col-span-1" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            <InbodySectionHelp metricId="pbf_pct" title="Diagnóstico de obesidad" />
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Columna «Normal»: intervalo de referencia según sexo, edad y talla registrados en la medición.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1 pr-3">Parámetro</th>
                <th className="text-left py-1 pr-3">Valor</th>
                <th className="text-left py-1 pr-3" title="Rango normal InBody">Normal</th>
                <th className="text-left py-1">
                  <InbodyMetricHelp metricId="inbody_status" label="Estado" labelClassName="text-[11px] font-normal text-muted-foreground" />
                </th>
              </tr>
            </thead>
            <tbody>
              <InbodyMetricRow metricId="bmi" value={measurement.bmi} min={measurement.bmi_min} max={measurement.bmi_max} />
              <InbodyMetricRow metricId="pbf_pct" value={measurement.pbf_pct} min={measurement.pbf_min_pct} max={measurement.pbf_max_pct} unit="%" />
              <InbodyMetricRow metricId="whr" value={measurement.whr} min={measurement.whr_min} max={measurement.whr_max} decimals={2} />
              <InbodyMetricRow metricId="bmr_kcal" label="MB" value={measurement.bmr_kcal} min={measurement.bmr_min_kcal} max={measurement.bmr_max_kcal} unit="kcal" decimals={0} />
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="border-sky-100/50 dark:border-sky-900/20">
          <CardContent className="pt-4 text-center">
            <div className="flex justify-center">
              <InbodyMetricHelp metricId="muscle_control_kg" labelClassName="text-[11px] uppercase text-muted-foreground font-normal" />
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1" title="Kg de MME a ganar (+) o perder (−) según InBody">
              {formatInbodyNumber(measurement.muscle_control_kg, 1, ' kg')}
            </div>
          </CardContent>
        </Card>
        <Card className="border-sky-100/50 dark:border-sky-900/20">
          <CardContent className="pt-4 text-center">
            <div className="flex justify-center">
              <InbodyMetricHelp metricId="fat_control_kg" labelClassName="text-[11px] uppercase text-muted-foreground font-normal" />
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1" title="Kg de grasa a perder (−) o ganar (+) según InBody">
              {formatInbodyNumber(measurement.fat_control_kg, 1, ' kg')}
            </div>
          </CardContent>
        </Card>
      </div>

      <InbodyNutritionPanel measurement={measurement} compact={compact} />

      <ImpedanceTable measurement={measurement} />
    </div>
  );
}

export const ClienteInbodyTab: React.FC<Props> = ({
  customerId,
  taxId,
  companyId,
  customerName,
  heightCm,
  birthDate,
  clinicalProfile,
  compact,
}) => {
  const { data: measurements, isLoading, error } = useInbodyMeasurements(customerId, taxId, companyId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(null);
  }, [customerId]);

  useEffect(() => {
    if (measurements?.length) {
      setSelectedId((prev) => (prev && measurements.some((m) => m.id === prev) ? prev : measurements[0].id));
    }
  }, [measurements]);

  const selected = useMemo(() => {
    if (!measurements?.length) return null;
    if (selectedId) return measurements.find((m) => m.id === selectedId) ?? measurements[0];
    return measurements[0];
  }, [measurements, selectedId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-center py-10 text-sm text-destructive">
          No se pudieron cargar las mediciones de báscula.
        </div>
        <InbodyCsvImportPanel
          embedded
          customerId={customerId}
          taxId={taxId}
          customerName={customerName}
        />
      </div>
    );
  }

  if (!measurements?.length) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
          <Activity className="h-10 w-10 opacity-30" />
          <div>
            <p className="font-medium text-foreground">Sin mediciones de báscula</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">
              Pulsa «Pesar ahora» y sube al paciente a la MorphoScan, o importa un CSV de Lookin&apos;Body.
            </p>
          </div>
          <ScaleWeighNowControls
            customerId={customerId}
            taxId={taxId}
            companyId={companyId}
            customerName={customerName}
            heightCm={heightCm}
            birthDate={birthDate}
            clinicalProfile={clinicalProfile}
            compact={compact}
          />
        </div>
        <InbodyCsvImportPanel
          embedded
          customerId={customerId}
          taxId={taxId}
          customerName={customerName}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selected && (
        <MeasurementSessionBar
          measurements={measurements}
          selected={selected}
          onSelect={setSelectedId}
          customerId={customerId}
          taxId={taxId}
          companyId={companyId}
          customerName={customerName}
          heightCm={heightCm}
          birthDate={birthDate}
          clinicalProfile={clinicalProfile}
          compact={compact}
        />
      )}

      <InbodyCompositionEvolutionChart
        measurements={measurements}
        selectedId={selected?.id}
        compact={compact}
        onSelectSession={setSelectedId}
      />

      <InbodyHistoryChart
        measurements={measurements}
        selectedId={selected?.id}
        compact={compact}
        onSelectSession={setSelectedId}
      />

      {selected && (
        <InbodySegmentalSilhouette
          lean={selected.segmental_lean}
          fat={selected.segmental_fat}
          sex={selected.sex}
          measuredAtLabel={format(new Date(selected.measured_at), "EEEE d MMMM yyyy · HH:mm", {
            locale: es,
          })}
          compact={compact}
        />
      )}

      {selected &&
        (isMorphoScanMeasurement(selected) ? (
          <MorphoScanMeasurementReport measurement={selected} compact={compact} />
        ) : (
          <MeasurementReport
            measurement={selected}
            siblings={measurements}
            onSelectReference={setSelectedId}
            compact={compact}
          />
        ))}

      {selected &&
        (isMorphoScanMeasurement(selected) ? (
          <MorphoScanReportExport
            key={`morphoscan-report-${customerId}-${selected.id}`}
            customerId={customerId}
            measurement={selected}
            customerName={customerName ?? undefined}
            compact={compact}
          />
        ) : (
          <InbodyReportExport
            key={`inbody-report-${customerId}-${selected.id}`}
            customerId={customerId}
            measurement={selected}
            customerName={customerName ?? undefined}
            compact={compact}
          />
        ))}

      <InbodyCsvImportPanel
        embedded
        customerId={customerId}
        taxId={taxId}
        customerName={customerName}
      />

      <p className="text-[10px] text-muted-foreground italic text-center pt-2">
        Utilice sus resultados como referencia cuando consulte a su médico o entrenador personal.
      </p>
    </div>
  );
};
