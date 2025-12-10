
import { useState, useCallback } from 'react';

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  iva_percentage: number;
  re_percentage: number;
  subtotal_after_discount: number;
  iva_amount: number;
  re_amount: number;
  total_price: number;
  variation_id?: string;
  article_id?: string;
}

export const useInvoiceItems = (initialItems: InvoiceItem[] = []) => {
  const [items, setItems] = useState<InvoiceItem[]>(initialItems);

  const updateItem = useCallback((index: number, field: keyof InvoiceItem, value: string | number) => {
    console.log('=== useInvoiceItems.updateItem CALLED ===');
    console.log('Index:', index, 'Field:', field, 'Value:', value);
    
    setItems(prevItems => {
      console.log('Previous items:', prevItems);
      
      const newItems = [...prevItems];
      const currentItem = { ...newItems[index] };
      
      // Update the specific field
      (currentItem as any)[field] = value;
      
      newItems[index] = currentItem;
      
      console.log('Updated item:', currentItem);
      console.log('New items array:', newItems);
      
      return newItems;
    });
  }, []);

  const addItem = useCallback((customerRePercentage: number, isIntracomunitario: boolean) => {
    const newItem: InvoiceItem = {
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_percentage: 0,
      iva_percentage: 21,
      re_percentage: isIntracomunitario ? 0 : customerRePercentage,
      subtotal_after_discount: 0,
      iva_amount: 0,
      re_amount: 0,
      total_price: 0
    };
    
    setItems(prevItems => [...prevItems, newItem]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems(prevItems => prevItems.filter((_, i) => i !== index));
  }, []);

  const setItemsDirectly = useCallback((newItems: InvoiceItem[]) => {
    setItems(newItems);
  }, []);

  return {
    items,
    updateItem,
    addItem,
    removeItem,
    setItems: setItemsDirectly
  };
};
