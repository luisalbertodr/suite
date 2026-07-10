import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { articleInBillingScope, fetchFamilyBillingByName } from '@/lib/reportCatalogScope';
import {
  buildArticleCodigoIndex,
  buildArticleFilterTerms,
  buildFamilyCodigoSets,
  fetchCatalogArticlesForMatching,
  lineMatchesArticleFilter,
  lineMatchesFamiliaFilter,
  parseInvoiceLineArticleCode,
  resolveLineArticle,
} from '@/lib/invoiceLineCatalogMatch';
import { fetchCatalogCustomers } from '@/lib/customerSearch';
import { fetchSalesWithoutInvoiceRows, usesWorkCenterStyleBillingRpc } from '@/lib/salesRevenue';

export type ReportFilters = {
  fechaDesde?: Date;
  fechaHasta?: Date;
  cliente?: string;
  proveedor?: string;
  estado?: string;
  familia?: string;
  familias?: string[];
  articulos?: string[];
  empresaEmisora?: string;
  diasInactividad?: number;
  diasSinMovimiento?: number;
  numClientes?: number;
  importeDesde?: number;
  importeHasta?: number;
  [key: string]: unknown;
};

/** Claves de fila en el mismo orden que `columns` en Reportes.tsx */
export const REPORT_ROW_KEYS: Record<string, string[]> = {
  'facturas-cobrar': ['numero', 'cliente', 'fechaEmision', 'vencimiento', 'importe', 'diasVencido'],
  'facturacion-mensual': ['mes', 'totalFacturado', 'numFacturas', 'variacion'],
  'facturacion-cliente': ['cliente', 'totalFacturado', 'numFacturas', 'promedio'],
  'ventas-articulo': ['articulo', 'cantidad', 'importe', 'margen'],
  'presupuestos-aceptados': ['numero', 'cliente', 'fecha', 'importe', 'estado'],
  'presupuestos-pendientes': ['numero', 'cliente', 'diasPendiente', 'importe', 'acciones'],
  'ratio-conversion': ['periodo', 'enviados', 'aceptados', 'conversion'],
  'listado-clientes': ['cliente', 'contacto', 'ultimaCompra', 'totalFacturado', 'estado'],
  'clientes-inactivos': ['cliente', 'ultimaFactura', 'diasInactivo', 'totalHistorico'],
  'clientes-top': ['ranking', 'cliente', 'facturacion', 'frecuencia', 'margen'],
  'stock-actual': ['articulo', 'stockActual', 'stockMinimo', 'valorStock'],
  'movimientos-stock': ['fecha', 'articulo', 'tipo', 'cantidad', 'stockResultante'],
  'articulos-sin-movimiento': ['articulo', 'ultimoMovimiento', 'stockActual', 'valor'],
  'facturas-pagar': ['proveedor', 'factura', 'fecha', 'vencimiento', 'importe'],
  'compras-proveedor': ['proveedor', 'totalComprado', 'numFacturas', 'formaPago'],
  'flujo-caja': ['periodo', 'ingresos', 'gastos', 'saldo', 'proyeccion'],
  'analisis-margenes': ['concepto', 'ventas', 'costos', 'margenBruto', 'margenPct'],
  'resumen-fiscal': ['concepto', 'baseImponible', 'iva', 'total', 'tipoIva'],
  'listado-facturas-emitidas': [
    'numero', 'fechaEmision', 'cliente', 'articulo', 'familia', 'cantidad', 'importeLinea', 'totalFactura', 'cobro',
  ],
};

const MONEY_KEYS = new Set([
  'importe', 'totalFacturado', 'valorStock', 'promedio', 'margen', 'facturacion',
  'totalComprado', 'ingresos', 'gastos', 'saldo', 'ventas', 'costos', 'margenBruto',
  'baseImponible', 'iva', 'total', 'valor', 'importeLinea', 'totalFactura',
]);

export function formatReportCell(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (MONEY_KEYS.has(key) && typeof value === 'number') return `€${value.toFixed(2)}`;
  return String(value);
}

type Scope = {
  billingCompanyIds: string[];
  catalogCompanyId: string;
  /** Todas las empresas del centro (filtro por artículo fiscal cruzado). */
  allBillingCompanyIds?: string[];
};

function dateFrom(filters: ReportFilters): string | undefined {
  return filters.fechaDesde ? format(filters.fechaDesde, 'yyyy-MM-dd') : undefined;
}

function dateTo(filters: ReportFilters): string | undefined {
  return filters.fechaHasta ? format(filters.fechaHasta, 'yyyy-MM-dd') : undefined;
}

function dateToIsoEnd(filters: ReportFilters): string | undefined {
  return filters.fechaHasta ? `${format(filters.fechaHasta, 'yyyy-MM-dd')}T23:59:59` : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
  if (typeof value === 'string' && value.trim() && value !== 'todas' && value !== 'todos') return [value.trim()];
  return [];
}

