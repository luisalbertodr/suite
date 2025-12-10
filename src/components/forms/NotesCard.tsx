
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NotesCardProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const NotesCard: React.FC<NotesCardProps> = ({ 
  value, 
  onChange, 
  placeholder = "Notas adicionales..." 
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas</CardTitle>
      </CardHeader>
      <CardContent>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder={placeholder}
        />
      </CardContent>
    </Card>
  );
};
