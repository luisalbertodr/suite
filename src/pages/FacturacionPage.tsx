import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Facturas } from '@/components/Facturas';
import { AlbaranesEntrada } from '@/components/AlbaranesEntrada';
import { AlbaranesSalida } from '@/components/AlbaranesSalida';
import { Presupuestos } from '@/components/Presupuestos';
import { PresupuestosN } from '@/components/PresupuestosN';
import { Proveedores } from '@/components/Proveedores';
import { Caja } from '@/components/Caja';
import { PageWrapper } from '@/components/PageWrapper';
import { useSearchParams } from 'react-router-dom';

const FacturacionPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'facturas';

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'facturas') {
      next.delete('tab');
    } else {
      next.set('tab', value);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <PageWrapper resource="invoices" action="read">
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="caja">Caja</TabsTrigger>
          <TabsTrigger value="albaranes-entrada">Alb. Entrada</TabsTrigger>
          <TabsTrigger value="albaranes-salida">Alb. Salida</TabsTrigger>
          <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
          <TabsTrigger value="presupuestos-n">Presupuestos N</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas">
          <Facturas />
        </TabsContent>
        <TabsContent value="caja">
          <Caja />
        </TabsContent>
        <TabsContent value="albaranes-entrada">
          <AlbaranesEntrada />
        </TabsContent>
        <TabsContent value="albaranes-salida">
          <AlbaranesSalida />
        </TabsContent>
        <TabsContent value="presupuestos">
          <Presupuestos />
        </TabsContent>
        <TabsContent value="presupuestos-n">
          <PresupuestosN />
        </TabsContent>
        <TabsContent value="proveedores">
          <Proveedores />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
};

export default FacturacionPage;
