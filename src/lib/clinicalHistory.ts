import { supabase } from '@/lib/supabase';

export type ClinicalHistoryRecord = {
  id: string;
  customer_id: string;
  company_id: string;
  fecha: string;
  appointment_id: string | null;
  antecedentes_personales: string | null;
  motivo_consulta: string | null;
  tratamiento: string | null;
  proxima_revision_fecha: string | null;
  proxima_revision_descripcion: string | null;
  aviso_text: string | null;
  titulo: string;
  tipo: string;
  descripcion: string | null;
  observaciones: string | null;
  empleado_id: string | null;
  created_at: string;
};

export type ClinicalHistoryFormValues = {
  birthDate: string;
  antecedentesPersonales: string;
  motivoConsulta: string;
  tratamiento: string;
  proximaRevisionFecha: string;
  proximaRevisionDescripcion: string;
  avisoText: string;
  avisoNotifyUserId: string;
};

const SELECT_FIELDS =
  'id, customer_id, company_id, fecha, appointment_id, antecedentes_personales, motivo_consulta, tratamiento, proxima_revision_fecha, proxima_revision_descripcion, aviso_text, titulo, tipo, descripcion, observaciones, empleado_id, created_at';

function mapRow(row: Record<string, unknown>): ClinicalHistoryRecord {
  return {
    id: String(row.id),
    customer_id: String(row.customer_id),
    company_id: String(row.company_id),
    fecha: String(row.fecha).slice(0, 10),
    appointment_id: row.appointment_id ? String(row.appointment_id) : null,
    antecedentes_personales: (row.antecedentes_personales as string) ?? null,
    motivo_consulta: (row.motivo_consulta as string) ?? null,
    tratamiento: (row.tratamiento as string) ?? null,
    proxima_revision_fecha: row.proxima_revision_fecha
      ? String(row.proxima_revision_fecha).slice(0, 10)
      : null,
    proxima_revision_descripcion: (row.proxima_revision_descripcion as string) ?? null,
    aviso_text: (row.aviso_text as string) ?? null,
    titulo: String(row.titulo ?? 'Consulta'),
    tipo: String(row.tipo ?? 'consulta'),
    descripcion: (row.descripcion as string) ?? null,
    observaciones: (row.observaciones as string) ?? null,
    empleado_id: row.empleado_id ? String(row.empleado_id) : null,
    created_at: String(row.created_at ?? ''),
  };
}

export async function fetchCustomerBirthDate(customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('birth_date')
    .eq('id', customerId)
    .maybeSingle();
  if (error) {
    if (error.code === '42703') return null;
    throw error;
  }
  const raw = (data as { birth_date?: string | null } | null)?.birth_date;
  return raw ? String(raw).slice(0, 10) : null;
}

export async function updateCustomerBirthDate(
  customerId: string,
  birthDate: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ birth_date: birthDate || null })
    .eq('id', customerId);
  if (error && error.code !== '42703') throw error;
}

export async function fetchClinicalHistoryByAppointment(
  appointmentId: string,
): Promise<ClinicalHistoryRecord | null> {
  const { data, error } = await supabase
    .from('historial_clinico')
    .select(SELECT_FIELDS)
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (error) {
    if (error.code === '42703') return null;
    throw error;
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function fetchClinicalHistoryList(customerId: string): Promise<ClinicalHistoryRecord[]> {
  const { data, error } = await supabase
    .from('historial_clinico')
    .select(SELECT_FIELDS)
    .eq('customer_id', customerId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export function clinicalHistoryToFormValues(
  record: ClinicalHistoryRecord | null,
  birthDate: string | null,
): ClinicalHistoryFormValues {
  return {
    birthDate: birthDate ?? '',
    antecedentesPersonales: record?.antecedentes_personales ?? record?.descripcion ?? '',
    motivoConsulta: record?.motivo_consulta ?? record?.titulo ?? '',
    tratamiento: record?.tratamiento ?? '',
    proximaRevisionFecha: record?.proxima_revision_fecha ?? '',
    proximaRevisionDescripcion: record?.proxima_revision_descripcion ?? '',
    avisoText: record?.aviso_text ?? '',
    avisoNotifyUserId: '',
  };
}

export function clinicalHistoryOneLineSummary(record: ClinicalHistoryRecord): string {
  const parts = [
    record.motivo_consulta?.trim() || record.titulo?.trim(),
    record.tratamiento?.trim(),
  ].filter(Boolean);
  return parts.join(' · ') || 'Consulta clínica';
}

export async function saveClinicalHistory(params: {
  customerId: string;
  companyId: string;
  appointmentDate: string;
  appointmentId?: string | null;
  employeeId?: string | null;
  values: ClinicalHistoryFormValues;
  existingId?: string | null;
}): Promise<ClinicalHistoryRecord> {
  const motivo = params.values.motivoConsulta.trim() || 'Consulta';
  const payload: Record<string, unknown> = {
    customer_id: params.customerId,
    company_id: params.companyId,
    fecha: params.appointmentDate,
    appointment_id: params.appointmentId ?? null,
    tipo: 'consulta',
    titulo: motivo.slice(0, 200),
    descripcion: params.values.antecedentesPersonales.trim() || null,
    antecedentes_personales: params.values.antecedentesPersonales.trim() || null,
    motivo_consulta: motivo,
    tratamiento: params.values.tratamiento.trim() || null,
    proxima_revision_fecha: params.values.proximaRevisionFecha || null,
    proxima_revision_descripcion: params.values.proximaRevisionDescripcion.trim() || null,
    aviso_text: params.values.avisoText.trim() || null,
    empleado_id: params.employeeId ?? null,
  };

  if (params.existingId) {
    const { data, error } = await supabase
      .from('historial_clinico')
      .update(payload)
      .eq('id', params.existingId)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('historial_clinico')
    .insert(payload)
    .select(SELECT_FIELDS)
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}
