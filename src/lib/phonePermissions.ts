/** Permiso: ver todas las llamadas (entrantes, salientes y perdidas). */
export const PHONE_PERMISSION_ALL = { resource: 'phone', action: 'read' } as const;

/** Permiso: ver solo llamadas perdidas y sus grabaciones. */
export const PHONE_PERMISSION_MISSED = { resource: 'phone', action: 'read_missed' } as const;

export type PhoneCallsScope = 'all' | 'missed' | 'none';

export function canAccessPhone(hasPermission: (resource: string, action: string) => boolean): boolean {
  return (
    hasPermission(PHONE_PERMISSION_ALL.resource, PHONE_PERMISSION_ALL.action) ||
    hasPermission(PHONE_PERMISSION_MISSED.resource, PHONE_PERMISSION_MISSED.action)
  );
}

export function getPhoneCallsScope(hasPermission: (resource: string, action: string) => boolean): PhoneCallsScope {
  if (hasPermission(PHONE_PERMISSION_ALL.resource, PHONE_PERMISSION_ALL.action)) return 'all';
  if (hasPermission(PHONE_PERMISSION_MISSED.resource, PHONE_PERMISSION_MISSED.action)) return 'missed';
  return 'none';
}
