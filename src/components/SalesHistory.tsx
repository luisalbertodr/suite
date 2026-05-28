import React, { useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { useNavigate } from 'react-router-dom';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from '@/components/ui/select';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, Filter, Receipt, Search } from 'lucide-react';

import { format, subDays } from 'date-fns';

import { es } from 'date-fns/locale';

import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';

import {

  parseAgendaSaleNotes,

  isSchemaColumnError,

  buildInvoicePrefillFromSale,

  TPV_SALE_INVOICE_PREFILL_KEY,

} from '@/lib/appointmentSales';



const PAGE_SIZE = 50;



type SaleRow = {

  id: string;

  ticket_number: string;

  total_amount: number;

  payment_method: string;

  status: string;

  created_at: string;

  customer_name?: string;

  customer_id?: string | null;

  appointment_id?: string | null;

  invoice_id?: string | null;

  notes?: string | null;

  company_id?: string | null;

  host_company_id?: string | null;

  sale_group_id?: string | null;

};



type InvoiceFilter = 'all' | 'invoiced' | 'pending';

type PaymentFilter = 'all' | 'cash' | 'card';
type BillingCompanyFilter = 'all' | string;



interface SalesHistoryProps {

  onBack: () => void;

}



const SALES_LIST_SELECT = `

  id,

  ticket_number,

  total_amount,

  payment_method,

  status,

  created_at,

  customer_name,

  customer_id,

  appointment_id,

  invoice_id,
  notes,
  company_id,
  host_company_id,
  sale_group_id
`;



const SALES_LIST_SELECT_FALLBACK = `

  id,

  ticket_number,

  total_amount,

  payment_method,

  status,

  created_at,

  customer_name,

  notes

`;



function defaultDateFrom() {

  return format(subDays(new Date(), 30), 'yyyy-MM-dd');

}



function defaultDateTo() {

  return format(new Date(), 'yyyy-MM-dd');

}



function itemSummaryFromNotes(notes: string | null | undefined): string {

  const parsed = parseAgendaSaleNotes(notes);

  const items = parsed?.items;

  if (!items?.length) return '—';

  if (items.length === 1) return items[0]?.name || '1 ítem';

  return `${items.length} ítems`;

}



