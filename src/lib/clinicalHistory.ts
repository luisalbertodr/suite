import { supabase } from '@/lib/supabase';

export type ClinicalHistoryReview = {
  id: string;
  historial_clinico_id: string;
  customer_id: string;
  company_id: string;
  appointment_id: string | null;
  fecha: string;
  descripcion: string;
  sort_order: number;
  created_at: string;
};

export type ClinicalHistoryFormReview = {
  id?: string;
  fecha: string;
  descripcion: string;
  appointmentId?: string | null;
};

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
  revisiones: ClinicalHistoryReview[];
};

export type ClinicalHistoryFormValues = {
  birthDate: string;
  antecedentesPersonales: string;
  motivoConsulta: string;
  tratamiento: string;
  proximaRevisionFecha: string;
  proximaRevisionDescripcion: string;
  revisiones: ClinicalHistoryFormReview[];
  avisoText: string;
  avisoNotifyUserId: string;
};

export function emptyClinicalHistoryFormValues(): ClinicalHistoryFormValues {
  return {
    birthDate: '',
    antecedentesPersonales: '',
    motivoConsulta: '',
    tratamiento: '',
    proximaRevisionFecha: '',
    proximaRevisionDescripcion: '',
    revisiones: [],
    avisoText: '',
    avisoNotifyUserId: '',
  };
}

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
    revisiones: [],
  };
}

