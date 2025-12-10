
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BasicInfoField {
  id: string;
  label: string;
  value: string | number;
  type?: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

interface BasicInfoCardProps {
  title: string;
  fields: BasicInfoField[];
  className?: string;
}

export const BasicInfoCard: React.FC<BasicInfoCardProps> = ({ 
  title, 
  fields, 
  className = "grid grid-cols-1 md:grid-cols-2 gap-4" 
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className={className}>
        {fields.map((field) => (
          <div key={field.id}>
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
            <Input
              id={field.id}
              type={field.type || 'text'}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              required={field.required}
              placeholder={field.placeholder}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
