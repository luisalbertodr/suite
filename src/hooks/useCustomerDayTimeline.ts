import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchAppointmentsForCustomer, CUSTOMER_APPOINTMENTS_TIMELINE_LIMIT, type CustomerAppointmentRow } from '@/lib/agendaCustomerAppointments';
import { parseDescriptionServiceLines, appointmentStatusLabel, normalizeHm } from '@/lib/agendaAppointmentDisplay';
import { buildAppointmentChargedTotals, parseAppointmentIdFromSaleNotes } from '@/lib/appointmentChargeTotals';

export type AppointmentAttachmentHints = {
  photos: boolean;
  signedConsents: boolean;
  documents: boolean;
};

export type AppointmentTimelineDetails = {
  appointmentId: string;
  date: string;
  timeRange: string;
  employeeName?: string;
  statusLabel: string;
  description?: string;
  services: string[];
  items: CustomerAppointmentRow['items'];
  chargedAmount?: number | null;
  attachments?: AppointmentAttachmentHints;
};

export type DayTimelineItem = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  timeLabel?: string;
  refTable?: string;
  refId?: string;
  imageUrls?: string[];
  amountLabel?: string;
  sortKey: number;
  /** Consentimiento firmado (solo kind consent) */
  signedConsent?: boolean;
  appointmentDetails?: AppointmentTimelineDetails;
};

export type DayAsset = {
  id: string;
  kind: string;
  title: string | null;
  storagePath: string | null;
  refTable?: string | null;
  refId?: string | null;
};

export type DayGroup = {
  date: string;
  daySummary?: string | null;
  hasDailyLog: boolean;
  items: DayTimelineItem[];
  assets: DayAsset[];
};

const toYmd = (d: string | null | undefined): string | null => {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
};

