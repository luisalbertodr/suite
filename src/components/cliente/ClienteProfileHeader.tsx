import React from 'react';
import { Phone, MessageCircle, CalendarPlus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  customer: any;
  isLoading: boolean;
}

export const ClienteProfileHeader: React.FC<Props> = ({ customer, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-6 p-6 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border border-sky-100 dark:border-sky-900/30">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const handleCall = () => {
    if (customer.phone) window.open(`tel:${customer.phone}`);
  };

  const handleWhatsApp = () => {
    if (customer.phone) {
      const cleaned = customer.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleaned}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 rounded-2xl bg-gradient-to-r from-sky-50/80 to-blue-50/80 dark:from-sky-950/20 dark:to-blue-950/20 border border-sky-100/50 dark:border-sky-900/20 backdrop-blur-sm">
      {/* Avatar */}
      <div className="relative">
        {customer.photo_url ? (
          <img
            src={customer.photo_url}
            alt={customer.name}
            className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-gray-800 shadow-lg"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center ring-4 ring-white dark:ring-gray-800 shadow-lg">
            <User className="w-9 h-9 text-white" />
          </div>
        )}
        {/* Online indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-400 border-[3px] border-white dark:border-gray-800" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold text-foreground tracking-tight truncate">
          {customer.name}
        </h2>
        {customer.tax_id && (
          <p className="text-sm text-muted-foreground mt-0.5">DNI/CIF: {customer.tax_id}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-1">
          {customer.email && (
            <span className="text-xs text-sky-600 dark:text-sky-400">{customer.email}</span>
          )}
          {customer.phone && (
            <span className="text-xs text-muted-foreground">· {customer.phone}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300"
          onClick={handleCall}
          disabled={!customer.phone}
        >
          <Phone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Llamar</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
          onClick={handleWhatsApp}
          disabled={!customer.phone}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-sky-500 hover:bg-sky-600 text-white"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nueva Cita</span>
        </Button>
      </div>
    </div>
  );
};
