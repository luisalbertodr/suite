export function consentKioskPatientPath(consentId: string): string {
  return `/consentimiento/${consentId}/paciente`;
}

export function openConsentKiosk(consentId: string): void {
  window.open(consentKioskPatientPath(consentId), '_blank', 'noopener,noreferrer');
}
