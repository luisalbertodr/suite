import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AgendaGrid } from './AgendaGrid';
import { AppointmentForm, type AppointmentFormInitialPrefill } from './AppointmentForm';
import { EditAppointmentForm } from './EditAppointmentForm';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { useAgendaAppointments } from '@/hooks/useAgendaAppointments';
import { useCabinas, useRecursos } from '@/hooks/useRecursosCabinas';
import { format, addDays, subDays, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgendaPreferences } from '@/hooks/useAgendaPreferences';
import { appointmentItemsQueryKey, fetchAppointmentItems, syncAppointmentItems } from '@/hooks/useAppointmentItems';
import { applyBonoSessionDelta } from '@/lib/consumeBonoSessions';
import type { AppointmentItemDraft, Appointment } from '@/types/agenda';
import { buildAppointmentTimeSegments, occupiedEndTimeFromItems } from '@/lib/agendaAppointmentItems';
import { toRecursoCatalogEntries, type ArticleResourceHint } from '@/lib/agendaRecursoMatch';
import { checkAppointmentItemsResourceConflict } from '@/lib/agendaResourceConflicts';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { CustomerSearchRow } from '@/lib/customerSearch';
import { fetchCatalogCustomers } from '@/lib/customerSearch';
import {
  loadAgendaViewPersisted,
  loadInitialAgendaDateYmd,
  mergePersistedLastDate,
  saveAgendaViewPersisted,
} from '@/lib/agendaViewPersistence';
import {
  parseAgendaDayHoursMap,
  parseUnavailability,
  type AgendaDayHoursMap,
  type AgendaUnavailabilityEntry,
} from '@/lib/agendaHours';
import { appointmentItemLineTotal } from '@/lib/agendaAppointmentPricing';
import { canChargeAppointment, appointmentChargeableTotal, fetchAppointmentSalesMap, summarizeAppointmentChargeState } from '@/lib/appointmentSales';
import { buildAgendaPrefillFromLead } from '@/lib/marketingLeadAgendaPrefill';
import { buildCustomerHistoryUrl } from '@/lib/agendaCustomerNavigation';
import { BillingEntityToggle } from '@/components/BillingEntityToggle';
import {
  filterEmployeesForAgendaView,
  loadAgendaBillingView,
  saveAgendaBillingView,
  type AgendaBillingView,
} from '@/lib/agendaBillingView';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useFamilies } from '@/hooks/useFamilies';
import {
  buildFamilyBillingMap,
  resolveBillingCompanyId,
} from '@/lib/billingCompany';
import {
  appointmentVisibleInBillingView,
  resolveAppointmentBillingIds,
} from '@/lib/workCenterAudit';

interface Employee {
  id: string;
  name: string;
  color: string;
}

type CreateAppointmentData = {
  employeeId: string;
  clientName: string;
  customerId?: string | null;
  description: string;
  startTime: string;
  endTime: string;
  date: string;
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  items?: AppointmentItemDraft[];
};

// Generate a Tailwind bg class from a hex color
const hexToTailwindBg = (hex: string, index: number): string => {
  const fallbacks = [
    'bg-sky-100 dark:bg-sky-950/50 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-100',
    'bg-violet-100 dark:bg-violet-950/50 border-violet-300 dark:border-violet-700 text-violet-900 dark:text-violet-100',
    'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100',
    'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100',
    'bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100',
    'bg-indigo-100 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100',
    'bg-teal-100 dark:bg-teal-950/50 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-100',
    'bg-orange-100 dark:bg-orange-950/50 border-orange-300 dark:border-orange-700 text-orange-900 dark:text-orange-100',
  ];
  return fallbacks[index % fallbacks.length];
};

