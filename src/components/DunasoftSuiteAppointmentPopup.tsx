import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EditAppointmentForm } from '@/components/EditAppointmentForm';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { useAgendaAppointments } from '@/hooks/useAgendaAppointments';
import { useCabinas, useRecursos } from '@/hooks/useRecursosCabinas';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  AGENDA_APPOINTMENT_DAY_SELECT,
  type AgendaAppointmentDayRow,
} from '@/lib/agendaAppointmentsQuery';
import { repairStyleText } from '@/lib/styleTextEncoding';
import { fetchCatalogCustomers } from '@/lib/customerSearch';
import {
  appointmentItemsQueryKey,
  syncAppointmentItems,
} from '@/hooks/useAppointmentItems';
import { syncAgendaAppointmentToStyle, deleteDunasoftAppointmentDual } from '@/lib/dunasoftDualWriteApi';
import {
  cancelAppointmentWithRefund,
  deleteOpenAppointment,
  describeCancelRefundResult,
  isAppointmentFinanciallyClosed,
} from '@/lib/appointmentLifecycle';
import {
  appointmentChargeableTotal,
  canChargeAppointment,
  fetchAppointmentSales,
} from '@/lib/appointmentSales';
import { appointmentItemLineTotal } from '@/lib/agendaAppointmentPricing';
import { resolveBillingCompanyId, buildFamilyBillingMap } from '@/lib/billingCompany';
import { useFamilies } from '@/hooks/useFamilies';
import type { Appointment, AppointmentItemDraft } from '@/types/agenda';

function normalizeAgendaTime(value?: string | null): string {
  if (!value) return '';
  const str = String(value);
  if (str.includes('T')) {
    const part = str.split('T')[1] || '';
    const hh = part.substring(0, 2);
    const mm = part.substring(3, 5);
    if (/^\d{2}$/.test(hh) && /^\d{2}$/.test(mm)) return `${hh}:${mm}`;
  }
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (match) return `${match[1]!.padStart(2, '0')}:${match[2]}`;
  return str.substring(0, 5);
}

function normalizeAgendaDate(
  start: string | null | undefined,
  legacyDate: string | null | undefined,
  fallbackDateYmd: string,
): string {
  if (start && String(start).includes('T')) return String(start).split('T')[0]!;
  return legacyDate ? String(legacyDate) : fallbackDateYmd;
}

function mapSuiteRowToAppointment(
  row: AgendaAppointmentDayRow,
  styleApt: Appointment,
  fallbackDateYmd: string,
): Appointment {
  const status = (['confirmed', 'pending', 'cancelled'].includes(row.status)
    ? row.status
    : 'pending') as Appointment['status'];
  return {
    id: row.id,
    employeeId: row.employee_id || '',
    clientName: repairStyleText(row.client_name || styleApt.clientName || ''),
    customerId: row.customer_id ?? styleApt.customerId ?? null,
    description: repairStyleText(row.description || styleApt.description || ''),
    startTime: normalizeAgendaTime(row.start_time) || styleApt.startTime,
    endTime: normalizeAgendaTime(row.end_time) || styleApt.endTime,
    date: normalizeAgendaDate(row.start_time, row.appointment_date, fallbackDateYmd),
    color: row.color || styleApt.color || '#3B82F6',
    status,
    legacyIdPlan: row.legacy_idplan != null ? String(row.legacy_idplan).trim() || null : styleApt.id,
    legacyClientCode: row.legacy_codcli || styleApt.legacyClientCode || null,
    legacyEmployeeCode: row.legacy_codemp || styleApt.legacyEmployeeCode || null,
    clientPhone: styleApt.clientPhone ?? null,
    paymentStatus: styleApt.paymentStatus,
  };
}

export async function fetchSuiteAppointmentByLegacyIdPlan(
  companyId: string,
  idplan: string,
): Promise<AgendaAppointmentDayRow | null> {
  const key = String(idplan).trim();
  if (!key) return null;
  // Columnas legacy_* / client_name no siempre están en el tipado generado.
  const { data, error } = await (supabase.from('agenda_appointments') as any)
    .select(AGENDA_APPOINTMENT_DAY_SELECT)
    .eq('company_id', companyId)
    .eq('legacy_idplan', key)
    .maybeSingle();
  if (error) throw error;
  return (data as AgendaAppointmentDayRow | null) ?? null;
}