function resolveFamiliaFilter(filters: ReportFilters): string[] {
  const multi = normalizeStringArray(filters.familias);
  if (multi.length) return multi;
  const single = filters.familia;
  if (single && single !== 'todas') return [String(single)];
  return [];
}

function resolveArticuloFilter(filters: ReportFilters): string[] {
  return normalizeStringArray(filters.articulos);
}

function paidStatusLabel(paid: boolean | null | undefined, status: string | null | undefined): string {
  if (paid === true) return 'Cobrada';
  if (status === 'cancelled' || status === 'void' || status === 'anulada') return 'Anulada';
  return 'Pendiente';
}

function lineAmount(item: Record<string, unknown>): number {
  return Number(item.subtotal_after_discount ?? item.subtotal ?? item.total_price ?? 0);
}

/** Ámbito fiscal del informe: por defecto la empresa activa (M/E en barra superior). */
export function resolveBillingScope(
  companyId: string | null,
  billingCompanies: { id: string }[],
  isMultiEntity: boolean,
  empresaEmisora?: string,
): string[] {
  if (!companyId) return [];
  const tab = empresaEmisora ?? companyId;
  if (tab === 'all') {
    if (isMultiEntity && billingCompanies.length > 1) {
      return billingCompanies.map((c) => c.id);
    }
    return [companyId];
  }
  return [tab];
}

export function applyCompanyScope<T extends { eq: (c: string, v: string) => T; in: (c: string, v: string[]) => T }>(
  query: T,
  scope: Scope,
  column = 'company_id',
): T {
  const ids = scope.billingCompanyIds;
  if (ids.length === 1) return query.eq(column, ids[0]!);
  if (ids.length > 1) return query.in(column, ids);
  return query;
}

