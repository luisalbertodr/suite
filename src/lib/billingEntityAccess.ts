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

export function billingViewFromCompanyId(companyId: string | null | undefined): BillingEntityView | null {
  if (!companyId) return null;
  if (companyId === MEDICINA_COMPANY_ID) return 'medicina';
  if (companyId === ESTETICA_COMPANY_ID) return 'estetica';
  return null;
}

export type BillingViewAccessOptions = {
  /** Vista «Ambas» (M+E combinadas): solo administradores / superuser. */
  canSeeCombined?: boolean;
};

/**
 * Vistas de facturación Dashboard permitidas.
 * - Ambas solo si `canSeeCombined` y el usuario tiene M y E asignadas.
 * - El resto solo ve las empresas a las que está asignado.
 */
export function resolveAllowedBillingViews(
  assignedIds: string[],
  options?: BillingViewAccessOptions,
): BillingEntityView[] {
  const hasMedicina = assignedIds.includes(MEDICINA_COMPANY_ID);
  const hasEstetica = assignedIds.includes(ESTETICA_COMPANY_ID);
  const canSeeCombined = Boolean(options?.canSeeCombined);

  if (hasMedicina && hasEstetica) {
    return canSeeCombined ? ['both', 'medicina', 'estetica'] : ['medicina', 'estetica'];
  }
  if (hasMedicina) return ['medicina'];
  if (hasEstetica) return ['estetica'];
  return canSeeCombined ? ['both'] : ['estetica'];
}

export function defaultBillingViewForAssigned(
  assignedIds: string[],
  options?: BillingViewAccessOptions & { activeCompanyId?: string | null },
): BillingEntityView {
  const allowed = resolveAllowedBillingViews(assignedIds, options);
  const fromActive = billingViewFromCompanyId(options?.activeCompanyId ?? null);
  if (fromActive && allowed.includes(fromActive)) return fromActive;
  // No-admins: prefer single-entity default, never Ambas.
  if (!options?.canSeeCombined) {
    const single = allowed.find((v) => v !== 'both');
    if (single) return single;
  }
  return allowed[0] ?? 'both';
}

export function clampBillingView(
  view: BillingEntityView,
  assignedIds: string[],
  options?: BillingViewAccessOptions,
): BillingEntityView {
  const allowed = resolveAllowedBillingViews(assignedIds, options);
  return allowed.includes(view) ? view : (allowed[0] ?? 'both');
}
