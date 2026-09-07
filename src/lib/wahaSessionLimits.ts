export type WahaMessageCapping = {
  cappingStatus?: string;
  totalQuota?: number;
  usedQuota?: number;
  cycleStart?: number;
  cycleEnd?: number;
};

export type WahaReachoutTimelock = {
  enforcementType?: string;
  isActive?: boolean;
  timeEnforcementEnds?: number | null;
};

export type WahaSessionLimits = {
  ok?: boolean;
  capping: WahaMessageCapping | null;
  timelock: WahaReachoutTimelock | null;
  supported?: boolean;
  limits_supported?: boolean;
};

export function formatWahaUnixDate(
  ts: number | null | undefined,
  timeZone = 'Europe/Madrid',
): string {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(ts * 1000));
}

export type SessionLimitAlert = {
  severity: 'warning' | 'critical';
  title: string;
  description: string;
};

export function buildSessionLimitAlerts(
  limits: WahaSessionLimits | null | undefined,
): SessionLimitAlert[] {
  if (!limits) return [];
  const alerts: SessionLimitAlert[] = [];

  const cappingStatus = (limits.capping?.cappingStatus ?? '').toUpperCase();
  if (cappingStatus && cappingStatus !== 'OK') {
    const used = limits.capping?.usedQuota;
    const total = limits.capping?.totalQuota;
    const quotaText =
      typeof used === 'number' && typeof total === 'number'
        ? `${used} / ${total} contactos nuevos en este ciclo.`
        : '';
    const cycleEnd = formatWahaUnixDate(limits.capping?.cycleEnd);

    if (cappingStatus === 'CAPPED' || cappingStatus.includes('CAP')) {
      alerts.push({
        severity: 'critical',
        title: 'Cuota de contactos nuevos agotada',
        description: `WhatsApp ha limitado los envíos a contactos nuevos (error 475). ${quotaText} El ciclo se renueva el ${cycleEnd}. No reinicies la sesión.`,
      });
    } else if (cappingStatus.includes('WARNING')) {
      alerts.push({
        severity: 'warning',
        title: 'Advertencia de cuota de contactos',
        description: `Te acercas al límite de mensajes a contactos nuevos. ${quotaText} Ciclo hasta el ${cycleEnd}.`,
      });
    } else {
      alerts.push({
        severity: 'warning',
        title: `Estado de cuota: ${cappingStatus}`,
        description: quotaText || 'Revisa el uso de mensajes a contactos nuevos.',
      });
    }
  }

  if (limits.timelock?.isActive) {
    const ends = formatWahaUnixDate(limits.timelock.timeEnforcementEnds);
    alerts.push({
      severity: 'critical',
      title: 'Restricción temporal de alcance (timelock)',
      description: `No puedes escribir a contactos nuevos hasta el ${ends}. La sesión sigue conectada: no la reinicies ni cierres sesión (error 463).`,
    });
  }

  return alerts;
}
