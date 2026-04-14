import React, { useState, useCallback } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomerDetail } from '@/hooks/useCustomerDetail';
import { ClienteProfileHeader } from './cliente/ClienteProfileHeader';
import { ClienteTimelineTab } from './cliente/ClienteTimelineTab';
import { ClienteVouchersTab } from './cliente/ClienteVouchersTab';
import { ClienteFichaTecnicaTab } from './cliente/ClienteFichaTecnicaTab';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Props {
  customerId: string;
  onBack: () => void;
}

export const ClienteDetailView: React.FC<Props> = ({ customerId, onBack }) => {
  const { customer, vouchers, history, registerSession } = useCustomerDetail(customerId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const handleFieldUpdate = useCallback((field: string, value: any) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (Object.keys(editedFields).length === 0) return;
      const { error } = await supabase
        .from('customers')
        .update(editedFields)
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

  // Merge fetched data with local edits
  const mergedCustomer = customer.data ? { ...customer.data, ...editedFields } : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Clientes
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

      {/* Profile header */}
      <ClienteProfileHeader customer={mergedCustomer} isLoading={customer.isLoading} />

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100/50 dark:border-sky-900/20 rounded-xl p-1">
          <TabsTrigger
            value="timeline"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-sky-700 dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-sky-300 text-sm"
          >
            Cronología
          </TabsTrigger>
          <TabsTrigger
            value="vouchers"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-sky-700 dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-sky-300 text-sm"
          >
            Bonos Activos
          </TabsTrigger>
          <TabsTrigger
            value="ficha"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-sky-700 dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-sky-300 text-sm"
          >
            Ficha Técnica
          </TabsTrigger>
        </TabsList>

        <div className="mt-5">
          <TabsContent value="timeline" className="mt-0">
            <ClienteTimelineTab
              history={history.data || []}
              isLoading={history.isLoading}
            />
          </TabsContent>

          <TabsContent value="vouchers" className="mt-0">
            <ClienteVouchersTab
              vouchers={vouchers.data || []}
              isLoading={vouchers.isLoading}
              onRegisterSession={(id) => registerSession.mutate(id)}
              isRegistering={registerSession.isPending}
            />
          </TabsContent>

          <TabsContent value="ficha" className="mt-0">
            <ClienteFichaTecnicaTab
              customer={mergedCustomer}
              isLoading={customer.isLoading}
              onUpdate={handleFieldUpdate}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
