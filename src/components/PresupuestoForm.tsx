import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useQuoteOperations } from '@/hooks/useQuoteOperations';
import { useFormData } from '@/hooks/useFormData';
import { useFormItems } from '@/hooks/useFormItems';
import { FormHeader } from './forms/FormHeader';
import { FormActions } from './forms/FormActions';
import { CustomerSelector } from './forms/CustomerSelector';
import { NotesCard } from './forms/NotesCard';
import { Quote } from '@/types/quote';

interface Customer {
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
  stock_actual: number;
}

interface PresupuestoFormProps {
  quote?: Quote | null;
  onClose: () => void;
}

const initialFormData = {
  number: '',
  customer_id: '',
  issue_date: new Date().toISOString().split('T')[0],
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  notes: '',
  status: 'draft' as 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired',
  currency: 'EUR',
};

export const PresupuestoForm: React.FC<PresupuestoFormProps> = ({ quote, onClose }) => {
  const adaptedQuote = quote ? {
    number: quote.number,
    customer_id: quote.customer_id,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until,
    notes: quote.notes || '',
    status: quote.status,
    currency: quote.currency,
  } : null;

  const { formData, setFormData, updateField } = useFormData(initialFormData, adaptedQuote);
  const { items, addItem, removeItem, updateItem, setItems } = useFormItems();
  const [searchTerms, setSearchTerms] = useState<{ [key: number]: string }>({});
  const [showSuggestions, setShowSuggestions] = useState<{ [key: number]: boolean }>({});
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

  const { toast } = useToast();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { generateQuoteNumber, createQuote, updateQuote } = useQuoteOperations();

  const { data: customers } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping customers query');
        return [];
      }

      console.log('Fetching customers for company:', companyId);
      
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, tax_id')
        .eq('company_id', companyId)
        .order('name');
      
      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }
      
      console.log('Fetched customers:', data?.length || 0);
      return data as Customer[];
    },
    enabled: !!companyId && !companyLoading,
  });

  const { data: articles } = useQuery({
    queryKey: ['articles', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping articles query');
        return [];
      }

      console.log('Fetching articles for company:', companyId);
      
      const { data, error } = await supabase
        .from('articles')
        .select('id, codigo, descripcion, precio, stock_actual')
        .eq('company_id', companyId)
        .eq('estado', 'activo')
        .order('descripcion');
      
      if (error) {
        console.error('Error fetching articles:', error);
        throw error;
      }
      
      console.log('Fetched articles:', data?.length || 0);
      return data as Article[];
    },
    enabled: !!companyId && !companyLoading,
  });

  useEffect(() => {
    const initializeForm = async () => {
      if (quote) {
        console.log('Initializing form with existing quote:', quote);
        // Load existing quote items
        const { data: quoteItems, error } = await supabase
          .from('quote_items')
          .select('*')
          .eq('quote_id', quote.id);
        
        if (!error && quoteItems) {
          const formattedItems = quoteItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            measurements: item.measurements || '',
            surface_area: item.surface_area || 0,
          }));
          setItems(formattedItems);
        }
      } else if (companyId && !formData.number && !isGeneratingNumber) {
        try {
          setIsGeneratingNumber(true);
          console.log('Generating new quote number for company:', companyId);
          const newNumber = await generateQuoteNumber();
          console.log('Generated quote number:', newNumber);
          updateField('number', newNumber);
        } catch (error) {
          console.error('Error generating quote number:', error);
          toast({
            title: "Error",
            description: "No se pudo generar el número de presupuesto automáticamente.",
            variant: "destructive",
          });
        } finally {
          setIsGeneratingNumber(false);
        }
      }
    };

    if (!companyLoading) {
      initializeForm();
    }
  }, [quote, companyId, companyLoading, generateQuoteNumber, toast, updateField, formData.number, isGeneratingNumber, setItems]);

  const getFilteredArticles = (searchTerm: string): Article[] => {
    if (!searchTerm || !articles) return [];
    
    return articles.filter(article =>
      article.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    setSearchTerms(prev => ({ ...prev, [index]: value }));
    if (!showSuggestions[index]) {
      updateItem(index, 'description', value);
    }
    setShowSuggestions(prev => ({ ...prev, [index]: value.length > 2 }));
  };

  const selectArticle = (index: number, article: Article) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      description: article.descripcion,
      article_id: article.id,
      unit_price: article.precio,
      total_price: newItems[index].quantity * article.precio,
    };
    setItems(newItems);
    
    setSearchTerms(prev => ({ ...prev, [index]: article.descripcion }));
    setShowSuggestions(prev => ({ ...prev, [index]: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submitted with data:', formData);
    console.log('Items:', items);
    
    if (!companyId) {
      toast({
        title: "Error",
        description: "No se pudo obtener la información de la empresa. Por favor, recarga la página.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.customer_id) {
      toast({
        title: "Error",
        description: "Por favor selecciona un cliente.",
        variant: "destructive",
      });
      return;
    }
    
    const validItems = items.filter(item => item.description.trim() !== '');
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Por favor agrega al menos un elemento al presupuesto.",
        variant: "destructive",
      });
      return;
    }

    // Ensure we have a quote number
    let currentFormData = { ...formData };
    if (!currentFormData.number) {
      console.log('No quote number, generating one...');
      try {
        const newNumber = await generateQuoteNumber();
        console.log('Generated quote number during submit:', newNumber);
        currentFormData.number = newNumber;
        setFormData(prev => ({ ...prev, number: newNumber }));
      } catch (error) {
        console.error('Error generating quote number during submit:', error);
        toast({
          title: "Error",
          description: "No se pudo generar el número de presupuesto.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const subtotal = validItems.reduce((sum, item) => sum + item.total_price, 0);
      const tax_amount = subtotal * 0.21;
      const total_amount = subtotal + tax_amount;

      const quoteData = {
        ...currentFormData,
        subtotal,
        tax_amount,
        total_amount,
      };

      console.log('Quote data to save:', quoteData);

      if (quote) {
        console.log('Updating existing quote:', quote.id);
        await updateQuote.mutateAsync({ id: quote.id, quoteData });

        // Delete existing items and insert new ones
        const { error: deleteError } = await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', quote.id);

        if (deleteError) {
          console.error('Error deleting existing quote items:', deleteError);
          throw deleteError;
        }

        const itemsToInsert = validItems.map(item => ({
          quote_id: quote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          measurements: item.measurements || null,
          surface_area: item.surface_area || null,
        }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('quote_items')
            .insert(itemsToInsert);

          if (itemsError) {
            console.error('Error updating quote items:', itemsError);
            throw itemsError;
          }
        }
        
        console.log('Quote updated successfully');
      } else {
        console.log('Creating new quote');
        const newQuote = await createQuote.mutateAsync(quoteData);
        console.log('Quote created:', newQuote);

        const itemsToInsert = validItems.map(item => ({
          quote_id: newQuote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          measurements: item.measurements || null,
          surface_area: item.surface_area || null,
        }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('quote_items')
            .insert(itemsToInsert);

          if (itemsError) {
            console.error('Error creating quote items:', itemsError);
            throw itemsError;
          }
        }
        
        console.log('Quote created successfully with items');
      }

      toast({
        title: "Éxito",
        description: quote ? "Presupuesto actualizado correctamente." : "Presupuesto creado correctamente.",
      });

      onClose();
    } catch (error) {
      console.error('Error saving quote:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el presupuesto: " + (error as any).message,
        variant: "destructive",
      });
    }
  };

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const taxAmount = subtotal * 0.21;
  const total = subtotal + taxAmount;

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

  return (
    <div className="space-y-6">
      <FormHeader 
        title={quote ? 'Editar Presupuesto' : 'Nuevo Presupuesto'} 
        onClose={onClose} 
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="number">Número de Presupuesto</Label>
              <Input
                id="number"
                type="text"
                value={formData.number}
                onChange={(e) => updateField('number', e.target.value)}
                required
                placeholder={isGeneratingNumber ? "Generando..." : "Se generará automáticamente..."}
                disabled={isGeneratingNumber}
              />
              {isGeneratingNumber && (
                <p className="text-sm text-blue-500 mt-1">
                  Generando número de presupuesto...
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="issue_date">Fecha de Emisión</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => updateField('issue_date', e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="valid_until">Válido Hasta</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => updateField('valid_until', e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Input
                id="currency"
                type="text"
                value={formData.currency}
                onChange={(e) => updateField('currency', e.target.value)}
                required
              />
            </div>
            
            <CustomerSelector
              customers={customers}
              value={formData.customer_id}
              onChange={(value) => updateField('customer_id', value)}
            />

            <div>
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value as typeof formData.status)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Borrador</option>
                <option value="sent">Enviado</option>
                <option value="accepted">Aceptado</option>
                <option value="rejected">Rechazado</option>
                <option value="expired">Expirado</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Elementos del Presupuesto</CardTitle>
              <Button type="button" onClick={addItem} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Elemento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end p-4 border rounded-lg">
                  <div className="md:col-span-2 relative">
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
                              {article.codigo} - €{article.precio.toFixed(2)} (Stock: {article.stock_actual})
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
                    <Label>Medidas</Label>
                    <Input
                      value={item.measurements || ''}
                      onChange={(e) => updateItem(index, 'measurements', e.target.value)}
                      placeholder="ej: 2x3m"
                    />
                  </div>
                  <div>
                    <Label>Superficie m²</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={item.surface_area || 0}
                      onChange={(e) => updateItem(index, 'surface_area', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Precio Unitario</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1">
                      <Label>Total</Label>
                      <div className="px-3 py-2 bg-gray-50 border rounded-md">
                        €{item.total_price.toFixed(2)}
                      </div>
                    </div>
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

            <div className="mt-6 space-y-2 max-w-sm ml-auto">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA (21%):</span>
                <span>€{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>€{total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <NotesCard
          value={formData.notes}
          onChange={(value) => updateField('notes', value)}
        />

        <FormActions
          onCancel={onClose}
          isLoading={createQuote.isPending || updateQuote.isPending}
          saveText="Guardar Presupuesto"
        />
      </form>
    </div>
  );
};
