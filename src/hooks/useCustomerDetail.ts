import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useToast } from '@/hooks/use-toast';

export const useCustomerDetail = (customerId: string) => {
  const { companyId } = useCompanyFilter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const customer = useQuery({
    queryKey: ['customer_detail', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const vouchers = useQuery({
    queryKey: ['customer_vouchers', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_vouchers')
        .select('*, articles(descripcion, codigo)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const history = useQuery({
    queryKey: ['customer_aesthetic_history', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_aesthetic_history')
        .select('*')
        .eq('customer_id', customerId)
        .order('event_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const registerSession = useMutation({
    mutationFn: async (voucherId: string) => {
      // Get voucher details
      const voucher = vouchers.data?.find(v => v.id === voucherId);
      if (!voucher) throw new Error('Bono no encontrado');
      if (voucher.used_sessions >= voucher.total_sessions) throw new Error('Sin sesiones disponibles');

      // Update used_sessions
      const newUsed = voucher.used_sessions + 1;
      const { error: updateError } = await supabase
        .from('customer_vouchers')
        .update({
          used_sessions: newUsed,
          is_active: newUsed < voucher.total_sessions,
        })
        .eq('id', voucherId);
      if (updateError) throw updateError;

      // Create history entry
      const { error: historyError } = await supabase
        .from('customer_aesthetic_history')
        .insert({
          customer_id: customerId,
          company_id: companyId!,
          event_type: 'session',
          event_date: new Date().toISOString(),
          data: {
            treatment: (voucher as any).articles?.descripcion || 'Tratamiento',
            voucher_code: voucher.voucher_code,
            session_number: newUsed,
            total_sessions: voucher.total_sessions,
          },
        });
      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer_vouchers', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_aesthetic_history', customerId] });
      toast({ title: 'Sesión registrada correctamente' });
    },
    onError: (e) => {
      toast({ title: (e as Error).message, variant: 'destructive' });
    },
  });

  return { customer, vouchers, history, registerSession, companyId };
};
