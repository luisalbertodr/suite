
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDeliveryNoteOperations } from '@/hooks/useDeliveryNoteOperations';
import { useDeliveryNoteForm } from '@/hooks/useDeliveryNoteForm';
import { DeliveryNoteHeader } from './delivery-note/DeliveryNoteHeader';
import { DeliveryNoteItems } from './delivery-note/DeliveryNoteItems';

interface DeliveryNote {
  id?: string;
  number: string;
  supplier_id: string;
  issue_date: string;
  delivery_date: string | null;
  status: string;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

interface AlbaranEntradaFormProps {
  deliveryNote?: DeliveryNote | null;
  onClose: () => void;
}

export const AlbaranEntradaForm: React.FC<AlbaranEntradaFormProps> = ({
  deliveryNote,
  onClose,
}) => {
  const { toast } = useToast();
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

  const { 
    suppliers, 
    articles, 
    generateDeliveryNoteNumber, 
    loadItems, 
    saveMutation, 
    isLoading 
  } = useDeliveryNoteOperations(onClose, false); // false = entrada

  const { 
    formData, 
    setFormData, 
    items, 
    setItems, 
    handleItemChange, 
    addItem, 
    removeItem 
  } = useDeliveryNoteForm(deliveryNote);

  // Generate number for new delivery notes
  useEffect(() => {
    const generateNumber = async () => {
      if (!deliveryNote?.id && !formData.number && !isLoading && !isGeneratingNumber) {
        console.log('=== GENERATING NEW DELIVERY NOTE NUMBER ===');
        setIsGeneratingNumber(true);
        
        try {
          const newNumber = await generateDeliveryNoteNumber();
          console.log('✅ Generated number:', newNumber);
          
          if (newNumber) {
            setFormData(prev => ({
              ...prev,
              number: newNumber
            }));
          }
        } catch (error) {
          console.error('❌ Error generating number:', error);
          toast({
            title: "Error",
            description: "No se pudo generar el número de albarán",
            variant: "destructive"
          });
        } finally {
          setIsGeneratingNumber(false);
        }
      }
    };

    generateNumber();
  }, [deliveryNote?.id, formData.number, isLoading, generateDeliveryNoteNumber, setFormData, toast, isGeneratingNumber]);

  // Load items for existing delivery notes
  useEffect(() => {
    const loadExistingItems = async () => {
      if (deliveryNote?.id && items.length === 0) {
        console.log('Loading items for existing delivery note:', deliveryNote.id);
        try {
          const loadedItems = await loadItems(deliveryNote.id);
          if (loadedItems && loadedItems.length > 0) {
            setItems(loadedItems);
          }
        } catch (error) {
          console.error('Error loading items:', error);
        }
      }
    };

    loadExistingItems();
  }, [deliveryNote?.id, items.length, loadItems, setItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== FORM SUBMIT ===');
    console.log('Form data:', formData);
    console.log('Items:', items);
    
    // Validate supplier
    if (!formData.supplier_id || formData.supplier_id.trim() === '') {
      toast({
        title: "Error",
        description: "Debe seleccionar un proveedor.",
        variant: "destructive"
      });
      return;
    }

    // Validate delivery note number
    if (!formData.number || formData.number.trim() === '') {
      toast({
        title: "Error",
        description: "El número de albarán es obligatorio.",
        variant: "destructive"
      });
      return;
    }

    // Check number format for new delivery notes
    if (!deliveryNote?.id) {
      const currentYear = new Date().getFullYear();
      const expectedPrefix = `ALE-${currentYear}`;
      if (!formData.number.startsWith(expectedPrefix)) {
        toast({
          title: "Error",
          description: `El número de albarán debe comenzar con ${expectedPrefix}`,
          variant: "destructive"
        });
        return;
      }
    }

    // Validate that there's at least one valid item
    const validItems = items.filter(item => 
      item.description && item.description.trim() !== '' && 
      item.quantity > 0
    );

    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un artículo válido al albarán.",
        variant: "destructive"
      });
      return;
    }

    console.log('Submitting with valid items:', validItems);
    console.log('Delivery note number:', formData.number);
    
    saveMutation.mutate({ 
      deliveryNote: formData, 
      items: validItems,
      deliveryNoteId: deliveryNote?.id 
    });
  };

  // Handle loading states
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando datos...</span>
      </div>
    );
  }

  if (isGeneratingNumber) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-2">Generando número de albarán...</span>
      </div>
    );
  }

  if (!suppliers || suppliers.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-700">Sin proveedores</h3>
          <p className="text-gray-500 mt-2">
            Debe crear al menos un proveedor antes de poder crear albaranes de entrada.
          </p>
          <div className="mt-4">
            <Button variant="outline" onClick={onClose}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">
          {deliveryNote ? 'Editar Albarán de Entrada' : 'Nuevo Albarán de Entrada'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <DeliveryNoteHeader 
          formData={formData}
          setFormData={setFormData}
          suppliers={suppliers}
        />

        <DeliveryNoteItems
          items={items}
          articles={articles}
          formData={formData}
          handleItemChange={handleItemChange}
          addItem={addItem}
          removeItem={removeItem}
        />

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveMutation.isPending || isGeneratingNumber}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AlbaranEntradaForm;