async function saleIdsInScope(scope: Scope, filters: ReportFilters): Promise<string[]> {
  let q = supabase.from('sales').select('id').eq('status', 'completed');
  q = applyCompanyScope(q, scope);
  const from = dateFrom(filters);
  const to = dateToIsoEnd(filters);
  if (from) q = q.gte('created_at', `${from}T00:00:00`);
  if (to) q = q.lte('created_at', to);
  if (filters.cliente && filters.cliente !== 'todos') q = q.eq('customer_id', filters.cliente);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

export async function fetchReportData(
  reportId: string,
  scope: Scope,
  filters: ReportFilters,
): Promise<Record<string, unknown>[]> {
  switch (reportId) {
    case 'facturas-cobrar':
      return fetchFacturasPorCobrar(scope, filters);
    case 'facturacion-mensual':
      return fetchFacturacionMensual(scope, filters);
    case 'facturacion-cliente':
      return fetchFacturacionPorCliente(scope, filters);
    case 'ventas-articulo':
      return fetchVentasPorArticulo(scope, filters);
    case 'presupuestos-aceptados':
      return fetchPresupuestos(scope, filters, 'accepted');
    case 'presupuestos-pendientes':
      return fetchPresupuestosPendientes(scope, filters);
    case 'ratio-conversion':
      return fetchRatioConversion(scope, filters);
    case 'listado-clientes':
      return fetchListadoClientes(scope, filters);
    case 'clientes-inactivos':
      return fetchClientesInactivos(scope, filters);
    case 'clientes-top':
      return fetchClientesTop(scope, filters);
    case 'stock-actual':
      return fetchStockActual(scope, filters);
    case 'movimientos-stock':
      return fetchMovimientosStock(scope, filters);
    case 'articulos-sin-movimiento':
      return fetchArticulosSinMovimiento(scope, filters);
    case 'facturas-pagar':
      return fetchFacturasPorPagar(scope, filters);
    case 'compras-proveedor':
      return fetchComprasProveedor(scope, filters);
    case 'flujo-caja':
      return fetchFlujoCaja(scope, filters);
    case 'analisis-margenes':
      return fetchAnalisisMargenes(scope, filters);
    case 'resumen-fiscal':
      return fetchResumenFiscal(scope, filters);
    case 'listado-facturas-emitidas':
      return fetchListadoFacturasEmitidas(scope, filters);
    default:
      return [];
  }
}

async function fetchListadoFacturasEmitidas(scope: Scope, filters: ReportFilters) {
  const familias = resolveFamiliaFilter(filters);
  const articuloIds = resolveArticuloFilter(filters);
  const hasLineFilter = familias.length > 0 || articuloIds.length > 0;

  const catalogArticles = hasLineFilter
    ? await fetchCatalogArticlesForMatching(scope.catalogCompanyId)
    : [];
  const byCodigo = buildArticleCodigoIndex(catalogArticles);
  const articleTerms = buildArticleFilterTerms(articuloIds, catalogArticles);
  const familiasFromArticulos = [
    ...new Set(
      catalogArticles
        .filter((a) => articleTerms.ids.has(a.id) && a.familia?.trim())
        .map((a) => a.familia!.trim()),
    ),
  ];
  const familiasForLineMatch = [...new Set([...familias, ...familiasFromArticulos])];
  const familyCodigoSets = buildFamilyCodigoSets(catalogArticles, familiasForLineMatch);

  let invoiceScopeIds = scope.billingCompanyIds;
  if (
    articuloIds.length > 0 &&
    scope.allBillingCompanyIds &&
    scope.allBillingCompanyIds.length > 0
  ) {
    const selected = catalogArticles.filter((a) => articleTerms.ids.has(a.id));
    const scopeSet = new Set(scope.billingCompanyIds);
    if (selected.some((a) => a.billing_company_id && scopeSet.has(a.billing_company_id))) {
      invoiceScopeIds = scope.allBillingCompanyIds;
    }
  }

  let query = supabase
    .from('invoices')
    .select(
      'id, company_id, number, issue_date, total_amount, subtotal, tax_amount, paid_status, status, customers:customer_id (name)',
    )
    ;
  query = applyCompanyScope(
    query,
    { billingCompanyIds: invoiceScopeIds, catalogCompanyId: scope.catalogCompanyId },
  );

  if (filters.cliente && filters.cliente !== 'todos') query = query.eq('customer_id', filters.cliente);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) query = query.gte('issue_date', from);
  if (to) query = query.lte('issue_date', to);

  if (filters.estado === 'paid') query = query.eq('paid_status', true);
  if (filters.estado === 'pending' || filters.estado === 'sent') query = query.eq('paid_status', false);

  const importeDesde = Number(filters.importeDesde ?? 0);
  const importeHasta = Number(filters.importeHasta ?? 0);
  if (importeDesde > 0) query = query.gte('total_amount', importeDesde);
  if (importeHasta > 0) query = query.lte('total_amount', importeHasta);

  const { data: invoices, error } = await query.order('issue_date', { ascending: false }).order('number', { ascending: false });
  if (error) throw error;
  const cancelled = new Set(['cancelled', 'void', 'anulada']);
  const invList = ((invoices ?? []) as Record<string, unknown>[]).filter(
    (inv) => !cancelled.has(String(inv.status ?? '').toLowerCase()),
  );

  if (!hasLineFilter) {
    return invList.map((inv) => ({
      numero: inv.number,
      fechaEmision: format(new Date(String(inv.issue_date)), 'dd/MM/yyyy'),
      cliente: (inv.customers as { name?: string } | null)?.name || 'N/A',
      articulo: '—',
      familia: '—',
      cantidad: '—',
      importeLinea: '—',
      totalFactura: Number(inv.total_amount ?? 0),
      cobro: paidStatusLabel(inv.paid_status as boolean | undefined, inv.status as string | undefined),
    }));
  }

  const invIds = invList.map((i) => String(i.id));
  if (invIds.length === 0) return [];

  const invById = new Map(invList.map((i) => [String(i.id), i]));
  const rows: Record<string, unknown>[] = [];
  const chunkSize = 150;

  for (let i = 0; i < invIds.length; i += chunkSize) {
    const chunk = invIds.slice(i, i + chunkSize);
    const { data: items, error: itemsErr } = await supabase
      .from('invoice_items')
      .select(
        'invoice_id, description, quantity, total_price, subtotal_after_discount, subtotal',
      )
      .in('invoice_id', chunk);
    if (itemsErr) throw itemsErr;

    for (const raw of items ?? []) {
      const item = raw as Record<string, unknown>;
      const description = String(item.description ?? '');
      const resolved = resolveLineArticle(description, byCodigo);
      const familiaArt = resolved?.familia?.trim() ?? '';
      const artId = resolved?.id ?? '';

      const inv = invById.get(String(item.invoice_id));
      if (!inv) continue;

      const invoiceCompanyId = String(inv.company_id ?? '');
      const matchesFamilia =
        familiasForLineMatch.length === 0 ||
        lineMatchesFamiliaFilter(description, byCodigo, familiasForLineMatch, familyCodigoSets, {
          invoiceCompanyId,
          billingCompanyIds: scope.billingCompanyIds,
        });
      const matchesArticulo =
        articuloIds.length === 0 || lineMatchesArticleFilter(description, byCodigo, articleTerms);
      if (familiasForLineMatch.length > 0 && articuloIds.length > 0) {
        if (!matchesFamilia && !matchesArticulo) continue;
      } else if (familiasForLineMatch.length > 0 && !matchesFamilia) {
        continue;
      } else if (articuloIds.length > 0 && !matchesArticulo) {
        continue;
      }

      const artLabel = resolved?.descripcion || description || 'Sin artículo';
      const codigo = resolved?.codigo ?? parseInvoiceLineArticleCode(description);
      rows.push({
        numero: inv.number,
        fechaEmision: format(new Date(String(inv.issue_date)), 'dd/MM/yyyy'),
        cliente: (inv.customers as { name?: string } | null)?.name || 'N/A',
        articulo: codigo ? `${codigo} - ${artLabel}` : artLabel,
        familia: familiaArt || '—',
        cantidad: Number(item.quantity ?? 1),
        importeLinea: lineAmount(item),
        totalFactura: Number(inv.total_amount ?? 0),
        cobro: paidStatusLabel(inv.paid_status as boolean | undefined, inv.status as string | undefined),
      });
    }
  }

  return rows.sort((a, b) => {
    const da = String(a.fechaEmision).split('/').reverse().join('');
    const db = String(b.fechaEmision).split('/').reverse().join('');
    if (da !== db) return db.localeCompare(da);
    return String(b.numero).localeCompare(String(a.numero));
  });
}

