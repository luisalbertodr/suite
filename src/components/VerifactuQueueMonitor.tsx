import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Play,
  MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const VerifactuQueueMonitor: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { data: queueItems, isLoading } = useQuery({
    queryKey: ['verifactu-queue', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('verifactu_queue')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !companyLoading,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const processQueueMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('verifactu-queue-processor');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Cola procesada',
        description: `Procesados: ${data.processed}, Exitosos: ${data.success}, Errores: ${data.errors}`,
      });
      queryClient.invalidateQueries({ queryKey: ['verifactu-queue'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['verifactu-logs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al procesar cola',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const retryItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('verifactu_queue')
        .update({
          status: 'pending',
          retry_count: 0,
          next_retry_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Elemento reintentado',
        description: 'El elemento ha sido marcado para reintento.',
      });
      queryClient.invalidateQueries({ queryKey: ['verifactu-queue'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al reintentar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Pendiente
        </Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          Procesando
        </Badge>;
      case 'success':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Exitoso
        </Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Fallido
        </Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelado
        </Badge>;
      default:
        return <Badge variant="outline">
          <AlertCircle className="w-3 h-3 mr-1" />
          {status}
        </Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'send':
        return <Badge variant="secondary">Envío</Badge>;
      case 'query':
        return <Badge variant="secondary">Consulta</Badge>;
      case 'cancel':
        return <Badge variant="secondary">Anulación</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  if (companyLoading || isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <p>Cargando cola de Verifactu...</p>
        </CardContent>
      </Card>
    );
  }

  if (!companyId) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <p>No se pudo cargar la empresa</p>
        </CardContent>
      </Card>
    );
  }

  const pendingCount = queueItems?.filter(item => item.status === 'pending').length || 0;
  const processingCount = queueItems?.filter(item => item.status === 'processing').length || 0;
  const failedCount = queueItems?.filter(item => item.status === 'failed').length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cola de Verifactu</CardTitle>
            <CardDescription>
              Monitor de solicitudes offline y reintentos automáticos
            </CardDescription>
          </div>
          <Button 
            onClick={() => processQueueMutation.mutate()}
            disabled={processQueueMutation.isPending}
          >
            <Play className="w-4 h-4 mr-2" />
            Procesar Cola
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Summary */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-sm text-gray-600">Pendientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{processingCount}</div>
            <div className="text-sm text-gray-600">Procesando</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
            <div className="text-sm text-gray-600">Fallidos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{queueItems?.length || 0}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
        </div>

        {/* Queue Items */}
        <div className="space-y-3">
          {queueItems?.length ? (
            queueItems.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(item.status)}
                    {getActionBadge(item.action)}
                    <span className="font-medium">
                      Factura #{item.invoice_id.substring(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryItemMutation.mutate(item.id)}
                        disabled={retryItemMutation.isPending}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Reintentar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost">
                      <MoreHorizontal className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Creado:</span>{' '}
                    {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </div>
                  <div>
                    <span className="font-medium">Reintentos:</span>{' '}
                    {item.retry_count}/{item.max_retries}
                  </div>
                  {item.next_retry_at && item.status === 'pending' && (
                    <div>
                      <span className="font-medium">Próximo intento:</span>{' '}
                      {format(new Date(item.next_retry_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </div>
                  )}
                </div>

                {item.error_message && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    <span className="font-medium">Error:</span> {item.error_message}
                  </div>
                )}

                {item.processed_at && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Procesado:</span>{' '}
                    {format(new Date(item.processed_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay elementos en la cola</p>
              <p className="text-sm">Las solicitudes aparecerán aquí cuando AEAT no esté disponible</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};