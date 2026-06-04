import { cloneItemsForNewAppointment } from '@/lib/appointmentLifecycle';
import { effectiveDurationMinutes } from '@/lib/agendaAppointmentItems';
import type { AppointmentItemDraft } from '@/types/agenda';

export type AgendaAppointmentClipboardMode = 'copy' | 'cut';

export type AgendaAppointmentClipboardPayload = {
  mode: AgendaAppointmentClipboardMode;
  sourceAppointmentId: string;
  sourceDateYmd: string;
  customerId: string | null;
  clientName: string;
  description: string;
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  items: AppointmentItemDraft[];
  occupiedMinutes: number;
};

const STORAGE_KEY = 'suite:agenda:appointment-clipboard';

export function saveAgendaAppointmentClipboard(payload: AgendaAppointmentClipboardPayload): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function loadAgendaAppointmentClipboard(): AgendaAppointmentClipboardPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgendaAppointmentClipboardPayload;
    if (!parsed?.sourceAppointmentId || !parsed.mode) return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAgendaAppointmentClipboard(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function prepareItemsForPaste(
  items: AppointmentItemDraft[],
  mode: AgendaAppointmentClipboardMode,
): AppointmentItemDraft[] {
  const cloned = cloneItemsForNewAppointment(items);
  if (mode === 'cut') return cloned;
  return cloned.map((it) => ({
    ...it,
    bono_id: null,
    customer_voucher_id: null,
    bono_coverage_index: null,
  }));
}

export function buildClipboardPayload(input: {
  mode: AgendaAppointmentClipboardMode;
  sourceAppointmentId: string;
  sourceDateYmd: string;
  customerId: string | null;
  clientName: string;
  description: string;
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  items: AppointmentItemDraft[];
}): AgendaAppointmentClipboardPayload {
  return {
    ...input,
    occupiedMinutes: effectiveDurationMinutes(input.items),
  };
}
