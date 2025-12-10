
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
                <TableHead>Variación</TableHead>
                <TableHead>ID PrestaShop</TableHead>
                <TableHead>Combinación</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productMappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell>
                    {(mapping as any).articles?.codigo} - {(mapping as any).articles?.descripcion}
                  </TableCell>
                  <TableCell>
                    {(mapping as any).article_variations && 
                      `${(mapping as any).article_variations.talla} - ${(mapping as any).article_variations.color}`
                    }
                  </TableCell>
                  <TableCell>{mapping.prestashop_product_id}</TableCell>
                  <TableCell>{mapping.prestashop_combination_id || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={mapping.sync_enabled ? 'default' : 'secondary'}>
                      {mapping.sync_enabled ? 'Activo' : 'Inactivo'}
                    </Badge>
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