export async function fetchSuiteAppointmentById(
  companyId: string,
  appointmentId: string,
): Promise<AgendaAppointmentDayRow | null> {
  const key = String(appointmentId).trim();
  if (!key) return null;
  const { data, error } = await (supabase.from('agenda_appointments') as any)
    .select(AGENDA_APPOINTMENT_DAY_SELECT)
    .eq('company_id', companyId)
    .eq('id', key)
    .maybeSingle();
  if (error) throw error;
  return (data as AgendaAppointmentDayRow | null) ?? null;
}

/** Cita Style mínima a partir del gemelo Suite (cuando no está en la grid del día). */
export function styleAppointmentFromSuiteRow(
  row: AgendaAppointmentDayRow,
  fallbackDateYmd: string,
): Appointment {
  const idplan = row.legacy_idplan != null ? String(row.legacy_idplan).trim() : '';
  return {
    id: idplan || row.id,
    employeeId: row.employee_id || '',
    clientName: repairStyleText(row.client_name || row.title || ''),
    customerId: row.customer_id ?? null,
    description: repairStyleText(row.description || ''),
    startTime: normalizeAgendaTime(row.start_time) || '09:00',
    endTime: normalizeAgendaTime(row.end_time) || '09:30',
    date: normalizeAgendaDate(row.start_time, row.appointment_date, fallbackDateYmd),
    color: row.color || '#3B82F6',
    status: (['confirmed', 'pending', 'cancelled'].includes(row.status)
      ? row.status
      : 'pending') as Appointment['status'],
    legacyIdPlan: idplan || null,
    legacyClientCode: row.legacy_codcli || null,
    legacyEmployeeCode: row.legacy_codemp || null,
    clientPhone: null,
  };
}

type Props = {
  styleAppointment: Appointment;
  suiteRow: AgendaAppointmentDayRow;
  fallbackDateYmd: string;
  onClose: () => void;
  onDeleted?: () => void;
  returnCustomerId?: string | null;
  onReturnToCustomerHistory?: () => void;
};

/**
 * Popup de Agenda Suite (EditAppointmentForm) abierto desde Agenda Style
 * cuando la cita tiene gemelo en `agenda_appointments.legacy_idplan`.
 */
