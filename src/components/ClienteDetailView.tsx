import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomerDetail } from '@/hooks/useCustomerDetail';
import { ClienteProfileHeader } from './cliente/ClienteProfileHeader';
import { ClienteDetailCompactBar } from './cliente/ClienteDetailCompactBar';
import { ClienteDailyScrollView } from './cliente/ClienteDailyScrollView';
import { ClienteBonosTab } from './cliente/ClienteBonosTab';
import { ClienteFichaTecnicaTab } from './cliente/ClienteFichaTecnicaTab';
import { ClienteInbodyTab } from './cliente/ClienteInbodyTab';
import { ClienteAdjuntosTab } from './cliente/ClienteAdjuntosTab';
import type { ClienteDetailTab } from '@/types/clienteDetail';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { primaryCustomerPhone } from '@/lib/legacyCustomerPhones';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { buildAgendaAppointmentUrl } from '@/lib/agendaCustomerNavigation';

interface Props {
  customerId: string;
  onBack: () => void;
  initialTab?: ClienteDetailTab;
  backLabel?: string;
  variant?: 'full' | 'compact';
  onNewAppointment?: () => void;
  /** Desde overlay de cita: abrir otra cita sin salir de la agenda. */
  onAppointmentClick?: (appointmentId: string, dateYmd: string) => void;
}

export const ClienteDetailView: React.FC<Props> = ({
  customerId,
  onBack,
  initialTab,
  backLabel = 'Clientes',
  variant = 'full',
  onNewAppointment,
  onAppointmentClick,
}) => {
  const navigate = useNavigate();
  const compact = variant === 'compact';
  const activeTab = initialTab ?? (compact ? 'ficha' : 'timeline');
  const [tab, setTab] = useState(activeTab);
  const { customer } = useCustomerDetail(customerId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const handleFieldUpdate = useCallback((field: string, value: any) => {
    setEditedFields((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (Object.keys(editedFields).length === 0) return;
      const payload = { ...editedFields } as Record<string, unknown>;
      if ('phone_mobile' in payload || 'phone_home' in payload) {
        const merged = { ...customer.data, ...editedFields };
        payload.phone = primaryCustomerPhone(merged) || null;
      }
      const { error } = await supabase
        .from('customers')
        .update(payload as any)
        .eq('id', customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer_detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditedFields({});
      setHasChanges(false);
      toast({ title: 'Cliente guardado' });
    },
    onError: () => toast({ title: 'Error al guardar', variant: 'destructive' }),
  });

  const mergedCustomer = customer.data ? { ...customer.data, ...editedFields } : null;

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab, customerId]);

  const handleAppointmentClick = useCallback(
    (appointmentId: string, dateYmd: string) => {
      if (onAppointmentClick) {
        onAppointmentClick(appointmentId, dateYmd);
        return;
      }
      navigate(buildAgendaAppointmentUrl(dateYmd, appointmentId, customerId));
    },
    [customerId, navigate, onAppointmentClick],
  );

  return (
    <div className={cn(compact ? 'space-y-3' : 'max-w-5xl mx-auto space-y-6')}>
      {compact ? (
        <ClienteDetailCompactBar
          customer={mergedCustomer}
          isLoading={customer.isLoading}
          onBack={onBack}
          backLabel={backLabel}
          onNewAppointment={onNewAppointment}
          hasChanges={hasChanges}
          onSave={() => saveMutation.mutate()}
          saving={saveMutation.isPending}
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              {backLabel}
            </Button>
            {hasChanges && (
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="gap-1.5 bg-sky-500 hover:bg-sky-600 text-white"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            )}
          </div>
          <ClienteProfileHeader customer={mergedCustomer} isLoading={customer.isLoading} />
        </>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList
          className={cn(
            'w-full grid grid-cols-5 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100/50 dark:border-sky-900/20 rounded-lg p-0.5',
            compact && 'h-8',
          )}
        >
          <TabsTrigger
            value="ficha"
            className={cn(
              'rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-sky-700 dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-sky-300',
              compact ? 'text-xs py-1 h-7' : 'text-sm rounded-lg',
            )}
          >
            Datos
          </TabsTrigger>
          <TabsTrigger
            value="vouchers"
            className={cn(
              'rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-sky-700 dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-sky-300',
              compact ? 'text-xs py-1 h-7' : 'text-sm rounded-lg',
            )}
          >
            Artículos
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className={cn(
              'rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-sky-700 dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-sky-300',
              compact ? 'text-xs py-1 h-7' : 'text-sm rounded-lg',
            )}
          >
            Servicios
          </TabsTrigger>
          <TabsTrigger
            value="inbody"
            className={cn(
              'rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-sky-700 dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-sky-300',
              compact ? 'text-[10px] px-1 py-1 h-7' : 'text-sm rounded-lg',
            )}
          >
            InBody
          </TabsTrigger>
          <TabsTrigger
            value="adjuntos"
            className={cn(
              'rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-sky-700 dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-sky-300',
              compact ? 'text-[10px] px-1 py-1 h-7' : 'text-sm rounded-lg',
            )}
          >
            Adjuntos
          </TabsTrigger>
        </TabsList>

        <div className={compact ? 'mt-2' : 'mt-5'}>
          <TabsContent value="ficha" className="mt-0">
            <ClienteFichaTecnicaTab
              customer={mergedCustomer}
              isLoading={customer.isLoading}
              onUpdate={handleFieldUpdate}
            />
          </TabsContent>

          <TabsContent value="vouchers" className="mt-0">
            {tab === 'vouchers' ? <ClienteBonosTab customerId={customerId} /> : null}
          </TabsContent>

          <TabsContent value="timeline" className="mt-0">
            {tab === 'timeline' ? (
              <ClienteDailyScrollView
                customerId={customerId}
                className="max-w-full"
                onAppointmentClick={handleAppointmentClick}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="inbody" className="mt-0">
            {tab === 'inbody' ? (
              <ClienteInbodyTab
                customerId={customerId}
                taxId={mergedCustomer?.tax_id}
                companyId={mergedCustomer?.company_id}
                compact={compact}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="adjuntos" className="mt-0">
            {tab === 'adjuntos' ? (
              <ClienteAdjuntosTab customerId={customerId} compact={compact} />
            ) : null}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
