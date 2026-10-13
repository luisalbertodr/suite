/** F5 — URLs públicas opcionales del stack Inngest / suite-jobs. */

export function getInngestUiUrl(): string {
  return (import.meta.env.VITE_INNGEST_UI_URL as string | undefined)?.trim() || '';
}

export function getSuiteJobsHealthUrl(): string {
  return (import.meta.env.VITE_SUITE_JOBS_HEALTH_URL as string | undefined)?.trim() || '';
}

export function isInngestConfigured(): boolean {
  return getInngestUiUrl().length > 0 || getSuiteJobsHealthUrl().length > 0;
}
