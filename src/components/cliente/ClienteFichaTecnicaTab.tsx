import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { IbanInput } from '@/components/ui/iban-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatAgeLabel } from '@/lib/patientAge';

interface Props {
  customer: any;
  isLoading: boolean;
  onUpdate: (field: string, value: any) => void;
}

const fieldLabel = 'text-[10px] uppercase tracking-wide text-muted-foreground font-medium';
const fieldInput = 'h-8 text-sm mt-0.5';

function birthDateYmd(customer: { birth_date?: string | null }): string {
  if (!customer.birth_date) return '';
  return String(customer.birth_date).slice(0, 10);
}

export const ClienteFichaTecnicaTab: React.FC<Props> = ({ customer, isLoading, onUpdate }) => {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-sky-100/50 dark:border-sky-900/20 p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!customer) return null;

  const birthYmd = birthDateYmd(customer);
  const ageLabel = formatAgeLabel(birthYmd);

  return (
    <div className="rounded-lg border border-sky-100/50 dark:border-sky-900/20 bg-card/40 p-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2">
        <div>
          <Label className={fieldLabel}>Nombre</Label>
          <Input
            value={customer.name || ''}
            onChange={(e) => onUpdate('name', e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>DNI/CIF</Label>
          <Input
            value={customer.tax_id || ''}
            onChange={(e) => onUpdate('tax_id', e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>Cod. cliente</Label>
          <Input
            value={customer.legacy_codcli || ''}
            readOnly
            tabIndex={-1}
            placeholder="—"
            className={cn(fieldInput, 'bg-muted/40 text-muted-foreground cursor-default')}
          />
        </div>
        <div>
          <Label className={fieldLabel}>Fecha de nacimiento</Label>
          <div className="flex items-center gap-2 mt-0.5">
            <Input
              type="date"
              value={birthYmd}
              onChange={(e) => onUpdate('birth_date', e.target.value || null)}
              className={cn(fieldInput, 'flex-1 mt-0')}
            />
            {ageLabel && (
              <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                {ageLabel}
              </span>
            )}
          </div>
        </div>
        <div>
          <Label className={fieldLabel}>Persona contacto</Label>
          <Input
            value={customer.contact_person || ''}
            onChange={(e) => onUpdate('contact_person', e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>Email</Label>
          <Input
            type="email"
            value={customer.email || ''}
            onChange={(e) => onUpdate('email', e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>Móvil (SMS)</Label>
          <Input
            value={customer.phone_mobile || ''}
            onChange={(e) => onUpdate('phone_mobile', e.target.value || null)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>Tel. fijo / alt.</Label>
          <Input
            value={customer.phone_home || ''}
            onChange={(e) => onUpdate('phone_home', e.target.value || null)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>Forma de pago</Label>
          <Select
            value={customer.payment_terms?.toString() || 'efectivo'}
            onValueChange={(v) => onUpdate('payment_terms', v)}
          >
            <SelectTrigger className={cn(fieldInput, 'h-8')}>
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
        <div className="sm:col-span-2 lg:col-span-2">
          <Label className={fieldLabel}>IBAN</Label>
          <IbanInput
            value={customer.iban_account || ''}
            onChange={(v) => onUpdate('iban_account', v)}
            className="mt-0.5 [&_input]:h-8 [&_input]:text-sm"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label className={fieldLabel}>Calle</Label>
          <Input
            value={customer.address_street || ''}
            onChange={(e) => onUpdate('address_street', e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>Ciudad</Label>
          <Input
            value={customer.address_city || ''}
            onChange={(e) => onUpdate('address_city', e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>Provincia</Label>
          <Input
            value={customer.address_state || ''}
            onChange={(e) => onUpdate('address_state', e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>C.P.</Label>
          <Input
            value={customer.address_postal_code || ''}
            onChange={(e) => onUpdate('address_postal_code', e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <Label className={fieldLabel}>País</Label>
          <Input
            value={customer.address_country || ''}
            onChange={(e) => onUpdate('address_country', e.target.value)}
            className={fieldInput}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label className={fieldLabel}>Notas</Label>
          <Textarea
            value={customer.notes || ''}
            onChange={(e) => onUpdate('notes', e.target.value)}
            rows={3}
            placeholder="Notas internas..."
            className="resize-none text-sm min-h-[72px] mt-0.5"
          />
        </div>
      </div>
    </div>
  );
};
