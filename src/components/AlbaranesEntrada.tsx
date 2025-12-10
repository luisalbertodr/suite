import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Eye, Trash2, Search, Package, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { AlbaranEntradaForm } from './AlbaranEntradaForm';
import { AlbaranEntradaView } from './AlbaranEntradaView';
import { PDFUploadModal } from './PDFUploadModal';
import { OCRReviewModal } from './OCRReviewModal';

interface DeliveryNoteEntry {
  id: string;
  number: string;
  supplier_id: string;
  issue_date: string;
  delivery_date: string | null;
  status: string;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  suppliers: {
    name: string;
  } | null;
}

export const AlbaranesEntrada: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showPDFUpload, setShowPDFUpload] = useState(false);
  const [showOCRReview, setShowOCRReview] = useState(false);
  const [ocrData, setOcrData] = useState<any>(null);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<DeliveryNoteEntry | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  console.log('AlbaranesEntrada - Component state:', {
    showForm,
    showView,
    selectedDeliveryNote: selectedDeliveryNote?.id || null,
    companyId,
    companyLoading
  });

  const { data: deliveryNotes = [], isLoading } = useQuery({
    queryKey: ['delivery-notes-entrada', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping delivery notes query');
        return [];
      }

      console.log('Fetching delivery notes for company:', companyId);

      const { data, error } = await supabase
        .from('delivery_notes')
        .select(`
          id,
          number,
          supplier_id,
          issue_date,
          delivery_date,
          status,
          notes,
          subtotal,
          tax_amount,
          total_amount,
          suppliers (
            name
          )
        `)
        .eq('company_id', companyId)
        .not('supplier_id', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching delivery notes:', error);
        throw error;
      }
      console.log('Fetched delivery notes:', data?.length || 0);
      return data as unknown as DeliveryNoteEntry[];
    },
    enabled: !!companyId && !companyLoading,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return data;
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
      queryClient.invalidateQueries({ queryKey: ['delivery-notes-entrada'] });
      toast({
        title: "Albarán eliminado",
        description: "El albarán ha sido eliminado correctamente."
      });
    }
  });

  const createFromOCRMutation = useMutation({
    mutationFn: async (data: any) => {
      // Create delivery note
      const { data: newNote, error: noteError } = await supabase
        .from('delivery_notes')
        .insert([{
          number: data.deliveryNote.number,
          supplier_id: data.deliveryNote.supplier_id,
          issue_date: data.deliveryNote.issue_date,
          delivery_date: data.deliveryNote.delivery_date,
          status: data.deliveryNote.status,
          notes: data.deliveryNote.notes,
          subtotal: data.deliveryNote.subtotal,
          tax_amount: data.deliveryNote.tax_amount,
          total_amount: data.deliveryNote.total_amount,
        }])
        .select()
        .single();

      if (noteError) throw noteError;

      // Create items
      const itemsToInsert = data.items.map(item => ({
        delivery_note_id: newNote.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      const { error: itemsError } = await supabase
        .from('delivery_note_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return newNote.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes-entrada'] });
      toast({
        title: "Albarán creado desde PDF",
        description: "El albarán ha sido creado exitosamente desde el PDF procesado."
      });
      setShowOCRReview(false);
      setOcrData(null);
    },
    onError: (error) => {
      console.error('Error creating delivery note from OCR:', error);
      toast({
        title: "Error",
        description: "Ha ocurrido un error al crear el albarán desde el PDF.",
        variant: "destructive"
      });
    }
  });

  const filteredNotes = deliveryNotes.filter(note =>
    note.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (note.suppliers?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const handleView = (deliveryNote: DeliveryNoteEntry) => {
    console.log('handleView called with:', deliveryNote);
    setSelectedDeliveryNote(deliveryNote);
    setShowView(true);
  };

  const handleEdit = (deliveryNote: DeliveryNoteEntry) => {
    console.log('handleEdit called with:', deliveryNote);
    setSelectedDeliveryNote(deliveryNote);
    setShowForm(true);
  };

  const handleFormClose = () => {
    console.log('handleFormClose called');
    setShowForm(false);
    setSelectedDeliveryNote(null);
  };

  const handleViewClose = () => {
    console.log('handleViewClose called');
    setShowView(false);
    setSelectedDeliveryNote(null);
  };

  const handleNewDeliveryNote = () => {
    console.log('handleNewDeliveryNote called');
    setSelectedDeliveryNote(null);
    setShowForm(true);
  };

  const handlePDFProcessed = (data: any) => {
    setOcrData(data);
    setShowPDFUpload(false);
    setShowOCRReview(true);
  };

  const handleOCRConfirm = (processedData: any) => {
    createFromOCRMutation.mutate(processedData);
  };

  // Loading company info
  if (companyLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando información de la empresa...</span>
      </div>
    );
  }

  // No company found
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
  if (showView && selectedDeliveryNote) {
    return (
      <AlbaranEntradaView
        deliveryNote={selectedDeliveryNote}
        onClose={handleViewClose}
        onEdit={() => {
          setShowView(false);
          setShowForm(true);
        }}
      />
    );
  }

  // Show form when requested
  if (showForm) {
    console.log('Rendering AlbaranEntradaForm with:', { selectedDeliveryNote: selectedDeliveryNote?.id || 'new' });
    return (
      <AlbaranEntradaForm
        deliveryNote={selectedDeliveryNote}
        onClose={handleFormClose}
      />
    );
  }

  // Loading delivery notes
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Cargando albaranes...</p>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Albaranes de Entrada</h1>
            <p className="text-gray-600 mt-2">Gestión de albaranes de recepción de mercancía</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setShowPDFUpload(true)}
              variant="outline"
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-green-500"
            >
              <FileText className="w-4 h-4 mr-2" />
              Procesar PDF
            </Button>
            <Button 
              onClick={handleNewDeliveryNote}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Albarán
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por número o proveedor..."
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
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay albaranes registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Número</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Proveedor</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha Emisión</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha Entrega</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Subtotal</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">IVA</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Total</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Estado</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotes.map((note) => (
                      <tr key={note.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{note.number}</td>
                        <td className="py-3 px-4">{note.suppliers?.name || 'N/A'}</td>
                        <td className="py-3 px-4">{new Date(note.issue_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          {note.delivery_date ? new Date(note.delivery_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4">{note.subtotal.toFixed(2)} €</td>
                        <td className="py-3 px-4">{note.tax_amount.toFixed(2)} €</td>
                        <td className="py-3 px-4 font-medium">{note.total_amount.toFixed(2)} €</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(note.status)}`}>
                            {getStatusText(note.status)}
                          </span>
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

      <PDFUploadModal
        isOpen={showPDFUpload}
        onClose={() => setShowPDFUpload(false)}
        onProcessed={handlePDFProcessed}
      />

      <OCRReviewModal
        isOpen={showOCRReview}
        onClose={() => {
          setShowOCRReview(false);
          setOcrData(null);
        }}
        ocrData={ocrData}
        suppliers={suppliers}
        onConfirm={handleOCRConfirm}
      />
    </>
  );
};

export default AlbaranesEntrada;
