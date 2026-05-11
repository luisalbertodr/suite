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
      const rows = (data || []) as any[];

      const toTime = (value: unknown): number => {
        const t = Date.parse(String(value || ''));
        return Number.isFinite(t) ? t : 0;
      };

      // Deduplicación: eventos de cita por appointment_id (se conserva el más reciente).
      const bestByAppointment = new Map<string, any>();
      const output: any[] = [];
      for (const row of rows) {
        const aptId = row?.event_type === 'appointment'
          ? String(row?.data?.appointment_id || '')
          : '';
        if (!aptId) {
          output.push(row);
          continue;
        }
        const prev = bestByAppointment.get(aptId);
        if (!prev || toTime(row?.updated_at || row?.event_date) >= toTime(prev?.updated_at || prev?.event_date)) {
          bestByAppointment.set(aptId, row);
        }
      }
      output.push(...Array.from(bestByAppointment.values()));

      // Deduplicación secundaria para citas legacy sin appointment_id:
      // misma fecha (día), tipo y tratamiento -> se conserva la más reciente.
      const bestLegacyKey = new Map<string, any>();
      const keep: any[] = [];
      for (const row of output) {
        if (row?.event_type !== 'appointment') {
          keep.push(row);
          continue;
        }
        const aptId = String(row?.data?.appointment_id || '');
        if (aptId) {
          keep.push(row);
          continue;
        }
        const day = String(row?.event_date || '').slice(0, 10);
        const items = Array.isArray(row?.data?.items) ? row.data.items : [];
        const itemsSig = items
          .map((it: any) => `${String(it?.label || '').trim().toLowerCase()}|${Number(it?.quantity || 0)}|${Number(it?.total || 0)}`)
          .sort()
          .join('||');
        const treatment = String(row?.data?.treatment || '').trim().toLowerCase();
        const total = String(row?.data?.total_amount ?? '');
        const k = `legacy|${day}|${treatment}|${total}|${itemsSig}`;
        const prev = bestLegacyKey.get(k);
        if (!prev || toTime(row?.created_at || row?.event_date) >= toTime(prev?.created_at || prev?.event_date)) {
          bestLegacyKey.set(k, row);
        }
      }
      keep.push(...Array.from(bestLegacyKey.values()));

      // Normaliza fechas inválidas/remotas para evitar 1970 en UI.
      return keep
        .map((row) => {
          const raw = String(row?.event_date || '');
          const t = Date.parse(raw);
          if (Number.isFinite(t) && t > Date.parse('2000-01-01T00:00:00Z')) return row;
          return {
            ...row,
            event_date: row?.created_at || row?.updated_at || new Date().toISOString(),
          };
        })
        .sort((a, b) => toTime(b.event_date) - toTime(a.event_date));
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
      queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
      toast({ title: 'Sesión registrada correctamente' });
    },
    onError: (e) => {
      toast({ title: (e as Error).message, variant: 'destructive' });
    },
  });

  return { customer, vouchers, history, registerSession, companyId };
};
