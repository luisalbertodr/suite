
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IbanInput } from '@/components/ui/iban-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { CustomerPhotoUpload } from './CustomerPhotoUpload';
import { CustomerAdvancedForm } from './CustomerAdvancedForm';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useCustomerAdvanced } from '@/hooks/useCustomerAdvanced';

interface Customer {
  id: string;
  name: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country?: string;
  contact_person?: string;
  payment_terms?: number;
  credit_limit?: number;
  notes?: string;
  iban_account?: string;
  photo_url?: string;
  re_percentage?: number;
  irpf_percentage?: number;
  intracomunitario?: string;
}

interface ClienteFormProps {
  customer?: Customer | null;
  onClose: () => void;
}

interface FormData {
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  address_country: string;
  contact_person: string;
  payment_terms: string;
  credit_limit: number;
  notes: string;
  iban_account: string;
  photo_url: string;
  re_percentage: number;
  irpf_percentage: number;
  intracomunitario: string;
}

export const ClienteForm: React.FC<ClienteFormProps> = ({ customer, onClose }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const { contacts, addresses, saveContacts, saveAddresses } = useCustomerAdvanced(customer?.id);

  const [advancedContacts, setAdvancedContacts] = useState<any[]>([]);
  const [advancedAddresses, setAdvancedAddresses] = useState<any[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: customer?.name || '',
      tax_id: customer?.tax_id || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      address_street: customer?.address_street || '',
      address_city: customer?.address_city || '',
      address_state: customer?.address_state || '',
      address_postal_code: customer?.address_postal_code || '',
      address_country: customer?.address_country || 'España',
      contact_person: customer?.contact_person || '',
      payment_terms: customer?.payment_terms ? customer.payment_terms.toString() : 'efectivo',
      credit_limit: customer?.credit_limit || 0,
      notes: customer?.notes || '',
      iban_account: customer?.iban_account || '',
      photo_url: customer?.photo_url || '',
      re_percentage: customer?.re_percentage || 0,
      irpf_percentage: customer?.irpf_percentage || 0,
      intracomunitario: customer?.intracomunitario || '',
    }
  });

  const watchedPaymentTerms = watch('payment_terms');
  const watchedIbanAccount = watch('iban_account');
  const watchedPhotoUrl = watch('photo_url');
  const watchedRePercentage = watch('re_percentage');
  const watchedIrpfPercentage = watch('irpf_percentage');
  const watchedIntracomunitario = watch('intracomunitario');

  const saveCustomerMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log('Starting customer save process...', { customer, companyId, data });
      
      if (!companyId) {
        throw new Error('No se pudo obtener el ID de la empresa');
      }

      // Convert payment_terms back to appropriate format for database
      let paymentTermsValue: number | null = null;
      if (data.payment_terms === '30 días') {
        paymentTermsValue = 30;
      } else if (data.payment_terms === '60 días') {
        paymentTermsValue = 60;
      } else {
        paymentTermsValue = null; // For efectivo, tarjeta, transferencia
      }

      const customerData = {
        ...data,
        payment_terms: paymentTermsValue,
        company_id: companyId,
      };

      console.log('Customer data to save:', customerData);

      let savedCustomerId: string;

      if (customer) {
        console.log('Updating existing customer:', customer.id);
        const { data: updatedData, error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customer.id)
          .select();
        
        if (error) {
          console.error('Error updating customer:', error);
          throw error;
        }
        
        console.log('Customer updated successfully:', updatedData);
        savedCustomerId = customer.id;
      } else {
        console.log('Creating new customer');
        const { data: newData, error } = await supabase
          .from('customers')
          .insert([customerData])
          .select();
        
        if (error) {
          console.error('Error creating customer:', error);
          throw error;
        }
        
        console.log('Customer created successfully:', newData);
        savedCustomerId = newData[0].id;
      }

      // Save advanced contacts and addresses
      if (advancedContacts.length > 0) {
        await saveContacts(savedCustomerId, advancedContacts);
      }
      if (advancedAddresses.length > 0) {
        await saveAddresses(savedCustomerId, advancedAddresses);
      }

      return { customerId: savedCustomerId };
    },
    onSuccess: () => {
      console.log('Customer save mutation successful');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      toast({
        title: customer ? "Cliente actualizado" : "Cliente creado",
        description: customer ? "El cliente ha sido actualizado exitosamente." : "El nuevo cliente ha sido creado exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      console.error('Customer save mutation error:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el cliente: " + (error as any).message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log('Form submitted with data:', data);
    
    if (!companyId) {
      toast({
        title: "Error",
        description: "No se pudo obtener la información de la empresa. Por favor, recarga la página.",
        variant: "destructive",
      });
      return;
    }
    
    saveCustomerMutation.mutate(data);
  };

  const handlePhotoChange = (photoUrl: string | null) => {
    setValue('photo_url', photoUrl || '');
  };

  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Cargando información de la empresa...</h2>
          <p className="text-gray-500 mt-2">Por favor, espera un momento.</p>
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
          {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <CustomerPhotoUpload
                currentPhotoUrl={watchedPhotoUrl}
                onPhotoChange={handlePhotoChange}
                customerId={customer?.id}
              />
            </div>
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                {...register('name', { required: 'El nombre es obligatorio' })}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="tax_id">DNI/CIF</Label>
              <Input
                id="tax_id"
                {...register('tax_id')}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
              />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                {...register('phone')}
              />
            </div>
            <div>
              <Label htmlFor="contact_person">Persona de Contacto</Label>
              <Input
                id="contact_person"
                {...register('contact_person')}
              />
            </div>
            <div>
              <Label htmlFor="payment_terms">Forma de Pago</Label>
              <Select
                value={watchedPaymentTerms}
                onValueChange={(value) => setValue('payment_terms', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="30 días">30 días</SelectItem>
                  <SelectItem value="60 días">60 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="credit_limit">Límite de Crédito (€)</Label>
              <Input
                id="credit_limit"
                type="number"
                min="0"
                step="0.01"
                {...register('credit_limit', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="iban_account">Cuenta Bancaria (tipo IBAN)</Label>
              <IbanInput
                value={watchedIbanAccount}
                onChange={(value) => setValue('iban_account', value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dirección Principal</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="address_street">Dirección</Label>
              <Input
                id="address_street"
                {...register('address_street')}
              />
            </div>
            <div>
              <Label htmlFor="address_city">Ciudad</Label>
              <Input
                id="address_city"
                {...register('address_city')}
              />
            </div>
            <div>
              <Label htmlFor="address_state">Provincia</Label>
              <Input
                id="address_state"
                {...register('address_state')}
              />
            </div>
            <div>
              <Label htmlFor="address_postal_code">Código Postal</Label>
              <Input
                id="address_postal_code"
                {...register('address_postal_code')}
              />
            </div>
            <div>
              <Label htmlFor="address_country">País</Label>
              <Input
                id="address_country"
                {...register('address_country')}
              />
            </div>
          </CardContent>
        </Card>

        <CustomerAdvancedForm
          customerId={customer?.id}
          initialContacts={contacts}
          initialAddresses={addresses}
          onContactsChange={setAdvancedContacts}
          onAddressesChange={setAdvancedAddresses}
          rePercentage={watchedRePercentage}
          irpfPercentage={watchedIrpfPercentage}
          intracomunitario={watchedIntracomunitario}
          onRePercentageChange={(value) => setValue('re_percentage', value)}
          onIrpfPercentageChange={(value) => setValue('irpf_percentage', value)}
          onIntracomunitarioChange={(value) => setValue('intracomunitario', value)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              {...register('notes')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Notas adicionales sobre el cliente..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveCustomerMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveCustomerMutation.isPending ? 'Guardando...' : 'Guardar Cliente'}
          </Button>
        </div>
      </form>
    </div>
  );
};
