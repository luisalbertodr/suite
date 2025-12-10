
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, Save, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  tax_id?: string;
}

interface Article {
  id: string;
  codigo: string;
  descripcion: string;
  precio: number;
  precio_compra: number;
  stock_actual: number;
}

interface DeliveryNoteItem {
  id?: string;
  article_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface DeliveryNote {
  id: string;
  number: string;
  supplier_id: string;
  customer_id?: string; // Made optional to support both suppliers and customers
  issue_date: string;
  delivery_date: string | null;
  status: string;
  notes: string | null;
}

interface AlbaranFormProps {
  deliveryNote?: DeliveryNote | null;
  onClose: () => void;
}

export const AlbaranForm: React.FC<AlbaranFormProps> = ({ deliveryNote, onClose }) => {
  const [formData, setFormData] = useState({
    number: '',
    supplier_id: '', // Changed from customer_id to supplier_id for entrada
    issue_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    notes: '',
    status: 'pending' as 'pending' | 'delivered' | 'cancelled',
  });

  const [items, setItems] = useState<DeliveryNoteItem[]>([
    { description: '', quantity: 1, unit_price: 0 }
  ]);

  const [searchTerms, setSearchTerms] = useState<{ [key: number]: string }>({});
  const [showSuggestions, setShowSuggestions] = useState<{ [key: number]: boolean }>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, email, tax_id')
        .order('name');
      
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: articles } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, codigo, descripcion, precio, precio_compra, stock_actual')
        .eq('estado', 'activo')
        .order('descripcion');
      
