import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FacturaForm } from './FacturaForm';
import { FacturaView } from './FacturaView';
import { VerifactuStatus } from './VerifactuStatus';
import { VerifactuCertificates } from './VerifactuCertificates';
import { VerifactuXMLDocuments } from './VerifactuXMLDocuments';
import { VerifactuQueueMonitor } from './VerifactuQueueMonitor';
import { Plus, Search, FileText, Settings, History, File, ListOrdered } from 'lucide-react';
import { format } from 'date-fns';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export const Facturas: React.FC = () => {
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('invoices');
  const [budgetData, setBudgetData] = useState<any>(null);
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const location = useLocation();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', searchTerm, companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping invoices query');
        return [];
      }

      console.log('Fetching invoices for company:', companyId);

      let query = supabase
        .from('invoices')
        .select(`
          *,
          customers!inner(name, tax_id),
          companies!inner(name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`number.ilike.%${searchTerm}%,customers.name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching invoices:', error);
        throw error;
      }
      
      console.log('Fetched invoices:', data?.length || 0);
      return data;
    },
    enabled: !!companyId && !companyLoading,
  });

  const { data: verifactuLogs } = useQuery({
    queryKey: ['verifactu-logs', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('verifactu_logs')
        .select(`
          *,
          invoices!inner(number)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !companyLoading,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setBudgetData(null); // Clear budget data when closing form
  };

  const handleEditInvoice = () => {
    setShowForm(true);
    setSelectedInvoice(null);
  };

  // Check for budget data from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('from') === 'presupuesto-n') {
      const storedData = sessionStorage.getItem('invoiceFromBudget');
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          setBudgetData(data);
          setShowForm(true);
          // Clear the stored data after using it
          sessionStorage.removeItem('invoiceFromBudget');
        } catch (error) {
          console.error('Error parsing budget data:', error);
        }
      }
    }
  }, [location.search]);

  if (companyLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando información de la empresa...</span>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">No se encontró información de empresa</h2>
          <p className="text-gray-500 mt-2">Por favor, contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <FacturaForm 
        onClose={handleFormClose}
        budgetData={budgetData}
      />
    );
  }

  if (selectedInvoice) {
    return (
      <FacturaView 
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onEdit={handleEditInvoice}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Facturas</h1>
          <p className="text-gray-600">Gestiona tus facturas y su integración con Verifactu</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Factura
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="invoices" className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>Facturas</span>
          </TabsTrigger>
          <TabsTrigger value="certificates" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Certificados</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center space-x-2">
            <History className="w-4 h-4" />
            <span>Historial</span>
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center space-x-2">
            <ListOrdered className="w-4 h-4" />
            <span>Cola</span>
          </TabsTrigger>
          <TabsTrigger value="xml-docs" className="flex items-center space-x-2">
            <File className="w-4 h-4" />
            <span>XML Docs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar facturas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid gap-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-500 mt-2">Cargando facturas...</p>
              </div>
            ) : invoices?.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No hay facturas</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm ? 'No se encontraron facturas con ese criterio.' : 'Crea tu primera factura para comenzar.'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setShowForm(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nueva Factura
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              invoices?.map((invoice) => (
                <Card key={invoice.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <FileText className="w-5 h-5" />
                          <span>{invoice.number}</span>
                          {invoice.is_corrective && (
                            <Badge variant="outline">Rectificativa</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {invoice.customers?.name} • {format(new Date(invoice.issue_date), 'dd/MM/yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status === 'paid' ? 'Pagada' : 
                           invoice.status === 'overdue' ? 'Vencida' : 'Pendiente'}
                        </Badge>
                        <span className="text-lg font-semibold">
                          {invoice.total_amount?.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <p>Vencimiento: {format(new Date(invoice.due_date), 'dd/MM/yyyy')}</p>
                        {invoice.corrective_reason && (
                          <p>Motivo rectificación: {invoice.corrective_reason}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <VerifactuStatus invoice={invoice} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          Ver detalles
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="certificates">
          <VerifactuCertificates />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Operaciones Verifactu</CardTitle>
              <CardDescription>
                Registro de todas las operaciones realizadas con el sistema Verifactu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {verifactuLogs?.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {log.action === 'send' ? 'Envío' : 
                         log.action === 'query' ? 'Consulta' : 'Anulación'} - 
                        Factura {log.invoices?.number}
                      </p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                      {log.error_message && (
                        <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                      )}
                    </div>
                    <Badge variant={log.status === 'accepted' ? 'default' : 
                                  log.status === 'error' ? 'destructive' : 'secondary'}>
                      {log.status === 'accepted' ? 'Éxito' : 
                       log.status === 'error' ? 'Error' : log.status}
                    </Badge>
                  </div>
                ))}
                {verifactuLogs?.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay operaciones Verifactu registradas
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue">
          <VerifactuQueueMonitor />
        </TabsContent>

        <TabsContent value="xml-docs">
          <VerifactuXMLDocuments />
        </TabsContent>
      </Tabs>
    </div>
  );
};
