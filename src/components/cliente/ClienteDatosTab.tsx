import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IbanInput } from '@/components/ui/iban-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerPhotoUpload } from '@/components/CustomerPhotoUpload';
import { CustomerAdvancedForm } from '@/components/CustomerAdvancedForm';
import { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';

interface ClienteDatosTabProps {
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  watch: UseFormWatch<any>;
  errors: FieldErrors;
  customerId?: string;
  contacts: any[];
  addresses: any[];
  onContactsChange: (contacts: any[]) => void;
  onAddressesChange: (addresses: any[]) => void;
}

export const ClienteDatosTab: React.FC<ClienteDatosTabProps> = ({
  register, setValue, watch, errors, customerId,
  contacts, addresses, onContactsChange, onAddressesChange
}) => {
  const watchedPaymentTerms = watch('payment_terms');
  const watchedIbanAccount = watch('iban_account');
  const watchedPhotoUrl = watch('photo_url');
  const watchedRePercentage = watch('re_percentage');
  const watchedIrpfPercentage = watch('irpf_percentage');
  const watchedIntracomunitario = watch('intracomunitario');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Información Básica</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <CustomerPhotoUpload
              currentPhotoUrl={watchedPhotoUrl}
              onPhotoChange={(url) => setValue('photo_url', url || '')}
              customerId={customerId}
            />
          </div>
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" {...register('name', { required: 'El nombre es obligatorio' })} />
            {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message as string}</p>}
          </div>
          <div>
            <Label htmlFor="tax_id">DNI/CIF</Label>
            <Input id="tax_id" {...register('tax_id')} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
          </div>
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          <div>
            <Label htmlFor="contact_person">Persona de Contacto</Label>
            <Input id="contact_person" {...register('contact_person')} />
          </div>
          <div>
            <Label htmlFor="payment_terms">Forma de Pago</Label>
            <Select value={watchedPaymentTerms} onValueChange={(v) => setValue('payment_terms', v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
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
            <Input id="credit_limit" type="number" min="0" step="0.01" {...register('credit_limit', { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="iban_account">Cuenta Bancaria (IBAN)</Label>
            <IbanInput value={watchedIbanAccount} onChange={(v) => setValue('iban_account', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dirección Principal</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="address_street">Dirección</Label>
            <Input id="address_street" {...register('address_street')} />
          </div>
          <div>
            <Label htmlFor="address_city">Ciudad</Label>
            <Input id="address_city" {...register('address_city')} />
          </div>
          <div>
            <Label htmlFor="address_state">Provincia</Label>
            <Input id="address_state" {...register('address_state')} />
          </div>
          <div>
            <Label htmlFor="address_postal_code">Código Postal</Label>
            <Input id="address_postal_code" {...register('address_postal_code')} />
          </div>
          <div>
            <Label htmlFor="address_country">País</Label>
            <Input id="address_country" {...register('address_country')} />
          </div>
        </CardContent>
      </Card>

      <CustomerAdvancedForm
        customerId={customerId}
        initialContacts={contacts}
        initialAddresses={addresses}
        onContactsChange={onContactsChange}
        onAddressesChange={onAddressesChange}
        rePercentage={watchedRePercentage}
        irpfPercentage={watchedIrpfPercentage}
        intracomunitario={watchedIntracomunitario}
        onRePercentageChange={(v) => setValue('re_percentage', v)}
        onIrpfPercentageChange={(v) => setValue('irpf_percentage', v)}
        onIntracomunitarioChange={(v) => setValue('intracomunitario', v)}
      />
    </div>
  );
};
