import React from 'react';
import { Building2, Check, Loader2 } from 'lucide-react';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const CompanySwitcher: React.FC = () => {
  const { companyId, accessibleCompanies, loading, switching, switchCompany } = useCompanyFilter();

  if (loading || accessibleCompanies.length <= 1) {
    return null;
  }

  const active = accessibleCompanies.find((c) => c.id === companyId);

  const handleSwitch = async (id: string) => {
    const ok = await switchCompany(id);
    if (!ok) {
      toast.error('No se pudo cambiar de empresa');
      return;
    }
    const name = accessibleCompanies.find((c) => c.id === id)?.name ?? 'Empresa';
    toast.success(`Empresa activa: ${name}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 max-w-[240px] text-xs"
          disabled={switching}
        >
          {switching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{active?.short_name?.trim() || active?.name || 'Empresa'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Cambiar empresa / centro
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accessibleCompanies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            className="flex items-start gap-2 cursor-pointer"
            onClick={() => void handleSwitch(company.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{company.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[company.tax_id, company.work_center_name].filter(Boolean).join(' · ')}
                {!company.is_assigned && company.work_center_name ? ' · centro laboral' : ''}
              </p>
            </div>
            {company.id === companyId && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
