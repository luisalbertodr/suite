import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Archive, ArchiveRestore, Plus, Search, Edit2, Users, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClienteForm } from './ClienteForm';
import { ClienteDetailView } from './ClienteDetailView';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useCustomerSearch, type CustomerListMode } from '@/hooks/useCustomerSearch';
import { CUSTOMER_SEARCH_MIN_CHARS, isCustomerSearchQueryReady } from '@/lib/customerSearch';
import { formatCustomerPhoneLabels } from '@/lib/legacyCustomerPhones';
import type { ClienteDetailTab } from '@/types/clienteDetail';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';

interface Customer {
  id: string;
  name: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country?: string;
  contact_person?: string;
  payment_terms?: number;
  credit_limit?: number;
  notes?: string;
  photo_url?: string;
  archived_at?: string | null;
}

type View = 'list' | 'form' | 'detail';

const CLIENTE_DETAIL_TABS: ClienteDetailTab[] = [
  'timeline',
  'ficha',
  'vouchers',
  'inbody',
  'historial',
  'adjuntos',
  'cuestionario',
];

function parseClienteDetailTab(tab: string | null): ClienteDetailTab {
  if (tab && CLIENTE_DETAIL_TABS.includes(tab as ClienteDetailTab)) {
    return tab as ClienteDetailTab;
  }
  return 'timeline';
}

