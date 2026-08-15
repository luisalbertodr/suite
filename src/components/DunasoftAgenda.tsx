import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { AgendaGrid } from '@/components/AgendaGrid';
import { DunasoftAppointmentDetailDialog } from '@/components/DunasoftAppointmentDetailDialog';
import {
  DunasoftAppointmentForm,
  type DunasoftAppointmentFormValues,
} from '@/components/DunasoftAppointmentForm';
import { AppointmentForm } from '@/components/AppointmentForm';
import {
  DunasoftSuiteAppointmentPopup,
  fetchSuiteAppointmentById,
  fetchSuiteAppointmentByLegacyIdPlan,
  styleAppointmentFromSuiteRow,
} from '@/components/DunasoftSuiteAppointmentPopup';
import type { AgendaAppointmentDayRow } from '@/lib/agendaAppointmentsQuery';
import { buildCustomerHistoryUrl } from '@/lib/agendaCustomerNavigation';
import { isUuid } from '@/lib/appointmentSales';
import {
  useDunasoftAgendaDay,
  usePrefetchAdjacentDunasoftAgendaDays,
} from '@/hooks/useDunasoftAgendaDay';
import { useDunasoftAppointmentMutations } from '@/hooks/useDunasoftAppointmentMutations';
import { useDunasoftSyncStatus } from '@/hooks/useDunasoftSyncStatus';
import { useStyleSyncAgentStatus } from '@/hooks/useStyleSyncAgentStatus';
import { useAgendaInboundSyncRefetch } from '@/hooks/useAgendaInboundSyncRefetch';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { useAgendaAppointments } from '@/hooks/useAgendaAppointments';
import { useCabinas, useRecursos } from '@/hooks/useRecursosCabinas';
import { appointmentItemsQueryKey, syncAppointmentItems } from '@/hooks/useAppointmentItems';
import { applyBonoSessionDelta } from '@/lib/consumeBonoSessions';
import { syncAgendaAppointmentToStyle } from '@/lib/dunasoftDualWriteApi';
import { buildAgendaSyncBadge } from '@/lib/agendaSyncBadge';
import { AgendaTopBarFitExtras } from '@/components/AgendaTopBarFitExtras';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';
import { useRoutePanelActive } from '@/contexts/RoutePanelContext';
import {
  loadInitialAgendaDateYmd,
  loadAgendaViewPersisted,
  mergePersistedLastDate,
  saveAgendaViewPersisted,
} from '@/lib/agendaViewPersistence';
import { DEFAULT_AGENDA_CENTER_HOURS } from '@/lib/agendaHours';
import type { Appointment, AppointmentItemDraft } from '@/types/agenda';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConsentimientoSignDialog } from '@/components/consentimiento/ConsentimientoSignDialog';
import type { ConsentimientoSignContext } from '@/lib/consentimientoTypes';
import { TreatmentSessionDialog } from '@/components/clinical/TreatmentSessionDialog';
import type { TrackingFamily } from '@/lib/treatmentTracking';
import { createQuestionnaire, openQuestionnaireKiosk } from '@/lib/questionnaireApi';
import { useToast } from '@/hooks/use-toast';

function normalizeStyleEmployeeCode(value: unknown): string {
  return String(value ?? '').trim().replace(/^0+/, '') || '0';
}

function appointmentToFormValues(apt: Appointment): Partial<DunasoftAppointmentFormValues> {
  const endTime =
    apt.timeSegments?.length
      ? apt.timeSegments[apt.timeSegments.length - 1]!.endTime
      : apt.occupiedEndTime || apt.endTime;
  return {
    codemp: apt.legacyEmployeeCode ?? apt.employeeId,
    codcli: apt.legacyClientCode ?? '',
    nomcli: apt.clientName,
    tel1cli: apt.clientPhone ?? '',
    fecha: apt.date,
    horini: apt.startTime,
    horfin: endTime,
    texto: apt.description,
    planart:
      apt.timeSegments?.map((s) => ({
        codart: s.label.split(' - ')[0]?.trim() ?? s.label,
        hora: s.startTime,
      })) ?? [],
  };
}

