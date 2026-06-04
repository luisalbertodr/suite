import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useInvoiceOperations } from '@/hooks/useInvoiceOperations';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useInvoiceItems } from '@/hooks/useInvoiceItems';
import { InvoiceItemRow } from './InvoiceItemRow';
import { CustomerSelector } from '@/components/forms/CustomerSelector';

interface Customer {
  id: string;
  name: string;
  email?: string;
  tax_id?: string;
  phone?: string | null;
  re_percentage?: number;
  intracomunitario?: string;
}

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

interface Invoice {
  id: string;
  number: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  re_total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  currency: string;
  paid_status: boolean;
  paid_date?: string;
  is_intracomunitario: boolean;
}

interface FacturaFormProps {
  invoice?: Invoice | null;
  onClose: () => void;
  onCreated?: (invoice: Record<string, unknown>) => void;
  budgetData?: any | null;
}

export const FacturaForm: React.FC<FacturaFormProps> = ({ invoice, onClose, onCreated, budgetData }) => {
  const [formData, setFormData] = useState({
    number: '',
    customer_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    status: 'draft' as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
    currency: 'EUR',
    paid_status: false,
    paid_date: '',
    is_intracomunitario: false,
  });

  const { items, updateItem, addItem, removeItem, setItems } = useInvoiceItems([
    { 
      description: '', 
      quantity: 1, 
      unit_price: 0, 
      discount_percentage: 0,
      iva_percentage: 21,
      re_percentage: 0,
      subtotal_after_discount: 0,
      iva_amount: 0,
      re_amount: 0,
      total_price: 0 
    }
  ]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCorrectiveInvoice, setIsCorrectiveInvoice] = useState(false);
  const [correctiveReason, setCorrectiveReason] = useState('');
  const [originalInvoiceId, setOriginalInvoiceId] = useState<string | null>(null);
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
  const billingCompanyIdOverride = budgetData?.company_id ? String(budgetData.company_id) : null;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { generateInvoiceNumber, createInvoice } = useInvoiceOperations();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? companyId;

  const { data: customers } = useQuery({
    queryKey: ['customers', catalogCompanyId],
    queryFn: async () => {
      if (!catalogCompanyId) {
        console.log('No company ID available, skipping customers query');
        return [];
      }

      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, tax_id, phone, re_percentage, intracomunitario')
        .eq('company_id', catalogCompanyId)
        .order('name');
      
      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }
      
      return data as Customer[];
    },
    enabled: !!catalogCompanyId && !companyLoading,
  });
  useEffect(() => {
    if (budgetData) {
      const fromTpv = budgetData.source === 'tpv_sale';
      const fromAgendaCancel = budgetData.source === 'agenda_appointment_cancel';
      const today = new Date().toISOString().split('T')[0];
      const customerId = String(budgetData.customer_id || '').trim();
      setFormData({
        number: '',
        customer_id: customerId,
        issue_date: today,
        due_date: today,
        notes: budgetData.notes || '',
        status: fromTpv ? 'paid' : 'draft',
        currency: 'EUR',
        paid_status: fromTpv,
        paid_date: fromTpv ? today : '',
        is_intracomunitario: false,
      });

      if (fromAgendaCancel) {
        setIsCorrectiveInvoice(true);
        setCorrectiveReason(String(budgetData.corrective_reason || ''));
        setOriginalInvoiceId(String(budgetData.original_invoice_id || '') || null);
        const invoiceItems = (budgetData.items || []).map((item: Record<string, unknown>) => ({
          description: String(item.description ?? ''),
          quantity: Number(item.quantity ?? 1),
          unit_price: Number(item.unit_price ?? 0),
          discount_percentage: Number(item.discount_percentage ?? 0),
          iva_percentage: Number(item.iva_percentage ?? 21),
          re_percentage: Number(item.re_percentage ?? 0),
          subtotal_after_discount: Number(item.subtotal_after_discount ?? 0),
          iva_amount: Number(item.iva_amount ?? 0),
          re_amount: Number(item.re_amount ?? 0),
          total_price: Number(item.total_price ?? 0),
          variation_id: (item.variation_id as string | null) ?? null,
        }));
        if (invoiceItems.length) setItems(invoiceItems);
        if (companyId || billingCompanyIdOverride) {
          void handleGenerateInvoiceNumber(true, billingCompanyIdOverride ?? undefined);
        }
      } else {
        const invoiceItems = budgetData.items.map((item: Record<string, unknown>) => ({
          description: String(item.description ?? ''),
          quantity: Number(item.quantity ?? 1),
          unit_price: Number(item.unit_price ?? 0),
          discount_percentage: 0,
          iva_percentage: 21,
          re_percentage: 0,
          subtotal_after_discount: Number(item.total_price ?? 0),
          iva_amount: Number(item.total_price ?? 0) * 0.21,
          re_amount: 0,
          total_price: Number(item.total_price ?? 0) * 1.21,
        }));
        setItems(invoiceItems);
        if (companyId) {
          void handleGenerateInvoiceNumber(false);
        }
      }
    } else if (invoice) {
      setFormData({
        number: invoice.number,
        customer_id: invoice.customer_id,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        notes: invoice.notes || '',
        status: invoice.status,
        currency: invoice.currency,
        paid_status: invoice.paid_status || false,
        paid_date: invoice.paid_date ? new Date(invoice.paid_date).toISOString().split('T')[0] : '',
        is_intracomunitario: invoice.is_intracomunitario || false,
      });
      
      setIsCorrectiveInvoice(invoice.number.startsWith('R-'));
      
      // Load invoice items
      const loadInvoiceItems = async () => {
        const { data: invoiceItems } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoice.id);
        
        if (invoiceItems && invoiceItems.length > 0) {
          const loadedItems = invoiceItems.map(item => ({
            id: item.id,
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            discount_percentage: Number(item.discount_percentage || 0),
            iva_percentage: Number(item.iva_percentage || 21),
            re_percentage: Number(item.re_percentage || 0),
            subtotal_after_discount: Number(item.subtotal_after_discount || 0),
            iva_amount: Number(item.iva_amount || 0),
            re_amount: Number(item.re_amount || 0),
            total_price: Number(item.total_price),
            variation_id: item.variation_id,
          }));
          setItems(loadedItems);
        }
      };
      
      loadInvoiceItems();
    } else if (companyId && !formData.number && !budgetData) {
      handleGenerateInvoiceNumber(false);
    }
  }, [invoice, budgetData, companyId, setItems]);

  // Update customer data when customer_id changes
  useEffect(() => {
    if (formData.customer_id && customers) {
      const customer = customers.find(c => c.id === formData.customer_id);
      setSelectedCustomer(customer || null);
      
      if (customer) {
        const isIntracom = !!customer.intracomunitario;
        setFormData(prev => ({ ...prev, is_intracomunitario: isIntracom }));
        
        // Update RE percentage for all items
        items.forEach((_, index) => {
          updateItem(index, 're_percentage', isIntracom ? 0 : (customer.re_percentage || 0));
        });
      }
    }
  }, [formData.customer_id, customers, items, updateItem]);

  const handleGenerateInvoiceNumber = async (
    forCorrective: boolean,
    overrideCompanyId?: string,
  ) => {
    if (!companyId && !overrideCompanyId) {
      console.error('No company ID available for invoice number generation');
      toast({
        title: "Error",
        description: "No se pudo obtener la información de la empresa.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingNumber(true);
    try {
      const newNumber = await generateInvoiceNumber(forCorrective, overrideCompanyId);
      setFormData(prev => ({ ...prev, number: String(newNumber || '') }));
      console.log('Invoice number generated successfully:', newNumber);
    } catch (error) {
      console.error('Error generating invoice number:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el número de factura. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingNumber(false);
    }
  };

  const handleCorrectiveInvoiceChange = (checked: boolean) => {
    setIsCorrectiveInvoice(checked);
    if (!invoice && (companyId || billingCompanyIdOverride)) {
      void handleGenerateInvoiceNumber(checked, billingCompanyIdOverride ?? undefined);
    }
  };

  const addNewItem = () => {
    const customerRePercentage = selectedCustomer?.re_percentage || 0;
    const isIntracom = formData.is_intracomunitario;
    addItem(customerRePercentage, isIntracom);
  };

  const removeItemHandler = (index: number) => {
    if (items.length > 1) {
      removeItem(index);
    }
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.subtotal_after_discount || 0), 0);
  const totalIva = items.reduce((sum, item) => sum + (item.iva_amount || 0), 0);
  const totalRe = items.reduce((sum, item) => sum + (item.re_amount || 0), 0);
  const grandTotal = subtotal + totalIva + totalRe;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    if (!formData.number) {
      toast({
        title: "Error",
        description: "Por favor genera un número de factura.",
        variant: "destructive",
      });
      return;
    }

    if (isCorrectiveInvoice && !correctiveReason.trim()) {
      toast({
        title: "Error",
        description: "Indica el motivo de la rectificación.",
        variant: "destructive",
      });
      return;
    }

    if (isCorrectiveInvoice && !originalInvoiceId) {
      toast({
        title: "Error",
        description: "Falta la referencia a la factura original.",
        variant: "destructive",
      });
      return;
    }
    
    const validItems = items.filter(item => item.description.trim() !== '');
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Por favor agrega al menos un elemento a la factura.",
        variant: "destructive",
      });
      return;
    }

    try {
      let calculatedSubtotal = subtotal;
      let calculatedTaxAmount = totalIva;
      let calculatedReTotal = totalRe;
      let calculatedTotalAmount = grandTotal;

      if (isCorrectiveInvoice) {
        calculatedSubtotal = Math.abs(calculatedSubtotal) * -1;
        calculatedTaxAmount = Math.abs(calculatedTaxAmount) * -1;
        calculatedReTotal = Math.abs(calculatedReTotal) * -1;
        calculatedTotalAmount = Math.abs(calculatedTotalAmount) * -1;
      }

      const invoiceData = {
        ...formData,
        subtotal: calculatedSubtotal,
        tax_amount: calculatedTaxAmount,
        total_amount: calculatedTotalAmount,
        re_total: calculatedReTotal,
        paid_date: formData.paid_status && formData.paid_date ? new Date(formData.paid_date).toISOString() : null,
        company_id: billingCompanyIdOverride ?? companyId,
        is_corrective: isCorrectiveInvoice,
        original_invoice_id: isCorrectiveInvoice ? originalInvoiceId : null,
        corrective_reason: isCorrectiveInvoice ? correctiveReason.trim() || null : null,
      };

      console.log('Submitting invoice data:', invoiceData);

      if (invoice) {
        // Update existing invoice
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            ...invoiceData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoice.id);

        if (invoiceError) throw invoiceError;

        // Delete existing items and insert new ones
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invoice.id);

        const itemsToInsert = validItems.map(item => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          iva_percentage: item.iva_percentage,
          re_percentage: item.re_percentage,
          subtotal_after_discount: isCorrectiveInvoice && item.subtotal_after_discount > 0 ? item.subtotal_after_discount * -1 : item.subtotal_after_discount,
          iva_amount: isCorrectiveInvoice && item.iva_amount > 0 ? item.iva_amount * -1 : item.iva_amount,
          re_amount: isCorrectiveInvoice && item.re_amount > 0 ? item.re_amount * -1 : item.re_amount,
          total_price: isCorrectiveInvoice && item.total_price > 0 ? item.total_price * -1 : item.total_price,
          variation_id: item.variation_id || null,
        }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }

        toast({
          title: "Factura actualizada",
          description: "La factura ha sido actualizada exitosamente.",
        });
      } else {
        // Create new invoice
        const newInvoice = await createInvoice.mutateAsync(invoiceData);

        const itemsToInsert = validItems.map(item => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          iva_percentage: item.iva_percentage,
          re_percentage: item.re_percentage,
          subtotal_after_discount: isCorrectiveInvoice && item.subtotal_after_discount > 0 ? item.subtotal_after_discount * -1 : item.subtotal_after_discount,
          iva_amount: isCorrectiveInvoice && item.iva_amount > 0 ? item.iva_amount * -1 : item.iva_amount,
          re_amount: isCorrectiveInvoice && item.re_amount > 0 ? item.re_amount * -1 : item.re_amount,
          total_price: isCorrectiveInvoice && item.total_price > 0 ? item.total_price * -1 : item.total_price,
          variation_id: item.variation_id || null,
        }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }

        // If this invoice was created from a budget, update the budget status to "facturado"
        if (budgetData?.presupuesto_id) {
          const { error: budgetUpdateError } = await supabase
            .from('presupuestos_n')
            .update({ status: 'facturado' })
            .eq('id', budgetData.presupuesto_id);

          if (budgetUpdateError) {
            console.error('Error updating budget status:', budgetUpdateError);
          }
        }

        if (budgetData?.sale_id) {
          const { error: saleLinkError } = await supabase
            .from('sales')
            .update({ invoice_id: newInvoice.id })
            .eq('id', budgetData.sale_id);
          if (saleLinkError && saleLinkError.code !== '42703' && saleLinkError.code !== 'PGRST204') {
            console.error('Error linking sale to invoice:', saleLinkError);
          }
          const { error: invSaleError } = await supabase
            .from('invoices')
            .update({ sale_id: budgetData.sale_id })
            .eq('id', newInvoice.id);
          if (invSaleError && invSaleError.code !== '42703' && invSaleError.code !== 'PGRST204') {
            console.error('Error linking invoice to sale:', invSaleError);
          }
        }

        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['appointment-sale'] });
        if (onCreated) {
          onCreated(newInvoice);
          return;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la factura: " + (error as any).message,
        variant: "destructive",
      });
    }
  };

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
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">
          {invoice ? 'Editar Factura' : isCorrectiveInvoice ? 'Factura rectificativa' : 'Nueva Factura'}
        </h1>
      </div>

      {budgetData?.source === 'agenda_appointment_cancel' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Rectificativa por cancelación de cita. Revisa importes (en negativo al guardar), guarda la
          factura en el sistema y comprueba la factura original{' '}
          <strong>{budgetData.original_invoice_number || budgetData.original_invoice_id}</strong>.
          {budgetData.pending_originals?.length
            ? ` Quedan ${budgetData.pending_originals.length} factura(s) más por rectificar después.`
            : null}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="number">Número de Factura</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="number"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  required
                  disabled={isGeneratingNumber}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleGenerateInvoiceNumber(isCorrectiveInvoice, billingCompanyIdOverride ?? undefined)
                  }
                  disabled={isGeneratingNumber}
                >
                  {isGeneratingNumber ? 'Generando...' : 'Generar'}
                </Button>
              </div>
            </div>
            <CustomerSelector
              customers={customers}
              value={formData.customer_id}
              onChange={(value) => setFormData({ ...formData, customer_id: value })}
              allowEmptyOption
              required
            />
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
              <Label htmlFor="due_date">Fecha de Vencimiento</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
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
                <option value="draft">Borrador</option>
                <option value="sent">Enviada</option>
                <option value="paid">Pagada</option>
                <option value="overdue">Vencida</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Input
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_corrective"
                checked={isCorrectiveInvoice}
                onCheckedChange={handleCorrectiveInvoiceChange}
                disabled={budgetData?.source === 'agenda_appointment_cancel'}
              />
              <Label htmlFor="is_corrective">Factura Rectificativa</Label>
            </div>
            {isCorrectiveInvoice && (
              <>
                <div className="md:col-span-2">
                  <Label htmlFor="corrective_reason">Motivo de rectificación</Label>
                  <Input
                    id="corrective_reason"
                    value={correctiveReason}
                    onChange={(e) => setCorrectiveReason(e.target.value)}
                    placeholder="Ej. Cancelación de cita y devolución"
                    required
                  />
                </div>
                {originalInvoiceId && (
                  <div className="md:col-span-2 text-xs text-muted-foreground">
                    Factura original: {budgetData?.original_invoice_number || originalInvoiceId}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Elementos de la Factura</CardTitle>
              <Button type="button" onClick={addNewItem} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Elemento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item, index) => (
                <InvoiceItemRow
                  key={index}
                  item={item}
                  index={index}
                  onUpdate={updateItem}
                  onRemove={removeItemHandler}
                  canRemove={items.length > 1}
                  customerRePercentage={selectedCustomer?.re_percentage || 0}
                  isIntracomunitario={formData.is_intracomunitario}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-right">
              <div>
                <Label>Subtotal</Label>
                <div className="text-lg font-semibold">
                  €{subtotal.toFixed(2)}
                </div>
              </div>
              <div>
                <Label>IVA</Label>
                <div className="text-lg font-semibold">
                  €{totalIva.toFixed(2)}
                </div>
              </div>
              <div>
                <Label>RE</Label>
                <div className="text-lg font-semibold">
                  €{totalRe.toFixed(2)}
                </div>
              </div>
              <div>
                <Label>Total</Label>
                <div className="text-xl font-bold text-blue-600">
                  €{grandTotal.toFixed(2)}
                </div>
              </div>
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
          <Button type="submit" disabled={createInvoice.isPending || isGeneratingNumber}>
            <Save className="w-4 h-4 mr-2" />
            {createInvoice.isPending ? 'Guardando...' : 'Guardar Factura'}
          </Button>
        </div>
      </form>
    </div>
  );
};
