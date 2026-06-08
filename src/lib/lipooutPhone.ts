import type { PhoneCallsScope } from '@/lib/phonePermissions';

/** Teléfono público, grupo de llamadas y extensiones internas Lipoout (no mostrar como cliente). */
export const LIPOOUT_INFRA_DIGITS = new Set(['881242909', '100', '1001', '1002']);

export const LIPOOUT_VOICEMAIL_IDS = new Set(['vms1002', 'vms102']);

export type CallDisplayType = 'outbound' | 'inbound' | 'missed' | 'voicemail';

export const callDisplayLabels: Record<CallDisplayType, string> = {
  outbound: 'Saliente',
  inbound: 'Entrante',
  missed: 'Perdida',
  voicemail: 'Buzón de voz',
};

export const callDisplayClasses: Record<CallDisplayType, string> = {
  outbound: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  inbound: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  missed: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  voicemail: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
};

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function isLipooutInfra(value: string | null | undefined): boolean {
  const raw = (value ?? '').trim();
  if (!raw) return false;
  if (LIPOOUT_VOICEMAIL_IDS.has(raw.toLowerCase())) return true;
  return LIPOOUT_INFRA_DIGITS.has(digitsOnly(raw));
}

export function isExternalCustomerPhone(value: string | null | undefined): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 9) return false;
  return !LIPOOUT_INFRA_DIGITS.has(digits);
}

export function getCallDisplayType(call: {
  direction: string;
  missed_reason?: string | null;
  display_type?: string | null;
}): CallDisplayType {
  if (call.display_type === 'voicemail' || call.missed_reason === 'voicemail') return 'voicemail';
  if (call.direction === 'outbound') return 'outbound';
  if (call.direction === 'inbound') return 'inbound';
  return 'missed';
}

export function callRecordingSource(call: {
  recording_path?: string | null;
  recording_url?: string | null;
}): string | null {
  return call.recording_path || call.recording_url || null;
}

export function canListenCallRecording(
  phoneScope: PhoneCallsScope,
  call: {
    missed_reason?: string | null;
    display_type?: string | null;
    recording_path?: string | null;
    recording_url?: string | null;
    can_listen_recording?: boolean;
    duration_seconds?: number;
    id?: string;
  },
): boolean {
  if (typeof call.can_listen_recording === 'boolean') return call.can_listen_recording;
  const hasRecording = !!callRecordingSource(call) ||
    (phoneScope === 'all' && (call.duration_seconds ?? 0) > 0 && !!call.id);
  if (!hasRecording) return false;
  if (phoneScope === 'all') return true;
  if (phoneScope === 'missed') return getCallDisplayType(call) === 'voicemail';
  return false;
}