export const DunasoftSuiteAppointmentPopup: React.FC<Props> = ({
  styleAppointment,
  suiteRow,
  fallbackDateYmd,
  onClose,
  onDeleted,
  returnCustomerId,
  onReturnToCustomerHistory,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useCompanyFilter();
  const { operationalCompanyId } = useWorkCenter();
  const opCompanyId = operationalCompanyId ?? companyId;
  const { employees: dbEmployees = [] } = useAgendaEmployees({ agendaOnly: true });
  const { cabinas } = useCabinas();
  const { recursos } = useRecursos();
  const { updateAppointment } = useAgendaAppointments(fallbackDateYmd);
  const { families: familyRecords } = useFamilies({ scope: 'all' });
  const familyBillingMap = useMemo(
    () =>
      buildFamilyBillingMap(
        familyRecords.map((f) => ({ name: f.name, billing_company_id: f.billing_company_id })),
      ),
    [familyRecords],
  );

  const [saving, setSaving] = useState(false);
  const [appointment, setAppointment] = useState(() =>
    mapSuiteRowToAppointment(suiteRow, styleAppointment, fallbackDateYmd),
  );

  const employees = useMemo(
    () =>
      dbEmployees.map((e) => ({
        id: e.id,
        name: e.name,
        color: e.color || '#3B82F6',
        billing_company_id: e.billing_company_id,
      })),
    [dbEmployees],
  );

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', opCompanyId, 'agenda-picker-style-bridge'],
    queryFn: async () => {
      if (!opCompanyId) return [];
      return fetchCatalogCustomers(supabase, opCompanyId);
    },
    enabled: !!opCompanyId,
    staleTime: 5 * 60_000,
  });

  const invalidateDays = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['dunasoft-agenda-day', fallbackDateYmd, companyId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['agenda-appointments', fallbackDateYmd, companyId],
    });
    await queryClient.invalidateQueries({ queryKey: ['appointment-time-segments'] });
    await queryClient.invalidateQueries({ queryKey: ['agenda-day-payment-status'] });
  };

  const handleSave = async (updated: Appointment, items: AppointmentItemDraft[]) => {
    setSaving(true);
    try {
      const paidLocked = isAppointmentFinanciallyClosed(appointment.paymentStatus);
      await updateAppointment.mutateAsync({
        id: updated.id,
        employee_id: paidLocked ? appointment.employeeId : updated.employeeId,
        customer_id: paidLocked ? appointment.customerId ?? null : updated.customerId ?? null,
        title: paidLocked ? appointment.clientName : updated.clientName,
        description: updated.description,
        start_time: paidLocked
          ? `${appointment.date}T${appointment.startTime}:00`
          : `${updated.date}T${updated.startTime}:00`,
        end_time: paidLocked
          ? `${appointment.date}T${appointment.endTime}:00`
          : `${updated.date}T${updated.endTime}:00`,
        color: paidLocked ? appointment.color : updated.color,
        status: updated.status,
      });
      if (!paidLocked) {
        try {
          await syncAppointmentItems(updated.id, items);
          await queryClient.invalidateQueries({ queryKey: appointmentItemsQueryKey(updated.id) });
          await syncAgendaAppointmentToStyle(updated.id);
        } catch (e) {
          console.error('appointment_items / style sync', e);
          toast({
            title: 'Cita actualizada, pero no se sincronizaron todos los ítems',
            description: (e as Error)?.message || 'Revisa los ítems y vuelve a guardar.',
            variant: 'destructive',
          });
        }
      }
      setAppointment({ ...appointment, ...updated });
      await invalidateDays();
      onClose();
    } catch (error) {
      console.error('Error updating suite appointment from Style agenda:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (appointmentId: string) => {
    if (isAppointmentFinanciallyClosed(appointment.paymentStatus)) {
      toast({
        title: 'Cita cerrada',
        description: 'Usa «Cancelar y devolver» para conservar el historial.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const idplan = appointment.legacyIdPlan?.trim() || styleAppointment.id;
      if (idplan) {
        await deleteDunasoftAppointmentDual(idplan);
      } else {
        await deleteOpenAppointment(appointmentId);
      }
      await invalidateDays();
      onDeleted?.();
      onClose();
    } catch (error) {
      toast({
        title: 'Error al eliminar cita',
        description: (error as Error)?.message || 'No se pudo eliminar la cita.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelAndRefund = async (appointmentId: string) => {
    if (!window.confirm('¿Cancelar la cita y gestionar la devolución de cobros?')) return;
    try {
      const result = await cancelAppointmentWithRefund(appointmentId, {
        reason: 'cancelacion_cita_agenda_style',
      });
      const toastMsg = describeCancelRefundResult(result, isAppointmentFinanciallyClosed(appointment.paymentStatus));
      toast({
        title: toastMsg.title,
        description: toastMsg.description,
        variant: toastMsg.variant,
      });
      await invalidateDays();
      onClose();
    } catch (error) {
      toast({
        title: 'Error al cancelar',
        description: (error as Error)?.message || 'No se pudo cancelar la cita.',
        variant: 'destructive',
      });
    }
  };

  const handleCharge = async (apt: Appointment, items: AppointmentItemDraft[]) => {
    const chargeableTotal = appointmentChargeableTotal(items);
    const existingSales = await fetchAppointmentSales(apt.id);
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
    let articlesMap = new Map<
      string,
      { familia: string; billing_company_id?: string | null; company_id?: string | null }
    >();
    if (articleIds.length && companyId) {
      const { data } = await (supabase.from('articles') as any)
        .select('id, familia, billing_company_id, company_id')
        .in('id', articleIds);
      articlesMap = new Map(
        ((data ?? []) as Array<{
          id: string;
          familia: string;
          billing_company_id?: string | null;
          company_id?: string | null;
        }>).map((a) => [a.id, a]),
      );
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

  return (
    <EditAppointmentForm
      appointment={appointment}
      employees={employees}
      customers={customers}
      cabinas={cabinas.data || []}
      recursos={recursos.data || []}
      saving={saving}
      paymentStatus={appointment.paymentStatus}
      onSave={handleSave}
      onCharge={handleCharge}
      onDelete={handleDelete}
      onCancelAndRefund={handleCancelAndRefund}
      onCancel={onClose}
      returnCustomerId={returnCustomerId}
      onReturnToCustomerHistory={onReturnToCustomerHistory}
    />
  );
};
