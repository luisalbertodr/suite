import { useState, useRef } from 'react';

export interface PresupuestoNItemForm {
  id?: string;
  article_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  _key?: string; // Internal key for React rendering
}

export const usePresupuestoNItems = (initialItems?: PresupuestoNItemForm[]) => {
  const keyCounter = useRef(0);
  
  const generateKey = () => {
    keyCounter.current += 1;
    return `item-${keyCounter.current}`;
  };

  const processInitialItems = (items: PresupuestoNItemForm[]) =>
    items.map(item => ({ ...item, _key: item._key || generateKey() }));

  const [items, setItems] = useState<PresupuestoNItemForm[]>(
    initialItems ? processInitialItems(initialItems) : 
    [{ description: '', quantity: 1, unit_price: 0, total_price: 0, _key: generateKey() }]
  );

  const addItem = () => {
    setItems(prev => [...prev, { 
      description: '', 
      quantity: 1, 
      unit_price: 0, 
      total_price: 0,
      _key: generateKey()
    }]);
  };

  const removeItem = (index: number) => {
    console.log('🗑️ removeItem called with index:', index, 'items length:', items.length);
    if (items.length <= 1) {
      console.log('❌ Cannot remove - only one item left');
      return;
    }
    
    const confirmDelete = window.confirm('¿Está seguro de que desea eliminar este artículo?');
    if (!confirmDelete) {
      console.log('❌ User cancelled deletion');
      return;
    }
    
    console.log('✅ Removing item at index:', index);
    setItems(prev => {
      const newItems = prev.filter((_, i) => i !== index);
      console.log('✅ New items after removal:', newItems);
      return newItems;
    });
  };

  const updateItem = (index: number, field: keyof PresupuestoNItemForm, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = newItems[index].quantity;
      const unitPrice = newItems[index].unit_price;
      newItems[index].total_price = Math.round(quantity * unitPrice * 100) / 100;
    }
    
    setItems(newItems);
  };

  const setItemsData = (newItems: PresupuestoNItemForm[]) => {
    setItems(newItems);
  };

  const getTotals = () => {
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.total_price, 0) * 100) / 100;
    const tax_amount = Math.round(subtotal * 0.21 * 100) / 100;
    const total_amount = Math.round((subtotal + tax_amount) * 100) / 100;

    return { subtotal, tax_amount, total_amount };
  };

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    setItems: setItemsData,
    getTotals
  };
};