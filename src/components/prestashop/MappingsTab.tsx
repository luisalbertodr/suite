
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePrestashopSync } from '@/hooks/usePrestashopSync';

export const MappingsTab: React.FC = () => {
  const { productMappings, mappingsLoading } = usePrestashopSync();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapeos de Productos</CardTitle>
        <CardDescription>
          Productos mapeados entre su sistema y PrestaShop
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mappingsLoading ? (
          <div>Cargando mapeos...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artículo</TableHead>
                <TableHead>ID PrestaShop</TableHead>
                <TableHead>Última Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productMappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell>
                    {(mapping as any).articles?.codigo} - {(mapping as any).articles?.descripcion}
                  </TableCell>
                  <TableCell>{mapping.prestashop_product_id}</TableCell>
                  <TableCell>
                    {mapping.last_synced_at 
                      ? new Date(mapping.last_synced_at).toLocaleDateString() 
                      : '-'}
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
