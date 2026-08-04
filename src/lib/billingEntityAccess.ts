import {
  ESTETICA_COMPANY_ID,
  MEDICINA_COMPANY_ID,
} from '@/lib/workCenterBilling';
import type { BillingEntityView } from '@/lib/salesRevenue';

/** Empresas del centro con asignación explícita al usuario (`is_assigned`). */
export function assignedCompanyIds(
  companies: Array<{ id: string; is_assigned?: boolean | null }>,
): string[] {
  return companies.filter((c) => c.is_assigned).map((c) => c.id);
}

/**
 * Vistas de facturación Dashboard permitidas según empresas asignadas.
 * Un usuario solo de Medicina no ve Ambas/Estética.
 */
export function resolveAllowedBillingViews(
  assignedIds: string[],
): BillingEntityView[] {
  const hasMedicina = assignedIds.includes(MEDICINA_COMPANY_ID);
  const hasEstetica = assignedIds.includes(ESTETICA_COMPANY_ID);

  if (hasMedicina && hasEstetica) return ['both', 'medicina', 'estetica'];
  if (hasMedicina) return ['medicina'];
  if (hasEstetica) return ['estetica'];
  return ['both'];
}

export function defaultBillingViewForAssigned(
  assignedIds: string[],
): BillingEntityView {
  return resolveAllowedBillingViews(assignedIds)[0] ?? 'both';
}

export function clampBillingView(
  view: BillingEntityView,
  assignedIds: string[],
): BillingEntityView {
  const allowed = resolveAllowedBillingViews(assignedIds);
  return allowed.includes(view) ? view : (allowed[0] ?? 'both');
}
