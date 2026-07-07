import type { Appointment, Employee } from '@/types/agenda';
import type { AppointmentTimeSegment } from '@/types/agenda';
import { employeeTailwindColor } from '@/lib/dunasoftColors';
import { normLegacyCodcli } from '@/lib/appointmentCustomerResolve';

export type DunasoftPlan2009Row = {
  _row_id: number;
  idplan: number | string | null;
  codemp: string | null;
  codcli: string | null;
  fecha: string | null;
  horini: string | null;
  horfin: string | null;
  texto: string | null;
  nomcli: string | null;
  tel1cli: string | null;
  colfon: number | null;
  collet: number | null;
  facturado: boolean | null;
  codrec: string | null;
};

export type DunasoftEmpleadoRow = {
  codemp: string;
  nomemp: string | null;
  ape1emp: string | null;
  ape2emp: string | null;
  verplan: boolean | null;
  ordplan: number | string | null;
  obsoleto: boolean | null;
  colorpf: number | null;
  colorpl: number | null;
};

export type DunasoftPlanArtRow = {
  idplan: number | string | null;
  codart: string | null;
  hora: string | null;
};

export function normalizeCodemp(code: string | null | undefined): string {
  const c = String(code ?? '').trim();
  return c.replace(/^0+/, '') || c || '0';
}

export function employeeDisplayName(row: DunasoftEmpleadoRow): string {
  const parts = [row.nomemp, row.ape1emp, row.ape1emp ? row.ape2emp : null].filter(Boolean);
  const name = parts.map((p) => String(p).trim()).filter(Boolean).join(' ');
  return name || String(row.codemp).trim();
}

function hasRealEmployeeName(row: DunasoftEmpleadoRow): boolean {
  return [row.nomemp, row.ape1emp, row.ape2emp].some((part) => String(part ?? '').trim().length > 0);
}

export function normHHMM(raw: string | null | undefined, fallback = '09:00'): string {
  const t = String(raw ?? '').trim();
  if (!t) return fallback;
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':');
    return `${h!.padStart(2, '0')}:${m}`;
  }
  if (/^\d{3,4}$/.test(t)) {
    const p = t.padStart(4, '0');
    return `${p.slice(0, 2)}:${p.slice(2)}`;
  }
  return fallback;
}

export function mapDunasoftEmployees(rows: DunasoftEmpleadoRow[]): Employee[] {
  return rows
    .filter((r) => r.obsoleto !== true && r.verplan !== false && hasRealEmployeeName(r))
    .sort((a, b) => {
      const oa = Number(a.ordplan ?? 0);
      const ob = Number(b.ordplan ?? 0);
      if (oa !== ob) return oa - ob;
      return employeeDisplayName(a).localeCompare(employeeDisplayName(b), 'es');
    })
    .map((r) => ({
      id: String(r.codemp).trim(),
      name: employeeDisplayName(r),
      color: employeeTailwindColor(String(r.codemp).trim(), r.colorpf),
    }));
}

function planArtLabel(row: DunasoftPlanArtRow, articles: Map<string, string>): string {
  const code = String(row.codart ?? '').trim();
  const des = articles.get(code) ?? code;
  return code ? `${code} - ${des}` : des;
}

export function mapPlanArtToSegments(
  planArt: DunasoftPlanArtRow[],
  articles: Map<string, string>,
  fallbackEnd: string
): AppointmentTimeSegment[] {
  const sorted = [...planArt].sort((a, b) => normHHMM(a.hora).localeCompare(normHHMM(b.hora)));
  const segments: AppointmentTimeSegment[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i]!;
    const startTime = normHHMM(row.hora);
    const next = sorted[i + 1];
    const endTime = next ? normHHMM(next.hora) : fallbackEnd;
    segments.push({
      clientKey: `${row.codart}-${startTime}-${i}`,
      label: planArtLabel(row, articles),
      kind: 'service',
      startTime,
      endTime,
      durationMinutes: 0,
    });
  }
  return segments;
}

export function attachCustomerIdsToAppointments(
  appointments: Appointment[],
  legacyToCustomerId: Map<string, string>,
): Appointment[] {
  return appointments.map((apt) => {
    if (apt.customerId || !apt.legacyClientCode) return apt;
    const customerId = legacyToCustomerId.get(normLegacyCodcli(apt.legacyClientCode)) ?? null;
    return customerId ? { ...apt, customerId } : apt;
  });
}

export function mapPlan2009ToAppointments(
  plans: DunasoftPlan2009Row[],
  employees: Employee[],
  planArtByPlan: Map<string, DunasoftPlanArtRow[]>,
  articles: Map<string, string>
): Appointment[] {
  const empByNorm = new Map<string, string>();
  for (const e of employees) {
    empByNorm.set(normalizeCodemp(e.id), e.id);
  }

  return plans
    .map((p) => {
      const codempRaw = String(p.codemp ?? '').trim();
      const employeeId =
        empByNorm.get(normalizeCodemp(codempRaw)) ??
        employees.find((e) => normalizeCodemp(e.id) === normalizeCodemp(codempRaw))?.id ??
        codempRaw;
      if (!employeeId) return null;

      const startTime = normHHMM(p.horini);
      const endTime = normHHMM(p.horfin, startTime);
      const idplan = p.idplan != null ? String(p.idplan).trim() : String(p._row_id);
      const artRows = planArtByPlan.get(idplan) ?? [];
      const timeSegments =
        artRows.length > 0
          ? mapPlanArtToSegments(artRows, articles, endTime)
          : [
              {
                clientKey: `${idplan}-block`,
                label: String(p.texto ?? '').trim() || 'Cita',
                kind: 'service' as const,
                startTime,
                endTime,
                durationMinutes: 0,
              },
            ];

      const serviceLine = artRows.length
        ? artRows
            .map((a) => planArtLabel(a, articles))
            .slice(0, 2)
            .join(' · ')
        : undefined;

      return {
        id: idplan,
        employeeId,
        clientName: String(p.nomcli ?? '').trim() || 'Sin nombre',
        clientPhone: String(p.tel1cli ?? '').trim() || undefined,
        customerId: null,
        description: String(p.texto ?? '').trim(),
        serviceName: serviceLine,
        legacyClientCode: p.codcli != null ? String(p.codcli).trim() : undefined,
        legacyEmployeeCode: codempRaw,
        legacyPlanincId: null,
        startTime,
        endTime,
        date: String(p.fecha ?? '').slice(0, 10),
        color: employees.find((e) => e.id === employeeId)?.color ?? '',
        timeSegments: timeSegments.length ? timeSegments : undefined,
        occupiedEndTime: endTime,
        status: 'confirmed' as const,
        paymentStatus: p.facturado ? ('paid' as const) : ('none' as const),
      } satisfies Appointment;
    })
    .filter((a): a is Appointment => a != null);
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