export const Agenda: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { isMultiEntity, operationalCompanyId } = useWorkCenter();
  const opCompanyId = operationalCompanyId ?? companyId;
  const { families: familyRecords } = useFamilies({ scope: 'all' });
  const familyBillingMap = useMemo(
    () => buildFamilyBillingMap(familyRecords.map((f) => ({ name: f.name, billing_company_id: f.billing_company_id }))),
    [familyRecords],
  );
  const skipPersistDateOnceRef = useRef(false);
  const [agendaBillingView, setAgendaBillingView] = useState<AgendaBillingView>('all');

  const [selectedDate, setSelectedDate] = useState(() => {
    const ymd = loadInitialAgendaDateYmd(null);
    if (ymd) {
      const d = parse(ymd, 'yyyy-MM-dd', new Date());
      if (isValid(d)) return d;
    }
    return new Date();
  });
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ employeeId: string; time: string } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [goToTodayRequestId, setGoToTodayRequestId] = useState(0);
  const [scrollToTimeRequest, setScrollToTimeRequest] = useState<{ requestId: number; time: string } | null>(null);
  const [appointmentPrefill, setAppointmentPrefill] = useState<AppointmentFormInitialPrefill | null>(null);
  const [appointmentPrefillLeadId, setAppointmentPrefillLeadId] = useState<string | null>(null);
  const processedMarketingLeadPrefillRef = useRef<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectedDateYmd = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  const selectedDateYmdRef = useRef(selectedDateYmd);
  selectedDateYmdRef.current = selectedDateYmd;
  const pendingOpenAppointmentIdRef = useRef<string | null>(null);

  const selectAgendaDate = useCallback(
    (d: Date, opts?: { syncUrl?: boolean }) => {
      setSelectedDate(d);
      if (opts?.syncUrl === false) return;
      const params = new URLSearchParams(location.search);
      if (!params.has('date') && !params.has('appointment')) return;
      params.set('date', format(d, 'yyyy-MM-dd'));
      params.delete('appointment');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true },
      );
    },
    [location.pathname, location.search, navigate],
  );

  useLayoutEffect(() => {
    if (!user?.id) return;
    const p = loadAgendaViewPersisted(user.id);
    if (!p?.lastDateYmd) return;
    const d = parse(p.lastDateYmd, 'yyyy-MM-dd', new Date());
    if (!isValid(d)) return;
    setSelectedDate((prev) => {
      const prevYmd = format(prev, 'yyyy-MM-dd');
      return prevYmd === p.lastDateYmd ? prev : d;
    });
    skipPersistDateOnceRef.current = true;
  }, [user?.id]);

  useLayoutEffect(() => {
    if (!user?.id) return;
    setAgendaBillingView(loadAgendaBillingView(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    saveAgendaBillingView(user.id, agendaBillingView);
  }, [user?.id, agendaBillingView]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date');
    const appointmentParam = params.get('appointment');

    if (appointmentParam) {
      pendingOpenAppointmentIdRef.current = appointmentParam;
    }

    if (!dateParam) return;
    const parsedDate = parse(dateParam, 'yyyy-MM-dd', new Date());
    if (!isValid(parsedDate)) return;
    setSelectedDate((prev) => {
      const prevYmd = format(prev, 'yyyy-MM-dd');
      const nextYmd = format(parsedDate, 'yyyy-MM-dd');
      return prevYmd === nextYmd ? prev : parsedDate;
    });
  }, [location.search]);

  const returnCustomerId = useMemo(() => {
    const id = new URLSearchParams(location.search).get('returnCustomer');
    return id?.trim() || null;
  }, [location.search]);

  const clearReturnCustomerParam = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('returnCustomer')) return;
    params.delete('returnCustomer');
    navigate(
      { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const handleReturnToCustomerHistory = useCallback(() => {
    if (!returnCustomerId) return;
    setShowEditForm(false);
    setSelectedAppointment(null);
    clearReturnCustomerParam();
    navigate(buildCustomerHistoryUrl(returnCustomerId));
  }, [returnCustomerId, clearReturnCustomerParam, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    if (skipPersistDateOnceRef.current) {
      skipPersistDateOnceRef.current = false;
      return;
    }
    const prev = loadAgendaViewPersisted(user.id);
    saveAgendaViewPersisted(user.id, mergePersistedLastDate(prev, selectedDateYmd));
  }, [user?.id, selectedDateYmd]);

  useEffect(() => {
    if (!user?.id) return;
    return () => {
      const prev = loadAgendaViewPersisted(user.id);
      saveAgendaViewPersisted(user.id, mergePersistedLastDate(prev, selectedDateYmdRef.current));
    };
  }, [user?.id]);

  const { data: companyAgendaRow } = useQuery({
    queryKey: ['company-agenda-center-hours', opCompanyId],
    queryFn: async () => {
      if (!opCompanyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('agenda_center_hours')
        .eq('id', opCompanyId)
        .single();
      if (error) throw error;
      return data as { agenda_center_hours: unknown };
    },
    enabled: !!opCompanyId && !companyLoading,
  });

  const centerHours: AgendaDayHoursMap = useMemo(
    () => parseAgendaDayHoursMap(companyAgendaRow?.agenda_center_hours),
    [companyAgendaRow?.agenda_center_hours],
  );

  const { data: agendaCustomers = [] } = useQuery({
    queryKey: ['customers', opCompanyId, 'agenda-picker'],
    queryFn: async () => {
      if (!opCompanyId) return [];
      return fetchCatalogCustomers(supabase, opCompanyId);
    },
    enabled: !!opCompanyId && !companyLoading,
  });

  const fromLeadIdParam = useMemo(
    () => new URLSearchParams(location.search).get('fromLead'),
    [location.search],
  );

  const { data: fromLeadMarketingRow } = useQuery({
    queryKey: ['agenda-marketing-lead-prefill', companyId, fromLeadIdParam],
    enabled: !!companyId && !!fromLeadIdParam,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_leads')
        .select(
          'id,first_name,last_name,phone,email,customer_id,form_name,campaign,notes,field_data,appointment_at,appointment_label',
        )
        .eq('company_id', companyId!)
        .eq('id', fromLeadIdParam!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: notifyRecipients = [] } = useQuery({
    queryKey: ['notify-recipients', opCompanyId, user?.id],
    queryFn: async () => {
      if (!opCompanyId || !user?.id) return [];
      const employeesBaseQuery = () =>
        supabase
          .from('agenda_employees')
          .select('id, name')
          .eq('company_id', opCompanyId);

      let employeesResult = await employeesBaseQuery().eq('is_active', true);
      if (employeesResult.error?.code === '42703') {
        employeesResult = await employeesBaseQuery().eq('active', true);
      }
      if (employeesResult.error) throw employeesResult.error;

      const activeEmployees = (employeesResult.data || []) as Array<{ id: string; name: string | null }>;
      const activeEmployeeIds = activeEmployees.map((e) => e.id).filter(Boolean);
      if (!activeEmployeeIds.length) return [];

      const { data: usersData, error: usersError } = await supabase.functions.invoke('main', {
        body: { action: 'listUsers', isSuperuser: false },
      });
      if (usersError) throw usersError;

      const nameByEmployeeId = new Map(activeEmployees.map((e) => [e.id, e.name || 'Empleado']));
      const recipients = ((usersData?.users || []) as any[])
        .filter((u: any) => u.id && u.id !== user.id)
        .map((u: any) => {
          const employeeId = u?.profiles?.employee_id ? String(u.profiles.employee_id) : null;
          if (!employeeId || !activeEmployeeIds.includes(employeeId)) return null;
          const employeeName = nameByEmployeeId.get(employeeId) || 'Empleado';
          return { userId: String(u.id), label: employeeName };
        })
        .filter(Boolean) as Array<{ userId: string; label: string }>;

      // Evita duplicados por userId.
      const uniqueByUserId = new Map<string, { userId: string; label: string }>();
      for (const item of recipients) uniqueByUserId.set(item.userId, item);
      return Array.from(uniqueByUserId.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
    },
    enabled: !!opCompanyId && !!user?.id,
  });

  const { employees: dbEmployeesRaw, isLoading: employeesLoading } = useAgendaEmployees({ agendaOnly: true });

  const dbEmployees = useMemo(() => {
    return [...dbEmployeesRaw].sort((a, b) => {
      const ao = a.agenda_sort_order ?? 0;
      const bo = b.agenda_sort_order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name, 'es');
    });
  }, [dbEmployeesRaw]);

  const employeeAgendaById = useMemo(() => {
    const m: Record<string, { weekly: AgendaDayHoursMap | null; blocks: AgendaUnavailabilityEntry[] }> = {};
    for (const e of dbEmployees) {
      m[e.id] = {
        weekly: e.weekly_hours == null ? null : parseAgendaDayHoursMap(e.weekly_hours),
        blocks: parseUnavailability(e.unavailability),
      };
    }
    return m;
  }, [dbEmployees]);

  const {
    appointments: dbAppointments,
    isLoading: appointmentsLoading,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  } = useAgendaAppointments(selectedDateYmd);

  const { cabinas } = useCabinas();
  const { recursos } = useRecursos();
  const { preferences, isLoading: prefsLoading } = useAgendaPreferences();

  const recursoCatalog = useMemo(
    () => toRecursoCatalogEntries(recursos.data || []),
    [recursos.data]
  );

  const cabinaCatalog = useMemo(
    () => (cabinas.data || []).map((c: { id: string; nombre: string }) => ({ id: c.id, nombre: c.nombre })),
    [cabinas.data]
  );

  const registerAppointmentHistory = async (
    customerId: string | null | undefined,
    dateYmd: string,
    items: AppointmentItemDraft[],
    appointmentId: string
  ) => {
    if (!opCompanyId || !customerId) return;
    const safeDateYmd = /^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd || ''))
      ? String(dateYmd)
      : format(new Date(), 'yyyy-MM-dd');
    const summaryItems = items.map((it) => ({
      label: it.label || 'Ítem',
      kind: it.kind,
      quantity: Number(it.quantity ?? 1),
      unit_price: Number(it.unit_price ?? 0),
      total: Number(appointmentItemLineTotal(it)),
      article_id: it.article_id ?? null,
      customer_voucher_id: it.customer_voucher_id ?? null,
    }));
    const payload = {
      company_id: opCompanyId,
      customer_id: customerId,
      event_type: 'appointment',
      event_date: `${safeDateYmd}T00:00:00`,
      data: {
        appointment_id: appointmentId,
        source: 'agenda',
        items: summaryItems,
        total_amount: Number(summaryItems.reduce((s, it) => s + Number(it.total || 0), 0)),
      },
    };

    // Upsert lógico por appointment_id (en JSON data) para evitar duplicados al editar.
    const { data: existing, error: existingError } = await supabase
      .from('customer_aesthetic_history')
      .select('id,data')
      .eq('company_id', opCompanyId)
      .eq('customer_id', customerId)
      .eq('event_type', 'appointment');
    if (existingError) throw existingError;

    const existingRow = (existing || []).find(
      (row: any) => String(row?.data?.appointment_id || '') === String(appointmentId)
    );

    if (existingRow?.id) {
      const { error } = await supabase
        .from('customer_aesthetic_history')
        .update(payload)
        .eq('id', existingRow.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('customer_aesthetic_history').insert(payload);
    if (error) throw error;
  };
  const appointmentIds = useMemo(() => dbAppointments.map((a) => a.id), [dbAppointments]);
  const { data: appointmentTotals = {} } = useQuery({
    queryKey: ['appointment-item-totals', companyId, appointmentIds.join('|')],
    enabled: !!companyId && appointmentIds.length > 0,
    queryFn: async () => {
      const parsePricingFromNotes = (notes: string | null) => {
        if (!notes || !notes.startsWith('__pricing__')) return { quantity: 1, unit_price: 0, bonus_payment_mode: 'none' as const };
        try {
          const parsed = JSON.parse(notes.slice('__pricing__'.length)) as {
            quantity?: number;
            unit_price?: number;
            bonus_payment_mode?: 'none' | 'full' | '60' | '40';
          };
          return {
            quantity: Number(parsed.quantity ?? 1),
            unit_price: Number(parsed.unit_price ?? 0),
            bonus_payment_mode: parsed.bonus_payment_mode ?? 'none',
          };
        } catch {
          return { quantity: 1, unit_price: 0, bonus_payment_mode: 'none' as const };
        }
      };

      let data: any[] | null = null;
      let error: any = null;

      ({ data, error } = await supabase
        .from('appointment_items')
        .select('appointment_id,kind,label,notes,article_id,articles(precio)')
        .in('appointment_id', appointmentIds));

      if (
        error &&
        error.code !== '42P01' &&
        error.code !== 'PGRST205'
      ) {
        throw error;
      }
      if (!data || error) return {};

      const normalizeText = (value: string | null | undefined) =>
        String(value || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const inferItemPriceFromLabel = (
        label: string | null | undefined,
        byCode: Map<string, number>,
        byDescription: Map<string, number>
      ) => {
        const raw = String(label || '').trim();
        if (!raw) return 0;
        const codeMatch = raw.match(/^([A-Za-z0-9._-]+)\s*[-:]/);
        if (codeMatch?.[1]) {
          const p = byCode.get(codeMatch[1].toLowerCase());
          if (typeof p === 'number' && p > 0) return p;
        }
        const normalized = normalizeText(raw.replace(/^([A-Za-z0-9._-]+)\s*[-:]\s*/, ''));
        return Math.max(0, Number(byDescription.get(normalized) || 0));
      };

      const byCode = new Map<string, number>();
      const byDescription = new Map<string, number>();
      const { data: articleRows } = await supabase
        .from('articles')
        .select('codigo,descripcion,precio')
        .eq('company_id', opCompanyId);
      for (const a of articleRows || []) {
        const price = Math.max(0, Number(a.precio || 0));
        if (price <= 0) continue;
        if (a.codigo) byCode.set(String(a.codigo).toLowerCase(), price);
        if (a.descripcion) byDescription.set(normalizeText(a.descripcion), price);
      }

      const totals: Record<string, number> = {};
      for (const row of data) {
        const fallback = parsePricingFromNotes(row.notes ?? null);
        const qty = Math.max(0, Number(fallback.quantity ?? 1));
        const baseUnit = Math.max(0, Number(fallback.unit_price ?? 0));
        const articlePrice = Math.max(0, Number(row.articles?.precio ?? 0));
        const inferredLabelPrice =
          !row.article_id && baseUnit <= 0
            ? inferItemPriceFromLabel(row.label, byCode, byDescription)
            : 0;
        const unit = baseUnit > 0 ? baseUnit : (row.article_id ? articlePrice : inferredLabelPrice);
        const mode = String(fallback.bonus_payment_mode ?? 'none');
        let line = qty * unit;
        if (row.kind === 'bonus') {
          if (mode === '60') line = unit * 0.6;
          else if (mode === '40') line = unit * 0.4;
          else if (mode === 'full') line = unit;
          else line = 0;
        }
        totals[row.appointment_id] = (totals[row.appointment_id] || 0) + line;
      }
      return totals;
    },
  });

  const { data: appointmentSalesMap = new Map() } = useQuery({
    queryKey: ['appointment-sales-map', companyId, appointmentIds.join('|')],
    enabled: !!companyId && appointmentIds.length > 0,
    queryFn: () => fetchAppointmentSalesMap(appointmentIds),
    staleTime: 30_000,
  });

  const { data: appointmentItemsPayload = { grouped: {}, articleHints: new Map<string, ArticleResourceHint>(), billingIdsByAppt: {} as Record<string, string[]> } } = useQuery({
    queryKey: ['appointment-time-segments', companyId, appointmentIds.join('|'), familyRecords.length],
    enabled: !!companyId && appointmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_items')
        .select('id,appointment_id,kind,label,duration_minutes,occupies_time,sort_order,cabina_id,recurso_id,article_id,articles(familia,billing_company_id,company_id,recurso_id)')
        .in('appointment_id', appointmentIds)
        .order('sort_order', { ascending: true });
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          return { grouped: {}, articleHints: new Map<string, ArticleResourceHint>(), billingIdsByAppt: {} };
        }
        throw error;
      }
      const grouped: Record<string, AppointmentItemDraft[]> = {};
      const articleHints = new Map<string, ArticleResourceHint>();
      const articlesBillingMap = new Map<
        string,
        { familia: string; billing_company_id?: string | null; company_id?: string | null }
      >();
      const billingIdsByAppt: Record<string, string[]> = {};
      const familyMap = familyBillingMap;

      for (const row of data || []) {
        const apptId = String(row.appointment_id);
        if (!grouped[apptId]) grouped[apptId] = [];
        grouped[apptId].push({
          clientKey: String(row.id),
          kind: row.kind as AppointmentItemDraft['kind'],
          label: String(row.label || ''),
          duration_minutes: Number(row.duration_minutes ?? 0),
          occupies_time: row.occupies_time !== false,
          cabina_id: row.cabina_id ?? null,
          recurso_id: row.recurso_id ?? null,
          article_id: row.article_id ?? null,
        });
        const art = row.articles as {
          familia?: string | null;
          billing_company_id?: string | null;
          company_id?: string | null;
          recurso_id?: string | null;
        } | null;
        if (row.article_id && art) {
          articleHints.set(String(row.article_id), {
            familia: art.familia ?? null,
            recurso_id: art.recurso_id ?? null,
          });
          articlesBillingMap.set(String(row.article_id), {
            familia: art.familia ?? 'Varios',
            billing_company_id: art.billing_company_id ?? null,
            company_id: art.company_id ?? null,
          });
        }
      }

      if (companyId) {
        for (const [apptId, drafts] of Object.entries(grouped)) {
          billingIdsByAppt[apptId] = resolveAppointmentBillingIds(
            drafts,
            articlesBillingMap,
            familyMap,
            companyId,
          );
        }
      }

      return { grouped, articleHints, billingIdsByAppt };
    },
  });

  const appointmentItemsByAppt = appointmentItemsPayload.grouped;
  const agendaArticleHints = appointmentItemsPayload.articleHints;
  const billingIdsByAppt = appointmentItemsPayload.billingIdsByAppt;

  // Map DB employees to grid employees with proper colors
  const allEmployees: Employee[] = dbEmployees.map((emp, idx) => ({
    id: emp.id,
    name: emp.name,
    color: hexToTailwindBg(emp.color || '#3B82F6', idx),
    billing_company_id: emp.billing_company_id ?? null,
  }));

  const employees = useMemo(
    () =>
      isMultiEntity && agendaBillingView !== 'all'
        ? filterEmployeesForAgendaView(allEmployees, agendaBillingView)
        : allEmployees,
    [allEmployees, agendaBillingView, isMultiEntity],
  );

  const parseServiceFromDescription = (
    description: string
  ): { code: string; service: string; hourInText: string } => {
    // Legacy sample: "[16:00] 214 - ZONA L..."
    const match = description.match(/\[(\d{1,2}:\d{2})\]\s*([^\s-]+)\s*-\s*(.+)$/);
    if (!match) return { code: '', service: '', hourInText: '' };
    return {
      hourInText: match[1]?.trim() || '',
      code: match[2]?.trim() || '',
      service: match[3]?.trim() || '',
    };
  };

  const normalizeTime = (value?: string | null): string => {
    if (!value) return '';
    const str = String(value);
    if (str.includes('T')) {
      const part = str.split('T')[1] || '';
      const hh = part.substring(0, 2);
      const mm = part.substring(3, 5);
      if (/^\d{2}$/.test(hh) && /^\d{2}$/.test(mm)) return `${hh}:${mm}`;
    }
    const m = str.match(/^(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    return str.substring(0, 5);
  };

  const normalizeDate = (start?: string | null, legacyDate?: string | null): string => {
    if (start && String(start).includes('T')) return String(start).split('T')[0];
    return legacyDate ? String(legacyDate) : format(selectedDate, 'yyyy-MM-dd');
  };

  // Map appointments (schema moderno + legado)
  const appointments: Appointment[] = dbAppointments.map((apt) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = apt;
    const description = row.description || '';
    const parsedService = parseServiceFromDescription(description);
    const clientName = row.client_name || row.title || '';
    const startTime = normalizeTime(row.start_time);
    const endTime = normalizeTime(row.end_time);
    const itemDrafts = appointmentItemsByAppt[row.id] || [];
    const timeSegments = buildAppointmentTimeSegments(startTime, itemDrafts, recursoCatalog, {
      recursos: recursoCatalog,
      cabinas: cabinaCatalog,
      articleHints: agendaArticleHints,
    });
    const occupiedEndTime = occupiedEndTimeFromItems(startTime, itemDrafts);
    const paymentOnlyLabels = itemDrafts
      .filter((it) => !it.occupies_time || Number(it.duration_minutes || 0) <= 0)
      .map((it) => (it.label || '').trim())
      .filter(Boolean);
    const chargeTotal = Object.prototype.hasOwnProperty.call(appointmentTotals, row.id)
      ? Number(appointmentTotals[row.id] || 0)
      : 0;
    const sales = appointmentSalesMap.get(row.id) ?? [];
    const chargeState = summarizeAppointmentChargeState(sales, chargeTotal);
    const aptStatus = (['confirmed', 'pending', 'cancelled'].includes(row.status) ? row.status : 'pending') as Appointment['status'];
    let paymentStatus: Appointment['paymentStatus'] = 'none';
    if (aptStatus !== 'cancelled') {
      if (chargeState.allCompleted) {
        paymentStatus = chargeState.allInvoiced ? 'invoiced' : 'paid';
      } else if (chargeState.completedTotal > 0) {
        paymentStatus = 'pending_charge';
      } else if (chargeTotal > 0) {
        paymentStatus = 'pending_charge';
      }
    }
    return {
      id: row.id,
      employeeId: row.employee_id || '',
      clientName,
      customerId: row.customer_id ?? null,
      description,
      serviceCode: parsedService.code,
      serviceName: parsedService.service,
      legacyEmployeeCode: row.legacy_codemp || undefined,
      legacyClientCode: row.legacy_codcli || undefined,
      legacyPlanincId: row.legacy_planinc_id ?? null,
      legacyHourInText: parsedService.hourInText || undefined,
      startTime,
      endTime,
      timeSegments,
      occupiedEndTime,
      paymentOnlyLabels,
      date: normalizeDate(row.start_time, row.appointment_date),
      color: row.color || '#3B82F6',
      totalAmount: Object.prototype.hasOwnProperty.call(appointmentTotals, row.id)
        ? chargeTotal
        : undefined,
      paymentStatus,
      status: aptStatus,
    };
  });

  const openAppointmentById = useCallback(
    (appointmentId: string, dateYmd: string) => {
      pendingOpenAppointmentIdRef.current = appointmentId;
      const parsed = parse(dateYmd, 'yyyy-MM-dd', new Date());
      const targetYmd = isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : selectedDateYmd;
      if (isValid(parsed) && targetYmd !== selectedDateYmd) {
        selectAgendaDate(parsed, { syncUrl: false });
        setShowEditForm(false);
        setSelectedAppointment(null);
        return;
      }
      const found = appointments.find((a) => a.id === appointmentId);
      if (found) {
        pendingOpenAppointmentIdRef.current = null;
        setSelectedAppointment(found);
        setShowEditForm(true);
        setScrollToTimeRequest({ requestId: Date.now(), time: found.startTime });
        return;
      }
      setShowEditForm(false);
      setSelectedAppointment(null);
    },
    [appointments, selectedDateYmd, selectAgendaDate],
  );

  useEffect(() => {
    const targetId = pendingOpenAppointmentIdRef.current;
    if (!targetId) return;
    const found = appointments.find((a) => a.id === targetId);
    if (!found) return;
    setSelectedAppointment(found);
    setShowEditForm(true);
    setScrollToTimeRequest({
      requestId: Date.now(),
      time: found.startTime,
    });
    pendingOpenAppointmentIdRef.current = null;

    const params = new URLSearchParams(location.search);
    params.delete('appointment');
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    );
  }, [appointments, location.pathname, location.search, navigate]);

  const effectiveSelectedIds = preferences.visibleEmployeeIds.length
    ? preferences.visibleEmployeeIds
    : employees.map((e) => e.id);
  const filteredEmployees = employees.filter((e) => effectiveSelectedIds.includes(e.id));
  const filteredAppointments = appointments.filter((apt) => {
    if (!effectiveSelectedIds.includes(apt.employeeId)) return false;
    if (!isMultiEntity || agendaBillingView === 'all') return true;
    const billingIds = billingIdsByAppt[apt.id] ?? [];
    return appointmentVisibleInBillingView(billingIds, agendaBillingView);
  });

  useEffect(() => {
    if (!fromLeadIdParam) {
      processedMarketingLeadPrefillRef.current = null;
      return;
    }
    if (fromLeadMarketingRow === undefined) return;
    if (fromLeadMarketingRow === null) {
      toast({
        title: 'Lead no encontrado',
        description: 'El enlace de marketing no es válido o el lead ya no existe.',
        variant: 'destructive',
      });
      const params = new URLSearchParams(location.search);
      params.delete('fromLead');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true },
      );
      return;
    }
    if (employeesLoading || prefsLoading) return;
    if (filteredEmployees.length === 0) {
      toast({
        title: 'Sin empleadas en la agenda',
        description: 'Activa al menos una empleada en la vista o revisa la configuración.',
        variant: 'destructive',
      });
      const params = new URLSearchParams(location.search);
      params.delete('fromLead');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true },
      );
      return;
    }

    const dedupeKey = `${fromLeadIdParam}:${fromLeadMarketingRow.id}`;
    if (processedMarketingLeadPrefillRef.current === dedupeKey) return;
    processedMarketingLeadPrefillRef.current = dedupeKey;

    const base = buildAgendaPrefillFromLead(fromLeadMarketingRow, agendaCustomers);
    const empId = filteredEmployees[0].id;

    selectAgendaDate(parse(base.date, 'yyyy-MM-dd', new Date()), { syncUrl: false });
    setSelectedSlot({ employeeId: empId, time: base.startTime });
    setAppointmentPrefill({
      clientPick: base.clientPick,
      description: base.description,
      date: base.date,
      startTime: base.startTime,
      employeeId: empId,
    });
    setAppointmentPrefillLeadId(fromLeadMarketingRow.id);
    setShowAppointmentForm(true);
    setScrollToTimeRequest({ requestId: Date.now(), time: base.startTime });

    toast({
      title: 'Nueva cita desde Marketing',
      description: 'Revisa cliente, fecha/hora y servicios antes de guardar.',
    });

    const params = new URLSearchParams(location.search);
    params.delete('fromLead');
    navigate(
      { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
      { replace: true },
    );
  }, [
    fromLeadIdParam,
    fromLeadMarketingRow,
    employeesLoading,
    prefsLoading,
    filteredEmployees,
    agendaCustomers,
    location.pathname,
    location.search,
    navigate,
    toast,
  ]);

  // Allow overlaps on same employee, but not on same cabina/recurso per servicio.
  const checkItemsResourceConflict = (
    date: string,
    startTime: string,
    items: AppointmentItemDraft[],
    excludeId?: string
  ): { hasConflict: boolean; messages: string[] } =>
    checkAppointmentItemsResourceConflict(
      date,
      startTime,
      items,
      appointments,
      { recursos: recursoCatalog, cabinas: cabinaCatalog, articleHints: agendaArticleHints },
      excludeId
    );

  const handleSlotClick = (employeeId: string, time: string) => {
    setAppointmentPrefill(null);
    setAppointmentPrefillLeadId(null);
    setSelectedSlot({ employeeId, time });
    setShowAppointmentForm(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowEditForm(true);
  };

  const handleAppointmentMove = async (appointmentId: string, newEmployeeId: string, newTime: string) => {
    try {
      const appointment = appointments.find((apt) => apt.id === appointmentId);
      if (!appointment) return;

      const [startH, startM] = appointment.startTime.split(':').map(Number);
      const [endH, endM] = appointment.endTime.split(':').map(Number);
      const duration = (endH * 60 + endM) - (startH * 60 + startM);

      const [newH, newM] = newTime.split(':').map(Number);
      const newEndMin = newH * 60 + newM + duration;
      const newEndTime = `${Math.floor(newEndMin / 60).toString().padStart(2, '0')}:${(newEndMin % 60).toString().padStart(2, '0')}`;

      const itemDrafts = appointmentItemsByAppt[appointmentId] || [];

      if (checkItemsResourceConflict(format(selectedDate, 'yyyy-MM-dd'), newTime, itemDrafts, appointmentId).hasConflict) {
        toast({ title: 'Conflicto de recurso/cabina', description: 'Algún servicio de la cita solapa cabina o recurso ya ocupados.', variant: 'destructive' });
        return;
      }

      await updateAppointment.mutateAsync({
        id: appointmentId,
        employee_id: newEmployeeId,
        customer_id: appointment.customerId ?? null,
        title: appointment.clientName,
        description: appointment.description,
        start_time: `${format(selectedDate, 'yyyy-MM-dd')}T${newTime}:00`,
        end_time: `${format(selectedDate, 'yyyy-MM-dd')}T${newEndTime}:00`,
        color: appointment.color,
        status: appointment.status,
      });

      toast({ title: 'Cita movida' });
    } catch {
      toast({ title: 'Error al mover cita', variant: 'destructive' });
    }
  };

  const handleAppointmentSave = async (data: CreateAppointmentData) => {
    try {
      const dateStr = data.date || format(selectedDate, 'yyyy-MM-dd');
      const items = data.items ?? [];

      if (checkItemsResourceConflict(dateStr, data.startTime, items).hasConflict) {
        toast({ title: 'Conflicto de recurso/cabina', description: 'Algún servicio solapa cabina o recurso ya ocupados en ese tramo.', variant: 'destructive' });
        return;
      }

      const created = await createAppointment.mutateAsync({
        employee_id: data.employeeId,
        customer_id: data.customerId ?? null,
        title: data.clientName,
        description: data.description,
        start_time: `${dateStr}T${data.startTime}:00`,
        end_time: `${dateStr}T${data.endTime}:00`,
        color: data.color,
        status: data.status,
      });
      try {
        const previousItems: AppointmentItemDraft[] = [];
        await syncAppointmentItems(created.id, items);
        try {
          await applyBonoSessionDelta(previousItems, items, {
            appointmentId: created.id,
            appointmentDate: dateStr,
            employeeId: data.employeeId,
          });
        } catch (bonoErr) {
          console.error('bono session consume', bonoErr);
          toast({
            title: 'Cita guardada, pero no se registró el uso del bono',
            description: (bonoErr as Error)?.message || 'Revisa el bono del cliente.',
            variant: 'destructive',
          });
        }
        await queryClient.invalidateQueries({ queryKey: appointmentItemsQueryKey(created.id) });
        await queryClient.invalidateQueries({ queryKey: ['appointment-time-segments'] });
        await queryClient.invalidateQueries({ queryKey: ['appointment-item-totals'] });
        await queryClient.invalidateQueries({ queryKey: ['customer-active-bonos'] });
        await queryClient.invalidateQueries({ queryKey: ['bonos'] });
        await registerAppointmentHistory(data.customerId ?? null, dateStr, items, created.id);
      } catch (e) {
        console.error('appointment_items sync', e);
        toast({
          title: 'Cita creada, pero no se guardaron los ítems/ficha',
          description: (e as Error)?.message || 'Revisa los ítems y vuelve a guardar.',
          variant: 'destructive',
        });
      }

      setShowAppointmentForm(false);
      setSelectedSlot(null);
      setAppointmentPrefill(null);
      setAppointmentPrefillLeadId(null);
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  const handleAppointmentUpdate = async (updated: Appointment, items: AppointmentItemDraft[]) => {
    try {
      const conflict = checkItemsResourceConflict(updated.date, updated.startTime, items, updated.id);
      if (conflict.hasConflict) {
        toast({
          title: 'Conflicto de recurso/cabina',
          description: conflict.messages[0] || 'Algún servicio solapa cabina o recurso ya ocupados.',
          variant: 'destructive',
        });
        return;
      }

      await updateAppointment.mutateAsync({
        id: updated.id,
        employee_id: updated.employeeId,
        customer_id: updated.customerId ?? null,
        title: updated.clientName,
        description: updated.description,
        start_time: `${updated.date}T${updated.startTime}:00`,
        end_time: `${updated.date}T${updated.endTime}:00`,
        color: updated.color,
        status: updated.status,
      });
      try {
        const previousItems = await fetchAppointmentItems(updated.id, companyId || undefined);
        await syncAppointmentItems(updated.id, items);
        try {
          await applyBonoSessionDelta(previousItems, items, {
            appointmentId: updated.id,
            appointmentDate: updated.date,
            employeeId: updated.employeeId,
          });
        } catch (bonoErr) {
          console.error('bono session consume', bonoErr);
          toast({
            title: 'Cita guardada, pero no se registró el uso del bono',
            description: (bonoErr as Error)?.message || 'Revisa el bono del cliente.',
            variant: 'destructive',
          });
        }
        await queryClient.invalidateQueries({ queryKey: appointmentItemsQueryKey(updated.id) });
        await queryClient.invalidateQueries({ queryKey: ['appointment-time-segments'] });
        await queryClient.invalidateQueries({ queryKey: ['appointment-item-totals'] });
        await queryClient.invalidateQueries({ queryKey: ['customer-active-bonos'] });
        await queryClient.invalidateQueries({ queryKey: ['bonos'] });
        await registerAppointmentHistory(updated.customerId ?? null, updated.date, items, updated.id);
      } catch (e) {
        console.error('appointment_items sync', e);
        toast({
          title: 'Cita actualizada, pero no se guardaron los ítems/ficha',
          description: (e as Error)?.message || 'Revisa los ítems y vuelve a guardar.',
          variant: 'destructive',
        });
      }

      setShowEditForm(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const handleAppointmentDelete = async (appointmentId: string) => {
    try {
      await deleteAppointment.mutateAsync(appointmentId);
      setShowEditForm(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleChargeAppointment = async (apt: Appointment, items: AppointmentItemDraft[]) => {
    const chargeableTotal = appointmentChargeableTotal(items);
    const existingSales = appointmentSalesMap.get(apt.id) ?? [];
    const chargeCheck = canChargeAppointment({
      status: apt.status,
      chargeableTotal,
      existingSales,
    });
    if (!chargeCheck.allowed) {
      toast({
        title: 'No se puede cobrar',
        description: chargeCheck.reason,
        variant: 'destructive',
      });
      return;
    }

    const articleIds = items.map((it) => it.article_id).filter(Boolean) as string[];
    let articlesMap = new Map<string, { familia: string; billing_company_id?: string | null; company_id?: string | null }>();
    if (articleIds.length && companyId) {
      const { data } = await supabase
        .from('articles')
        .select('id, familia, billing_company_id, company_id')
        .in('id', articleIds);
      articlesMap = new Map((data ?? []).map((a) => [a.id, a]));
    }

    const paidBillingIds = new Set(
      existingSales
        .filter((s) => s.status === 'completed' && s.company_id)
        .map((s) => String(s.company_id)),
    );

    const prefilledCart = items
      .filter((it) => appointmentItemLineTotal(it) > 0)
      .filter((it) => {
        if (!companyId || paidBillingIds.size === 0) return true;
        const article = it.article_id ? articlesMap.get(it.article_id) : null;
        const billingId = article
          ? resolveBillingCompanyId(
              {
                billing_company_id: article.billing_company_id,
                familia: article.familia ?? 'Varios',
                company_id: article.company_id,
              },
              familyBillingMap,
              companyId,
            )
          : companyId;
        return !paidBillingIds.has(billingId);
      })
      .map((it, idx) => {
        const bonusMode = it.kind === 'bonus' ? (it.bonus_payment_mode ?? 'none') : null;
        const lineTotal = appointmentItemLineTotal(it);
        const qty = it.kind === 'bonus' ? 1 : Math.max(1, Number(it.quantity ?? 1));
        const unit = it.kind === 'bonus' ? lineTotal : Math.max(0, Number(it.unit_price ?? 0));
        const labelSuffix =
          it.kind === 'bonus' && bonusMode && bonusMode !== 'none'
            ? ` (Bono ${bonusMode === 'full' ? '100%' : `${bonusMode}%`})`
            : '';
        const article = it.article_id ? articlesMap.get(it.article_id) : null;
        const billingCompanyId =
          article && companyId
            ? resolveBillingCompanyId(
                {
                  billing_company_id: article.billing_company_id,
                  familia: article.familia ?? 'Varios',
                  company_id: article.company_id,
                },
                familyBillingMap,
                companyId,
              )
            : companyId ?? undefined;
        return {
          id: it.article_id || `apt-${apt.id}-${idx}`,
          name: `${it.label || 'Ítem'}${labelSuffix}`,
          price: unit,
          quantity: qty,
          total: lineTotal,
          variationId: undefined as string | undefined,
          size: undefined as string | undefined,
          color: undefined as string | undefined,
          sourceKind: it.kind,
          sourceBonusMode: bonusMode,
          billingCompanyId,
        };
      });

    if (prefilledCart.length === 0) {
      toast({
        title: 'No hay importe pendiente',
        description: 'Todos los conceptos de esta cita ya están cobrados.',
        variant: 'destructive',
      });
      return;
    }

    navigate('/tpv', {
      state: {
        prefillFromAppointment: {
          appointmentId: apt.id,
          customerId: apt.customerId ?? null,
          customerName: apt.clientName,
          date: apt.date,
          appointmentStatus: apt.status,
          items: prefilledCart,
        },
      },
    });
  };

  const handleNotifyAppointment = async (
    apt: Appointment,
    recipientUserId: string,
    message: string
  ) => {
    if (!companyId || !user?.id) return;
    const link = `/agenda?date=${apt.date}&appointment=${apt.id}`;
    const title = `Observación cita · ${apt.clientName}`;
    // Intento extendido (si existen columnas nuevas).
    let { error } = await supabase.from('notifications').insert({
      company_id: opCompanyId,
      user_id: recipientUserId,
      from_user_id: user.id,
      appointment_id: apt.id,
      title,
      message,
      type: 'appointment',
      link,
      read: false,
      metadata: { appointment_id: apt.id, appointment_date: apt.date },
    });
    if (error?.code === '42703') {
      // Fallback para esquemas con estructura mínima.
      ({ error } = await supabase.from('notifications').insert({
        company_id: opCompanyId,
        user_id: recipientUserId,
        title,
        message,
        type: 'info',
        link,
        read: false,
      }));
    }
    if (error) {
      toast({
        title: 'No se pudo enviar la notificación',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Notificación enviada' });
  };

  if (
    (employeesLoading && dbEmployeesRaw.length === 0) ||
    (appointmentsLoading && dbAppointments.length === 0) ||
    prefsLoading
  ) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!employees.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Sin empleados activos en la agenda</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Si ya tienes empleados dados de alta pero están inactivos, entra en Configuración → Agenda → horario por
          empleado y activa al menos uno con el interruptor «Activo en la agenda». Allí también puedes editar horarios
          y el orden de las columnas aunque estén inactivos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-9rem)] min-h-[560px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-sky-500" />
            Agenda
          </h1>
          {isMultiEntity && agendaBillingView !== 'all' && (
            <p className="mt-1 text-[10px] text-muted-foreground text-violet-600 dark:text-violet-400">
              Las citas mixtas (estética + medicina) solo se ven en «Ambas empresas»
            </p>
          )}
        </div>

        <div className="flex flex-nowrap items-center gap-1.5 min-w-0">
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <div className="flex flex-nowrap items-center rounded-md border border-border/60 bg-muted/80 p-0 h-7">
              <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0 rounded-none rounded-l-md" onClick={() => selectAgendaDate(subDays(selectedDate, 1))}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 min-w-0 max-w-[11rem] sm:max-w-[13rem] px-2 text-xs font-medium tabular-nums capitalize rounded-none border-x border-border/50"
                >
                  {format(selectedDate, 'EEE d MMM yyyy', { locale: es })}
                </Button>
              </PopoverTrigger>
              <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0 rounded-none rounded-r-md" onClick={() => selectAgendaDate(addDays(selectedDate, 1))}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                key={format(selectedDate, 'yyyy-MM')}
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  if (d) {
                    selectAgendaDate(d);
                    setDatePickerOpen(false);
                  }
                }}
                defaultMonth={selectedDate}
                locale={es}
                captionLayout="dropdown"
                fromYear={1990}
                toYear={2040}
                initialFocus
                className="pointer-events-auto p-2"
                classNames={{
                  month: 'space-y-1',
                  caption: 'flex justify-center pt-0 pb-1 px-0 relative items-center',
                  caption_dropdowns: 'flex flex-row flex-nowrap items-center justify-center gap-1',
                  /** Oculta el texto duplicado (mes/año + icono) junto al desplegable nativo */
                  caption_label: 'hidden',
                  dropdown: 'h-7 rounded-md border border-input bg-background px-1.5 py-0 text-xs font-medium cursor-pointer',
                  dropdown_month: 'shrink-0 max-h-7',
                  dropdown_year: 'shrink-0 max-h-7 w-[4.25rem]',
                }}
                labels={{
                  labelMonthDropdown: () => 'Mes',
                  labelYearDropdown: () => 'Año',
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs shrink-0"
            onClick={() => {
              selectAgendaDate(new Date());
              setGoToTodayRequestId((n) => n + 1);
            }}
          >
            <Clock className="w-3.5 h-3.5 mr-1" /> Hoy
          </Button>
          <BillingEntityToggle
            showAll
            value={agendaBillingView}
            onChange={setAgendaBillingView}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <AgendaGrid
          employees={filteredEmployees}
          appointments={filteredAppointments}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentMove={handleAppointmentMove}
          persistUserId={user?.id ?? null}
          viewDateYmd={selectedDateYmd}
          goToTodayRequestId={goToTodayRequestId}
          scrollToTimeRequest={scrollToTimeRequest}
          centerHours={centerHours}
          employeeAgendaById={employeeAgendaById}
          visibleFields={preferences.visibleFields}
          slotMinutes={preferences.slotMinutes}
          cellHeight={preferences.cellHeight}
        />
      </div>

      {/* Create form */}
      {showAppointmentForm && selectedSlot && (
        <AppointmentForm
          key={
            appointmentPrefillLeadId
              ? `mlead-${appointmentPrefillLeadId}`
              : `slot-${selectedDateYmd}-${selectedSlot.employeeId}-${selectedSlot.time}`
          }
          employeeId={selectedSlot.employeeId}
          time={selectedSlot.time}
          employees={allEmployees}
          customers={agendaCustomers}
          cabinas={cabinas.data || []}
          recursos={recursos.data || []}
          dayAppointments={appointments}
          initialPrefill={appointmentPrefill}
          onSave={handleAppointmentSave}
          onCancel={() => {
            setShowAppointmentForm(false);
            setSelectedSlot(null);
            setAppointmentPrefill(null);
            setAppointmentPrefillLeadId(null);
          }}
        />
      )}

      {/* Edit form */}
      {showEditForm && selectedAppointment && (
        <EditAppointmentForm
          appointment={selectedAppointment}
          employees={allEmployees}
          customers={agendaCustomers}
          notifyRecipients={notifyRecipients}
          cabinas={cabinas.data || []}
          recursos={recursos.data || []}
          dayAppointments={appointments}
          onSave={handleAppointmentUpdate}
          onCharge={handleChargeAppointment}
          onNotify={handleNotifyAppointment}
          onDelete={handleAppointmentDelete}
          onCancel={() => {
            setShowEditForm(false);
            setSelectedAppointment(null);
            clearReturnCustomerParam();
          }}
          returnCustomerId={returnCustomerId}
          onReturnToCustomerHistory={returnCustomerId ? handleReturnToCustomerHistory : undefined}
          onHistoryAppointmentClick={openAppointmentById}
        />
      )}
    </div>
  );
};
