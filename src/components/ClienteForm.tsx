import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, User, Heart, Calendar, FileText, Receipt, Gift, StickyNote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useCustomerAdvanced } from '@/hooks/useCustomerAdvanced';
import { ClienteDatosTab } from './cliente/ClienteDatosTab';
import { ClienteHistorialTab } from './cliente/ClienteHistorialTab';
import { ClienteCitasTab } from './cliente/ClienteCitasTab';
import { ClienteDocumentacionTab } from './cliente/ClienteDocumentacionTab';
import { ClienteFacturacionTab } from './cliente/ClienteFacturacionTab';
import { ClienteBonosTab } from './cliente/ClienteBonosTab';
import { ClienteNotasTab } from './cliente/ClienteNotasTab';

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

  const watchedNotes = watch('notes');

  const saveCustomerMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!companyId) throw new Error('No se pudo obtener el ID de la empresa');

      let paymentTermsValue: number | null = null;
      if (data.payment_terms === '30 días') paymentTermsValue = 30;
      else if (data.payment_terms === '60 días') paymentTermsValue = 60;

      const customerData = { ...data, payment_terms: paymentTermsValue, company_id: companyId };
      let savedCustomerId: string;

      if (customer) {
        const { error } = await supabase.from('customers').update(customerData).eq('id', customer.id);
        if (error) throw error;
        savedCustomerId = customer.id;
      } else {
        const { data: newData, error } = await supabase.from('customers').insert([customerData]).select();
        if (error) throw error;
        savedCustomerId = newData[0].id;
      }

      if (advancedContacts.length > 0) await saveContacts(savedCustomerId, advancedContacts);
      if (advancedAddresses.length > 0) await saveAddresses(savedCustomerId, advancedAddresses);
      return { customerId: savedCustomerId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: customer ? 'Cliente actualizado' : 'Cliente creado' });
      onClose();
    },
    onError: (error) => {
      toast({ title: 'Error', description: (error as any).message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: FormData) => {
    if (!companyId) {
      toast({ title: 'Error', description: 'No se pudo obtener la empresa.', variant: 'destructive' });
      return;
    }
    saveCustomerMutation.mutate(data);
  };

  if (!companyId) {
    return <div className="flex justify-center items-center h-64 text-muted-foreground">Cargando...</div>;
  }

  const isExisting = !!customer?.id;

  const tabItems = [
    { value: 'datos', label: 'Datos', icon: User },
    ...(isExisting ? [
      { value: 'historial', label: 'Historial', icon: Heart },
      { value: 'citas', label: 'Citas', icon: Calendar },
      { value: 'documentacion', label: 'Documentación', icon: FileText },
      { value: 'facturacion', label: 'Facturación', icon: Receipt },
      { value: 'bonos', label: 'Bonos', icon: Gift },
    ] : []),
    { value: 'notas', label: 'Notas', icon: StickyNote },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <h1 className="text-2xl font-bold">{customer ? customer.name : 'Nuevo Cliente'}</h1>
        </div>
        <Button onClick={handleSubmit(onSubmit)} disabled={saveCustomerMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {saveCustomerMutation.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      <Tabs defaultValue="datos" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          {tabItems.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5">
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          <TabsContent value="datos">
            <ClienteDatosTab
              register={register}
              setValue={setValue}
              watch={watch}
              errors={errors}
              customerId={customer?.id}
              contacts={contacts}
              addresses={addresses}
              onContactsChange={setAdvancedContacts}
              onAddressesChange={setAdvancedAddresses}
            />
          </TabsContent>

          {isExisting && (
            <>
              <TabsContent value="historial">
                <ClienteHistorialTab customerId={customer!.id} />
              </TabsContent>
              <TabsContent value="citas">
                <ClienteCitasTab customerId={customer!.id} />
              </TabsContent>
              <TabsContent value="documentacion">
                <ClienteDocumentacionTab customerId={customer!.id} />
              </TabsContent>
              <TabsContent value="facturacion">
                <ClienteFacturacionTab customerId={customer!.id} />
              </TabsContent>
              <TabsContent value="bonos">
                <ClienteBonosTab customerId={customer!.id} />
              </TabsContent>
            </>
          )}

          <TabsContent value="notas">
            <ClienteNotasTab
              notes={watchedNotes}
              onChange={(v) => setValue('notes', v)}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