      if (error) throw error;
      return data as Article[];
    },
  });

  const { data: deliveryNoteItems } = useQuery({
    queryKey: ['delivery-note-items', deliveryNote?.id],
    queryFn: async () => {
      if (!deliveryNote?.id) return [];
      
      const { data, error } = await supabase
        .from('delivery_note_items')
        .select('*')
        .eq('delivery_note_id', deliveryNote.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!deliveryNote?.id,
  });

  useEffect(() => {
    if (deliveryNote) {
      setFormData({
        number: deliveryNote.number,
        supplier_id: deliveryNote.supplier_id,
        issue_date: deliveryNote.issue_date,
        delivery_date: deliveryNote.delivery_date || '',
        notes: deliveryNote.notes || '',
        status: deliveryNote.status as 'pending' | 'delivered' | 'cancelled',
      });
    } else {
      generateDeliveryNoteNumber();
    }
  }, [deliveryNote]);

  useEffect(() => {
    if (deliveryNoteItems && deliveryNoteItems.length > 0) {
      setItems(deliveryNoteItems.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: 0,
      })));
    }
  }, [deliveryNoteItems]);

  const generateDeliveryNoteNumber = async () => {
    const { data, error } = await supabase
      .from('delivery_notes')
      .select('number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const lastNumber = parseInt(data[0].number.replace(/\D/g, '')) || 0;
      const newNumber = `ALB-${String(lastNumber + 1).padStart(4, '0')}`;
      setFormData(prev => ({ ...prev, number: newNumber }));
    } else {
      setFormData(prev => ({ ...prev, number: 'ALB-0001' }));
    }
  };

  const getFilteredArticles = (searchTerm: string): Article[] => {
    if (!searchTerm || !articles) return [];
    
    return articles.filter(article =>
      article.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    setSearchTerms(prev => ({ ...prev, [index]: value }));
    updateItem(index, 'description', value);
    setShowSuggestions(prev => ({ ...prev, [index]: value.length > 2 }));
  };

  const selectArticle = (index: number, article: Article) => {
    updateItem(index, 'description', article.descripcion);
    updateItem(index, 'article_id', article.id);
    updateItem(index, 'unit_price', article.precio_compra);
    setSearchTerms(prev => ({ ...prev, [index]: article.descripcion }));
    setShowSuggestions(prev => ({ ...prev, [index]: false }));
  };

  const updateArticleStock = async (articleId: string, quantity: number) => {
    try {
      const { data: article, error: fetchError } = await supabase
        .from('articles')
        .select('stock_actual')
        .eq('id', articleId)
        .single();

      if (fetchError) throw fetchError;

      const newStock = article.stock_actual + quantity;

      const { error: updateError } = await supabase
        .from('articles')
        .update({ stock_actual: newStock })
        .eq('id', articleId);

      if (updateError) throw updateError;
      
      // Invalidate articles query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    } catch (error) {
      console.error('Error updating stock:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el stock del artículo.",
        variant: "destructive",
      });
    }
  };

  const saveDeliveryNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      // Update the data to use supplier_id instead of customer_id for the database
      const dbData = {
        ...data,
        supplier_id: data.supplier_id,
        // Remove customer_id from the data since we're dealing with suppliers
      };
      delete dbData.customer_id;

      if (deliveryNote) {
        const { error: deliveryNoteError } = await supabase
          .from('delivery_notes')
          .update({
            ...dbData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deliveryNote.id);

        if (deliveryNoteError) throw deliveryNoteError;

        await supabase
          .from('delivery_note_items')
          .delete()
          .eq('delivery_note_id', deliveryNote.id);

        const itemsToInsert = items.filter(item => item.description.trim() !== '').map(item => ({
          delivery_note_id: deliveryNote.id,
          description: item.description,
          quantity: item.quantity,
        }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('delivery_note_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }

        // Update stock for each item with article_id
        for (const item of items) {
          if (item.article_id && item.quantity > 0) {
            await updateArticleStock(item.article_id, item.quantity);
          }
        }
      } else {
        const { data: newDeliveryNote, error: deliveryNoteError } = await supabase
          .from('delivery_notes')
          .insert(dbData)
          .select()
          .single();

        if (deliveryNoteError) throw deliveryNoteError;

        const itemsToInsert = items.filter(item => item.description.trim() !== '').map(item => ({
          delivery_note_id: newDeliveryNote.id,
          description: item.description,
          quantity: item.quantity,
        }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('delivery_note_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }

        // Update stock for each item with article_id
        for (const item of items) {
          if (item.article_id && item.quantity > 0) {
            await updateArticleStock(item.article_id, item.quantity);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      toast({
        title: deliveryNote ? "Albarán actualizado" : "Albarán creado",
        description: deliveryNote ? "El albarán ha sido actualizado exitosamente." : "El nuevo albarán ha sido creado exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo guardar el albarán.",
        variant: "destructive",
      });
      console.error('Error saving delivery note:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_id) {
      toast({
        title: "Error",
        description: "Por favor selecciona un proveedor.",
        variant: "destructive",
      });
      return;
    }
    
    if (items.filter(item => item.description.trim() !== '').length === 0) {
      toast({
        title: "Error",
        description: "Por favor agrega al menos un elemento al albarán.",
        variant: "destructive",
      });
      return;
    }

    saveDeliveryNoteMutation.mutate(formData);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    setSearchTerms(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
    setShowSuggestions(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  const updateItem = (index: number, field: keyof DeliveryNoteItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">
          {deliveryNote ? 'Editar Albarán' : 'Nuevo Albarán'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="number">Número de Albarán</Label>
              <Input
                id="number"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="supplier_id">Proveedor</Label>
              <select
                id="supplier_id"
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers?.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="issue_date">Fecha de Emisión</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="delivery_date">Fecha de Entrega</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pendiente</option>
                <option value="delivered">Entregado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Elementos del Albarán</CardTitle>
              <Button type="button" onClick={addItem} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Elemento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-lg">
                  <div className="md:col-span-1 relative">
                    <Label>Descripción</Label>
                    <div className="relative">
                      <Input
                        value={searchTerms[index] || item.description}
                        onChange={(e) => handleDescriptionChange(index, e.target.value)}
                        placeholder="Buscar artículo..."
                      />
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    </div>
                    
                    {showSuggestions[index] && searchTerms[index] && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {getFilteredArticles(searchTerms[index]).map((article) => (
                          <div
                            key={article.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                            onClick={() => selectArticle(index, article)}
                          >
                            <div className="font-medium text-sm">{article.descripcion}</div>
                            <div className="text-xs text-gray-500">
                              {article.codigo} - Compra: €{article.precio_compra.toFixed(2)} - Venta: €{article.precio.toFixed(2)} (Stock: {article.stock_actual})
                            </div>
                          </div>
                        ))}
                        {getFilteredArticles(searchTerms[index]).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            No se encontraron artículos
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Precio de Compra</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      readOnly
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Notas adicionales..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveDeliveryNoteMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveDeliveryNoteMutation.isPending ? 'Guardando...' : 'Guardar Albarán'}
          </Button>
        </div>
      </form>
    </div>
  );
};