async function fetchFacturasPorCobrar(scope: Scope, filters: ReportFilters) {
  let query = supabase
    .from('invoices')
    .select('number, issue_date, due_date, total_amount, customers:customer_id (name)')
    .eq('paid_status', false);
  query = applyCompanyScope(query, scope);
  if (filters.cliente && filters.cliente !== 'todos') query = query.eq('customer_id', filters.cliente);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) query = query.gte('issue_date', from);
  if (to) query = query.lte('issue_date', to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((inv: any) => ({
    numero: inv.number,
    cliente: inv.customers?.name || 'N/A',
    fechaEmision: format(new Date(inv.issue_date), 'dd/MM/yyyy'),
    vencimiento: format(new Date(inv.due_date), 'dd/MM/yyyy'),
    importe: inv.total_amount,
    diasVencido: Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
  }));
}

async function fetchFacturacionMensual(scope: Scope, filters: ReportFilters) {
  const from = dateFrom(filters);
  const to = dateTo(filters);
  const hubOnly =
    scope.billingCompanyIds.some((id) => usesWorkCenterStyleBillingRpc(id)) &&
    (!filters.cliente || filters.cliente === 'todos');

  if (hubOnly) {
    const rpcCompanyId = scope.billingCompanyIds[0]!;
    const startYear = from ? parseInt(from.slice(0, 4), 10) : new Date().getFullYear();
    const endYear = to ? parseInt(to.slice(0, 4), 10) : startYear;
    const monthly: Record<string, { totalFacturado: number; numFacturas: number }> = {};

    for (let year = startYear; year <= endYear; year++) {
      const { data, error } = await supabase.rpc('dashboard_billing_monthly', {
        p_company_id: rpcCompanyId,
        p_year: year,
      });
      if (error) throw error;
      for (const row of data ?? []) {
        const monthKey = `${year}-${String(row.month_num).padStart(2, '0')}`;
        if (from && monthKey < from.slice(0, 7)) continue;
        if (to && monthKey > to.slice(0, 7)) continue;
        const mes = format(new Date(year, row.month_num - 1, 1), 'MMMM yyyy', { locale: es });
        if (!monthly[mes]) monthly[mes] = { totalFacturado: 0, numFacturas: 0 };
        monthly[mes].totalFacturado += Number(row.total ?? 0);
      }
    }

    return Object.entries(monthly).map(([mes, d]) => ({
      mes,
      totalFacturado: d.totalFacturado,
      numFacturas: d.numFacturas,
      variacion: '—',
    }));
  }

  let query = supabase
    .from('invoices')
    .select('issue_date, total_amount, status, customers:customer_id (name)')
    .order('issue_date', { ascending: false });
  query = applyCompanyScope(query, scope);
  if (filters.cliente && filters.cliente !== 'todos') query = query.eq('customer_id', filters.cliente);
  if (from) query = query.gte('issue_date', from);
  if (to) query = query.lte('issue_date', to);
  const { data, error } = await query;
  if (error) throw error;

  const monthly: Record<string, { totalFacturado: number; numFacturas: number; numTickets: number }> = {};
  for (const inv of data ?? []) {
    const status = String((inv as any).status ?? '').toLowerCase();
    if (['cancelled', 'void', 'anulada'].includes(status)) continue;
    const mes = format(new Date((inv as any).issue_date), 'MMMM yyyy', { locale: es });
    if (!monthly[mes]) monthly[mes] = { totalFacturado: 0, numFacturas: 0, numTickets: 0 };
    monthly[mes].totalFacturado += Number((inv as any).total_amount);
    monthly[mes].numFacturas += 1;
  }

  return Object.entries(monthly).map(([mes, d]) => ({
    mes,
    totalFacturado: d.totalFacturado,
    numFacturas: d.numFacturas,
    variacion: '—',
  }));
}

