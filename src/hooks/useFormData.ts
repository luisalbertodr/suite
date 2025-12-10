
import { useState, useEffect } from 'react';

export const useFormData = <T>(initialData: T, existingData?: T | null) => {
  const [formData, setFormData] = useState<T>(initialData);

  useEffect(() => {
    if (existingData) {
      setFormData(existingData);
    }
  }, [existingData]);

  const updateField = (field: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData(initialData);
  };

  return {
    formData,
    setFormData,
    updateField,
    resetForm
  };
};
