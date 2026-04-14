import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  notes: string;
  onChange: (notes: string) => void;
}

export const ClienteNotasTab: React.FC<Props> = ({ notes, onChange }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas del Cliente</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          placeholder="Notas adicionales sobre el cliente..."
          className="resize-none"
        />
      </CardContent>
    </Card>
  );
};
