
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Eye, Trash2, Search, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { AlbaranSalidaForm } from './AlbaranSalidaForm';
import { AlbaranSalidaView } from './AlbaranSalidaView';

interface DispatchNote {
  id: string;
  number: string;
  customer_id: string;
  supplier_id: string;
  issue_date: string;
  delivery_date: string | null;
  status: string;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  customers: {
    name: string;
  } | null;
}

export const AlbaranesSalida: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [selectedDispatchNote, setSelectedDispatchNote] = useState<DispatchNote | null>(null);
  const [budgetData, setBudgetData] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const location = useLocation();

  // Query for dispatch notes - filtering by customer_id (not supplier_id) for outbound delivery notes
  const { data: dispatchNotes = [], isLoading } = useQuery({
    queryKey: ['dispatch-notes', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping dispatch notes query');
        return [];
      }

      console.log('Fetching dispatch notes for company:', companyId);

      const { data, error } = await supabase
        .from('delivery_notes')
        .select(`
          id,
          number,
          customer_id,
          issue_date,
          delivery_date,
          status,
          notes,
          subtotal,
          tax_amount,
          total_amount,
          customers (
            name
          )
        `)
        .eq('company_id', companyId)
        .not('customer_id', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching dispatch notes:', error);
        throw error;
      }
      console.log('Fetched dispatch notes:', data?.length || 0);
      return data as unknown as DispatchNote[];
    },
    enabled: !!companyId && !companyLoading,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('delivery_notes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-notes'] });
      toast({
        title: "Albarán eliminado",
        description: "El albarán de salida ha sido eliminado correctamente."
      });
    }
  });

  const filteredNotes = dispatchNotes.filter(note =>
    note.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (note.customers?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'dispatched': return 'text-blue-600 bg-blue-50';
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'dispatched': return 'Despachado';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const handleView = (dispatchNote: DispatchNote) => {
    setSelectedDispatchNote(dispatchNote);
    setShowView(true);
  };

  const handleEdit = (dispatchNote: DispatchNote) => {
    setSelectedDispatchNote(dispatchNote);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedDispatchNote(null);
    setBudgetData(null); // Clear budget data when closing form
  };

  const handleViewClose = () => {
    setShowView(false);
    setSelectedDispatchNote(null);
  };

  // Check for budget data from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('from') === 'presupuesto-n') {
      const storedData = sessionStorage.getItem('deliveryNoteFromBudget');
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          setBudgetData(data);
          setShowForm(true);
          // Clear the stored data after using it
          sessionStorage.removeItem('deliveryNoteFromBudget');
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

  // Show view when requested
  if (showView && selectedDispatchNote) {
    return (
      <AlbaranSalidaView
        deliveryNote={selectedDispatchNote}
        onClose={handleViewClose}
        onEdit={() => {
          setShowView(false);
          setShowForm(true);
        }}
      />
    );
  }

  if (showForm) {
    return (
      <AlbaranSalidaForm
        deliveryNote={selectedDispatchNote}
        onClose={handleFormClose}
        budgetData={budgetData}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Cargando albaranes de salida...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Albaranes de Salida</h1>
          <p className="text-gray-600 mt-2">Gestión de albaranes de despacho de mercancía</p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Albarán de Salida
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por número o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredNotes.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No hay albaranes de salida registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Número</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha Emisión</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha Despacho</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Estado</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Total</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotes.map((note) => (
                    <tr key={note.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{note.number}</td>
                      <td className="py-3 px-4">{note.customers?.name || 'N/A'}</td>
                      <td className="py-3 px-4">{new Date(note.issue_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        {note.delivery_date ? new Date(note.delivery_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(note.status)}`}>
                          {getStatusText(note.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        €{note.total_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleView(note)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(note)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => deleteMutation.mutate(note.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AlbaranesSalida;
