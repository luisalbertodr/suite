import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, addDays, subDays, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
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
import { useDunasoftAgendaDay } from '@/hooks/useDunasoftAgendaDay';
import { useDunasoftAppointmentMutations } from '@/hooks/useDunasoftAppointmentMutations';
import { useDunasoftSyncStatus } from '@/hooks/useDunasoftSyncStatus';
import { useStyleSyncAgentStatus } from '@/hooks/useStyleSyncAgentStatus';
import { useAgendaInboundSyncRefetch } from '@/hooks/useAgendaInboundSyncRefetch';
import { buildAgendaSyncBadge } from '@/lib/agendaSyncBadge';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';
import {
  loadInitialAgendaDateYmd,
  loadAgendaViewPersisted,
  mergePersistedLastDate,
  saveAgendaViewPersisted,
} from '@/lib/agendaViewPersistence';
import { DEFAULT_AGENDA_CENTER_HOURS } from '@/lib/agendaHours';
import type { Appointment } from '@/types/agenda';
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
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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

  const selectedDateYmd = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

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

  const { data, isLoading, isError, error, refetch, isFetching, isDayLoading, isDayRefreshing } =
    useDunasoftAgendaDay(selectedDateYmd, companyId);
  useAgendaInboundSyncRefetch(companyId, refetch, selectedDateYmd);
  const showInitialSkeleton = isLoading && !data;
  const { createMutation, updateMutation, deleteMutation } = useDunasoftAppointmentMutations(selectedDateYmd);
  const { data: syncStatus } = useDunasoftSyncStatus(20_000);
  const { data: styleSync } = useStyleSyncAgentStatus(companyId, 25_000);

  const syncBadge = useMemo(
    () => buildAgendaSyncBadge(syncStatus, styleSync),
    [syncStatus, styleSync],
  );

  const employees = data?.employees ?? [];
  const appointments = data?.appointments ?? [];
  const employeeAgendaById = data?.employeeAgendaById ?? {};

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const aptId = params.get('appointment');
    if (!aptId || !appointments.length) return;
    const apt = appointments.find((a) => a.id === aptId);
    if (!apt) return;
    setDetailAppointment(apt);
    setDetailOpen(true);
    params.delete('appointment');
    navigate(
      { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
      { replace: true },
    );
  }, [appointments, location.pathname, location.search, navigate]);

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
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          Actualizar
        </Button>
      </>
    ),
    [datePickerOpen, isFetching, refetch, selectAgendaDate, selectedDate, syncBadge],
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

  const handleAppointmentClick = useCallback((apt: Appointment) => {
    setDetailAppointment(apt);
    setDetailOpen(true);
  }, []);

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
  };

  const handleCreateSave = (values: DunasoftAppointmentFormValues) => {
    createMutation.mutate(values, { onSuccess: () => closeForm() });
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
            isDayLoading || isDayRefreshing ? 'opacity-60 pointer-events-none' : ''
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
          setFormMode('edit');
          setEditTarget(apt);
          setFormSlot({ employeeId: apt.employeeId, time: apt.startTime });
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

      {formMode === 'create' && formSlot ? (
        <DunasoftAppointmentForm
          mode="create"
          employeeId={formSlot.employeeId}
          employees={employees}
          defaultDate={selectedDateYmd}
          startTime={formSlot.time}
          saving={createMutation.isPending}
          onSave={handleCreateSave}
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
          saving={updateMutation.isPending}
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