export const DunasoftAgenda: React.FC = () => {
  const { user } = useAuth();
  const { companyId } = useCompanyFilter();
  const { toast } = useToast();
  const { requireOrToast: requirePermissionOrToast, can: canPermission } = usePermissionGuard();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const panelActive = useRoutePanelActive();

  const [selectedDate, setSelectedDate] = useState(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const parsed = parse(dateParam, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) return parsed;
    }
    const persisted = loadInitialAgendaDateYmd(user?.id);
    if (persisted && /^\d{4}-\d{2}-\d{2}$/.test(persisted)) {
      const parsed = parse(persisted, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) return parsed;
    }
    return new Date();
  });

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [goToTodayRequestId, setGoToTodayRequestId] = useState(0);
  const [scrollToTimeRequest, setScrollToTimeRequest] = useState<{
    requestId: number;
    time: string;
  } | null>(null);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [suiteEdit, setSuiteEdit] = useState<{
    styleApt: Appointment;
    suiteRow: AgendaAppointmentDayRow;
  } | null>(null);
  const [openingAppointment, setOpeningAppointment] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [formSlot, setFormSlot] = useState<{ employeeId: string; time: string } | null>(null);
  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [consentSignContext, setConsentSignContext] = useState<ConsentimientoSignContext | null>(null);
  const [sessionContext, setSessionContext] = useState<{
    appointment: Appointment;
    trackingFamily: TrackingFamily;
    plantillaCodigo?: string | null;
  } | null>(null);
  const pendingOpenAppointmentIdRef = useRef<string | null>(null);
  const openingDeepLinkRef = useRef(false);

  const selectedDateYmd = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

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
    setSuiteEdit(null);
    setDetailOpen(false);
    setFormMode(null);
    setEditTarget(null);
    clearReturnCustomerParam();
    navigate(buildCustomerHistoryUrl(returnCustomerId));
  }, [returnCustomerId, clearReturnCustomerParam, navigate]);

  const selectAgendaDate = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      const params = new URLSearchParams(location.search);
      const ymd = format(date, 'yyyy-MM-dd');
      if (ymd === format(new Date(), 'yyyy-MM-dd')) params.delete('date');
      else params.set('date', ymd);
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true },
      );
    },
    [location.pathname, location.search, navigate],
  );

  useEffect(() => {
    if (!user?.id) return;
    const prev = loadAgendaViewPersisted(user.id);
    saveAgendaViewPersisted(user.id, mergePersistedLastDate(prev, selectedDateYmd));
  }, [user?.id, selectedDateYmd]);

  const { data, isLoading, isError, error, refetch, refetchDay, isFetching, isDayLoading } =
    useDunasoftAgendaDay(selectedDateYmd, companyId, panelActive);
  usePrefetchAdjacentDunasoftAgendaDays(selectedDateYmd, companyId, panelActive);
  useAgendaInboundSyncRefetch(companyId, refetchDay, selectedDateYmd, panelActive);
  const showInitialSkeleton = isLoading && !data;
  const { updateMutation, deleteMutation } = useDunasoftAppointmentMutations(
    selectedDateYmd,
    companyId,
  );
  const { employees: suiteEmployees = [] } = useAgendaEmployees({ agendaOnly: true });
  const { createAppointment } = useAgendaAppointments(selectedDateYmd);
  const { cabinas } = useCabinas();
  const { recursos } = useRecursos();
  const { data: syncStatus } = useDunasoftSyncStatus(20_000, panelActive);
  const { data: styleSync } = useStyleSyncAgentStatus(companyId, 25_000, panelActive);

  const suiteEmployeesForForm = useMemo(
    () =>
      suiteEmployees.map((e) => ({
        id: e.id,
        name: e.name,
        color: e.color || '#3B82F6',
        billing_company_id: e.billing_company_id,
      })),
    [suiteEmployees],
  );

  const createSuiteEmployeeId = useMemo(() => {
    if (!formSlot) return suiteEmployeesForForm[0]?.id ?? '';
    const styleCode = normalizeStyleEmployeeCode(formSlot.employeeId);
    const match = suiteEmployees.find(
      (e) => normalizeStyleEmployeeCode(e.dunasoft_codemp) === styleCode,
    );
    return match?.id ?? suiteEmployeesForForm[0]?.id ?? '';
  }, [formSlot, suiteEmployees, suiteEmployeesForForm]);

  const syncBadge = useMemo(
    () => buildAgendaSyncBadge(syncStatus, styleSync),
    [syncStatus, styleSync],
  );

  const employees = useMemo(() => data?.employees ?? [], [data?.employees]);
  const appointments = useMemo(() => data?.appointments ?? [], [data?.appointments]);
  const employeeAgendaById = useMemo(
    () => data?.employeeAgendaById ?? {},
    [data?.employeeAgendaById],
  );

  /** Actualizar manual: datos del día y estado de sync, avisando si el badge no está OK. */
  const handleRefresh = useCallback(async () => {
    await refetch();
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['dunasoft-sync-status'] }),
      queryClient.refetchQueries({
        queryKey: ['style-sync-agent-status', companyId ?? 'default'],
      }),
    ]);
    const badge = buildAgendaSyncBadge(
      queryClient.getQueryData(['dunasoft-sync-status']),
      queryClient.getQueryData(['style-sync-agent-status', companyId ?? 'default']),
    );
    if (badge.tone !== 'ok') {
      toast({
        title: badge.label,
        description: badge.title,
        variant: badge.tone === 'error' ? 'destructive' : 'default',
      });
    }
  }, [companyId, queryClient, refetch, toast]);

  const openStyleEditForm = useCallback((apt: Appointment) => {
    setFormMode('edit');
    setEditTarget(apt);
    setFormSlot({ employeeId: apt.employeeId, time: apt.startTime });
  }, []);

  const openAppointmentPopup = useCallback(
    async (apt: Appointment) => {
      setDetailOpen(false);
      setSuiteEdit(null);
      setFormMode(null);
      setEditTarget(null);

      const paid =
        apt.paymentStatus === 'paid' || apt.paymentStatus === 'invoiced';

      if (companyId) {
        setOpeningAppointment(true);
        try {
          const suiteRow = await fetchSuiteAppointmentByLegacyIdPlan(companyId, apt.id);
          if (suiteRow) {
            setSuiteEdit({ styleApt: apt, suiteRow });
            return;
          }
        } catch (e) {
          console.warn('No se pudo resolver gemelo Suite de la cita Style:', e);
        } finally {
          setOpeningAppointment(false);
        }
      }

      // Sin gemelo Suite: formulario Style completo; cobrada → detalle (docs / solo lectura).
      if (paid) {
        setDetailAppointment(apt);
        setDetailOpen(true);
        return;
      }
      if (!requirePermissionOrToast('agenda', 'update')) {
        setDetailAppointment(apt);
        setDetailOpen(true);
        return;
      }
      openStyleEditForm(apt);
    },
    [companyId, openStyleEditForm, requirePermissionOrToast],
  );

  // Deep-link desde ficha/cliente / reloj TopBar (Dock keep-alive: re-leer search).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const appointmentParam = params.get('appointment')?.trim() || null;
    if (appointmentParam) {
      pendingOpenAppointmentIdRef.current = appointmentParam;
    }
    const dateParam = params.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const parsed = parse(dateParam, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) {
        setSelectedDate((prev) =>
          format(prev, 'yyyy-MM-dd') === dateParam ? prev : parsed,
        );
      }
    }
    if (params.get('now') === '1') {
      const today = new Date();
      const todayYmd = format(today, 'yyyy-MM-dd');
      setSelectedDate((prev) =>
        format(prev, 'yyyy-MM-dd') === todayYmd ? prev : today,
      );
      setGoToTodayRequestId((n) => n + 1);
      params.delete('now');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true },
      );
      void queryClient.invalidateQueries({
        queryKey: ['dunasoft-agenda-day', todayYmd, companyId],
      });
    }
  }, [companyId, location.pathname, location.search, navigate, queryClient]);

  useEffect(() => {
    const targetId = pendingOpenAppointmentIdRef.current;
    if (!targetId || !companyId || openingDeepLinkRef.current) return;
    // idplan Style: esperar a la grid del día. UUID Suite: se puede abrir vía BD.
    if (!isUuid(targetId) && isDayLoading && !appointments.length) return;

    let cancelled = false;
    openingDeepLinkRef.current = true;

    const stripAppointmentParam = () => {
      const params = new URLSearchParams(location.search);
      if (!params.has('appointment')) return;
      params.delete('appointment');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true },
      );
    };

    void (async () => {
      try {
        let suiteRow: AgendaAppointmentDayRow | null = null;
        let styleApt: Appointment | undefined;

        if (isUuid(targetId)) {
          // Lookup por id Suite (PK); no depende de la empresa activa de la UI.
          suiteRow = await fetchSuiteAppointmentById(companyId, targetId);
          if (cancelled) return;
          if (!suiteRow) {
            pendingOpenAppointmentIdRef.current = null;
            stripAppointmentParam();
            toast({
              title: 'Cita no encontrada',
              description: 'No se pudo abrir la cita desde la ficha.',
              variant: 'destructive',
            });
            return;
          }
          const rowYmd =
            (suiteRow.start_time && String(suiteRow.start_time).includes('T')
              ? String(suiteRow.start_time).split('T')[0]
              : null) ||
            suiteRow.appointment_date ||
            selectedDateYmd;
          if (rowYmd && rowYmd !== selectedDateYmd) {
            const parsed = parse(rowYmd, 'yyyy-MM-dd', new Date());
            if (isValid(parsed)) {
              // Mantener pending hasta que cargue el día correcto.
              openingDeepLinkRef.current = false;
              selectAgendaDate(parsed);
              return;
            }
          }
          const idplan = suiteRow.legacy_idplan != null ? String(suiteRow.legacy_idplan).trim() : '';
          styleApt =
            (idplan ? appointments.find((a) => a.id === idplan) : undefined) ??
            styleAppointmentFromSuiteRow(suiteRow, selectedDateYmd);
        } else {
          styleApt = appointments.find((a) => a.id === targetId);
          if (!styleApt) {
            if (!isDayLoading) {
              pendingOpenAppointmentIdRef.current = null;
              stripAppointmentParam();
              toast({
                title: 'Cita no encontrada',
                description: 'No hay esa cita en la agenda del día.',
                variant: 'destructive',
              });
            }
            return;
          }
          try {
            suiteRow = await fetchSuiteAppointmentByLegacyIdPlan(companyId, styleApt.id);
          } catch {
            suiteRow = null;
          }
          if (cancelled) return;
        }

        pendingOpenAppointmentIdRef.current = null;
        stripAppointmentParam();
        setScrollToTimeRequest({
          requestId: Date.now(),
          time: styleApt.startTime || '09:00',
        });

        if (suiteRow) {
          setDetailOpen(false);
          setFormMode(null);
          setEditTarget(null);
          setSuiteEdit({ styleApt, suiteRow });
        } else {
          await openAppointmentPopup(styleApt);
        }
      } finally {
        if (!cancelled) openingDeepLinkRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      openingDeepLinkRef.current = false;
    };
  }, [
    appointments,
    companyId,
    isDayLoading,
    location.pathname,
    location.search,
    navigate,
    openAppointmentPopup,
    selectAgendaDate,
    selectedDateYmd,
    toast,
  ]);

  const topBarActions = useMemo(
    () => (
      <>
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <div className="flex h-7 flex-nowrap items-center rounded-md border border-border/60 bg-muted/80 p-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 p-0 rounded-none rounded-l-md"
              onClick={() => selectAgendaDate(subDays(selectedDate, 1))}
            >
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
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 p-0 rounded-none rounded-r-md"
              onClick={() => selectAgendaDate(addDays(selectedDate, 1))}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <PopoverContent className="w-auto p-0 z-[250]" align="center">
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
                caption_label: 'hidden',
                dropdown:
                  'h-7 rounded-md border border-input bg-background px-1.5 py-0 text-xs font-medium cursor-pointer',
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
        <AgendaTopBarFitExtras>
          <span
            className={`inline-flex h-7 shrink-0 items-center rounded-md border px-2 text-[11px] font-medium tabular-nums ${
              syncBadge.tone === 'error'
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : syncBadge.tone === 'pending'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
            }`}
            title={syncBadge.title}
          >
            {syncBadge.label}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs shrink-0 text-muted-foreground"
            onClick={() => void handleRefresh()}
            disabled={isFetching}
          >
            Actualizar
          </Button>
        </AgendaTopBarFitExtras>
      </>
    ),
    [
      datePickerOpen,
      handleRefresh,
      isFetching,
      selectAgendaDate,
      selectedDate,
      syncBadge,
    ],
  );

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-sky-500" />
          Agenda Style
        </span>
      ),
      actions: topBarActions,
    },
    [topBarActions],
  );

  const handleSlotClick = useCallback(
    (employeeId: string, time: string) => {
      if (!requirePermissionOrToast('agenda', 'create')) return;
      setFormMode('create');
      setFormSlot({ employeeId, time });
      setEditTarget(null);
    },
    [requirePermissionOrToast],
  );

  const handleAppointmentClick = useCallback(
    (apt: Appointment) => {
      void openAppointmentPopup(apt);
    },
    [openAppointmentPopup],
  );

  const handleAppointmentMove = useCallback(
    (appointmentId: string, newEmployeeId: string, newTime: string) => {
      if (!requirePermissionOrToast('agenda', 'update')) return;
      const apt = appointments.find((a) => a.id === appointmentId);
      if (!apt) return;
      if (apt.paymentStatus === 'paid' || apt.paymentStatus === 'invoiced') {
        toast({
          title: 'Cita cobrada',
          description: 'No se puede mover una cita con ticket cobrado.',
          variant: 'destructive',
        });
        return;
      }

      const [startH, startM] = apt.startTime.split(':').map(Number);
      const [endH, endM] = apt.endTime.split(':').map(Number);
      const duration = endH * 60 + endM - (startH * 60 + startM);
      const [newH, newM] = newTime.split(':').map(Number);
      const newEndMin = newH * 60 + newM + duration;
      const newEndTime = `${Math.floor(newEndMin / 60)
        .toString()
        .padStart(2, '0')}:${(newEndMin % 60).toString().padStart(2, '0')}`;

      const deltaMin = newH * 60 + newM - (startH * 60 + startM);
      const planart =
        apt.timeSegments?.map((s) => {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const shifted = sh * 60 + sm + deltaMin;
          const hora = `${Math.floor(shifted / 60)
            .toString()
            .padStart(2, '0')}:${(shifted % 60).toString().padStart(2, '0')}`;
          return {
            codart: s.label.split(' - ')[0]?.trim() ?? s.label,
            hora,
          };
        }) ?? [];

      updateMutation.mutate({
        idplan: appointmentId,
        payload: {
          codemp: newEmployeeId,
          codcli: apt.legacyClientCode ?? '',
          nomcli: apt.clientName,
          tel1cli: apt.clientPhone ?? '',
          fecha: apt.date,
          horini: newTime,
          horfin: newEndTime,
          texto: apt.description,
          customer_id: apt.customerId,
          ...(planart.length ? { planart } : {}),
        },
      });
    },
    [appointments, requirePermissionOrToast, toast, updateMutation],
  );

  const closeForm = () => {
    setFormMode(null);
    setFormSlot(null);
    setEditTarget(null);
    setSuiteEdit(null);
  };

  const handleSuiteCreateSave = async (data: {
    employeeId: string;
    clientName: string;
    customerId?: string | null;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    color: string;
    status: Appointment['status'];
    items?: AppointmentItemDraft[];
  }) => {
    setCreateSaving(true);
    try {
      const dateStr = data.date || selectedDateYmd;
      const items = data.items ?? [];
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
        await syncAppointmentItems(created.id, items);
        try {
          await applyBonoSessionDelta([], items, {
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
        await syncAgendaAppointmentToStyle(created.id);
      } catch (e) {
        console.error('appointment_items / style sync', e);
        toast({
          title: 'Cita creada, pero faltan ítems o sync Style',
          description: (e as Error)?.message || 'Revisa la cita y vuelve a guardar.',
          variant: 'destructive',
        });
      }
      await refetchDay();
      closeForm();
      toast({ title: 'Cita creada', description: 'Guardada en Suite y encolada hacia Style.' });
    } catch (err) {
      toast({
        title: 'Error al crear',
        description: (err as Error)?.message || 'No se pudo crear la cita.',
        variant: 'destructive',
      });
    } finally {
      setCreateSaving(false);
    }
  };

  const handleEditSave = (values: DunasoftAppointmentFormValues) => {
    if (!editTarget) return;
    updateMutation.mutate(
      {
        idplan: editTarget.id,
        payload: { ...values, planart: values.planart },
      },
      {
        onSuccess: () => {
          closeForm();
          setDetailOpen(false);
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setDetailOpen(false);
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
      {isError ? (
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error instanceof Error ? error.message : 'Error al cargar la agenda Dunasoft'}</span>
          <Button variant="outline" size="sm" className="ml-auto h-7" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {showInitialSkeleton ? (
        <Skeleton className="min-h-0 flex-1 w-full rounded-lg" />
      ) : (
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-card transition-opacity duration-150 ${
            isDayLoading ? 'opacity-60' : ''
          }`}
        >
          <AgendaGrid
            employees={employees}
            appointments={appointments}
            onSlotClick={handleSlotClick}
            onAppointmentClick={handleAppointmentClick}
            onAppointmentMove={handleAppointmentMove}
            persistUserId={user?.id}
            viewDateYmd={selectedDateYmd}
            goToTodayRequestId={goToTodayRequestId}
            scrollToTimeRequest={scrollToTimeRequest}
            centerHours={DEFAULT_AGENDA_CENTER_HOURS}
            employeeAgendaById={employeeAgendaById}
            slotMinutes={15}
            visibleFields={{
              clientName: true,
              service: true,
              description: true,
              timeRange: true,
              status: true,
              legacyCodes: true,
            }}
          />
        </div>
      )}

      <DunasoftAppointmentDetailDialog
        appointment={detailAppointment}
        employees={employees}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canEdit={canPermission('agenda', 'update')}
        canDelete={canPermission('agenda', 'delete')}
        onEdit={(apt) => {
          if (!requirePermissionOrToast('agenda', 'update')) return;
          setDetailOpen(false);
          openStyleEditForm(apt);
        }}
        onDelete={(apt) => {
          if (!requirePermissionOrToast('agenda', 'delete')) return;
          setDeleteTarget(apt);
        }}
        companyId={companyId}
        onSelectConsent={(apt, plantillaId) => {
          if (!companyId || !apt.customerId) return;
          const employee = employees.find((e) => e.id === apt.employeeId);
          setDetailOpen(false);
          setConsentSignContext({
            customerId: apt.customerId,
            companyId,
            appointmentId: apt.id,
            tratamiento: apt.serviceName ?? undefined,
            profesional: employee?.name ?? apt.legacyEmployeeCode ?? undefined,
            profesionalEmpleadoId: apt.employeeId,
            initialPlantillaId: plantillaId,
          });
        }}
        onOpenFreeConsent={(apt) => {
          if (!companyId || !apt.customerId) return;
          const employee = employees.find((e) => e.id === apt.employeeId);
          setDetailOpen(false);
          setConsentSignContext({
            customerId: apt.customerId,
            companyId,
            appointmentId: apt.id,
            tratamiento: apt.serviceName ?? undefined,
            profesional: employee?.name ?? apt.legacyEmployeeCode ?? undefined,
            profesionalEmpleadoId: apt.employeeId,
          });
        }}
        onRegisterSession={(apt, trackingFamily, plantillaCodigo) => {
          if (!companyId || !apt.customerId) return;
          setDetailOpen(false);
          setSessionContext({ appointment: apt, trackingFamily, plantillaCodigo });
        }}
        onOpenQuestionnaire={async (apt) => {
          if (!companyId || !apt.customerId) return;
          try {
            const q = await createQuestionnaire({
              customerId: apt.customerId,
              companyId,
              appointmentId: apt.id,
            });
            setDetailOpen(false);
            openQuestionnaireKiosk(q.id);
            toast({ title: 'Cuestionario abierto en tablet (modo cliente)' });
          } catch (e) {
            toast({
              title: e instanceof Error ? e.message : 'Error',
              variant: 'destructive',
            });
          }
        }}
      />

      {consentSignContext ? (
        <ConsentimientoSignDialog
          open={!!consentSignContext}
          onOpenChange={(o) => !o && setConsentSignContext(null)}
          context={consentSignContext}
        />
      ) : null}

      {sessionContext && companyId && sessionContext.appointment.customerId ? (
        <TreatmentSessionDialog
          open={!!sessionContext}
          onOpenChange={(o) => !o && setSessionContext(null)}
          customerId={sessionContext.appointment.customerId}
          companyId={companyId}
          customerName={sessionContext.appointment.clientName}
          trackingFamily={sessionContext.trackingFamily}
          tratamiento={sessionContext.appointment.serviceName ?? 'Tratamiento'}
          plantillaCodigo={sessionContext.plantillaCodigo}
          appointmentId={sessionContext.appointment.id}
          appointmentDate={sessionContext.appointment.date}
          employeeId={sessionContext.appointment.employeeId}
        />
      ) : null}

      {suiteEdit ? (
        <DunasoftSuiteAppointmentPopup
          styleAppointment={suiteEdit.styleApt}
          suiteRow={suiteEdit.suiteRow}
          fallbackDateYmd={selectedDateYmd}
          onClose={() => setSuiteEdit(null)}
          returnCustomerId={returnCustomerId}
          onReturnToCustomerHistory={
            returnCustomerId ? handleReturnToCustomerHistory : undefined
          }
        />
      ) : null}

      {formMode === 'create' && formSlot && createSuiteEmployeeId ? (
        <AppointmentForm
          employeeId={createSuiteEmployeeId}
          time={formSlot.time}
          defaultDate={selectedDateYmd}
          employees={suiteEmployeesForForm}
          cabinas={cabinas.data || []}
          recursos={recursos.data || []}
          dayAppointments={appointments}
          saving={createSaving || createAppointment.isPending}
          onSave={handleSuiteCreateSave}
          onCancel={closeForm}
        />
      ) : null}

      {formMode === 'edit' && formSlot && editTarget ? (
        <DunasoftAppointmentForm
          mode="edit"
          employeeId={formSlot.employeeId}
          employees={employees}
          defaultDate={editTarget.date}
          startTime={editTarget.startTime}
          idplan={editTarget.id}
          initial={appointmentToFormValues(editTarget)}
          saving={updateMutation.isPending || openingAppointment}
          onSave={handleEditSave}
          onCancel={closeForm}
        />
      ) : null}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cita en Style y Suite?</AlertDialogTitle>
            <AlertDialogDescription>
              Se registrará incidencia BORRAR en planinc, se borrará plan2009/planart y se encolará la
              escritura en DBF. Esta acción no se puede deshacer en Style.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMutation.isPending}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
