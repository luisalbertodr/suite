import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Facturas } from '@/components/Facturas';
import { AlbaranesEntrada } from '@/components/AlbaranesEntrada';
import { AlbaranesSalida } from '@/components/AlbaranesSalida';
import { Presupuestos } from '@/components/Presupuestos';
import { PresupuestosN } from '@/components/PresupuestosN';
import { PageWrapper } from '@/components/PageWrapper';

const FacturacionPage: React.FC = () => {
  return (
    <PageWrapper resource="invoices" action="read">
      <Tabs defaultValue="facturas" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="albaranes-entrada">Alb. Entrada</TabsTrigger>
          <TabsTrigger value="albaranes-salida">Alb. Salida</TabsTrigger>
          <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
          <TabsTrigger value="presupuestos-n">Presupuestos N</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas">
          <Facturas />
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
      </Tabs>
    </PageWrapper>
  );
};

export default FacturacionPage;