async function fetchFacturacionPorCliente(scope: Scope, filters: ReportFilters) {
  let query = supabase.from('invoices').select('total_amount, customers:customer_id (name)');
  query = applyCompanyScope(query, scope);
  const { data, error } = await query;
  if (error) throw error;

  const byClient: Record<string, { totalFacturado: number; numFacturas: number; numTickets: number }> = {};
  for (const inv of data ?? []) {
    const name = (inv as any).customers?.name || 'Cliente desconocido';
    if (!byClient[name]) byClient[name] = { totalFacturado: 0, numFacturas: 0, numTickets: 0 };
    byClient[name].totalFacturado += Number((inv as any).total_amount);
    byClient[name].numFacturas += 1;
  }

  return Object.entries(byClient).map(([cliente, d]) => ({
    cliente,
    totalFacturado: d.totalFacturado,
    numFacturas: d.numFacturas,
    promedio: d.numFacturas > 0 ? d.totalFacturado / d.numFacturas : 0,
  }));
}

async function fetchVentasPorArticulo(scope: Scope, filters: ReportFilters) {
  const saleIds = await saleIdsInScope(scope, filters);
  if (saleIds.length === 0) return [];

  const familyBilling = await fetchFamilyBillingByName(
    scope.catalogCompanyId,
    scope.billingCompanyIds,
  );

  const { data, error } = await supabase
    .from('sale_items')
    .select(
      'quantity, total_price, description, articles:article_id (descripcion, precio_compra, familia, company_id, billing_company_id)',
    )
    .in('sale_id', saleIds);
  if (error) throw error;

  const byArt: Record<string, { cantidad: number; importe: number; costo: number }> = {};
  for (const item of data ?? []) {
    const art = item as any;
    const linked = art.articles;
    if (
      linked &&
      !articleInBillingScope(linked, scope.catalogCompanyId, scope.billingCompanyIds, familyBilling)
    ) {
      continue;
    }
    if (filters.familia && filters.familia !== 'todas' && art.articles?.familia !== filters.familia) continue;
    const name = art.articles?.descripcion || art.description || 'Sin nombre';
    if (!byArt[name]) byArt[name] = { cantidad: 0, importe: 0, costo: Number(art.articles?.precio_compra ?? 0) };
    byArt[name].cantidad += Number(art.quantity);
    byArt[name].importe += Number(art.total_price);
  }

  return Object.entries(byArt).map(([articulo, d]) => ({
    articulo,
    cantidad: d.cantidad,
    importe: d.importe,
    margen: d.importe - d.costo * d.cantidad,
  }));
}

async function fetchPresupuestos(scope: Scope, filters: ReportFilters, status: string) {
  let query = supabase
    .from('quotes')
    .select('number, issue_date, total_amount, invoiced, customers:customer_id (name)')
    .eq('status', status);
  query = applyCompanyScope(query, scope);
  if (filters.cliente && filters.cliente !== 'todos') query = query.eq('customer_id', filters.cliente);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) query = query.gte('issue_date', from);
  if (to) query = query.lte('issue_date', to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((q: any) => ({
    numero: q.number,
    cliente: q.customers?.name || 'N/A',
    fecha: format(new Date(q.issue_date), 'dd/MM/yyyy'),
    importe: q.total_amount,
    estado: q.invoiced ? 'Facturado' : 'Pendiente de facturar',
  }));
}

async function fetchPresupuestosPendientes(scope: Scope, filters: ReportFilters) {
  let query = supabase
    .from('quotes')
    .select('number, issue_date, valid_until, total_amount, customers:customer_id (name)')
    .eq('status', 'sent');
  query = applyCompanyScope(query, scope);
  if (filters.cliente && filters.cliente !== 'todos') query = query.eq('customer_id', filters.cliente);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) query = query.gte('issue_date', from);
  if (to) query = query.lte('issue_date', to);
  const { data, error } = await query;
  if (error) throw error;
  const hoy = Date.now();
  return (data ?? []).map((q: any) => {
    const dias = Math.floor((hoy - new Date(q.issue_date).getTime()) / 86400000);
    const vencido = hoy > new Date(q.valid_until).getTime();
    return {
      numero: q.number,
      cliente: q.customers?.name || 'N/A',
      diasPendiente: dias,
      importe: q.total_amount,
      acciones: vencido ? 'Vencido' : 'Vigente',
    };
  });
}

