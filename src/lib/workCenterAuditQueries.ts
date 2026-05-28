import { supabase } from '@/lib/supabase';
import { isSchemaColumnError } from '@/lib/appointmentSales';

type OrderColumn = 'name' | 'descripcion';

export async function queryCompanyRowsWithSelectFallback(
  table: 'agenda_employees' | 'article_families' | 'articles',
  companyId: string,
  selectVariants: readonly string[],
  orderBy: OrderColumn = 'name',
): Promise<Record<string, unknown>[]> {
  for (const select of selectVariants) {
    const res = await supabase
      .from(table)
      .select(select)
      .eq('company_id', companyId)
      .order(orderBy);
    if (!res.error) return (res.data ?? []) as Record<string, unknown>[];
    if (!isSchemaColumnError(res.error)) throw res.error;
  }
  return [];
}

export async function fetchAuditEmployees(companyId: string) {
  const rows = await queryCompanyRowsWithSelectFallback(
    'agenda_employees',
    companyId,
    [
      'id, name, billing_company_id, is_active',
      'id, name, billing_company_id, active',
      'id, name, is_active',
      'id, name, active',
      'id, name, billing_company_id',
      'id, name',
      '*',
    ],
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    billing_company_id: (row.billing_company_id as string | null | undefined) ?? null,
    active: (row.active ?? row.is_active ?? true) as boolean | null,
    is_active: (row.is_active ?? row.active ?? true) as boolean | null,
  }));
}

export async function fetchAuditFamilies(companyId: string) {
  const rows = await queryCompanyRowsWithSelectFallback(
    'article_families',
    companyId,
    ['id, name, billing_company_id', 'id, name'],
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    billing_company_id: (row.billing_company_id as string | null | undefined) ?? null,
  }));
}

export async function fetchAuditArticles(companyId: string) {
  const rows = await queryCompanyRowsWithSelectFallback(
    'articles',
    companyId,
    [
      'id, descripcion, familia, billing_company_id, company_id, estado',
      'id, descripcion, familia, company_id, estado',
      'id, descripcion, familia, estado',
    ],
    'descripcion',
  );
  return rows.map((row) => ({
    id: String(row.id),
    descripcion: String(row.descripcion ?? ''),
    familia: String(row.familia ?? 'Varios'),
    billing_company_id: (row.billing_company_id as string | null | undefined) ?? null,
    company_id: (row.company_id as string | null | undefined) ?? null,
    estado: (row.estado as string | null | undefined) ?? null,
  }));
}
