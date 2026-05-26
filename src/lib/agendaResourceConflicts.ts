import type { Appointment, AppointmentItemDraft, AppointmentTimeSegment } from '@/types/agenda';
import { buildAppointmentTimeSegments, hhmmToMinutes, type BuildSegmentsOptions } from '@/lib/agendaAppointmentItems';

export function timeRangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const a0 = hhmmToMinutes(startA);
  const a1 = hhmmToMinutes(endA);
  const b0 = hhmmToMinutes(startB);
  const b1 = hhmmToMinutes(endB);
  return a0 < b1 && a1 > b0;
}

export type ScheduledResourceSlot = {
  appointmentId: string;
  clientName?: string;
  startTime: string;
  endTime: string;
  cabina_id?: string | null;
  recurso_id?: string | null;
};

export type ResourceConflictProbe = {
  clientKey: string;
  startTime: string;
  endTime: string;
  cabina_id?: string | null;
  recurso_id?: string | null;
};

export function collectResourceSlotsFromAppointments(
  appointments: Appointment[],
  excludeId?: string
): ScheduledResourceSlot[] {
  const slots: ScheduledResourceSlot[] = [];
  for (const apt of appointments) {
    if (excludeId && apt.id === excludeId) continue;
    const segs = apt.timeSegments ?? [];
    if (segs.length) {
      for (const seg of segs) {
        if (!seg.cabinaId && !seg.recursoId) continue;
        slots.push({
          appointmentId: apt.id,
          clientName: apt.clientName,
          startTime: seg.startTime,
          endTime: seg.endTime,
          cabina_id: seg.cabinaId,
          recurso_id: seg.recursoId,
        });
      }
      continue;
    }
    if (apt.cabina_id || apt.recurso_id) {
      slots.push({
        appointmentId: apt.id,
        clientName: apt.clientName,
        startTime: apt.startTime,
        endTime: apt.occupiedEndTime ?? apt.endTime,
        cabina_id: apt.cabina_id,
        recurso_id: apt.recurso_id,
      });
    }
  }
  return slots;
}

function probeConflictsWithSlots(
  probe: ResourceConflictProbe,
  slots: ScheduledResourceSlot[],
  excludeAppointmentId?: string
): string[] {
  const msgs: string[] = [];
  for (const slot of slots) {
    if (excludeAppointmentId && slot.appointmentId === excludeAppointmentId) continue;
    if (!timeRangesOverlap(probe.startTime, probe.endTime, slot.startTime, slot.endTime)) continue;
    const who = slot.clientName?.trim() || 'otra cita';
    if (probe.cabina_id && slot.cabina_id === probe.cabina_id) {
      msgs.push(`Cabina ocupada ${slot.startTime}–${slot.endTime} (${who})`);
    }
    if (probe.recurso_id && slot.recurso_id === probe.recurso_id) {
      msgs.push(`Recurso ocupado ${slot.startTime}–${slot.endTime} (${who})`);
    }
  }
  return msgs;
}

/** Detecta solapes de cabina/recurso entre sondas y citas existentes del mismo día. */
export function findItemResourceConflicts(
  date: string,
  probes: ResourceConflictProbe[],
  appointments: Appointment[],
  excludeAppointmentId?: string
): Map<string, string[]> {
  const sameDay = appointments.filter((a) => a.date === date);
  const existing = collectResourceSlotsFromAppointments(sameDay, excludeAppointmentId);
  const result = new Map<string, string[]>();

  for (let i = 0; i < probes.length; i += 1) {
    const probe = probes[i]!;
    const msgs = probeConflictsWithSlots(probe, existing, excludeAppointmentId);

    for (let j = 0; j < probes.length; j += 1) {
      if (i === j) continue;
      const other = probes[j]!;
      if (!timeRangesOverlap(probe.startTime, probe.endTime, other.startTime, other.endTime)) continue;
      if (probe.cabina_id && other.cabina_id === probe.cabina_id) {
        msgs.push(`Cabina duplicada en esta cita (${other.startTime}–${other.endTime})`);
      }
      if (probe.recurso_id && other.recurso_id === probe.recurso_id) {
        msgs.push(`Recurso duplicado en esta cita (${other.startTime}–${other.endTime})`);
      }
    }

    const unique = [...new Set(msgs)];
    if (unique.length) result.set(probe.clientKey, unique);
  }
  return result;
}

export function segmentsToConflictProbes(segments: AppointmentTimeSegment[]): ResourceConflictProbe[] {
  return segments.map((seg) => ({
    clientKey: seg.clientKey,
    startTime: seg.startTime,
    endTime: seg.endTime,
    cabina_id: seg.cabinaId,
    recurso_id: seg.recursoId,
  }));
}

export function checkAppointmentItemsResourceConflict(
  date: string,
  startTime: string,
  items: AppointmentItemDraft[],
  appointments: Appointment[],
  segmentOptions: BuildSegmentsOptions,
  excludeAppointmentId?: string
): { hasConflict: boolean; messages: string[] } {
  const segments = buildAppointmentTimeSegments(startTime, items, segmentOptions.recursos ?? [], segmentOptions);
  const probes = segmentsToConflictProbes(segments);
  const conflicts = findItemResourceConflicts(date, probes, appointments, excludeAppointmentId);
  const messages = [...conflicts.values()].flat();
  return { hasConflict: messages.length > 0, messages };
}
