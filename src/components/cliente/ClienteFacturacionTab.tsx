import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Receipt, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  customerId: string;
}

export const ClienteFacturacionTab: React.FC<Props> = ({ customerId }) => {
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['customer_invoices', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('issue_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: quotes, isLoading: loadingQuotes } = useQuery({
    queryKey: ['customer_quotes', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('customer_id', customerId)
        .order('issue_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loadingInvoices || loadingQuotes) {
    return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Receipt className="w-5 h-5" /> Facturas ({invoices?.length || 0})
        </h3>
        {!invoices?.length ? (
          <p className="text-sm text-muted-foreground">No hay facturas</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{inv.number}</span>
                    <span className="text-sm text-muted-foreground ml-3">
                      {format(new Date(inv.issue_date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{inv.total_amount.toFixed(2)} €</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {inv.status === 'paid' ? 'Pagada' : inv.status === 'pending' ? 'Pendiente' : inv.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Presupuestos ({quotes?.length || 0})
        </h3>
        {!quotes?.length ? (
          <p className="text-sm text-muted-foreground">No hay presupuestos</p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <Card key={q.id}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{q.number}</span>
                    <span className="text-sm text-muted-foreground ml-3">
                      {format(new Date(q.issue_date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <span className="font-semibold">{q.total_amount.toFixed(2)} €</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
