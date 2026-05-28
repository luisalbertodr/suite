import {
  buildFamilyBillingMap,
  companyDisplayName,
  resolveBillingCompanyId,
  type BillingCompanyOption,
  type FamilyBillingRow,
} from '@/lib/billingCompany';

export type AuditSeverity = 'error' | 'warning' | 'info';

export type AuditIssue = {
  id: string;
  severity: AuditSeverity;
  category: 'family' | 'article' | 'employee' | 'company';
  title: string;
  detail?: string;
  fixHint?: string;
};

export type BillingEntityCount = {
  companyId: string;
  label: string;
  count: number;
};

export type WorkCenterAuditResult = {
  issues: AuditIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  employeesByBilling: BillingEntityCount[];
  articlesByBilling: BillingEntityCount[];
  sharedEmployees: number;
  explicitFamilies: number;
  implicitFamilies: number;
};

type FamilyRow = FamilyBillingRow & { id?: string };
type ArticleRow = {
  id: string;
  descripcion: string;
  familia: string;
  billing_company_id: string | null;
  company_id?: string | null;
  estado?: string | null;
};
type EmployeeRow = {
  id: string;
  name: string;
  billing_company_id: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
};

export function buildWorkCenterAudit(input: {
  hostCompanyId: string;
  billingCompanies: BillingCompanyOption[];
  families: FamilyRow[];
  articles: ArticleRow[];
  employees: EmployeeRow[];
}): WorkCenterAuditResult {
  const { hostCompanyId, billingCompanies, families, articles, employees } = input;
  const billingIds = new Set(billingCompanies.map((c) => c.id));
  const labels = new Map(billingCompanies.map((c) => [c.id, companyDisplayName(c)]));
  const familyBillingMap = buildFamilyBillingMap(families);
  const issues: AuditIssue[] = [];

  let explicitFamilies = 0;
  let implicitFamilies = 0;
  for (const family of families) {
    if (family.billing_company_id) {
      explicitFamilies += 1;
      if (!billingIds.has(family.billing_company_id)) {
        issues.push({
          id: `family-billing-${family.name}`,
          severity: 'error',
          category: 'family',
          title: `Familia «${family.name}» con emisor fuera del centro`,
          detail: 'La empresa emisora asignada no pertenece a este centro laboral.',
          fixHint: 'Configuración → Artículos → Familias, o panel superusuario.',
        });
      }
    } else {
      implicitFamilies += 1;
      issues.push({
        id: `family-implicit-${family.name}`,
        severity: 'info',
        category: 'family',
        title: `Familia «${family.name}» sin emisor explícito`,
        detail: `Facturará como ${labels.get(hostCompanyId) ?? 'tenant operativo'} por defecto.`,
        fixHint: 'Artículos → Gestionar familias → Empresa emisora.',
      });
    }
  }

  const articleBillingCounts = new Map<string, number>();
  for (const article of articles) {
    if (article.estado && article.estado !== 'activo') continue;
    const resolved = resolveBillingCompanyId(
      {
        billing_company_id: article.billing_company_id,
        familia: article.familia ?? 'Varios',
        company_id: article.company_id,
      },
      familyBillingMap,
      hostCompanyId,
    );
    articleBillingCounts.set(resolved, (articleBillingCounts.get(resolved) ?? 0) + 1);

    if (article.billing_company_id && !billingIds.has(article.billing_company_id)) {
      issues.push({
        id: `article-billing-${article.id}`,
        severity: 'error',
        category: 'article',
        title: `Artículo «${article.descripcion}» con emisor inválido`,
        detail: 'La empresa emisora no está en el centro laboral.',
        fixHint: 'Artículos → editar artículo → Empresa emisora.',
      });
    } else if (!article.billing_company_id && !familyBillingMap.get(article.familia)) {
      issues.push({
        id: `article-implicit-${article.id}`,
        severity: 'warning',
        category: 'article',
        title: `Artículo «${article.descripcion}» hereda emisor del tenant`,
        detail: `Familia «${article.familia}» sin emisor; usará ${labels.get(hostCompanyId) ?? 'operativo'}.`,
        fixHint: 'Asigna emisor en el artículo o en su familia.',
      });
    }
  }

  let sharedEmployees = 0;
  const employeeBillingCounts = new Map<string, number>();
  for (const emp of employees) {
    const isActive = emp.active !== false && emp.is_active !== false;
    if (!isActive) continue;

    if (!emp.billing_company_id) {
      sharedEmployees += 1;
      continue;
    }

    employeeBillingCounts.set(
      emp.billing_company_id,
      (employeeBillingCounts.get(emp.billing_company_id) ?? 0) + 1,
    );

    if (!billingIds.has(emp.billing_company_id)) {
      issues.push({
        id: `employee-billing-${emp.id}`,
        severity: 'error',
        category: 'employee',
        title: `Empleado «${emp.name}» con emisor fuera del centro`,
        fixHint: 'Configuración → Empleados → Empresa emisora.',
      });
    }
  }

  for (const company of billingCompanies) {
    if (!company.tpv_ticket_prefix?.trim()) {
      issues.push({
        id: `company-prefix-${company.id}`,
        severity: 'warning',
        category: 'company',
        title: `${companyDisplayName(company)} sin prefijo TPV`,
        detail: 'Los tickets no distinguirán serie entre empresas del centro.',
        fixHint: 'Superusuario → Centros laborales → prefijo TPV.',
      });
    }
  }

  if (sharedEmployees === 0 && employees.some((e) => e.active !== false && e.is_active !== false)) {
    issues.push({
      id: 'no-shared-employees',
      severity: 'info',
      category: 'employee',
      title: 'Ningún empleado compartido',
      detail: 'Para recepción común, deja la empresa emisora vacía en el empleado.',
      fixHint: 'Configuración → Empleados.',
    });
  }

  const severityRank: Record<AuditSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const articlesByBilling = billingCompanies.map((c) => ({
    companyId: c.id,
    label: companyDisplayName(c),
    count: articleBillingCounts.get(c.id) ?? 0,
  }));

  const employeesByBilling = billingCompanies.map((c) => ({
    companyId: c.id,
    label: companyDisplayName(c),
    count: employeeBillingCounts.get(c.id) ?? 0,
  }));

  return {
    issues,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    infoCount: issues.filter((i) => i.severity === 'info').length,
    employeesByBilling,
    articlesByBilling,
    sharedEmployees,
    explicitFamilies,
    implicitFamilies,
  };
}

/** Citas visibles al filtrar por una sola empresa: oculta las mixtas. */
export function appointmentVisibleInBillingView(
  requiredBillingIds: string[],
  view: 'all' | string,
): boolean {
  if (view === 'all') return true;
  if (requiredBillingIds.length === 0) return true;
  if (requiredBillingIds.length > 1) return false;
  return requiredBillingIds[0] === view;
}

export function resolveAppointmentBillingIds(
  items: Array<{ article_id?: string | null }>,
  articlesMap: Map<string, { familia: string; billing_company_id?: string | null; company_id?: string | null }>,
  familyBillingMap: Map<string, string | null>,
  hostCompanyId: string,
): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.article_id) continue;
    const article = articlesMap.get(item.article_id);
    if (!article) continue;
    ids.add(
      resolveBillingCompanyId(
        {
          billing_company_id: article.billing_company_id,
          familia: article.familia ?? 'Varios',
          company_id: article.company_id,
        },
        familyBillingMap,
        hostCompanyId,
      ),
    );
  }
  return [...ids];
}