export const Clientes: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [listMode, setListMode] = useState<CustomerListMode>('active');
  const [view, setView] = useState<View>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<ClienteDetailTab>('timeline');
  const [initialQuestionnaireId, setInitialQuestionnaireId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { operationalCompanyId, loading: wcLoading } = useWorkCenter();
  const catalogCompanyId = operationalCompanyId ?? companyId;

  const { customers: searchResults, isLoading } = useCustomerSearch(
    catalogCompanyId,
    searchTerm,
    listMode,
  );

  useEffect(() => {
    const customerId = searchParams.get('customer');
    if (!customerId) return;
    const tab = searchParams.get('tab');
    const questionnaireId = searchParams.get('questionnaire');
    setSelectedCustomerId(customerId);
    setDetailTab(parseClienteDetailTab(tab));
    setInitialQuestionnaireId(questionnaireId);
    setView('detail');
  }, [searchParams]);

  const clearCustomerUrlParams = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('customer');
    next.delete('tab');
    next.delete('questionnaire');
    setSearchParams(next, { replace: true });
    setInitialQuestionnaireId(null);
  };

  const openCustomerDetail = (customerId: string, tab: ClienteDetailTab = 'timeline') => {
    setSelectedCustomerId(customerId);
    setDetailTab(tab);
    setView('detail');
    const next = new URLSearchParams(searchParams);
    next.set('customer', customerId);
    if (tab !== 'timeline') next.set('tab', tab);
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  const invalidateCustomerQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['customers-search'] });
    queryClient.invalidateQueries({ queryKey: ['customer-lookup'] });
  };

  const archiveCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCustomerQueries();
      toast({ title: 'Cliente archivado' });
    },
    onError: () => toast({ title: 'Error al archivar', variant: 'destructive' }),
  });

  const restoreCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .update({ archived_at: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCustomerQueries();
      toast({ title: 'Cliente restaurado' });
    },
    onError: () => toast({ title: 'Error al restaurar', variant: 'destructive' }),
  });

  const openNewCustomerForm = () => {
    setSelectedCustomer(null);
    setView('form');
  };

  const topBarActions = useMemo(() => (
    <Button
      onClick={openNewCustomerForm}
      className="h-7 bg-sky-500 px-2 text-xs text-white hover:bg-sky-600"
    >
      <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo Cliente
    </Button>
  ), []);

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <Users className="w-4 h-4 text-pink-500" />
          Clientes
        </span>
      ),
      actions: topBarActions,
    },
    [topBarActions],
  );

  if (companyLoading || wcLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (!catalogCompanyId) {
    return (
      <div className="flex justify-center items-center h-64 text-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">No se encontró empresa</h2>
          <p className="text-muted-foreground mt-2">Contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedCustomerId) {
    return (
      <ClienteDetailView
        key={`${selectedCustomerId}-${detailTab}-${initialQuestionnaireId ?? ''}`}
        customerId={selectedCustomerId}
        initialTab={detailTab}
        initialQuestionnaireId={initialQuestionnaireId}
        onBack={() => {
          setView('list');
          setSelectedCustomerId(null);
          clearCustomerUrlParams();
        }}
      />
    );
  }

  if (view === 'form') {
    return (
      <ClienteForm
        customer={selectedCustomer}
        onClose={() => {
          setView('list');
          setSelectedCustomer(null);
        }}
      />
    );
  }

  const searchHintReady = listMode === 'archived' || isCustomerSearchQueryReady(searchTerm);
  const isArchivedMode = listMode === 'archived';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              {isArchivedMode ? 'Clientes archivados' : 'Lista de Clientes'}
            </CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                type="button"
                variant={isArchivedMode ? 'default' : 'outline'}
                onClick={() => {
                  setListMode(isArchivedMode ? 'active' : 'archived');
                  setSearchTerm('');
                }}
                className="h-9 shrink-0"
              >
                <Archive className="w-4 h-4 mr-2" />
                {isArchivedMode ? 'Ver activos' : 'Archivados'}
              </Button>
              {!isArchivedMode && (
                <Button
                  type="button"
                  onClick={openNewCustomerForm}
                  className="h-9 shrink-0 bg-sky-500 text-white hover:bg-sky-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Cliente
                </Button>
              )}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={
                    isArchivedMode
                      ? 'Buscar archivados…'
                      : `Buscar (mín. ${CUSTOMER_SEARCH_MIN_CHARS} letras o números)…`
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!searchHintReady ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Escribe al menos {CUSTOMER_SEARCH_MIN_CHARS} letras o {CUSTOMER_SEARCH_MIN_CHARS} números para buscar clientes.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Nombre, DNI, teléfono, email o código legacy.
              </p>
              <Button
                type="button"
                onClick={openNewCustomerForm}
                className="mt-6 bg-sky-500 text-white hover:bg-sky-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Cliente
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>DNI/CIF</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {isArchivedMode
                        ? searchTerm.trim()
                          ? `No hay archivados para «${searchTerm.trim()}»`
                          : 'No hay clientes archivados'
                        : `No se encontraron clientes para «${searchTerm.trim()}»`}
                    </TableCell>
                  </TableRow>
                ) : (
                  searchResults.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-sky-50/50 dark:hover:bg-sky-950/20"
                      onClick={() => openCustomerDetail(customer.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                            {customer.photo_url ? (
                              <img src={customer.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                                {customer.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-sm">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {customer.email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="w-3 h-3" /> {customer.email}
                            </div>
                          )}
                          {formatCustomerPhoneLabels(customer).map((label) => (
                            <div key={label} className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="w-3 h-3" /> {label}
                            </div>
                          ))}
                          {!formatCustomerPhoneLabels(customer).length && customer.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="w-3 h-3" /> {customer.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{customer.tax_id || '—'}</TableCell>
                      <TableCell className="text-sm">{customer.address_city || '—'}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {!isArchivedMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setView('form');
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {isArchivedMode ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-sky-600"
                              title="Restaurar cliente"
                              onClick={() => {
                                if (window.confirm('¿Restaurar este cliente archivado?')) {
                                  restoreCustomerMutation.mutate(customer.id);
                                }
                              }}
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-amber-600"
                              title="Archivar cliente"
                              onClick={() => {
                                if (window.confirm('¿Archivar este cliente? Podrás recuperarlo después.')) {
                                  archiveCustomerMutation.mutate(customer.id);
                                }
                              }}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
