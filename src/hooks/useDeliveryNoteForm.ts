
import { useState, useEffect, useCallback } from 'react';

interface DeliveryNoteItem {
  id?: string;
  article_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface DeliveryNote {
  id?: string;
  number: string;
  supplier_id?: string;
  customer_id?: string;
  issue_date: string;
  delivery_date: string | null;
  status: string;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

export const useDeliveryNoteForm = (initialDeliveryNote?: DeliveryNote | null) => {
  const [formData, setFormData] = useState<DeliveryNote>({
    number: '',
    supplier_id: '',
    customer_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    delivery_date: null,
    status: 'pending',
    notes: '',
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
  });

  const [items, setItems] = useState<DeliveryNoteItem[]>([
    { description: '', quantity: 1, unit_price: 0, total_price: 0 }
  ]);

  useEffect(() => {
    if (initialDeliveryNote) {
      setFormData(initialDeliveryNote);
    }
  }, [initialDeliveryNote]);

  const calculateTotals = useCallback((updatedItems: DeliveryNoteItem[]) => {
    const subtotal = updatedItems.reduce((sum, item) => {
      const itemTotal = Number(item.total_price) || 0;
      return sum + itemTotal;
    }, 0);
    
    const taxAmount = subtotal * 0.21; // 21% IVA
    const totalAmount = subtotal + taxAmount;

    setFormData(prev => ({
      ...prev,
      subtotal: Number(subtotal.toFixed(2)),
      tax_amount: Number(taxAmount.toFixed(2)),
      total_amount: Number(totalAmount.toFixed(2)),
    }));
  }, []);

  const handleItemChange = useCallback((
    index: number, 
    field: keyof DeliveryNoteItem, 
    value: string | number, 
    articles: any[]
  ) => {
    setItems(currentItems => {
      const updatedItems = [...currentItems];
      const currentItem = { ...updatedItems[index] };
      
      // Handle different field types with proper type casting
      if (field === 'description' && typeof value === 'string') {
        currentItem.description = value;
      } else if (field === 'article_id' && typeof value === 'string') {
        currentItem.article_id = value;
        
        // Si se está cambiando el article_id, también actualizar descripción y precio
        if (value && articles) {
          const article = articles.find(a => a.id === value);
          if (article) {
            currentItem.description = article.descripcion;
            currentItem.unit_price = Number(article.precio || article.precio_compra || 0);
          }
        }
      } else if (field === 'quantity' && typeof value === 'number') {
        currentItem.quantity = value;
      } else if (field === 'unit_price' && typeof value === 'number') {
        currentItem.unit_price = value;
      } else if (field === 'total_price' && typeof value === 'number') {
        currentItem.total_price = value;
      }

      // Recalcular precio total cuando cambia cantidad o precio unitario
      if (field === 'quantity' || field === 'unit_price' || field === 'article_id') {
        const quantity = Number(currentItem.quantity) || 1;
        const unitPrice = Number(currentItem.unit_price) || 0;
        currentItem.total_price = Number((quantity * unitPrice).toFixed(2));
      }

      updatedItems[index] = currentItem;
      
      // Usar setTimeout para evitar bucles infinitos con el cálculo de totales
      setTimeout(() => calculateTotals(updatedItems), 0);
      
      return updatedItems;
    });
  }, [calculateTotals]);

  const addItem = useCallback(() => {
    setItems(currentItems => {
      const newItems = [...currentItems, { description: '', quantity: 1, unit_price: 0, total_price: 0 }];
      setTimeout(() => calculateTotals(newItems), 0);
      return newItems;
    });
  }, [calculateTotals]);

  const removeItem = useCallback((index: number) => {
    setItems(currentItems => {
      if (currentItems.length > 1) {
        const updatedItems = currentItems.filter((_, i) => i !== index);
        setTimeout(() => calculateTotals(updatedItems), 0);
        return updatedItems;
      }
      return currentItems;
    });
  }, [calculateTotals]);

  return {
    formData,
    setFormData,
    items,
    setItems,
    handleItemChange,
    addItem,
    removeItem,
    calculateTotals
  };
};
