import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, Users, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClienteForm } from './ClienteForm';
import { ClienteDetailView } from './ClienteDetailView';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { CUSTOMER_SEARCH_MIN_CHARS, isCustomerSearchQueryReady } from '@/lib/customerSearch';
import { formatCustomerPhoneLabels } from '@/lib/legacyCustomerPhones';

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
}

type View = 'list' | 'form' | 'detail';
type DetailTab = 'timeline' | 'vouchers' | 'ficha';

export const Clientes: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<View>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('timeline');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { operationalCompanyId, loading: wcLoading } = useWorkCenter();
  const catalogCompanyId = operationalCompanyId ?? companyId;

  const { customers: searchResults, isLoading } = useCustomerSearch(catalogCompanyId, searchTerm);

  useEffect(() => {
    const customerId = searchParams.get('customer');
    if (!customerId) return;
    const tab = searchParams.get('tab');
    setSelectedCustomerId(customerId);
    setDetailTab(tab === 'ficha' || tab === 'vouchers' ? tab : 'timeline');
    setView('detail');
  }, [searchParams]);

  const clearCustomerUrlParams = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('customer');
    next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  const openCustomerDetail = (customerId: string, tab: DetailTab = 'timeline') => {
    setSelectedCustomerId(customerId);
    setDetailTab(tab);
    setView('detail');
    const next = new URLSearchParams(searchParams);
    next.set('customer', customerId);
    if (tab !== 'timeline') next.set('tab', tab);
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-search'] });
      toast({ title: 'Cliente eliminado' });
    },
    onError: () => toast({ title: 'Error al eliminar', variant: 'destructive' }),
  });

  if (companyLoading) {
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
        key={`${selectedCustomerId}-${detailTab}`}
        customerId={selectedCustomerId}
        initialTab={detailTab}
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

  const searchHintReady = isCustomerSearchQueryReady(searchTerm);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        </div>
        <Button
          onClick={() => {
            setSelectedCustomer(null);
            setView('form');
          }}
          className="bg-sky-500 hover:bg-sky-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" /> Lista de Clientes
            </CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={`Buscar (mín. ${CUSTOMER_SEARCH_MIN_CHARS} letras o números)…`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
                autoFocus
              />
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
                      No se encontraron clientes para «{searchTerm.trim()}»
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                              if (window.confirm('¿Eliminar este cliente?')) {
                                deleteCustomerMutation.mutate(customer.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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
