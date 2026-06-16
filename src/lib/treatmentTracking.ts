import { supabase } from '@/lib/supabase';
import type { ConsentimientoPlantilla } from '@/lib/consentimientoTypes';

export type TrackingFamily = 'depilacion' | 'aesthetic';

export type MeasurementAssets = {
  male?: string | null;
  female?: string | null;
};

export const TRACKING_FAMILY_LABELS: Record<TrackingFamily, string> = {
  depilacion: 'Depilación (láser / IPL / eléctrica)',
  aesthetic: 'Tratamientos estéticos (facial, corporal, INDIBA, LPG…)',
};

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  consent: 'Consentimiento',
  tracking: 'Seguimiento por sesiones',
  questionnaire: 'Cuestionario',
  admin: 'Administrativo',
};

export function inferCustomerSex(
  customer?: { gender?: string | null; name?: string | null } | null,
): 'male' | 'female' | null {
  const g = (customer?.gender ?? '').toLowerCase();
  if (['m', 'male', 'hombre', 'masculino', 'h'].includes(g)) return 'male';
  if (['f', 'female', 'mujer', 'femenino'].includes(g)) return 'female';
  return null;
}

export function measurementAssetForCustomer(
  assets: MeasurementAssets | null | undefined,
  customer?: { gender?: string | null; name?: string | null } | null,
): string | null {
  if (!assets) return null;
  const sex = inferCustomerSex(customer);
  if (sex === 'male' && assets.male) return assets.male;
  if (sex === 'female' && assets.female) return assets.female;
  return assets.female ?? assets.male ?? null;
}

export async function fetchPlantillaByCodigo(
  companyId: string,
  codigo: string,
): Promise<ConsentimientoPlantilla | null> {
  const { data, error } = await supabase
    .from('consentimiento_plantillas')
    .select('*')
    .eq('company_id', companyId)
    .eq('codigo', codigo)
    .maybeSingle();
  if (error) throw error;
  return (data as ConsentimientoPlantilla) ?? null;
}

export async function findActiveTreatmentHistorial(params: {
  customerId: string;
  trackingFamily: TrackingFamily;
  plantillaCodigo?: string | null;
}) {
  let query = supabase
    .from('historial_clinico')
    .select('id, titulo, tratamiento, tracking_family, plantilla_codigo, fecha, created_at')
    .eq('customer_id', params.customerId)
    .eq('tracking_family', params.trackingFamily)
    .order('fecha', { ascending: false })
    .limit(1);
  if (params.plantillaCodigo) {
    query = query.eq('plantilla_codigo', params.plantillaCodigo);
  }
  const { data, error } = await query.maybeSingle();
  if (error && error.code !== '42703') throw error;
  return data;
}

export async function ensureTreatmentHistorial(params: {
  customerId: string;
  companyId: string;
  trackingFamily: TrackingFamily;
  tratamiento: string;
  plantillaCodigo?: string | null;
  consentimientoId?: string | null;
  appointmentId?: string | null;
  appointmentDate?: string;
  employeeId?: string | null;
}): Promise<string> {
  const existing = await findActiveTreatmentHistorial({
    customerId: params.customerId,
    trackingFamily: params.trackingFamily,
    plantillaCodigo: params.plantillaCodigo,
  });
  if (existing?.id) return existing.id as string;

  const fecha = params.appointmentDate ?? new Date().toISOString().slice(0, 10);
  const payload: Record<string, unknown> = {
    customer_id: params.customerId,
    company_id: params.companyId,
    fecha,
    tipo: 'tratamiento',
    titulo: params.tratamiento.slice(0, 200) || TRACKING_FAMILY_LABELS[params.trackingFamily],
    motivo_consulta: params.tratamiento.slice(0, 200) || TRACKING_FAMILY_LABELS[params.trackingFamily],
    tratamiento: params.tratamiento,
    tracking_family: params.trackingFamily,
    plantilla_codigo: params.plantillaCodigo ?? null,
    consentimiento_id: params.consentimientoId ?? null,
    appointment_id: params.appointmentId ?? null,
    empleado_id: params.employeeId ?? null,
  };

  const { data, error } = await supabase
    .from('historial_clinico')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export type SessionFormValues = {
  zona: string;
  parametros: string;
  observaciones: string;
  fluencia: string;
  pulso: string;
};

export const emptySessionForm = (): SessionFormValues => ({
  zona: '',
  parametros: '',
  observaciones: '',
  fluencia: '',
  pulso: '',
});

export async function addTreatmentSessionRevision(params: {
  historialId: string;
  customerId: string;
  companyId: string;
  appointmentId?: string | null;
  fecha: string;
  session: SessionFormValues;
  trackingFamily: TrackingFamily;
}): Promise<void> {
  const descripcion = [
    params.session.zona ? `Zona: ${params.session.zona}` : '',
    params.session.fluencia ? `Fluencia: ${params.session.fluencia}` : '',
    params.session.pulso ? `Pulso: ${params.session.pulso}` : '',
    params.session.parametros ? `Parámetros: ${params.session.parametros}` : '',
    params.session.observaciones ? `Observaciones: ${params.session.observaciones}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const session_data = {
    tracking_family: params.trackingFamily,
    ...params.session,
  };

  const { error } = await supabase.from('historial_clinico_revisiones').insert({
    historial_clinico_id: params.historialId,
    customer_id: params.customerId,
    company_id: params.companyId,
    appointment_id: params.appointmentId ?? null,
    fecha: params.fecha,
    descripcion,
    session_data,
    sort_order: Date.now(),
  });
  if (error) throw error;
}

export function plantillaBadges(plantilla: Pick<
  ConsentimientoPlantilla,
  'document_kind' | 'linked_tracking_codigo' | 'category' | 'requires_measurements'
>) {
  const badges: string[] = [];
  if (plantilla.document_kind) {
    badges.push(DOCUMENT_KIND_LABELS[plantilla.document_kind] ?? plantilla.document_kind);
  }
  if (plantilla.category === 'medicina') badges.push('Medicina');
  if (plantilla.linked_tracking_codigo) badges.push('Con seguimiento');
  if (plantilla.requires_measurements) badges.push('Medidas');
  return badges;
}

export function trackingFamilyFromPlantilla(
  plantilla: Pick<ConsentimientoPlantilla, 'linked_tracking_codigo' | 'tracking_family'>,
): TrackingFamily | null {
  if (plantilla.tracking_family === 'depilacion' || plantilla.tracking_family === 'aesthetic') {
    return plantilla.tracking_family;
  }
  if (plantilla.linked_tracking_codigo === 'tracking_depilacion') return 'depilacion';
  if (plantilla.linked_tracking_codigo === 'tracking_aesthetic') return 'aesthetic';
  return null;
}