const timeFromFecha = (d: string | null | undefined): string | undefined => {
  if (!d) return undefined;
  if (d.includes('T') || d.length > 10) {
    const t = new Date(d);
    if (Number.isFinite(t.getTime())) {
      return t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
  }
  return undefined;
};

const refKey = (table?: string | null, id?: string | null): string | null => {
  if (table && id) return `${table}:${id}`;
  return null;
};

function isInvoicePaid(inv: { status?: string | null; paid_status?: boolean | null }): boolean {
  return inv.paid_status === true || inv.status === 'paid';
}

function shouldHideInvoiceRow(
  inv: { id: string; total_amount?: number | null; status?: string | null; paid_status?: boolean | null },
  day: DayGroup,
  invoiceIdsLinkedToAppointments: Set<string>,
): boolean {
  if (invoiceIdsLinkedToAppointments.has(String(inv.id))) return true;
  if (!isInvoicePaid(inv)) return false;
  const invTotal = Number(inv.total_amount ?? 0);
  if (invTotal <= 0) return false;
  return day.items.some(
    (it) =>
      it.kind === 'appointment' &&
      it.appointmentDetails != null &&
      Math.abs((it.appointmentDetails.chargedAmount ?? 0) - invTotal) < 0.02,
  );
}

function itemRelatesToAppointment(it: DayTimelineItem, appointmentId: string): boolean {
  if (it.kind === 'appointment' && it.id === `appt:${appointmentId}`) return false;
  if (it.refTable === 'agenda_appointments' && it.refId) {
    return it.refId === appointmentId;
  }
  return true;
}

function assetRelatesToAppointment(asset: DayAsset, appointmentId: string): boolean {
  if (asset.refTable === 'agenda_appointments' && asset.refId) {
    return asset.refId === appointmentId;
  }
  return true;
}

function computeAppointmentAttachments(day: DayGroup, appointmentId: string): AppointmentAttachmentHints {
  let photos = false;
  let signedConsents = false;
  let documents = false;

  for (const asset of day.assets) {
    if (!assetRelatesToAppointment(asset, appointmentId)) continue;
    if (asset.kind === 'photo_before' || asset.kind === 'photo_after') photos = true;
    if (asset.kind === 'consent') signedConsents = true;
    if (asset.kind === 'document' || asset.kind === 'other') documents = true;
  }

  for (const it of day.items) {
    if (!itemRelatesToAppointment(it, appointmentId)) continue;
    if (it.imageUrls?.length) photos = true;
    if (it.kind === 'consent' && it.signedConsent) signedConsents = true;
    if (it.kind === 'document' || it.kind === 'clinic_note') {
      if (it.kind === 'document') documents = true;
    }
    if (it.kind === 'sale' || it.kind === 'product' || it.kind === 'service') {
      /* cobertura ya en la cita */
    }
  }

  return { photos, signedConsents, documents };
}

function enrichDayAppointmentAttachments(day: DayGroup): void {
  for (const it of day.items) {
    if (it.kind !== 'appointment' || !it.appointmentDetails) continue;
    it.appointmentDetails.attachments = computeAppointmentAttachments(
      day,
      it.appointmentDetails.appointmentId,
    );
  }
}

type DailyRow = {
  id: string;
  log_date: string;
  day_summary: string | null;
  daily_customer_log_items?: Array<{
    id: string;
    item_kind: string;
    title: string | null;
    body: string | null;
    ref_table: string | null;
    ref_id: string | null;
    amount_cents: number | null;
    sort_order: number;
  } | null> | null;
  daily_customer_log_assets?: Array<{
    id: string;
    asset_kind: string;
    title: string | null;
    storage_path: string | null;
    ref_table: string | null;
    ref_id: string | null;
  } | null> | null;
};

function mergeByDay(
  customerId: string,
  dailyRows: DailyRow[],
  historial: any[],
  consent: any[],
  aesthetic: any[],
  bonos: any[],
  bonoUso: any[],
  bonoNameById: Map<string, string>,
  appointments: any[],
  invoices: any[],
  quotes: any[],
  chargedByAppointment: Map<string, number>,
  invoiceIdsLinkedToAppointments: Set<string>,
): DayGroup[] {
  const byDay = new Map<string, DayGroup>();

  const getDay = (ymd: string) => {
    let g = byDay.get(ymd);
    if (!g) {
      g = {
        date: ymd,
        hasDailyLog: false,
        daySummary: null,
        items: [],
        assets: [],
      };
      byDay.set(ymd, g);
    }
    return g;
  };

  for (const log of dailyRows) {
    const ymd = toYmd(log.log_date) || toYmd(String(log.log_date)) || '1970-01-01';
    const d = getDay(ymd);
    d.hasDailyLog = true;
    d.daySummary = log.day_summary;
    for (const it of log.daily_customer_log_items || []) {
      if (!it) continue;
      if (it.item_kind === 'sale' && it.ref_table === 'agenda_appointments' && it.ref_id) {
        continue;
      }
      d.items.push({
        id: `daily_item:${it.id}`,
        kind: it.item_kind,
        title: (it.title || it.item_kind).trim() || 'Evento',
        subtitle: it.body || undefined,
        timeLabel: timeFromFecha(ymd),
        refTable: it.ref_table || undefined,
        refId: it.ref_id || undefined,
        amountLabel:
          it.amount_cents != null && it.amount_cents !== 0
            ? (it.amount_cents / 100).toFixed(2) + ' €'
            : undefined,
        sortKey: (it.sort_order ?? 0) * 1_000_000,
      });
    }
    for (const a of log.daily_customer_log_assets || []) {
      if (!a) continue;
      d.assets.push({
        id: a.id,
        kind: a.asset_kind,
        title: a.title,
        storagePath: a.storage_path,
        refTable: a.ref_table,
        refId: a.ref_id,
      });
    }
  }

  const dailyRefKeys = new Set<string>();
  for (const log of dailyRows) {
    for (const it of log.daily_customer_log_items || []) {
      if (!it) continue;
      const k = refKey(it.ref_table, it.ref_id);
      if (k) dailyRefKeys.add(k);
    }
  }

  let sortN = 0;
  for (const h of historial) {
    const ymd = toYmd(h.fecha);
    if (!ymd) continue;
    const k = refKey('historial_clinico', h.id);
    if (k && dailyRefKeys.has(k)) continue;
    const d = getDay(ymd);
    const photos: string[] = [];
    if (Array.isArray(h.fotos_antes)) photos.push(...h.fotos_antes.filter(Boolean));
    if (Array.isArray(h.fotos_despues)) photos.push(...h.fotos_despues.filter(Boolean));
    d.items.push({
      id: `hc:${h.id}`,
      kind: 'clinic_note',
      title: h.titulo || 'Registro clínico',
      subtitle: [h.tipo, h.descripcion, h.observaciones, h.tratamiento].filter(Boolean).join(' · ') || undefined,
      timeLabel: timeFromFecha(h.fecha),
      refTable: 'historial_clinico',
      refId: h.id,
      imageUrls: photos.length ? photos : undefined,
      sortKey: 1_000_000 + sortN++,
    });
  }

  for (const c of consent) {
    const ymd = toYmd(c.fecha_firma) || toYmd(c.created_at);
    if (!ymd) continue;
    const k = refKey('consentimientos', c.id);
    if (k && dailyRefKeys.has(k)) continue;
    const d = getDay(ymd);
    d.items.push({
      id: `consent:${c.id}`,
      kind: 'consent',
      title: c.titulo || 'Consentimiento',
      subtitle: c.tipo,
      timeLabel: timeFromFecha(c.fecha_firma || c.created_at),
      refTable: 'consentimientos',
      refId: c.id,
      signedConsent: c.firmado === true || !!c.firma_url,
      sortKey: 2_000_000 + sortN++,
    });
  }

  for (const e of aesthetic) {
    if (String(e.event_type || '').toUpperCase() === 'CITA_HISTORICA') continue;
    const ymd = toYmd(e.event_date) || toYmd(e.created_at);
    if (!ymd) continue;
    const k = refKey('customer_aesthetic_history', e.id);
    if (k && dailyRefKeys.has(k)) continue;
    const d = getDay(ymd);
    const data = (e.data && typeof e.data === 'object' ? e.data : {}) as Record<string, unknown>;
    const treatment = (data.treatment as string) || (data.notes as string) || e.event_type;
    d.items.push({
      id: `aesthetic:${e.id}`,
      kind: e.event_type || 'aesthetic',
      title: (treatment as string) || 'Evento estético',
      subtitle: typeof data.notes === 'string' ? data.notes : undefined,
      timeLabel: timeFromFecha(e.event_date || e.created_at),
      refTable: 'customer_aesthetic_history',
      refId: e.id,
      sortKey: 3_000_000 + sortN++,
    });
  }

  for (const b of bonos) {
    const ymd = toYmd(b.fecha_compra);
    if (!ymd) continue;
    const k = refKey('bonos', b.id);
    if (k && dailyRefKeys.has(k)) continue;
    const d = getDay(ymd);
    d.items.push({
      id: `bono_purchase:${b.id}`,
      kind: 'bono_purchase',
      title: `Compra: ${b.nombre || 'Bono'}`,
      subtitle: b.legacy_codboncli ? `Ref. ${b.legacy_codboncli}` : b.descripcion || undefined,
      timeLabel: timeFromFecha(b.fecha_compra),
      refTable: 'bonos',
      refId: b.id,
      amountLabel:
        b.precio_total != null ? `${Number(b.precio_total).toFixed(2)} €` : undefined,
      sortKey: 4_000_000 + sortN++,
    });
  }

  for (const u of bonoUso) {
    const ymd = toYmd(u.fecha);
    if (!ymd) continue;
    const k = refKey('bono_uso', u.id);
    if (k && dailyRefKeys.has(k)) continue;
    const d = getDay(ymd);
    const name = bonoNameById.get(u.bono_id) || 'Bono';
    d.items.push({
      id: `bono_use:${u.id}`,
      kind: 'bono_use',
      title: `Uso bono: ${name}`,
      subtitle: u.notas || undefined,
      timeLabel: timeFromFecha(u.fecha),
      refTable: 'bono_uso',
      refId: u.id,
      sortKey: 4_100_000 + sortN++,
    });
  }

  for (const a of appointments) {
    const ymd = a.ymd || toYmd(a.start_time);
    if (!ymd) continue;
    const k = refKey('agenda_appointments', a.id);
    if (k && dailyRefKeys.has(k)) continue;
    const d = getDay(ymd);
    const services =
      a.service_lines.length > 0
        ? a.service_lines
        : parseDescriptionServiceLines(a.description);
    const subtitleParts = [
      a.time_range,
      a.employee_name,
      services[0],
    ].filter(Boolean);
    const hm = normalizeHm(a.start_time);
    const timeSort = hm ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)) : sortN++;
    const chargedAmount = chargedByAppointment.get(String(a.id)) ?? null;
    d.items.push({
      id: `appt:${a.id}`,
      kind: 'appointment',
      title: a.title || 'Cita',
      subtitle: subtitleParts.join(' · ') || undefined,
      timeLabel: a.time_range || undefined,
      refTable: 'agenda_appointments',
      refId: a.id,
      amountLabel:
        chargedAmount != null && chargedAmount > 0
          ? `${chargedAmount.toFixed(2)} €`
          : undefined,
      sortKey: 5_000_000 + timeSort,
      appointmentDetails: {
        appointmentId: a.id,
        date: ymd,
        timeRange: a.time_range,
        employeeName: a.employee_name ?? undefined,
        statusLabel: appointmentStatusLabel(a.status),
        description: a.description ?? undefined,
        services,
        items: a.items,
        chargedAmount,
      },
    });
  }

  for (const inv of invoices) {
    const ymd = toYmd(inv.issue_date) || toYmd(inv.created_at);
    if (!ymd) continue;
    const k = refKey('invoices', inv.id);
    if (k && dailyRefKeys.has(k)) continue;
    const d = getDay(ymd);
    if (shouldHideInvoiceRow(inv, d, invoiceIdsLinkedToAppointments)) continue;
    const status =
      isInvoicePaid(inv) ? 'Pagada' : inv.status === 'pending' ? 'Pendiente' : String(inv.status || '');
    d.items.push({
      id: `invoice:${inv.id}`,
      kind: 'invoice',
      title: `Factura ${inv.number || ''}`.trim(),
      subtitle: status || undefined,
      timeLabel: timeFromFecha(inv.issue_date || inv.created_at),
      refTable: 'invoices',
      refId: inv.id,
      amountLabel:
        inv.total_amount != null ? `${Number(inv.total_amount).toFixed(2)} €` : undefined,
      sortKey: 6_000_000 + sortN++,
    });
  }

  for (const q of quotes) {
    const ymd = toYmd(q.issue_date) || toYmd(q.created_at);
    if (!ymd) continue;
    const k = refKey('quotes', q.id);
    if (k && dailyRefKeys.has(k)) continue;
    const d = getDay(ymd);
    d.items.push({
      id: `quote:${q.id}`,
      kind: 'quote',
      title: `Presupuesto ${q.number || ''}`.trim(),
      subtitle: q.status ? String(q.status) : undefined,
      timeLabel: timeFromFecha(q.issue_date || q.created_at),
      refTable: 'quotes',
      refId: q.id,
      amountLabel:
        q.total_amount != null ? `${Number(q.total_amount).toFixed(2)} €` : undefined,
      sortKey: 6_100_000 + sortN++,
    });
  }

  for (const g of byDay.values()) {
    g.items.sort((a, b) => a.sortKey - b.sortKey);
    enrichDayAppointmentAttachments(g);
  }

  return Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export type CustomerDayTimelineResult = {
  days: DayGroup[];
  hasMoreAppointments: boolean;
};

