
import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDeliveryNoteOperations } from '@/hooks/useDeliveryNoteOperations';
import { useDeliveryNoteForm } from '@/hooks/useDeliveryNoteForm';
import { DeliveryNoteHeader } from './delivery-note/DeliveryNoteHeader';
import { DeliveryNoteItems } from './delivery-note/DeliveryNoteItems';

interface DeliveryNote {
  id?: string;
  number: string;
  customer_id: string;
  issue_date: string;
  delivery_date: string | null;
  status: string;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

interface AlbaranSalidaFormProps {
  deliveryNote?: DeliveryNote | null;
  onClose: () => void;
  budgetData?: any | null;
}

export const AlbaranSalidaForm: React.FC<AlbaranSalidaFormProps> = ({
  deliveryNote,
  onClose,
  budgetData,
}) => {
  const { toast } = useToast();
  const { customers, articles, generateDeliveryNoteNumber, loadItems, saveMutation } = useDeliveryNoteOperations(onClose, true);
  const { formData, setFormData, items, setItems, handleItemChange, addItem, removeItem } = useDeliveryNoteForm(deliveryNote);

  // Handle budget status update after successful delivery note creation
  useEffect(() => {
    if (budgetData && saveMutation.isSuccess) {
      // Update budget status to "facturado" when delivery note is created successfully
      const updateBudgetStatus = async () => {
        try {
          const { error } = await supabase
            .from('presupuestos_n')
            .update({ status: 'despachado' }) // or whatever status you prefer
            .eq('id', budgetData.presupuesto_id);

          if (error) {
            console.error('Error updating budget status:', error);
          } else {
            console.log('Budget status updated successfully');
          }
        } catch (error) {
          console.error('Error in budget status update:', error);
        }
      };

      updateBudgetStatus();
    }
  }, [budgetData, saveMutation.isSuccess]);

  useEffect(() => {
    console.log('=== ALBARAN SALIDA FORM EFFECT ===');
    console.log('deliveryNote:', deliveryNote);
    console.log('budgetData:', budgetData);
    console.log('formData.number:', formData.number);
    
    if (budgetData) {
      // Pre-populate form with budget data
      console.log('Setting form data from budget');
      setFormData({
        number: '',
        customer_id: budgetData.customer_id,
        supplier_id: '', // Clear supplier_id for exit notes
        issue_date: new Date().toISOString().split('T')[0],
        delivery_date: null,
        status: 'pending',
        notes: budgetData.notes || '',
        subtotal: budgetData.subtotal,
        tax_amount: budgetData.tax_amount,
        total_amount: budgetData.total_amount,
      });

      // Map budget items to delivery note items
      const deliveryItems = budgetData.items.map((item: any) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
        article_id: null,
        variation_id: null,
      }));

      setItems(deliveryItems);
      
      // Generate delivery note number
      generateDeliveryNoteNumber().then(newNumber => {
        console.log('Generated delivery note number:', newNumber);
        if (newNumber && newNumber !== 'TEMP-001') {
          setFormData(prev => ({
            ...prev,
            number: newNumber
          }));
        }
      }).catch(error => {
        console.error('Error generating delivery note number:', error);
      });
    } else if (deliveryNote) {
      console.log('Setting form data for existing delivery note');
      // Set form data for existing delivery note
      setFormData({
        ...deliveryNote,
        supplier_id: '', // Clear supplier_id for exit notes
        customer_id: deliveryNote.customer_id,
      });
      
      // Load items for existing delivery note
      if (deliveryNote.id) {
        console.log('Loading items for delivery note ID:', deliveryNote.id);
        loadItems(deliveryNote.id).then(loadedItems => {
          console.log('Loaded items:', loadedItems);
          if (loadedItems.length > 0) {
            setItems(loadedItems);
          }
        });
      }
    } else if (!budgetData) {
      // Generate number for new delivery note only if we don't have one yet and not from budget
      if (!formData.number || formData.number === 'TEMP-001') {
        console.log('Generating new delivery note number');
        generateDeliveryNoteNumber().then(newNumber => {
          console.log('Generated number:', newNumber);
          if (newNumber && newNumber !== 'TEMP-001') {
            setFormData(prev => ({
              ...prev,
              number: newNumber
            }));
          }
        }).catch(error => {
          console.error('Error generating delivery note number:', error);
        });
      }
    }
  }, [deliveryNote, budgetData, generateDeliveryNoteNumber, loadItems, setFormData, setItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== FORM SUBMIT ===');
    console.log('Form data:', formData);
    console.log('Items:', items);
    console.log('saveMutation.isPending:', saveMutation.isPending);
    
    if (saveMutation.isPending) {
      console.log('Save mutation already in progress, ignoring submit');
      return;
    }
    
    // Validation
    if (!formData.customer_id) {
      console.error('No customer selected');
      toast({
        title: "Error",
        description: "Debe seleccionar un cliente.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.number || formData.number === 'TEMP-001') {
      console.error('Invalid delivery note number');
      toast({
        title: "Error",
        description: "Debe tener un número de albarán válido.",
        variant: "destructive"
      });
      return;
    }

    // Validación simplificada - al menos un item con algo de contenido
    const validItems = items.filter(item => 
      (item.description && item.description.trim() !== '') || 
      (item.article_id && item.article_id.trim() !== '')
    );

    console.log('Valid items:', validItems);
    console.log('Total items:', items.length);

    if (validItems.length === 0) {
      console.error('No valid items in delivery note');
      toast({
        title: "Error",
        description: "Debe agregar al menos un artículo al albarán.",
        variant: "destructive"
      });
      return;
    }

    console.log('Validation passed, calling save mutation');
    saveMutation.mutate({ 
      deliveryNote: formData, 
      items: validItems, // Solo enviar items válidos
      deliveryNoteId: deliveryNote?.id
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">
          {deliveryNote ? 'Editar Albarán de Salida' : 'Nuevo Albarán de Salida'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <DeliveryNoteHeader 
          formData={formData}
          setFormData={setFormData}
          suppliers={customers} // Use customers instead of suppliers for exit notes
          isExit={true}
        />

        <DeliveryNoteItems
          items={items}
          articles={articles}
          formData={formData}
          handleItemChange={handleItemChange}
          addItem={addItem}
          removeItem={removeItem}
        />

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AlbaranSalidaForm;
