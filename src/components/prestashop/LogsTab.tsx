
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePrestashopSync } from '@/hooks/usePrestashopSync';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const LogsTab: React.FC = () => {
  const { syncLogs, logsLoading } = usePrestashopSync();

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      error: 'destructive',
      partial: 'secondary',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs de Sincronización</CardTitle>
        <CardDescription>
          Historial de sincronizaciones realizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logsLoading ? (
          <div>Cargando logs...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Mensaje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {formatDistanceToNow(new Date(log.processed_at), { 
                      addSuffix: true, 
                      locale: es 
                    })}
                  </TableCell>
                  <TableCell>{log.sync_type}</TableCell>
                  <TableCell>{log.direction}</TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {log.message || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
