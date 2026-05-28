import React from 'react';
import { ArrowLeft, Phone, MessageCircle, CalendarPlus, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { primaryCustomerPhone, formatCustomerPhoneLabels } from '@/lib/legacyCustomerPhones';
import { usePermissions } from '@/hooks/usePermissions';

type Props = {
  customer: Record<string, unknown> | null;
  isLoading: boolean;
  onBack: () => void;
  backLabel: string;
  onNewAppointment?: () => void;
  hasChanges?: boolean;
  onSave?: () => void;
  saving?: boolean;
};

export const ClienteDetailCompactBar: React.FC<Props> = ({
  customer,
  isLoading,
  onBack,
  backLabel,
  onNewAppointment,
  hasChanges,
  onSave,
  saving,
}) => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canUseWhatsapp = hasPermission('whatsapp', 'read');

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 border-b pb-2">
        <Skeleton className="h-4 w-40 flex-1" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>
    );
  }

  if (!customer) return null;

  const phone = primaryCustomerPhone(customer);
  const phoneLabel = formatCustomerPhoneLabels(customer)[0] || phone || '';
  const name = String(customer.name ?? '').trim();

  const handleCall = () => {
    if (phone) window.open(`tel:${phone.replace(/\s+/g, '')}`);
  };

  const handleWhatsApp = () => {
    if (!phone) return;
    if (canUseWhatsapp) {
      const params = new URLSearchParams();
      params.set('phone', phone);
      if (name) params.set('name', name);
      navigate(`/whatsapp?${params.toString()}`);
    } else {
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    }
  };

  const handleNewAppointment = () => {
    if (onNewAppointment) {
      onNewAppointment();
      return;
    }
    navigate('/agenda');
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border/60 pb-2">
      <div className="min-w-0 flex-1 text-xs leading-tight">
        <span className="font-medium text-foreground truncate">{name || 'Cliente'}</span>
        {phoneLabel && (
          <span className="text-muted-foreground">
            {' '}
            · {phoneLabel}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 shrink-0 ml-auto">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px] gap-1"
          onClick={handleCall}
          disabled={!phone}
        >
          <Phone className="h-3 w-3" />
          Llamar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px] gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
          onClick={handleWhatsApp}
          disabled={!phone}
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1 bg-sky-500 hover:bg-sky-600 text-white"
          onClick={handleNewAppointment}
        >
          <CalendarPlus className="h-3 w-3" />
          Nueva cita
        </Button>
        {hasChanges && onSave && (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1"
            onClick={onSave}
            disabled={saving}
          >
            <Save className="h-3 w-3" />
            {saving ? '…' : 'Guardar'}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-7 px-2 gap-1 text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="h-3 w-3" />
          <span className="text-[11px]">{backLabel}</span>
        </Button>
      </div>
    </div>
  );
};