async function fetchRatioConversion(scope: Scope, filters: ReportFilters) {
  let query = supabase.from('quotes').select('issue_date, status, total_amount');
  query = applyCompanyScope(query, scope);
  if (filters.cliente && filters.cliente !== 'todos') query = query.eq('customer_id', filters.cliente);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) query = query.gte('issue_date', from);
  if (to) query = query.lte('issue_date', to);
  const { data, error } = await query;
  if (error) throw error;

  const monthly: Record<string, { enviados: number; aceptados: number }> = {};
  for (const q of data ?? []) {
    const row = q as any;
    const periodo = format(new Date(row.issue_date), 'MMMM yyyy', { locale: es });
    if (!monthly[periodo]) monthly[periodo] = { enviados: 0, aceptados: 0 };
    if (row.status === 'sent' || row.status === 'accepted' || row.status === 'rejected') monthly[periodo].enviados += 1;
    if (row.status === 'accepted') monthly[periodo].aceptados += 1;
  }

  return Object.entries(monthly).map(([periodo, d]) => ({
    periodo,
    enviados: d.enviados,
    aceptados: d.aceptados,
    conversion: d.enviados > 0 ? `${((d.aceptados / d.enviados) * 100).toFixed(1)}%` : '0%',
  }));
}

async function fetchListadoClientes(scope: Scope, _filters: ReportFilters) {
  const customers = await fetchCatalogCustomers(supabase as SupabaseClient, scope.catalogCompanyId);
  const results: Record<string, unknown>[] = [];
  for (const c of customers) {
    let invQ = supabase.from('invoices').select('issue_date, total_amount').eq('customer_id', c.id);
    invQ = applyCompanyScope(invQ, scope);
    const { data: invs } = await invQ.order('issue_date', { ascending: false }).limit(1);
    const last = invs?.[0];
    let totalQ = supabase.from('invoices').select('total_amount').eq('customer_id', c.id);
    totalQ = applyCompanyScope(totalQ, scope);
    const { data: allInv } = await totalQ;
    const total = (allInv ?? []).reduce((s, i) => s + Number((i as any).total_amount), 0);
    results.push({
      cliente: c.name,
      contacto: c.email || c.phone || c.phone_mobile || 'N/A',
      ultimaCompra: last ? format(new Date((last as any).issue_date), 'dd/MM/yyyy') : 'Sin facturas',
      totalFacturado: total,
      estado: 'Activo',
    });
  }
  return results;
}

async function fetchClientesInactivos(scope: Scope, filters: ReportFilters) {
  const dias = Number(filters.diasInactividad ?? filters['dias-inactividad'] ?? 90);
  const cutoff = format(subDays(new Date(), dias), 'yyyy-MM-dd');
  let invQ = supabase.from('invoices').select('customer_id').gte('issue_date', cutoff);
  invQ = applyCompanyScope(invQ, scope);
  const { data: recent, error: invErr } = await invQ;
  if (invErr) throw invErr;
  const activeIds = [...new Set((recent ?? []).map((r) => (r as any).customer_id).filter(Boolean))];

  const customers = await fetchCatalogCustomers(supabase as SupabaseClient, scope.catalogCompanyId);
  const inactive = customers.filter((c) => !activeIds.includes(c.id));

  return inactive.map((c) => ({
    cliente: c.name,
    ultimaFactura: `Sin actividad ${dias}+ días`,
    diasInactivo: `${dias}+`,
    totalHistorico: '—',
  }));
}

async function fetchClientesTop(scope: Scope, filters: ReportFilters) {
  const rows = await fetchFacturacionPorCliente(scope, filters);
  const limit = Number(filters.numClientes ?? filters.ranking ?? 10);
  return rows
    .sort((a, b) => Number(b.totalFacturado) - Number(a.totalFacturado))
    .slice(0, limit)
    .map((r, i) => ({
      ranking: i + 1,
      cliente: r.cliente,
      facturacion: r.totalFacturado,
      frecuencia: r.numFacturas,
      margen: '—',
    }));
}

async function fetchStockActual(scope: Scope, filters: ReportFilters) {
  const familyBilling = await fetchFamilyBillingByName(
    scope.catalogCompanyId,
    scope.billingCompanyIds,
  );

  let query = supabase
    .from('articles')
    .select('descripcion, stock_actual, stock_minimo, precio_compra, familia, company_id, billing_company_id')
    .eq('company_id', scope.catalogCompanyId)
    .order('descripcion');
  if (filters.familia && filters.familia !== 'todas') query = query.eq('familia', filters.familia);
  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? [])
    .filter((a: any) =>
      articleInBillingScope(a, scope.catalogCompanyId, scope.billingCompanyIds, familyBilling),
    )
    .map((a: any) => ({
    articulo: a.descripcion,
    stockActual: a.stock_actual,
    stockMinimo: a.stock_minimo,
    valorStock: Number(a.stock_actual) * Number(a.precio_compra || 0),
  }));
  if (filters['stock-minimo']) {
    rows = rows.filter((r) => Number(r.stockActual) <= Number(r.stockMinimo));
  }
  return rows;
}

