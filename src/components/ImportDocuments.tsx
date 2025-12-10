
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Package, Import, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImportDocumentsProps {
  customerId: string;
  onImportItems: (items: any[], documentRefs: { [key: string]: { type: string; number: string } }, quoteIds?: string[]) => void;
  onClose: () => void;
}

export const ImportDocuments: React.FC<ImportDocumentsProps> = ({ 
  customerId, 
  onImportItems, 
  onClose 
}) => {
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [selectedDeliveryNotes, setSelectedDeliveryNotes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'quotes' | 'delivery_notes'>('quotes');
  const { toast } = useToast();

  // Obtener presupuestos aceptados y NO facturados del cliente
  const { data: quotes } = useQuery({
    queryKey: ['quotes-accepted-not-invoiced', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('customer_id', customerId)
        .eq('status', 'accepted')
        .eq('invoiced', false) // Solo presupuestos no facturados
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  // Obtener albaranes de salida del cliente
  const { data: deliveryNotes } = useQuery({
    queryKey: ['delivery-notes', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('*')
        .eq('customer_id', customerId)
        .in('status', ['delivered', 'pending'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  // Obtener elementos de presupuestos seleccionados
  const { data: quoteItems } = useQuery({
    queryKey: ['quote-items', selectedQuotes],
    queryFn: async () => {
      if (selectedQuotes.length === 0) return [];
      
      const { data, error } = await supabase
        .from('quote_items')
        .select('*, quotes(number)')
        .in('quote_id', selectedQuotes);
      
      if (error) throw error;
      return data;
    },
    enabled: selectedQuotes.length > 0,
  });

  // Obtener elementos de albaranes seleccionados
  const { data: deliveryNoteItems } = useQuery({
    queryKey: ['delivery-note-items', selectedDeliveryNotes],
    queryFn: async () => {
      if (selectedDeliveryNotes.length === 0) return [];
      
      const { data, error } = await supabase
        .from('delivery_note_items')
        .select('*, delivery_notes(number)')
        .in('delivery_note_id', selectedDeliveryNotes);
      
      if (error) throw error;
      return data;
    },
    enabled: selectedDeliveryNotes.length > 0,
  });

  const handleQuoteSelection = (quoteId: string, checked: boolean) => {
    if (checked) {
      setSelectedQuotes([...selectedQuotes, quoteId]);
    } else {
      setSelectedQuotes(selectedQuotes.filter(id => id !== quoteId));
    }
  };

  const handleDeliveryNoteSelection = (deliveryNoteId: string, checked: boolean) => {
    if (checked) {
      setSelectedDeliveryNotes([...selectedDeliveryNotes, deliveryNoteId]);
    } else {
      setSelectedDeliveryNotes(selectedDeliveryNotes.filter(id => id !== deliveryNoteId));
    }
  };

  const handleImport = () => {
    const importedItems: any[] = [];
    const documentRefs: { [key: string]: { type: string; number: string } } = {};
    let itemIndex = 0;

    // Procesar elementos de presupuestos
    if (quoteItems) {
      quoteItems.forEach((item: any) => {
        const invoiceItem = {
          description: `${item.description} (Presupuesto: ${item.quotes?.number})`,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          source_document_type: 'quote',
          source_document_id: item.quote_id,
          source_document_number: item.quotes?.number,
        };
        importedItems.push(invoiceItem);
        documentRefs[itemIndex] = {
          type: 'Presupuesto',
          number: item.quotes?.number || 'N/A'
        };
        itemIndex++;
      });
    }

    // Procesar elementos de albaranes
    if (deliveryNoteItems) {
      deliveryNoteItems.forEach((item: any) => {
        const invoiceItem = {
          description: `${item.description} (Albarán: ${item.delivery_notes?.number})`,
          quantity: item.quantity,
          unit_price: 0, // Los albaranes no tienen precio, se debe establecer manualmente
          total_price: 0,
          source_document_type: 'delivery_note',
          source_document_id: item.delivery_note_id,
          source_document_number: item.delivery_notes?.number,
        };
        importedItems.push(invoiceItem);
        documentRefs[itemIndex] = {
          type: 'Albarán',
          number: item.delivery_notes?.number || 'N/A'
        };
        itemIndex++;
      });
    }

    if (importedItems.length === 0) {
      toast({
        title: "Sin elementos",
        description: "No hay elementos seleccionados para importar.",
        variant: "destructive",
      });
      return;
    }

    // Añadir información de los IDs de los presupuestos seleccionados para marcarlos como facturados
    const importData = {
      items: importedItems,
      documentRefs: documentRefs,
      selectedQuoteIds: selectedQuotes
    };

    onImportItems(importData.items, importData.documentRefs, importData.selectedQuoteIds);
    toast({
      title: "Elementos importados",
      description: `Se han importado ${importedItems.length} elementos correctamente.`,
    });
  };

  const hasQuotes = quotes && quotes.length > 0;
  const hasDeliveryNotes = deliveryNotes && deliveryNotes.length > 0;
  const hasSelections = selectedQuotes.length > 0 || selectedDeliveryNotes.length > 0;

  if (!hasQuotes && !hasDeliveryNotes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Import className="w-5 h-5" />
            <span>Importar Documentos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              No hay presupuestos aceptados disponibles ni albaranes de salida para este cliente.
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Los presupuestos ya facturados no aparecen en esta lista.
            </p>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Import className="w-5 h-5" />
              <span>Importar Documentos</span>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={!hasSelections}
                className="bg-green-600 hover:bg-green-700"
              >
                <Import className="w-4 h-4 mr-2" />
                Importar Seleccionados
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
            {hasQuotes && (
              <button
                onClick={() => setActiveTab('quotes')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
                  activeTab === 'quotes'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Presupuestos Disponibles ({quotes?.length || 0})</span>
              </button>
            )}
            {hasDeliveryNotes && (
              <button
                onClick={() => setActiveTab('delivery_notes')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
                  activeTab === 'delivery_notes'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Albaranes ({deliveryNotes?.length || 0})</span>
              </button>
            )}
          </div>

          {/* Content */}
          {activeTab === 'quotes' && hasQuotes && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Presupuestos Aceptados (No Facturados)</h3>
                <div className="text-sm text-gray-500">
                  Solo se muestran presupuestos no facturados
                </div>
              </div>
              <div className="space-y-3">
                {quotes?.map((quote) => (
                  <div key={quote.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      checked={selectedQuotes.includes(quote.id)}
                      onCheckedChange={(checked) => handleQuoteSelection(quote.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{quote.number}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(quote.issue_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-gray-600">
                          Total: €{quote.total_amount.toFixed(2)}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                            Aceptado
                          </span>
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            Disponible
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'delivery_notes' && hasDeliveryNotes && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Albaranes de Salida</h3>
              <div className="space-y-3">
                {deliveryNotes?.map((deliveryNote) => (
                  <div key={deliveryNote.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      checked={selectedDeliveryNotes.includes(deliveryNote.id)}
                      onCheckedChange={(checked) => handleDeliveryNoteSelection(deliveryNote.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{deliveryNote.number}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(deliveryNote.issue_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-gray-600">
                          {deliveryNote.delivery_date ? 
                            `Entregado: ${new Date(deliveryNote.delivery_date).toLocaleDateString()}` : 
                            'Pendiente de entrega'
                          }
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          deliveryNote.status === 'delivered' 
                            ? 'text-green-600 bg-green-100' 
                            : 'text-blue-600 bg-blue-100'
                        }`}>
                          {deliveryNote.status === 'delivered' ? 'Entregado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
