import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Edit, Mail, Phone, Globe, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { EmpresaForm } from './EmpresaForm';
import { companyDisplayName } from '@/lib/billingCompany';

export type WorkCenterCompany = {
  id: string;
  name: string;
  tax_id: string;
  email: string;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  logo_url: string | null;
  website: string | null;
  additional_info: string | null;
  short_name: string | null;
  tpv_ticket_prefix: string | null;
  created_at: string;
};

export const WorkCenterCompaniesConfig: React.FC = () => {
  const queryClient = useQueryClient();
  const { isMultiEntity, billingCompanies, workCenter, loading: wcLoading } = useWorkCenter();
  const [editingCompany, setEditingCompany] = useState<WorkCenterCompany | null>(null);

  const companyIds = billingCompanies.map((c) => c.id);

  const { data: companies, isLoading } = useQuery({
    queryKey: ['work-center-companies-full', companyIds.join(',')],
    queryFn: async () => {
      if (companyIds.length === 0) return [] as WorkCenterCompany[];
      const { data, error } = await supabase
        .from('companies')
        .select(
          'id, name, tax_id, email, phone, address_street, address_city, address_state, address_postal_code, address_country, logo_url, website, additional_info, short_name, tpv_ticket_prefix, created_at',
        )
        .in('id', companyIds)
        .order('name');
      if (error) throw error;
      return (data ?? []) as WorkCenterCompany[];
    },
    enabled: isMultiEntity && companyIds.length > 0 && !wcLoading,
  });

  if (!isMultiEntity) return null;

  if (wcLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const handleCloseForm = () => {
    setEditingCompany(null);
    queryClient.invalidateQueries({ queryKey: ['work-center-companies-full'] });
    queryClient.invalidateQueries({ queryKey: ['work-center-billing-companies'] });
    queryClient.invalidateQueries({ queryKey: ['company'] });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Empresas del centro laboral
          </CardTitle>
          <CardDescription>
            {workCenter?.name
              ? `${workCenter.name}: datos fiscales y emisión de cada empresa emisora.`
              : 'Datos fiscales de Medicina y Estética en el mismo centro.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {(companies ?? []).map((company) => {
            const label = company.short_name?.trim() || companyDisplayName(company);
            return (
              <div
                key={company.id}
                className="rounded-xl border bg-card p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{company.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {label !== company.name && (
                        <Badge variant="secondary" className="text-xs">
                          {label}
                        </Badge>
                      )}
                      {company.tpv_ticket_prefix && (
                        <Badge variant="outline" className="text-xs font-mono">
                          TPV {company.tpv_ticket_prefix}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">CIF: {company.tax_id}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingCompany(company)}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                    Editar
                  </Button>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {company.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 shrink-0" />
                      <span className="truncate">{company.email}</span>
                    </div>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 shrink-0" />
                      <span>{company.phone}</span>
                    </div>
                  )}
                  {company.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 shrink-0" />
                      <span className="truncate">{company.website}</span>
                    </div>
                  )}
                  {(company.address_street || company.address_city) && (
                    <div className="flex items-start gap-2">
                      <Receipt className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {[company.address_street, company.address_postal_code, company.address_city]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {editingCompany && (
        <EmpresaForm
          onClose={handleCloseForm}
          company={editingCompany}
          showWorkCenterFields
        />
      )}
    </>
  );
};
