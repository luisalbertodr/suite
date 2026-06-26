import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PatientKioskShell } from '@/components/tablet/PatientKioskShell';
import { ConsentimientoSignDialog } from '@/components/consentimiento/ConsentimientoSignDialog';
import { ConsentPatientWaitScreen } from '@/components/consentimiento/ConsentPatientWaitScreen';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import type { Consentimiento, ConsentimientoCustomer } from '@/lib/consentimientoTypes';

function ConsentKioskContent() {
  const { consentId } = useParams<{ consentId: string }>();
  const [justSigned, setJustSigned] = useState(false);

  const { data: consent, isLoading, refetch } = useQuery({
    queryKey: ['consent-kiosk', consentId],
    enabled: !!consentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consentimientos')
        .select('*')
        .eq('id', consentId!)
        .single();
      if (error) throw error;
      return data as Consentimiento;
    },
    refetchInterval: (q) => {
      const row = q.state.data;
      if (row && (row.firmado === true || !!row.firma_url)) return 8000;
      return false;
    },
  });

  const { data: customer } = useQuery({
    queryKey: ['consent-kiosk-customer', consent?.customer_id],
    enabled: !!consent?.customer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id,name,tax_id,email,phone,phone_mobile,address_street,address_city,address_postal_code')
        .eq('id', consent!.customer_id)
        .single();
      if (error) throw error;
      return data as ConsentimientoCustomer;
    },
  });

  useEffect(() => {
    const blockBack = () => {
      if (consent && (consent.firmado === true || !!consent.firma_url || justSigned)) {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockBack);
    return () => window.removeEventListener('popstate', blockBack);
  }, [consent, justSigned]);

  const onSigned = useCallback(() => {
    setJustSigned(true);
    void refetch();
  }, [refetch]);

  if (isLoading || !consentId) {
    return (
      <PatientKioskShell title="Consentimiento informado" locked={false}>
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </PatientKioskShell>
    );
  }

  if (!consent) {
    return (
      <PatientKioskShell title="Consentimiento informado" locked={false}>
        <p className="text-center text-muted-foreground py-20">Consentimiento no encontrado.</p>
      </PatientKioskShell>
    );
  }

  const firmado = consent.firmado === true || !!consent.firma_url;
  const locked = firmado || justSigned;

  if (locked) {
    return (
      <PatientKioskShell title="Consentimiento informado" companyId={consent.company_id} locked>
        <ConsentPatientWaitScreen customerName={customer?.name} title={consent.titulo} />
      </PatientKioskShell>
    );
  }

  return (
    <PatientKioskShell title="Consentimiento informado" companyId={consent.company_id} locked={false}>
      <ConsentimientoSignDialog
        variant="kiosk"
        open
        onOpenChange={() => undefined}
        context={{
          customerId: consent.customer_id,
          companyId: consent.company_id,
          customer: customer ?? undefined,
          consentId: consent.id,
        }}
        onSigned={onSigned}
      />
    </PatientKioskShell>
  );
}

export default function ConsentKioskPage() {
  return (
    <ProtectedRoute>
      <ConsentKioskContent />
    </ProtectedRoute>
  );
}