export const SalesHistory: React.FC<SalesHistoryProps> = ({ onBack }) => {

  const navigate = useNavigate();

  const { companyId } = useCompanyFilter();
  const { isMultiEntity, billingCompanies, companyLabels } = useWorkCenter();

  const [dateFrom, setDateFrom] = useState(defaultDateFrom);

  const [dateTo, setDateTo] = useState(defaultDateTo);

  const [searchTerm, setSearchTerm] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');

  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [billingCompanyFilter, setBillingCompanyFilter] = useState<BillingCompanyFilter>('all');
  const [page, setPage] = useState(0);



  useEffect(() => {

    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);

    return () => window.clearTimeout(timer);

  }, [searchTerm]);



  useEffect(() => {

    setPage(0);

  }, [dateFrom, dateTo, debouncedSearch, invoiceFilter, paymentFilter, billingCompanyFilter]);



  const applyFilters = (query: ReturnType<typeof supabase.from>) => {

    let q = query;

    if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`);

    if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59`);

    if (debouncedSearch) {

      q = q.or(`ticket_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`);

    }

    if (paymentFilter !== 'all') q = q.eq('payment_method', paymentFilter);

    if (invoiceFilter === 'invoiced') q = q.not('invoice_id', 'is', null);

    if (invoiceFilter === 'pending') q = q.is('invoice_id', null);

    return q;

  };



  const queryKey = [

    'sales-history',

    companyId,

    dateFrom,

    dateTo,

    debouncedSearch,

    invoiceFilter,

    paymentFilter,
    billingCompanyFilter,
    page,

  ];



  const { data: listResult, isLoading, error, isFetching } = useQuery({

    queryKey,

    queryFn: async () => {

      if (!companyId) return { rows: [] as SaleRow[], total: 0, pageTotal: 0 };



      const from = page * PAGE_SIZE;

      const to = from + PAGE_SIZE - 1;



      for (const select of [SALES_LIST_SELECT, SALES_LIST_SELECT_FALLBACK] as const) {

        let query = applyFilters(
          supabase
            .from('sales')
            .select(select, { count: 'exact' })
            .order('created_at', { ascending: false }),
        );

        if (billingCompanyFilter !== 'all') {
          query = query.eq('company_id', billingCompanyFilter);
        } else if (isMultiEntity && billingCompanies.length > 1) {
          const ids = billingCompanies.map((c) => c.id).join(',');
          query = query.or(`host_company_id.eq.${companyId},company_id.in.(${ids})`);
        } else {
          query = query.eq('company_id', companyId);
        }



        const result = await query.range(from, to);

        if (!result.error) {

          const rows = (result.data ?? []) as SaleRow[];

          const pageTotal = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

          return { rows, total: result.count ?? rows.length, pageTotal };

        }

        if (!isSchemaColumnError(result.error)) throw result.error;

      }



      return { rows: [], total: 0, pageTotal: 0 };

    },

    enabled: !!companyId,

    placeholderData: (prev) => prev,

  });



  const sales = listResult?.rows ?? [];

  const totalCount = listResult?.total ?? 0;

  const pageTotal = listResult?.pageTotal ?? 0;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));



  const resolveAppointmentId = (sale: SaleRow) =>

    sale.appointment_id ?? parseAgendaSaleNotes(sale.notes)?.appointment_id ?? null;



  const resolveCustomerId = async (sale: SaleRow): Promise<string | null> => {

    const fromNotes = parseAgendaSaleNotes(sale.notes)?.customer_id;

    if (fromNotes) return String(fromNotes);

    if (sale.customer_id) return String(sale.customer_id);

    if (!sale.customer_name?.trim() || !companyId) return null;

    const name = sale.customer_name.trim();

    const { data } = await supabase

      .from('customers')

      .select('id')

      .eq('company_id', companyId)

      .ilike('name', name)

      .limit(1)

      .maybeSingle();

    return data?.id ? String(data.id) : null;

  };



  const fetchSaleItems = async (saleId: string) => {

    const { data, error: itemsError } = await supabase

      .from('sale_items')

      .select('description, quantity, unit_price, total_price')

      .eq('sale_id', saleId);

    if (itemsError) throw itemsError;

    return data ?? [];

  };



  const openInvoiceFromSale = async (sale: SaleRow) => {

    if (sale.invoice_id) {

      navigate(`/facturacion?invoice=${sale.invoice_id}`);

      return;

    }

    const customerId = await resolveCustomerId(sale);

    const appointmentId = resolveAppointmentId(sale);

    const saleItems = await fetchSaleItems(sale.id);

    const prefill = buildInvoicePrefillFromSale(

      {

        id: sale.id,

        ticket_number: sale.ticket_number,

        total_amount: Number(sale.total_amount ?? 0),

        status: sale.status ?? 'completed',

        created_at: sale.created_at,

        customer_id: customerId,

        appointment_id: appointmentId,

        invoice_id: null,

        notes: sale.notes ?? null,

      },

      saleItems,

      customerId,

      appointmentId,

    );

    sessionStorage.setItem(TPV_SALE_INVOICE_PREFILL_KEY, JSON.stringify(prefill));

    navigate('/facturacion');

  };



  const exportToCSV = () => {

    if (sales.length === 0) return;

    const headers = ['Ticket', 'Fecha', 'Total', 'Método de Pago', 'Estado', 'Cliente'];

    const csvContent = [

      headers.join(','),

      ...sales.map((sale) =>

        [

          sale.ticket_number,

          format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm'),

          sale.total_amount.toFixed(2),

          sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta',

          sale.status === 'completed' ? 'Completada' : sale.status,

          sale.customer_name || '',

        ].join(','),

      ),

    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);

    link.download = `ventas_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    link.click();

    URL.revokeObjectURL(link.href);

  };



  const rangeLabel = useMemo(() => {

    if (totalCount === 0) return 'Sin resultados';

    const from = page * PAGE_SIZE + 1;

    const to = Math.min(totalCount, (page + 1) * PAGE_SIZE);

    return `${from}–${to} de ${totalCount.toLocaleString('es-ES')}`;

  }, [page, totalCount]);



  return (

    <div className="space-y-6">

      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">

        <div className="flex items-start gap-3">

          <Button onClick={onBack} variant="outline" className="shrink-0 mt-1">

            <ArrowLeft className="w-4 h-4 mr-2" />

            Volver al TPV

          </Button>

          <div>

            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">

              <FileText className="w-7 h-7 text-blue-600" />

              Historial de Ventas

            </h1>

            <p className="text-sm text-gray-600 mt-1">

              Por defecto últimos 30 días · {PAGE_SIZE} por página

            </p>

          </div>

        </div>

        <div className="flex gap-2">

          <Button onClick={exportToCSV} variant="outline" disabled={sales.length === 0} size="sm">

            <Download className="w-4 h-4 mr-2" />

            CSV (página)

          </Button>

        </div>

      </div>



      <Card>

        <CardHeader className="pb-3">

          <CardTitle className="flex items-center text-base">

            <Filter className="w-4 h-4 mr-2" />

            Filtros y búsqueda

          </CardTitle>

        </CardHeader>

        <CardContent>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">

            <div>

              <Label htmlFor="dateFrom">Desde</Label>

              <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />

            </div>

            <div>

              <Label htmlFor="dateTo">Hasta</Label>

              <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

            </div>

            <div className="lg:col-span-2">

              <Label htmlFor="search">Buscar ticket o cliente</Label>

              <div className="relative">

                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

                <Input

                  id="search"

                  className="pl-8"

                  placeholder="Ej. LEG-1234 o nombre cliente"

                  value={searchTerm}

                  onChange={(e) => setSearchTerm(e.target.value)}

                />

              </div>

            </div>

            <div>

              <Label>Factura</Label>

              <Select value={invoiceFilter} onValueChange={(v) => setInvoiceFilter(v as InvoiceFilter)}>

                <SelectTrigger>

                  <SelectValue />

                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="all">Todas</SelectItem>

                  <SelectItem value="invoiced">Con factura</SelectItem>

                  <SelectItem value="pending">Sin facturar</SelectItem>

                </SelectContent>

              </Select>

            </div>

            <div>

              <Label>Pago</Label>

              <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}>

                <SelectTrigger>

                  <SelectValue />

                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="all">Todos</SelectItem>

                  <SelectItem value="cash">Efectivo</SelectItem>

                  <SelectItem value="card">Tarjeta</SelectItem>

                </SelectContent>

              </Select>

            </div>

            {isMultiEntity && billingCompanies.length > 1 && (
              <div>
                <Label>Empresa emisora</Label>
                <Select
                  value={billingCompanyFilter}
                  onValueChange={(v) => setBillingCompanyFilter(v as BillingCompanyFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas (centro laboral)</SelectItem>
                    {billingCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {companyLabels.get(c.id) ?? c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          </div>

          <div className="flex flex-wrap gap-2 mt-3">

            <Button

              variant="outline"

              size="sm"

              onClick={() => {

                setDateFrom(defaultDateFrom());

                setDateTo(defaultDateTo());

                setSearchTerm('');

                setInvoiceFilter('all');

                setPaymentFilter('all');

              }}

            >

              Últimos 30 días

            </Button>

            <Button

              variant="ghost"

              size="sm"

              onClick={() => {

                setDateFrom('');

                setDateTo('');

                setSearchTerm('');

                setInvoiceFilter('all');

                setPaymentFilter('all');

              }}

            >

              Limpiar filtros

            </Button>

          </div>

        </CardContent>

      </Card>



      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <Card>

          <CardContent className="p-5">

            <div className="text-2xl font-bold text-blue-600">{totalCount.toLocaleString('es-ES')}</div>

            <p className="text-sm text-gray-600">Ventas (filtro actual)</p>

          </CardContent>

        </Card>

        <Card>

          <CardContent className="p-5">

            <div className="text-2xl font-bold text-green-600">€{pageTotal.toFixed(2)}</div>

            <p className="text-sm text-gray-600">Total en esta página</p>

          </CardContent>

        </Card>

        <Card>

          <CardContent className="p-5">

            <div className="text-2xl font-bold text-purple-600">

              €{sales.length > 0 ? (pageTotal / sales.length).toFixed(2) : '0.00'}

            </div>

            <p className="text-sm text-gray-600">Media en página</p>

          </CardContent>

        </Card>

      </div>



      <Card>

        <CardHeader className="flex flex-row items-center justify-between pb-3">

          <CardTitle className="text-base">Listado</CardTitle>

          <span className="text-sm text-muted-foreground">{rangeLabel}{isFetching ? ' · actualizando…' : ''}</span>

        </CardHeader>

        <CardContent>

          {isLoading ? (

            <div className="text-center py-10 text-muted-foreground">Cargando ventas…</div>

          ) : error ? (

            <div className="text-center py-10 text-red-500">Error al cargar las ventas</div>

          ) : sales.length === 0 ? (

            <div className="text-center py-10 text-muted-foreground">

              No hay ventas con estos filtros. Prueba ampliar el rango de fechas.

            </div>

          ) : (

            <>

              <div className="overflow-x-auto">

                <Table>

                  <TableHeader>

                    <TableRow>

                      <TableHead>Ticket</TableHead>

                      <TableHead>Fecha</TableHead>

                      <TableHead>Total</TableHead>

                      <TableHead>Pago</TableHead>

                      <TableHead>Estado</TableHead>

                      <TableHead>Cliente</TableHead>

                      <TableHead>Cita</TableHead>

                      <TableHead>Ítems</TableHead>

                      <TableHead>Factura</TableHead>

                    </TableRow>

                  </TableHeader>

                  <TableBody>

                    {sales.map((sale) => (

                      <TableRow key={sale.id}>

                        <TableCell className="font-medium">{sale.ticket_number}</TableCell>

                        <TableCell>{format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>

                        <TableCell className="font-medium">€{Number(sale.total_amount).toFixed(2)}</TableCell>

                        <TableCell>

                          <span

                            className={`px-2 py-0.5 rounded-full text-xs ${

                              sale.payment_method === 'cash'

                                ? 'bg-green-100 text-green-800'

                                : 'bg-blue-100 text-blue-800'

                            }`}

                          >

                            {sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}

                          </span>

                        </TableCell>

                        <TableCell>

                          <span

                            className={`px-2 py-0.5 rounded-full text-xs ${

                              sale.status === 'completed'

                                ? 'bg-green-100 text-green-800'

                                : 'bg-yellow-100 text-yellow-800'

                            }`}

                          >

                            {sale.status === 'completed' ? 'Completada' : sale.status}

                          </span>

                        </TableCell>

                        <TableCell>{sale.customer_name || '—'}</TableCell>

                        <TableCell>

                          {(() => {

                            const aptId = resolveAppointmentId(sale);

                            if (!aptId) return '—';

                            const parsed = parseAgendaSaleNotes(sale.notes);

                            return (

                              <Button

                                variant="link"

                                className="h-auto p-0 text-xs"

                                onClick={() =>

                                  navigate(

                                    `/agenda?appointment=${aptId}${parsed?.appointment_date ? `&date=${parsed.appointment_date}` : ''}`,

                                  )

                                }

                              >

                                Agenda

                              </Button>

                            );

                          })()}

                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">

                          {itemSummaryFromNotes(sale.notes)}

                        </TableCell>

                        <TableCell>

                          {sale.invoice_id ? (

                            <Button

                              variant="link"

                              className="h-auto p-0 text-xs text-emerald-700"

                              onClick={() => navigate(`/facturacion?invoice=${sale.invoice_id}`)}

                            >

                              Ver factura

                            </Button>

                          ) : sale.status === 'completed' ? (

                            <Button

                              variant="outline"

                              size="sm"

                              className="h-7 text-xs"

                              onClick={() => void openInvoiceFromSale(sale)}

                            >

                              <Receipt className="w-3 h-3 mr-1" />

                              Facturar

                            </Button>

                          ) : (

                            '—'

                          )}

                        </TableCell>

                      </TableRow>

                    ))}

                  </TableBody>

                </Table>

              </div>

              <div className="flex items-center justify-between mt-4">

                <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>

                  <ChevronLeft className="w-4 h-4 mr-1" />

                  Anterior

                </Button>

                <span className="text-sm text-muted-foreground">

                  Página {page + 1} de {totalPages}

                </span>

                <Button

                  variant="outline"

                  size="sm"

                  disabled={page + 1 >= totalPages}

                  onClick={() => setPage((p) => p + 1)}

                >

                  Siguiente

                  <ChevronRight className="w-4 h-4 ml-1" />

                </Button>

              </div>

            </>

          )}

        </CardContent>

      </Card>

    </div>

  );

};