export const useCustomerDayTimeline = (
  customerId: string | undefined,
  options?: { appointmentLimit?: number },
) => {
  const appointmentLimit = options?.appointmentLimit ?? CUSTOMER_APPOINTMENTS_TIMELINE_LIMIT;

  return useQuery({
    queryKey: ['customer_day_timeline', customerId, appointmentLimit],
    queryFn: async (): Promise<CustomerDayTimelineResult> => {
      if (!customerId) return { days: [], hasMoreAppointments: false };

      const [
        dailyRes,
        historialRes,
        consentRes,
        aestheticRes,
        bonosRes,
        appointmentsPage,
        invoicesRes,
        quotesRes,
        customerRes,
      ] = await Promise.all([
        supabase
          .from('daily_customer_log')
          .select(
            `id, log_date, day_summary, daily_customer_log_items (*), daily_customer_log_assets (*)`,
          )
          .eq('customer_id', customerId)
          .order('log_date', { ascending: false }),
        supabase
          .from('historial_clinico')
          .select('*')
          .eq('customer_id', customerId)
          .order('fecha', { ascending: false }),
        supabase
          .from('consentimientos')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false }),
        supabase
          .from('customer_aesthetic_history')
          .select('*')
          .eq('customer_id', customerId)
          .order('event_date', { ascending: false }),
        supabase
          .from('bonos')
          .select(
            'id, customer_id, nombre, descripcion, fecha_compra, precio_total, legacy_codboncli',
          )
          .eq('customer_id', customerId)
          .order('fecha_compra', { ascending: false }),
        fetchAppointmentsForCustomer(customerId, {
          limit: appointmentLimit,
          includeItems: false,
        }),
        supabase
          .from('invoices')
          .select('id, number, issue_date, created_at, total_amount, status, paid_status')
          .eq('customer_id', customerId)
          .order('issue_date', { ascending: false }),
        supabase
          .from('quotes')
          .select('id, number, issue_date, created_at, total_amount, status')
          .eq('customer_id', customerId)
          .order('issue_date', { ascending: false }),
        supabase.from('customers').select('company_id').eq('id', customerId).maybeSingle(),
      ]);

      if (historialRes.error) throw historialRes.error;
      if (consentRes.error) throw consentRes.error;
      if (aestheticRes.error) throw aestheticRes.error;
      if (bonosRes.error) throw bonosRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (quotesRes.error) throw quotesRes.error;
      if (dailyRes.error) {
        console.warn('daily_customer_log:', dailyRes.error.message);
      }

      const bonoList = (bonosRes.data || []) as any[];
      const bonoNameById = new Map(
        bonoList.map((b) => [b.id, String(b.nombre || 'Bono')]) as [string, string][],
      );
      const bonoIds = bonoList.map((b) => b.id);
      let bonoUsoFiltered: any[] = [];
      if (bonoIds.length) {
        const bonoUsoRes = await supabase
          .from('bono_uso')
          .select('id, bono_id, fecha, notas, article_id, quantity, source_table, source_legacy_key')
          .in('bono_id', bonoIds)
          .order('fecha', { ascending: false });
        if (bonoUsoRes.error) throw bonoUsoRes.error;
        bonoUsoFiltered = bonoUsoRes.data || [];
      }

      const appointmentIds = appointmentsPage.rows.map((a) => String(a.id));
      const companyId = (customerRes.data as { company_id?: string } | null)?.company_id ?? null;
      let chargedByAppointment = new Map<string, number>();
      try {
        chargedByAppointment = await buildAppointmentChargedTotals(appointmentIds, {
          companyId,
          customerId,
          salesOnly: true,
        });
      } catch (err) {
        console.warn('buildAppointmentChargedTotals:', err);
      }

      const invoiceIdsLinkedToAppointments = new Set<string>();
      try {
        let salesRes = await supabase
          .from('sales')
          .select('appointment_id, invoice_id, notes')
          .eq('customer_id', customerId)
          .not('invoice_id', 'is', null);
        if (salesRes.error) {
          salesRes = await supabase
            .from('sales')
            .select('appointment_id, invoice_id, notes')
            .not('invoice_id', 'is', null)
            .limit(5000);
        }
        if (!salesRes.error) {
          for (const sale of salesRes.data || []) {
            const invId = (sale as { invoice_id?: string | null }).invoice_id;
            const aptId =
              (sale as { appointment_id?: string | null }).appointment_id ??
              parseAppointmentIdFromSaleNotes((sale as { notes?: string | null }).notes ?? null);
            if (invId && aptId) invoiceIdsLinkedToAppointments.add(String(invId));
          }
        }
      } catch (err) {
        console.warn('sales invoice linkage:', err);
      }

      return {
        days: mergeByDay(
          customerId,
          (dailyRes.data as DailyRow[]) || [],
          historialRes.data || [],
          consentRes.data || [],
          aestheticRes.data || [],
          bonoList,
          bonoUsoFiltered,
          bonoNameById,
          appointmentsPage.rows,
          invoicesRes.data || [],
          quotesRes.data || [],
          chargedByAppointment,
          invoiceIdsLinkedToAppointments,
        ),
        hasMoreAppointments: appointmentsPage.hasMore,
      };
    },
    enabled: !!customerId,
  });
};