async function fetchMovimientosStock(scope: Scope, filters: ReportFilters) {
  const rows: Record<string, unknown>[] = [];
  let dnQ = supabase
    .from('delivery_notes')
    .select('issue_date, number, total_amount, suppliers:supplier_id (name)')
    .not('supplier_id', 'is', null);
  dnQ = applyCompanyScope(dnQ, scope);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) dnQ = dnQ.gte('issue_date', from);
  if (to) dnQ = dnQ.lte('issue_date', to);
  const { data: entradas, error: e1 } = await dnQ.order('issue_date', { ascending: false }).limit(200);
  if (e1) throw e1;
  for (const n of entradas ?? []) {
    const row = n as any;
    rows.push({
      fecha: format(new Date(row.issue_date), 'dd/MM/yyyy'),
      articulo: row.suppliers?.name || row.number || 'Entrada',
      tipo: 'Entrada',
      cantidad: 1,
      stockResultante: '—',
    });
  }

  const saleIds = await saleIdsInScope(scope, filters);
  if (saleIds.length > 0) {
    const { data: items, error: e2 } = await supabase
      .from('sale_items')
      .select('quantity, description, created_at, sales:sale_id (created_at)')
      .in('sale_id', saleIds.slice(0, 500))
      .order('created_at', { ascending: false })
      .limit(200);
    if (e2) throw e2;
    for (const it of items ?? []) {
      const row = it as any;
      const dt = row.sales?.created_at || row.created_at;
      rows.push({
        fecha: dt ? format(new Date(dt), 'dd/MM/yyyy') : '—',
        articulo: row.description || 'Venta',
        tipo: 'Salida',
        cantidad: row.quantity,
        stockResultante: '—',
      });
    }
  }
  return rows.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

async function fetchArticulosSinMovimiento(scope: Scope, filters: ReportFilters) {
  const dias = Number(filters.diasSinMovimiento ?? filters['dias-sin-movimiento'] ?? 90);
  const cutoff = subDays(new Date(), dias).toISOString();
  const saleIds = await saleIdsInScope(scope, { ...filters, fechaDesde: subDays(new Date(), dias) });
  const { data: items } =
    saleIds.length > 0
      ? await supabase.from('sale_items').select('article_id').in('sale_id', saleIds).not('article_id', 'is', null)
      : { data: [] };
  const activeArticleIds = new Set((items ?? []).map((i: any) => i.article_id));

  const familyBilling = await fetchFamilyBillingByName(
    scope.catalogCompanyId,
    scope.billingCompanyIds,
  );

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, descripcion, stock_actual, precio_compra, familia, updated_at, company_id, billing_company_id')
    .eq('company_id', scope.catalogCompanyId)
    .gt('stock_actual', 0);
  if (error) throw error;

  return (articles ?? [])
    .filter((a: any) =>
      articleInBillingScope(a, scope.catalogCompanyId, scope.billingCompanyIds, familyBilling),
    )
    .filter((a: any) => !activeArticleIds.has(a.id))
    .filter((a: any) => !filters.familia || filters.familia === 'todas' || a.familia === filters.familia)
    .map((a: any) => ({
      articulo: a.descripcion,
      ultimoMovimiento: `>${dias} días`,
      stockActual: a.stock_actual,
      valor: Number(a.stock_actual) * Number(a.precio_compra || 0),
    }));
}

async function fetchFacturasPorPagar(scope: Scope, filters: ReportFilters) {
  let query = supabase
    .from('delivery_notes')
    .select('number, issue_date, total_amount, delivery_date, suppliers:supplier_id (name)')
    .not('supplier_id', 'is', null)
    .eq('status', 'pending');
  query = applyCompanyScope(query, scope);
  if (filters.proveedor && filters.proveedor !== 'todos') query = query.eq('supplier_id', filters.proveedor);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) query = query.gte('issue_date', from);
  if (to) query = query.lte('issue_date', to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((n: any) => ({
    proveedor: n.suppliers?.name || 'N/A',
    factura: n.number,
    fecha: format(new Date(n.issue_date), 'dd/MM/yyyy'),
    vencimiento: n.delivery_date ? format(new Date(n.delivery_date), 'dd/MM/yyyy') : '—',
    importe: n.total_amount,
  }));
}

async function fetchComprasProveedor(scope: Scope, filters: ReportFilters) {
  let query = supabase
    .from('delivery_notes')
    .select('total_amount, suppliers:supplier_id (name, id)')
    .not('supplier_id', 'is', null);
  query = applyCompanyScope(query, scope);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) query = query.gte('issue_date', from);
  if (to) query = query.lte('issue_date', to);
  if (filters.proveedor && filters.proveedor !== 'todos') query = query.eq('supplier_id', filters.proveedor);
  const { data, error } = await query;
  if (error) throw error;

  const bySup: Record<string, { name: string; total: number; count: number }> = {};
  for (const n of data ?? []) {
    const row = n as any;
    const id = row.suppliers?.id || 'unknown';
    const name = row.suppliers?.name || 'Proveedor';
    if (!bySup[id]) bySup[id] = { name, total: 0, count: 0 };
    bySup[id].total += Number(row.total_amount);
    bySup[id].count += 1;
  }
  return Object.values(bySup).map((s) => ({
    proveedor: s.name,
    totalComprado: s.total,
    numFacturas: s.count,
    formaPago: '—',
  }));
}