function mapReview(row: Record<string, unknown>): ClinicalHistoryReview {
  return {
    id: String(row.id),
    historial_clinico_id: String(row.historial_clinico_id),
    customer_id: String(row.customer_id),
    company_id: String(row.company_id),
    appointment_id: row.appointment_id ? String(row.appointment_id) : null,
    fecha: String(row.fecha).slice(0, 10),
    descripcion: String(row.descripcion ?? ''),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

function isReviewSchemaError(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === '42703';
}

async function attachReviews(records: ClinicalHistoryRecord[]): Promise<ClinicalHistoryRecord[]> {
  if (!records.length) return records;
  const ids = records.map((record) => record.id);
  const { data, error } = await supabase
    .from('historial_clinico_revisiones')
    .select(
      'id, historial_clinico_id, customer_id, company_id, appointment_id, fecha, descripcion, sort_order, created_at',
    )
    .in('historial_clinico_id', ids)
    .order('fecha', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (isReviewSchemaError(error)) return records;
    throw error;
  }

  const byHistory = new Map<string, ClinicalHistoryReview[]>();
  for (const row of data ?? []) {
    const review = mapReview(row as Record<string, unknown>);
    const list = byHistory.get(review.historial_clinico_id) ?? [];
    list.push(review);
    byHistory.set(review.historial_clinico_id, list);
  }

  return records.map((record) => ({
    ...record,
    revisiones: byHistory.get(record.id) ?? [],
  }));
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
  const records = data ? await attachReviews([mapRow(data as Record<string, unknown>)]) : [];
  return records[0] ?? null;
}

export async function fetchClinicalHistoryList(customerId: string): Promise<ClinicalHistoryRecord[]> {
  const { data, error } = await supabase
    .from('historial_clinico')
    .select(SELECT_FIELDS)
    .eq('customer_id', customerId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return attachReviews((data ?? []).map((row) => mapRow(row as Record<string, unknown>)));
}

export async function fetchLatestClinicalHistory(
  customerId: string,
  excludeAppointmentId?: string | null,
): Promise<ClinicalHistoryRecord | null> {
  let query = supabase
    .from('historial_clinico')
    .select(SELECT_FIELDS)
    .eq('customer_id', customerId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  if (excludeAppointmentId) {
    query = query.neq('appointment_id', excludeAppointmentId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  const records = data ? await attachReviews([mapRow(data as Record<string, unknown>)]) : [];
  return records[0] ?? null;
}

export function clinicalHistoryToFormValues(
  record: ClinicalHistoryRecord | null,
  birthDate: string | null,
): ClinicalHistoryFormValues {
  const revisiones = record?.revisiones?.length
    ? record.revisiones.map((revision) => ({
        id: revision.id,
        fecha: revision.fecha,
        descripcion: revision.descripcion,
        appointmentId: revision.appointment_id,
      }))
    : record?.proxima_revision_fecha || record?.proxima_revision_descripcion
      ? [
          {
            fecha: record.proxima_revision_fecha ?? '',
            descripcion: record.proxima_revision_descripcion ?? '',
            appointmentId: null,
          },
        ]
      : [];

  return {
    birthDate: birthDate ?? '',
    antecedentesPersonales: record?.antecedentes_personales ?? record?.descripcion ?? '',
    motivoConsulta: record?.motivo_consulta ?? record?.titulo ?? '',
    tratamiento: record?.tratamiento ?? '',
    proximaRevisionFecha: revisiones[0]?.fecha ?? '',
    proximaRevisionDescripcion: revisiones[0]?.descripcion ?? '',
    revisiones,
    avisoText: record?.aviso_text ?? '',
    avisoNotifyUserId: '',
  };
}

export function clinicalHistoryToPrefillValues(
  record: ClinicalHistoryRecord | null,
  birthDate: string | null,
): ClinicalHistoryFormValues {
  if (!record && !birthDate) {
    return emptyClinicalHistoryFormValues();
  }

  const base = clinicalHistoryToFormValues(record, birthDate);
  return {
    ...base,
    proximaRevisionFecha: '',
    proximaRevisionDescripcion: '',
    revisiones: [],
    avisoText: '',
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
  const revisiones = params.values.revisiones
    .map((revision, index) => ({
      id: revision.id,
      fecha: revision.fecha.trim(),
      descripcion: revision.descripcion.trim(),
      appointmentId: revision.appointmentId ?? null,
      sortOrder: index,
    }))
    .filter((revision) => revision.fecha || revision.descripcion);
  const firstReview = revisiones[0];
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
    proxima_revision_fecha: firstReview?.fecha || null,
    proxima_revision_descripcion: firstReview?.descripcion || null,
    aviso_text: params.values.avisoText.trim() || null,
    empleado_id: params.employeeId ?? null,
  };

  let saved: ClinicalHistoryRecord;
  if (params.existingId) {
    const { data, error } = await supabase
      .from('historial_clinico')
      .update(payload)
      .eq('id', params.existingId)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    saved = mapRow(data as Record<string, unknown>);
  } else {
    const { data, error } = await supabase
      .from('historial_clinico')
      .insert(payload)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    saved = mapRow(data as Record<string, unknown>);
  }

  await saveClinicalHistoryReviews({
    record: saved,
    reviews: revisiones,
  });

  const withReviews = await attachReviews([saved]);
  return withReviews[0] ?? saved;
}

async function saveClinicalHistoryReviews(params: {
  record: ClinicalHistoryRecord;
  reviews: Array<{
    id?: string;
    fecha: string;
    descripcion: string;
    appointmentId: string | null;
    sortOrder: number;
  }>;
}): Promise<void> {
  const keepIds = params.reviews
    .map((review) => review.id)
    .filter((id): id is string => Boolean(id));

  let deleteQuery = supabase
    .from('historial_clinico_revisiones')
    .delete()
    .eq('historial_clinico_id', params.record.id);
  if (keepIds.length) {
    deleteQuery = deleteQuery.not('id', 'in', `(${keepIds.join(',')})`);
  }
  const deleteResult = await deleteQuery;
  if (deleteResult.error) {
    if (isReviewSchemaError(deleteResult.error)) return;
    throw deleteResult.error;
  }

  for (const review of params.reviews) {
    const row = {
      historial_clinico_id: params.record.id,
      customer_id: params.record.customer_id,
      company_id: params.record.company_id,
      appointment_id: review.appointmentId || null,
      fecha: review.fecha || params.record.fecha,
      descripcion: review.descripcion,
      sort_order: review.sortOrder,
    };

    const result = review.id
      ? await supabase
          .from('historial_clinico_revisiones')
          .update(row)
          .eq('id', review.id)
      : await supabase.from('historial_clinico_revisiones').insert(row);

    if (result.error) throw result.error;
  }
}
