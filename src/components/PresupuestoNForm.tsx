import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { CustomerSelector } from '@/components/forms/CustomerSelector';
import { usePresupuestoNOperations } from '@/hooks/usePresupuestoNOperations';
import { usePresupuestoNItems } from '@/hooks/usePresupuestoNItems';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
interface Customer {
  id: string;
  name: string;
  email?: string;
  tax_id?: string;
}
interface PresupuestoNFormProps {
  presupuestoId?: string;
  onCancel: () => void;
  onSuccess?: () => void;
}
export const PresupuestoNForm: React.FC<PresupuestoNFormProps> = ({
  presupuestoId,
  onCancel,
  onSuccess
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [formData, setFormData] = useState<{
    customer_id: string;
    issue_date: string;
    status: 'borrador' | 'enviado' | 'aceptado' | 'facturado';
    notes: string;
  }>({
    customer_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    status: 'borrador',
    notes: ''
  });
  const {
    createPresupuestoN,
    updatePresupuestoN,
    loading
  } = usePresupuestoNOperations();
  const {
    items,
    addItem,
    removeItem,
    updateItem,
    setItems,
    getTotals
  } = usePresupuestoNItems();
  const {
    toast
  } = useToast();

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('customers').select('id, name, email, tax_id').order('name');
        if (error) throw error;
        setCustomers(data || []);
      } catch (error: any) {
        console.error('Error fetching customers:', error);
        toast({
          title: "Error",
          description: "Error al cargar los clientes",
          variant: "destructive"
        });
      } finally {
        setCustomersLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch existing presupuesto if editing
  useEffect(() => {
    if (presupuestoId) {
      const fetchPresupuesto = async () => {
        try {
          const {
            data,
            error
          } = await supabase.from('presupuestos_n').select(`
              *,
              presupuestos_n_items (*)
            `).eq('id', presupuestoId).single();
          if (error) throw error;
          setFormData({
            customer_id: data.customer_id,
            issue_date: data.issue_date,
            status: data.status as 'borrador' | 'enviado' | 'aceptado' | 'facturado',
            notes: data.notes || ''
          });
          if (data.presupuestos_n_items && data.presupuestos_n_items.length > 0) {
            setItems(data.presupuestos_n_items.map((item: any, idx: number) => ({
              id: item.id,
              article_id: item.article_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
              _key: `existing-${item.id}-${idx}`
            })));
          }
        } catch (error: any) {
          console.error('Error fetching presupuesto:', error);
          toast({
            title: "Error",
            description: "Error al cargar el presupuesto",
            variant: "destructive"
          });
        }
      };
      fetchPresupuesto();
    }
  }, [presupuestoId, toast]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('💾 handleSubmit called');
    console.log('📋 Current form data:', formData);
    console.log('📋 Current items:', items);
    if (!formData.customer_id) {
      console.log('❌ No customer selected');
      toast({
        title: "Error",
        description: "Por favor selecciona un cliente",
        variant: "destructive"
      });
      return;
    }
    if (items.length === 0 || items.every(item => !item.description.trim())) {
      console.log('❌ No valid items');
      toast({
        title: "Error",
        description: "Por favor añade al menos un artículo",
        variant: "destructive"
      });
      return;
    }
    try {
      console.log('💾 SAVE PROCESS STARTED - PREPARING ITEMS');
      console.log('💾 Current items before filtering:', items);
      console.log('💾 Form data:', formData);

      // Save all items that have at least a description (complete budget)
      const validItems = items.filter(item => {
        const hasDescription = item.description && item.description.trim() !== '';
        console.log('💾 Item check:', {
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          hasDescription: hasDescription,
          willInclude: hasDescription
        });
        return hasDescription;
      });
      console.log('💾 FILTERING COMPLETE');
      console.log('💾 Original items count:', items.length);
      console.log('💾 Valid items count:', validItems.length);
      console.log('💾 Valid items for saving:', validItems);
      if (presupuestoId) {
        console.log('🔄 Updating existing presupuesto:', presupuestoId);
        await updatePresupuestoN(presupuestoId, formData, validItems);
      } else {
        console.log('✨ Creating new presupuesto');
        await createPresupuestoN(formData, validItems);
      }
      console.log('✅ Save successful, calling callbacks');
      // Call onSuccess to refresh the list, then onCancel to close the form
      if (onSuccess) {
        onSuccess();
      }
      onCancel();
    } catch (error) {
      console.log('❌ Error in handleSubmit:', error);
      // Error is handled in the hook
    }
  };
  const {
    subtotal,
    tax_amount,
    total_amount
  } = getTotals();
  return <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">
          {presupuestoId ? 'Editar' : 'Nuevo'} PresupuestoN
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                
                {customersLoading ? <div className="flex items-center justify-center h-10 border rounded-md">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  </div> : <CustomerSelector customers={customers} value={formData.customer_id} onChange={value => setFormData(prev => ({
                ...prev,
                customer_id: value
              }))} />}
              </div>
              
              <div>
                <Label htmlFor="issue_date">Fecha de Emisión</Label>
                <Input id="issue_date" type="date" value={formData.issue_date} onChange={e => setFormData(prev => ({
                ...prev,
                issue_date: e.target.value
              }))} required />
              </div>

              <div>
                <Label htmlFor="status">Estado</Label>
                <select key={`status-select-${formData.status}`} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={formData.status} onChange={e => {
                console.log('🔄 Estado cambiado a:', e.target.value);
                const newStatus = e.target.value as 'borrador' | 'enviado' | 'aceptado' | 'facturado';
                console.log('📝 Updating form data with new status:', newStatus);
                setFormData(prev => {
                  const newFormData = {
                    ...prev,
                    status: newStatus
                  };
                  console.log('📝 New form data:', newFormData);
                  return newFormData;
                });
              }}>
                  <option value="borrador">Borrador</option>
                  <option value="enviado">Enviado</option>
                  <option value="aceptado">Aceptado</option>
                  <option value="facturado">Facturado</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Artículos
              <Button type="button" variant="outline" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" />
                Añadir Artículo
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item, index) => <div key={item._key} className="flex gap-2 p-4 border rounded-lg items-end">
                  <div className="flex-1">
                    <Label>Descripción del Artículo</Label>
                    <Input value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} placeholder="Describe el artículo..." className="w-full" />
                  </div>
                  
                  <div className="w-16">
                    <Label>Cantidad</Label>
                    <Input 
                      type="text"
                      defaultValue={item.quantity.toString()}
                      onChange={e => {
                        const value = e.target.value;
                        // Permitir escribir punto decimal y números
                        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                          // Solo actualizar si es un número válido completo
                          if (value !== '' && !value.endsWith('.')) {
                            const numValue = parseFloat(value) || 0;
                            updateItem(index, 'quantity', numValue);
                          }
                        } else {
                          // Revertir el valor si no es válido
                          e.target.value = item.quantity.toString();
                        }
                      }}
                      onBlur={e => {
                        const value = e.target.value;
                        const numValue = parseFloat(value) || 0;
                        updateItem(index, 'quantity', Math.round(numValue * 100) / 100);
                        e.target.value = (Math.round(numValue * 100) / 100).toString();
                      }}
                      onFocus={e => e.target.select()} 
                      className="w-16" 
                      placeholder="0"
                    />
                  </div>
                  
                  <div className="w-20">
                    <Label>Precio Unit.</Label>
                    <Input 
                      type="text"
                      defaultValue={item.unit_price.toString()}
                      onChange={e => {
                        const value = e.target.value;
                        // Permitir escribir punto decimal y números
                        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                          // Solo actualizar si es un número válido completo
                          if (value !== '' && !value.endsWith('.')) {
                            const numValue = parseFloat(value) || 0;
                            updateItem(index, 'unit_price', numValue);
                          }
                        } else {
                          // Revertir el valor si no es válido
                          e.target.value = item.unit_price.toString();
                        }
                      }}
                      onBlur={e => {
                        const value = e.target.value;
                        const numValue = parseFloat(value) || 0;
                        updateItem(index, 'unit_price', Math.round(numValue * 100) / 100);
                        e.target.value = (Math.round(numValue * 100) / 100).toString();
                      }}
                      onFocus={e => e.target.select()} 
                      className="w-20" 
                      placeholder="0"
                    />
                  </div>
                  
                  <div className="w-20">
                    <Label>Total</Label>
                    <Input value={item.total_price.toFixed(2)} readOnly className="bg-muted w-20" />
                  </div>
                  
                  {items.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => removeItem(index)} className="text-destructive hover:bg-destructive/10" title="Eliminar artículo">
                      <Trash2 className="w-4 h-4" />
                    </Button>}
                </div>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Base Imponible:</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span>IVA (21%):</span>
              <span>{tax_amount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>{total_amount.toFixed(2)} €</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={formData.notes} onChange={e => setFormData(prev => ({
            ...prev,
            notes: e.target.value
          }))} placeholder="Observaciones del presupuesto..." rows={4} />
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>;
};