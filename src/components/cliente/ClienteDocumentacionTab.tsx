import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { FileCheck, FileSignature, Eye, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { format } from 'date-fns';
import { ConsentimientoSignDialog } from '@/components/consentimiento/ConsentimientoSignDialog';
import { ConsentimientoViewerDialog } from '@/components/consentimiento/ConsentimientoViewerDialog';
import type { Consentimiento, ConsentimientoCustomer } from '@/lib/consentimientoTypes';

interface Props {
  customerId: string;
  customer?: ConsentimientoCustomer | null;
}

export const ClienteDocumentacionTab: React.FC<Props> = ({ customerId, customer }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const [signOpen, setSignOpen] = useState(false);
  const [viewConsent, setViewConsent] = useState<Consentimiento | null>(null);
  const [pendingConsentId, setPendingConsentId] = useState<string | undefined>();

  const { data: consentimientos, isLoading } = useQuery({
    queryKey: ['consentimientos', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consentimientos')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Consentimiento[];
    },
  });

  const openNewSign = () => {
    if (!companyId) {
      toast({ title: 'Empresa no identificada', variant: 'destructive' });
      return;
    }
    setPendingConsentId(undefined);
    setSignOpen(true);
  };

  const openPendingSign = (id: string) => {
    setPendingConsentId(id);
    setSignOpen(true);
  };

  const handleSigned = () => {
    queryClient.invalidateQueries({ queryKey: ['consentimientos', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customer-attachments', customerId] });
  };

  if (!companyId) {
    return <div className="text-center py-8 text-muted-foreground">Cargando empresa…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Consentimientos y Documentación</h3>
        <Button size="sm" onClick={openNewSign}>
          <Plus className="w-4 h-4 mr-1" />
          Nuevo consentimiento
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando…</div>
      ) : !consentimientos?.length ? (
        <div className="text-center py-8 text-muted-foreground">
          No hay consentimientos. Crea uno desde una plantilla y fírmalo en tablet.
        </div>
      ) : (
        <div className="space-y-3">
          {consentimientos.map((c) => {
            const firmado = c.firmado === true || !!c.firma_url;
            return (
              <Card key={c.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{c.titulo}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                        {c.tipo}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          firmado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {firmado ? 'Firmado' : 'Pendiente'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.fecha_firma || c.created_at), 'dd/MM/yyyy')}
                      </span>
                      {firmado ? (
                        <Button variant="outline" size="sm" onClick={() => setViewConsent(c)}>
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => openPendingSign(c.id)}>
                          <FileSignature className="w-4 h-4 mr-1" /> Firmar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConsentimientoSignDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        context={{
          customerId,
          companyId,
          customer,
          consentId: pendingConsentId,
        }}
        onSigned={handleSigned}
      />

      <ConsentimientoViewerDialog
        consent={viewConsent}
        open={!!viewConsent}
        onOpenChange={(o) => !o && setViewConsent(null)}
      />
    </div>
  );
};
