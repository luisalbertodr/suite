
import { useState } from 'react';

export interface FormItem {
  id?: string;
  article_id?: string;
  variation_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  measurements?: string;
  surface_area?: number;
}

export const useFormItems = (initialItems?: FormItem[]) => {
  const [items, setItems] = useState<FormItem[]>(
    initialItems || [{ description: '', quantity: 1, unit_price: 0, total_price: 0 }]
  );

  const addItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof FormItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    
    setItems(newItems);
  };

  const setItemsData = (newItems: FormItem[]) => {
    setItems(newItems);
  };

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    setItems: setItemsData
  };
};
