import { supabase } from '@/integrations/supabase/client';
import { buildAgendaAppointmentUrl, buildCustomerProfileUrl } from '@/lib/agendaCustomerNavigation';
import { scaleDeviceFromMeasurement, scaleDeviceLabel } from '@/lib/inbodyMeasurements';
import { repairStyleText } from '@/lib/styleTextEncoding';

export const DASHBOARD_RECENT_ACTIVITY_LIMIT = 100;

const AUDIT_FETCH_LIMIT = 140;
const SUPPLEMENT_FETCH_LIMIT = 40;

const AUDITED_ENTITY_TABLES = [
  'agenda_appointments',
  'customers',
  'invoices',
  'sales',
  'marketing_leads',
] as const;

export type DashboardRecentActivityType =
  | 'factura'
  | 'cita'
  | 'cliente'
  | 'bascula'
  | 'venta'
  | 'marketing'
  | 'nota_marketing';

export type DashboardRecentActivityFilter = 'all' | DashboardRecentActivityType;

export const DASHBOARD_ACTIVITY_TYPE_OPTIONS: Array<{
  value: DashboardRecentActivityFilter;
  label: string;
}> = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'cita', label: 'Citas' },
  { value: 'factura', label: 'Facturas' },
  { value: 'cliente', label: 'Clientes' },
  { value: 'venta', label: 'Ventas TPV' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'nota_marketing', label: 'Notas marketing' },
  { value: 'bascula', label: 'Báscula' },
];

const TYPE_TO_AUDIT_TABLE: Record<
  Exclude<DashboardRecentActivityType, 'bascula' | 'nota_marketing'>,
  (typeof AUDITED_ENTITY_TABLES)[number]
> = {
  cita: 'agenda_appointments',
  cliente: 'customers',
  factura: 'invoices',
  venta: 'sales',
  marketing: 'marketing_leads',
};

export type DashboardRecentActivity = {
  id: string;
  type: DashboardRecentActivityType;
  description: string;
  time: string;
  createdAt: string;
  href: string;
};

type AuditEventRow = {
  id: string;
  action: 'insert' | 'update' | 'delete';
  entity_table: string;
  entity_id: string | null;
  old_record: Record<string, unknown> | null;
  new_record: Record<string, unknown> | null;
  created_at: string;
};

type JsonRecord = Record<string, unknown> | null;

function recordStr(rec: JsonRecord, key: string): string | null {
  const value = rec?.[key];
  if (value == null) return null;
  return String(value);
}

function recordNum(rec: JsonRecord, key: string): number | null {
  const value = rec?.[key];
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function getTimeAgo(dateString: string): string {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (diff < 1) return 'hace unos segundos';
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) {
    const h = Math.floor(diff / 60);
    return `hace ${h} hora${h > 1 ? 's' : ''}`;
  }
  const d = Math.floor(diff / 1440);
  return `hace ${d} día${d > 1 ? 's' : ''}`;
}

