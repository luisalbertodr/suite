import React from 'react';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { BillingEntityToggle } from '@/components/BillingEntityToggle';

type BillingScopeToggleProps = {
  className?: string;
  /** Deshabilitar interacción (p. ej. pestaña compartida). */
  disabled?: boolean;
};

/** M/E vinculado a la empresa activa (switchCompany). */
export const BillingScopeToggle: React.FC<BillingScopeToggleProps> = ({ className, disabled = false }) => {
  const { companyId, switchCompany, switching } = useCompanyFilter();

  if (!companyId) return null;

  return (
    <BillingEntityToggle
      value={companyId}
      onChange={(id) => {
        if (disabled || switching) return;
        if (typeof id === 'string' && id !== 'all') {
          void switchCompany(id);
        }
      }}
      disabled={disabled || switching}
      className={className}
    />
  );
};
