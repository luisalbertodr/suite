import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSignature } from 'lucide-react';
import { ConsentimientoPlantillasManager } from '@/components/consentimiento/ConsentimientoPlantillasManager';

export const ConsentimientoPlantillasConfig: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5" />
            Consentimientos informados
          </CardTitle>
          <CardDescription>
            Define plantillas reutilizables con variables como {'{nombre}'} o {'{tratamiento}'}. Se usan al
            firmar desde la ficha del cliente o desde una cita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)}>Gestionar plantillas</Button>
        </CardContent>
      </Card>
      {open ? <ConsentimientoPlantillasManager onClose={() => setOpen(false)} /> : null}
    </>
  );
};
