/**
 * Resolución de empresa emisora (Centro Laboral / split billing).
 * Regla: artículo > familia > tenant por defecto.
 */

export type BillingCompanyOption = {
  id: string;
  name: string;
  short_name: string | null;
  tpv_ticket_prefix: string | null;
  tax_id: string | null;
};

export type ArticleBillingSource = {
  billing_company_id?: string | null;
  familia: string;
  company_id?: string | null;
};

export type FamilyBillingRow = {
  name: string;
  billing_company_id: string | null;
};

export type CartItemWithBilling = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  variationId?: string;
  size?: string;
  color?: string;
  billingCompanyId: string;
  sourceKind?: string;
  sourceBonusMode?: string | null;
};

export function resolveBillingCompanyId(
  article: ArticleBillingSource,
  familyBillingMap: Map<string, string | null>,
  defaultCompanyId: string,
): string {
  if (article.billing_company_id) return article.billing_company_id;
  const fromFamily = familyBillingMap.get(article.familia);
  if (fromFamily) return fromFamily;
  return article.company_id ?? defaultCompanyId;
}

export function buildFamilyBillingMap(families: FamilyBillingRow[]): Map<string, string | null> {
  return new Map(families.map((f) => [f.name, f.billing_company_id]));
}

export type BillingPaymentGroup = {
  billingCompanyId: string;
  companyLabel: string;
  items: CartItemWithBilling[];
  total: number;
};

export function groupCartByBillingCompany(
  items: CartItemWithBilling[],
  companyLabels: Map<string, string>,
): BillingPaymentGroup[] {
  const groups = new Map<string, CartItemWithBilling[]>();
  for (const item of items) {
    const list = groups.get(item.billingCompanyId) ?? [];
    list.push(item);
    groups.set(item.billingCompanyId, list);
  }
  return Array.from(groups.entries()).map(([billingCompanyId, groupItems]) => ({
    billingCompanyId,
    companyLabel: companyLabels.get(billingCompanyId) ?? 'Empresa',
    items: groupItems,
    total: groupItems.reduce((sum, it) => sum + it.total, 0),
  }));
}

export function hasSplitBilling(groups: BillingPaymentGroup[]): boolean {
  return groups.length > 1;
}

export function companyDisplayName(c: Pick<BillingCompanyOption, 'short_name' | 'name'>): string {
  return (c.short_name?.trim() || c.name?.trim() || 'Empresa');
}

/** Otra empresa del mismo centro laboral (para «desasignar» familias). */
export function getSiblingBillingCompanyId(
  billingCompanies: Array<{ id: string }>,
  currentCompanyId: string,
): string | null {
  const sibling = billingCompanies.find((c) => c.id !== currentCompanyId);
  return sibling?.id ?? null;
}

/** Familia visible en la configuración de una empresa emisora. */
export function familyBelongsToBillingCompany(
  family: { billing_company_id: string | null },
  billingCompanyId: string,
  catalogHostCompanyId: string,
): boolean {
  if (family.billing_company_id) return family.billing_company_id === billingCompanyId;
  return billingCompanyId === catalogHostCompanyId;
}

/** Empleados compatibles con las empresas emisoras de los ítems de cita. */
export function filterEmployeesForBillingCompanies<
  T extends { id: string; billing_company_id?: string | null },
>(
  employees: T[],
  requiredBillingCompanyIds: string[],
  hostCompanyId: string,
): T[] {
  if (requiredBillingCompanyIds.length === 0) return employees;
  const unique = [...new Set(requiredBillingCompanyIds)];
  if (unique.length > 1) {
    // Cita con servicios de distintas empresas: solo empleados sin restricción o del host
    return employees.filter(
      (e) => !e.billing_company_id || e.billing_company_id === hostCompanyId,
    );
  }
  const required = unique[0];
  return employees.filter(
    (e) =>
      !e.billing_company_id ||
      e.billing_company_id === required ||
      e.billing_company_id === hostCompanyId,
  );
}

export function resolveRequiredBillingCompanyIds(
  articleIds: string[],
  articlesMap: Map<string, ArticleBillingSource>,
  familyBillingMap: Map<string, string | null>,
  hostCompanyId: string,
): string[] {
  const ids = new Set<string>();
  for (const articleId of articleIds) {
    const article = articlesMap.get(articleId);
    if (!article) continue;
    ids.add(resolveBillingCompanyId(article, familyBillingMap, hostCompanyId));
  }
  return [...ids];
}
