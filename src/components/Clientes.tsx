import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, Users, Mail, Phone, MapPin, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClienteForm } from './ClienteForm';
import { ClienteDetailView } from './ClienteDetailView';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

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

export const Clientes: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<View>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!companyId && !companyLoading,
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      toast({ title: "Cliente eliminado" });
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const filteredCustomers = customers?.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tax_id?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (companyLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-64 text-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">No se encontró empresa</h2>
          <p className="text-muted-foreground mt-2">Contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  // Detail view
  if (view === 'detail' && selectedCustomerId) {
    return (
      <ClienteDetailView
        customerId={selectedCustomerId}
        onBack={() => { setView('list'); setSelectedCustomerId(null); }}
      />
    );
  }

  // Form view
  if (view === 'form') {
    return (
      <ClienteForm
        customer={selectedCustomer}
        onClose={() => { setView('list'); setSelectedCustomer(null); }}
      />
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de clientes</p>
        </div>
        <Button
          onClick={() => { setSelectedCustomer(null); setView('form'); }}
          className="bg-sky-500 hover:bg-sky-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" /> Lista de Clientes
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No se encontraron clientes
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className="cursor-pointer hover:bg-sky-50/50 dark:hover:bg-sky-950/20" onClick={() => { setSelectedCustomerId(customer.id); setView('detail'); }}>
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
                          {customer.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" /> {customer.email}</div>}
                          {customer.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" /> {customer.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{customer.tax_id || '—'}</TableCell>
                      <TableCell className="text-sm">{customer.address_city || '—'}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedCustomer(customer); setView('form'); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                            if (window.confirm('¿Eliminar este cliente?')) deleteCustomerMutation.mutate(customer.id);
                          }}>
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