async function fetchFlujoCaja(scope: Scope, filters: ReportFilters) {
  const monthly: Record<string, { ingresos: number; gastos: number }> = {};

  let invQ = supabase.from('invoices').select('issue_date, total_amount, paid_status');
  invQ = applyCompanyScope(invQ, scope);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) invQ = invQ.gte('issue_date', from);
  if (to) invQ = invQ.lte('issue_date', to);
  const { data: invs, error } = await invQ;
  if (error) throw error;
  for (const inv of invs ?? []) {
    const row = inv as any;
    if (row.paid_status === false) continue;
    const p = format(new Date(row.issue_date), 'MMMM yyyy', { locale: es });
    if (!monthly[p]) monthly[p] = { ingresos: 0, gastos: 0 };
    monthly[p].ingresos += Number(row.total_amount);
  }

  for (const cid of scope.billingCompanyIds) {
    const tpv = await fetchSalesWithoutInvoiceRows(
      cid,
      filters.fechaDesde ? new Date(`${dateFrom(filters)}T00:00:00`).toISOString() : undefined,
      dateToIsoEnd(filters),
    );
    for (const s of tpv) {
      const p = format(new Date(s.created_at), 'MMMM yyyy', { locale: es });
      if (!monthly[p]) monthly[p] = { ingresos: 0, gastos: 0 };
      monthly[p].ingresos += Number(s.total_amount ?? 0);
    }
  }

  let expQ = supabase.from('delivery_notes').select('issue_date, total_amount').not('supplier_id', 'is', null);
  expQ = applyCompanyScope(expQ, scope);
  if (from) expQ = expQ.gte('issue_date', from);
  if (to) expQ = expQ.lte('issue_date', to);
  const { data: gastos } = await expQ;
  for (const g of gastos ?? []) {
    const row = g as any;
    const p = format(new Date(row.issue_date), 'MMMM yyyy', { locale: es });
    if (!monthly[p]) monthly[p] = { ingresos: 0, gastos: 0 };
    monthly[p].gastos += Number(row.total_amount);
  }

  return Object.entries(monthly).map(([periodo, d]) => ({
    periodo,
    ingresos: d.ingresos,
    gastos: d.gastos,
    saldo: d.ingresos - d.gastos,
    proyeccion: '—',
  }));
}

async function fetchAnalisisMargenes(scope: Scope, filters: ReportFilters) {
  const ventas = await fetchVentasPorArticulo(scope, filters);
  return ventas.map((v) => ({
    concepto: v.articulo,
    ventas: v.importe,
    costos: Number(v.importe) - Number(v.margen),
    margenBruto: v.margen,
    margenPct: Number(v.importe) > 0 ? `${((Number(v.margen) / Number(v.importe)) * 100).toFixed(1)}%` : '0%',
  }));
}

async function fetchResumenFiscal(scope: Scope, filters: ReportFilters) {
  let invQ = supabase.from('invoices').select('id, issue_date');
  invQ = applyCompanyScope(invQ, scope);
  const from = dateFrom(filters);
  const to = dateTo(filters);
  if (from) invQ = invQ.gte('issue_date', from);
  if (to) invQ = invQ.lte('issue_date', to);
  const { data: invs, error: invErr } = await invQ;
  if (invErr) throw invErr;
  const ids = (invs ?? []).map((i: any) => i.id);
  if (ids.length === 0) return [];

  const { data: items, error } = await supabase
    .from('invoice_items')
    .select('subtotal_after_discount, subtotal, iva_percentage, iva_amount, total_price')
    .in('invoice_id', ids.slice(0, 500));
  if (error) throw error;

  const byRate: Record<string, { base: number; iva: number; total: number }> = {};
  for (const it of items ?? []) {
    const row = it as any;
    const rate = String(row.iva_percentage ?? 21);
    if (!byRate[rate]) byRate[rate] = { base: 0, iva: 0, total: 0 };
    const base = Number(row.subtotal_after_discount ?? row.subtotal ?? row.total_price ?? 0);
    const iva = Number(row.iva_amount ?? 0);
    byRate[rate].base += base;
    byRate[rate].iva += iva;
    byRate[rate].total += base + iva;
  }

  return Object.entries(byRate).map(([tipo, d]) => ({
    concepto: `IVA ${tipo}%`,
    baseImponible: d.base,
    iva: d.iva,
    total: d.total,
    tipoIva: `${tipo}%`,
  }));
}