function appointmentDateFromRecord(rec: JsonRecord): string {
  const appointmentDate = recordStr(rec, 'appointment_date');
  if (appointmentDate) return appointmentDate.slice(0, 10);
  const startTime = recordStr(rec, 'start_time');
  if (startTime?.includes('T')) return startTime.split('T')[0]!;
  const createdAt = recordStr(rec, 'created_at');
  return createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

function appointmentLabel(rec: JsonRecord): string {
  return repairStyleText(
    recordStr(rec, 'client_name')
    || recordStr(rec, 'title')
    || recordStr(rec, 'description')
    || 'Cita',
  );
}

function customerLabel(rec: JsonRecord): string {
  return repairStyleText(recordStr(rec, 'name') || 'Cliente');
}

function leadLabel(rec: JsonRecord): string {
  const first = recordStr(rec, 'first_name') ?? '';
  const last = recordStr(rec, 'last_name') ?? '';
  const combined = `${first} ${last}`.trim();
  return repairStyleText(combined || recordStr(rec, 'phone') || 'Lead');
}

function formatEuro(amount: number | null): string {
  if (amount == null) return '';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function marketingLeadHref(leadId: string | null | undefined): string {
  if (!leadId) return '/marketing';
  return `/marketing?lead=${leadId}`;
}

function mapAuditEvent(event: AuditEventRow): DashboardRecentActivity | null {
  const rec = event.action === 'delete' ? event.old_record : event.new_record;
  const entityId = event.entity_id ?? recordStr(rec, 'id');

  switch (event.entity_table) {
    case 'agenda_appointments': {
      const label = appointmentLabel(rec);
      const customerId = recordStr(rec, 'customer_id');
      const dateYmd = appointmentDateFromRecord(rec);
      const status = recordStr(rec, 'status');
      const oldStatus = recordStr(event.old_record, 'status');

      let description: string;
      if (event.action === 'insert') description = `Cita creada: ${label}`;
      else if (event.action === 'delete') description = `Cita eliminada: ${label}`;
      else if (status === 'cancelled' && oldStatus !== 'cancelled') description = `Cita cancelada: ${label}`;
      else description = `Cita modificada: ${label}`;

      return {
        id: `audit-${event.id}`,
        type: 'cita',
        description,
        time: getTimeAgo(event.created_at),
        createdAt: event.created_at,
        href: entityId
          ? buildAgendaAppointmentUrl(dateYmd, entityId, customerId ?? undefined)
          : `/agenda?date=${dateYmd}`,
      };
    }

    case 'customers': {
      const label = customerLabel(rec);
      const description = event.action === 'insert'
        ? `Cliente registrado: ${label}`
        : event.action === 'delete'
          ? `Cliente eliminado: ${label}`
          : `Cliente actualizado: ${label}`;

      return {
        id: `audit-${event.id}`,
        type: 'cliente',
        description,
        time: getTimeAgo(event.created_at),
        createdAt: event.created_at,
        href: entityId ? buildCustomerProfileUrl(entityId) : '/clientes',
      };
    }

    case 'invoices': {
      const number = repairStyleText(recordStr(rec, 'number') || 'sin número');
      const description = event.action === 'insert'
        ? `Factura ${number} creada`
        : event.action === 'delete'
          ? `Factura ${number} eliminada`
          : `Factura ${number} actualizada`;

      return {
        id: `audit-${event.id}`,
        type: 'factura',
        description,
        time: getTimeAgo(event.created_at),
        createdAt: event.created_at,
        href: entityId ? `/facturacion?invoice=${entityId}` : '/facturacion',
      };
    }

    case 'sales': {
      const ticket = repairStyleText(recordStr(rec, 'ticket_number') || 'TPV');
      const total = formatEuro(recordNum(rec, 'total_amount'));
      const status = recordStr(rec, 'status');
      let description: string;
      if (event.action === 'insert') {
        description = total ? `Venta ${ticket} — ${total}` : `Venta ${ticket} registrada`;
      } else if (event.action === 'delete') {
        description = `Venta ${ticket} eliminada`;
      } else if (status === 'cancelled') {
        description = `Venta ${ticket} cancelada`;
      } else {
        description = `Venta ${ticket} actualizada`;
      }

      return {
        id: `audit-${event.id}`,
        type: 'venta',
        description,
        time: getTimeAgo(event.created_at),
        createdAt: event.created_at,
        href: '/tpv',
      };
    }

    case 'marketing_leads': {
      const label = leadLabel(rec);
      const oldStage = recordStr(event.old_record, 'stage_id');
      const newStage = recordStr(event.new_record, 'stage_id');
      const archivedAt = recordStr(event.new_record, 'archived_at');
      const oldArchivedAt = recordStr(event.old_record, 'archived_at');

      let description: string;
      if (event.action === 'insert') {
        description = `Lead marketing: ${label}`;
      } else if (event.action === 'delete') {
        description = `Lead marketing eliminado: ${label}`;
      } else if (archivedAt && !oldArchivedAt) {
        description = `Lead archivado: ${label}`;
      } else if (oldStage && newStage && oldStage !== newStage) {
        description = `Lead movido de etapa: ${label}`;
      } else {
        description = `Lead marketing actualizado: ${label}`;
      }

      return {
        id: `audit-${event.id}`,
        type: 'marketing',
        description,
        time: getTimeAgo(event.created_at),
        createdAt: event.created_at,
        href: marketingLeadHref(entityId),
      };
    }

    default:
      return null;
  }
}

const NOTE_KIND_LABEL: Record<string, string> = {
  note: 'Nota',
  call: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  rejection: 'Rechazo',
  reschedule: 'Reagendar',
};

function truncateText(text: string, max = 72): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

async function fetchAuditEvents(
  companyIds: string[],
  entityTables: string[],
  limit: number,
): Promise<AuditEventRow[]> {
  const auditPromises = companyIds.map((id) =>
    supabase
      .from('audit_events')
      .select('id, action, entity_table, entity_id, old_record, new_record, created_at')
      .eq('company_id', id)
      .in('entity_table', entityTables)
      .order('created_at', { ascending: false })
      .limit(limit),
  );

  const auditResults = await Promise.all(auditPromises);
  for (const result of auditResults) {
    if (result.error) throw result.error;
  }

  return auditResults
    .flatMap((result) => (result.data ?? []) as AuditEventRow[])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

function mapAuditEvents(events: AuditEventRow[]): DashboardRecentActivity[] {
  const activities: DashboardRecentActivity[] = [];
  for (const event of events) {
    const mapped = mapAuditEvent(event);
    if (mapped) activities.push(mapped);
  }
  return activities;
}

async function fetchScaleActivities(
  opCompanyId: string,
  limit: number,
): Promise<DashboardRecentActivity[]> {
  const scaleRes = await supabase
    .from('inbody_measurements')
    .select('id, customer_id, measured_at, weight_kg, pbf_pct, device, source, customers(name)')
    .eq('company_id', opCompanyId)
    .not('customer_id', 'is', null)
    .order('measured_at', { ascending: false })
    .limit(limit);

  if (scaleRes.error) throw scaleRes.error;

  const activities: DashboardRecentActivity[] = [];
  for (const measurement of scaleRes.data ?? []) {
    if (!measurement.customer_id) continue;
    const customer = measurement.customers as { name?: string | null } | null;
    const name = repairStyleText(customer?.name ?? 'Cliente');
    const device = scaleDeviceLabel(scaleDeviceFromMeasurement(measurement));
    const weight = measurement.weight_kg != null ? `${measurement.weight_kg} kg` : '';
    const fat = measurement.pbf_pct != null ? ` · ${measurement.pbf_pct}% grasa` : '';
    const metrics = weight ? ` — ${weight}${fat}` : '';

    activities.push({
      id: `scale-${measurement.id}`,
      type: 'bascula',
      description: `Báscula ${device}: ${name}${metrics}`,
      time: getTimeAgo(measurement.measured_at),
      createdAt: measurement.measured_at,
      href: buildCustomerProfileUrl(measurement.customer_id, 'inbody'),
    });
  }
  return activities;
}

async function fetchMarketingNoteActivities(
  opCompanyId: string,
  limit: number,
): Promise<DashboardRecentActivity[]> {
  const notesRes = await supabase
    .from('marketing_lead_notes')
    .select('id, lead_id, body, kind, created_at, marketing_leads(first_name, last_name, phone)')
    .eq('company_id', opCompanyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (notesRes.error) throw notesRes.error;

  const activities: DashboardRecentActivity[] = [];
  for (const note of notesRes.data ?? []) {
    const lead = note.marketing_leads as {
      first_name?: string | null;
      last_name?: string | null;
      phone?: string | null;
    } | null;
    const leadName = leadLabel(lead);
    const kindLabel = NOTE_KIND_LABEL[note.kind] ?? 'Nota';
    const bodyPreview = truncateText(repairStyleText(note.body));

    activities.push({
      id: `mnote-${note.id}`,
      type: 'nota_marketing',
      description: `${kindLabel} en lead ${leadName}: ${bodyPreview}`,
      time: getTimeAgo(note.created_at),
      createdAt: note.created_at,
      href: marketingLeadHref(note.lead_id),
    });
  }
  return activities;
}

export type FetchDashboardRecentActivityOptions = {
  limit?: number;
  typeFilter?: DashboardRecentActivityFilter;
};

export async function fetchDashboardRecentActivity(
  companyId: string,
  opCompanyId: string,
  options: FetchDashboardRecentActivityOptions = {},
): Promise<DashboardRecentActivity[]> {
  const limit = options.limit ?? DASHBOARD_RECENT_ACTIVITY_LIMIT;
  const typeFilter = options.typeFilter ?? 'all';
  const companyIds = [...new Set([companyId, opCompanyId].filter(Boolean))];

  if (typeFilter === 'bascula') {
    return fetchScaleActivities(opCompanyId, limit);
  }

  if (typeFilter === 'nota_marketing') {
    return fetchMarketingNoteActivities(opCompanyId, limit);
  }

  if (typeFilter !== 'all') {
    const entityTable = TYPE_TO_AUDIT_TABLE[typeFilter];
    const auditEvents = await fetchAuditEvents(companyIds, [entityTable], limit);
    return mapAuditEvents(auditEvents);
  }

  const [auditEvents, scaleActivities, noteActivities] = await Promise.all([
    fetchAuditEvents(companyIds, [...AUDITED_ENTITY_TABLES], AUDIT_FETCH_LIMIT),
    fetchScaleActivities(opCompanyId, SUPPLEMENT_FETCH_LIMIT),
    fetchMarketingNoteActivities(opCompanyId, SUPPLEMENT_FETCH_LIMIT),
  ]);

  return [...mapAuditEvents(auditEvents), ...scaleActivities, ...noteActivities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
