import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

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
        <RichTextEditor
          value={notes || ''}
          onChange={onChange}
          placeholder="Notas adicionales sobre el cliente..."
          minHeightClass="min-h-[220px]"
        />
      </CardContent>
    </Card>
  );
};
