import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { IbanInput } from '@/components/ui/iban-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  customer: any;
  isLoading: boolean;
  onUpdate: (field: string, value: any) => void;
}

export const ClienteFichaTecnicaTab: React.FC<Props> = ({ customer, isLoading, onUpdate }) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => (
          <Card key={i}>
            <CardContent className="p-6 space-y-4">
              {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-10 w-full" />)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6">
      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Datos Personales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Nombre</Label>
            <Input
              value={customer.name || ''}
              onChange={(e) => onUpdate('name', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">DNI/CIF</Label>
            <Input
              value={customer.tax_id || ''}
              onChange={(e) => onUpdate('tax_id', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={customer.email || ''}
              onChange={(e) => onUpdate('email', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Teléfono</Label>
            <Input
              value={customer.phone || ''}
              onChange={(e) => onUpdate('phone', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Persona de Contacto</Label>
            <Input
              value={customer.contact_person || ''}
              onChange={(e) => onUpdate('contact_person', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Forma de Pago</Label>
            <Select
              value={customer.payment_terms?.toString() || 'efectivo'}
              onValueChange={(v) => onUpdate('payment_terms', v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="60">60 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">IBAN</Label>
            <IbanInput
              value={customer.iban_account || ''}
              onChange={(v) => onUpdate('iban_account', v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Dirección</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Calle</Label>
            <Input
              value={customer.address_street || ''}
              onChange={(e) => onUpdate('address_street', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ciudad</Label>
            <Input
              value={customer.address_city || ''}
              onChange={(e) => onUpdate('address_city', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Provincia</Label>
            <Input
              value={customer.address_state || ''}
              onChange={(e) => onUpdate('address_state', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Código Postal</Label>
            <Input
              value={customer.address_postal_code || ''}
              onChange={(e) => onUpdate('address_postal_code', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">País</Label>
            <Input
              value={customer.address_country || ''}
              onChange={(e) => onUpdate('address_country', e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-sky-100/50 dark:border-sky-900/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={customer.notes || ''}
            onChange={(e) => onUpdate('notes', e.target.value)}
            rows={5}
            placeholder="Notas internas sobre el cliente..."
            className="resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
};
