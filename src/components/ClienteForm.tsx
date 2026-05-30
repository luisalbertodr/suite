import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, User, Heart, Calendar, FileText, Receipt, Gift, StickyNote, ChevronRight } from 'lucide-react';
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
import { ClienteDailyScrollView } from './cliente/ClienteDailyScrollView';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

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

const Section: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}> = ({ title, icon: Icon, open, onOpenChange, children }) => (
  <Collapsible open={open} onOpenChange={onOpenChange} className="border border-sky-100/80 dark:border-sky-900/30 rounded-lg overflow-hidden bg-card">
    <CollapsibleTrigger asChild>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-sky-50/80 dark:hover:bg-sky-950/30"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-sky-600 flex-shrink-0" />
          {title}
        </span>
        <ChevronRight
          className={cn('w-4 h-4 text-muted-foreground transition-transform flex-shrink-0', open && 'rotate-90')}
        />
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="px-3 pb-3 pt-0 border-t border-sky-100/50 dark:border-sky-900/20">{children}</div>
    </CollapsibleContent>
  </Collapsible>
);

export const ClienteForm: React.FC<ClienteFormProps> = ({ customer, onClose }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const { contacts, addresses, saveContacts, saveAddresses } = useCustomerAdvanced(customer?.id);
  const [advancedContacts, setAdvancedContacts] = useState<any[]>([]);
  const [advancedAddresses, setAdvancedAddresses] = useState<any[]>([]);

  const isExisting = !!customer?.id;
  const [openDatos, setOpenDatos] = useState(!isExisting);
  const [openNotas, setOpenNotas] = useState(false);
  const [openHistorial, setOpenHistorial] = useState(false);
  const [openCitas, setOpenCitas] = useState(false);
  const [openDoc, setOpenDoc] = useState(false);
  const [openFact, setOpenFact] = useState(false);
  const [openBonos, setOpenBonos] = useState(false);
  const [openActividad, setOpenActividad] = useState(false);

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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (result?.customerId) {
        queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', result.customerId] });
        queryClient.invalidateQueries({ queryKey: ['customer_detail', result.customerId] });
      }
      toast({ title: customer ? 'Cliente actualizado' : 'Cliente creado' });
      onClose();
    },
    onError: (error) => {
      const e = error as { code?: string; message?: string };
      if (e?.code === '23505') {
        toast({
          title: 'Teléfono duplicado',
          description:
            'Ya existe un cliente con este número (mismos 9 últimos dígitos). Busca la ficha o cambia el teléfono.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Error', description: e?.message || 'Error al guardar', variant: 'destructive' });
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

      {isExisting && customer?.id && (
        <Section
          title="Actividad por día"
          icon={Calendar}
          open={openActividad}
          onOpenChange={setOpenActividad}
        >
          {openActividad ? (
            <ClienteDailyScrollView customerId={customer.id} className="max-w-full" />
          ) : (
            <p className="text-sm text-muted-foreground py-2">Abre esta sección para ver el historial.</p>
          )}
        </Section>
      )}

      <div className="space-y-2">
        <Section title="Datos y contacto" icon={User} open={openDatos} onOpenChange={setOpenDatos}>
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
        </Section>

        {isExisting && customer?.id && (
          <>
            <Section
              title="Historial clínico"
              icon={Heart}
              open={openHistorial}
              onOpenChange={setOpenHistorial}
            >
              <ClienteHistorialTab customerId={customer.id} />
            </Section>
            <Section title="Citas" icon={Calendar} open={openCitas} onOpenChange={setOpenCitas}>
              {openCitas ? (
                <ClienteCitasTab customerId={customer.id} />
              ) : (
                <p className="text-sm text-muted-foreground py-2">Abre esta sección para ver las citas.</p>
              )}
            </Section>
            <Section
              title="Documentación"
              icon={FileText}
              open={openDoc}
              onOpenChange={setOpenDoc}
            >
              <ClienteDocumentacionTab customerId={customer.id} />
            </Section>
            <Section
              title="Facturación"
              icon={Receipt}
              open={openFact}
              onOpenChange={setOpenFact}
            >
              <ClienteFacturacionTab customerId={customer.id} />
            </Section>
            <Section title="Bonos" icon={Gift} open={openBonos} onOpenChange={setOpenBonos}>
              <ClienteBonosTab customerId={customer.id} />
            </Section>
          </>
        )}

        <Section title="Notas" icon={StickyNote} open={openNotas} onOpenChange={setOpenNotas}>
          <ClienteNotasTab
            notes={watchedNotes}
            onChange={(v) => setValue('notes', v)}
          />
        </Section>
      </div>
    </div>
  );
};
