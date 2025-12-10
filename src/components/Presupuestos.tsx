import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Edit2, Eye, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PresupuestoForm } from './PresupuestoForm';
import { PresupuestoView } from './PresupuestoView';
import { Quote } from '@/types/quote';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export const Presupuestos: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['quotes', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping quotes query');
        return [];
      }

      console.log('Fetching quotes for company:', companyId);

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customers (
            name,
            email
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotes:', error);
        throw error;
      }
      
      console.log('Fetched quotes:', data?.length || 0);
      return data;
    },
    enabled: !!companyId && !companyLoading,
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes', companyId] });
      toast({
        title: "Presupuesto eliminado",
        description: "El presupuesto ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el presupuesto.",
        variant: "destructive",
      });
    },
  });

  const filteredQuotes = quotes?.filter(quote =>
    quote.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.customers?.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleEdit = (quote: any) => {
    setSelectedQuote(quote as Quote);
    setShowForm(true);
  };

  const handleView = (quote: any) => {
    setSelectedQuote(quote as Quote);
    setShowView(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este presupuesto?')) {
      deleteQuoteMutation.mutate(id);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedQuote(null);
  };

  const handleViewClose = () => {
    setShowView(false);
    setSelectedQuote(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-green-600 bg-green-100';
      case 'sent': return 'text-blue-600 bg-blue-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'expired': return 'text-gray-600 bg-gray-100';
      default: return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Borrador';
      case 'sent': return 'Enviado';
      case 'accepted': return 'Aceptado';
      case 'rejected': return 'Rechazado';  
      case 'expired': return 'Expirado';
      default: return status;
    }
  };

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
      <PresupuestoForm
        quote={selectedQuote}
        onClose={handleFormClose}
      />
    );
  }

  if (showView && selectedQuote) {
    return (
      <PresupuestoView
        quote={selectedQuote}
        onClose={handleViewClose}
        onEdit={() => {
          setShowView(false);
          setShowForm(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Presupuestos</h1>
          <p className="text-gray-600 mt-2">Gestión de presupuestos y cotizaciones</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Presupuesto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Lista de Presupuestos</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar presupuestos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Válido Hasta</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No se encontraron presupuestos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => handleEdit(quote)}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {quote.number}
                        </button>
                      </TableCell>
                      <TableCell>{quote.customers?.name || 'N/A'}</TableCell>
                      <TableCell>{new Date(quote.issue_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(quote.valid_until).toLocaleDateString()}</TableCell>
                      <TableCell>€{quote.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}>
                          {getStatusText(quote.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(quote)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(quote)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(quote.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
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
