import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ArrowRightLeft, Link2, Plus, Trash2, Unlink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { invokeMain } from '@/lib/invokeMain';

export interface WorkCenterRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface WorkCenterCompanyRow {
  id: string;
  name: string;
  tax_id: string | null;
  short_name: string | null;
  tpv_ticket_prefix: string | null;
  work_center_id: string | null;
}

interface ListWorkCentersResponse {
  work_centers: WorkCenterRow[];
  companies: WorkCenterCompanyRow[];
}

export const WorkCenterPanel: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCenterName, setNewCenterName] = useState('');
  const [linkCompanyId, setLinkCompanyId] = useState('');
  const [linkWorkCenterId, setLinkWorkCenterId] = useState('');
  const [linkShortName, setLinkShortName] = useState('');
  const [linkTicketPrefix, setLinkTicketPrefix] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['superuser-work-centers'],
    queryFn: async () => {
      const result = await invokeMain({ action: 'listWorkCenters' });
      return {
        work_centers: (result.work_centers ?? []) as WorkCenterRow[],
        companies: (result.companies ?? []) as WorkCenterCompanyRow[],
      } satisfies ListWorkCentersResponse;
    },
  });

  const workCenters = data?.work_centers ?? [];
  const companies = data?.companies ?? [];

  const workCenterNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const wc of workCenters) map.set(wc.id, wc.name);
    return map;
  }, [workCenters]);

  const companiesByCenter = useMemo(() => {
    const map = new Map<string, WorkCenterCompanyRow[]>();
    for (const wc of workCenters) map.set(wc.id, []);
    for (const company of companies) {
      if (!company.work_center_id) continue;
      const list = map.get(company.work_center_id) ?? [];
      list.push(company);
      map.set(company.work_center_id, list);
    }
    return map;
  }, [workCenters, companies]);

  const companySelectLabel = (c: WorkCenterCompanyRow) => {
    const base = `${c.name}${c.tax_id ? ` · ${c.tax_id}` : ''}`;
    if (!c.work_center_id) return `${base} · sin centro`;
    const wcName = workCenterNameById.get(c.work_center_id);
    return wcName ? `${base} · en ${wcName}` : base;
  };

  const handleCompanySelect = (companyId: string) => {
    setLinkCompanyId(companyId);
    const company = companies.find((c) => c.id === companyId);
    if (company) {
      setLinkShortName(company.short_name ?? '');
      setLinkTicketPrefix(company.tpv_ticket_prefix ?? '');
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['superuser-work-centers'] });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
  };

  const createMutation = useMutation({
    mutationFn: async (name: string) => invokeMain({ action: 'createWorkCenter', name }),
    onSuccess: () => {
      toast({ title: 'Centro laboral creado' });
      setNewCenterName('');
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async () =>
      invokeMain({
        action: 'assignCompanyToWorkCenter',
        company_id: linkCompanyId,
        work_center_id: linkWorkCenterId,
        short_name: linkShortName.trim() || null,
        tpv_ticket_prefix: linkTicketPrefix.trim() || null,
      }),
    onSuccess: () => {
      const company = companies.find((c) => c.id === linkCompanyId);
      const targetName = workCenterNameById.get(linkWorkCenterId) ?? 'centro';
      const wasAssigned = !!company?.work_center_id && company.work_center_id !== linkWorkCenterId;
      toast({
        title: wasAssigned ? 'Empresa movida' : 'Empresa vinculada',
        description: wasAssigned
          ? `${company?.name ?? 'Empresa'} ahora pertenece a ${targetName}.`
          : undefined,
      });
      setLinkCompanyId('');
      setLinkShortName('');
      setLinkTicketPrefix('');
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({
      companyId,
      workCenterId,
    }: {
      companyId: string;
      workCenterId: string;
    }) =>
      invokeMain({
        action: 'assignCompanyToWorkCenter',
        company_id: companyId,
        work_center_id: workCenterId,
      }),
    onSuccess: (_data, { companyId, workCenterId }) => {
      const company = companies.find((c) => c.id === companyId);
      toast({
        title: 'Empresa movida',
        description: `${company?.name ?? 'Empresa'} → ${workCenterNameById.get(workCenterId) ?? 'centro'}`,
      });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (companyId: string) =>
      invokeMain({
        action: 'assignCompanyToWorkCenter',
        company_id: companyId,
        work_center_id: null,
      }),
    onSuccess: () => {
      toast({ title: 'Empresa desvinculada' });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => invokeMain({ action: 'deleteWorkCenter', id }),
    onSuccess: () => {
      toast({ title: 'Centro laboral eliminado' });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCenterName.trim();
    if (!name) return;
    createMutation.mutate(name);
  };

  const handleLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCompanyId || !linkWorkCenterId) {
      toast({
        title: 'Campos incompletos',
        description: 'Selecciona centro laboral y empresa.',
        variant: 'destructive',
      });
      return;
    }
    const company = companies.find((c) => c.id === linkCompanyId);
    if (company?.work_center_id === linkWorkCenterId) {
      toast({
        title: 'Sin cambios',
        description: 'La empresa ya pertenece a ese centro.',
        variant: 'destructive',
      });
      return;
    }
    linkMutation.mutate();
  };

  const selectedLinkCompany = companies.find((c) => c.id === linkCompanyId);
  const linkIsMove = !!selectedLinkCompany?.work_center_id
    && selectedLinkCompany.work_center_id !== linkWorkCenterId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Crear centro laboral
          </CardTitle>
          <CardDescription>
            Agrupa varias razones sociales que comparten agenda, clientes y TPV pero facturan por separado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="wc-name">Nombre del centro</Label>
              <Input
                id="wc-name"
                value={newCenterName}
                onChange={(e) => setNewCenterName(e.target.value)}
                placeholder="Ej. Clínica Mar Lamas"
                required
              />
            </div>
            <Button
              type="submit"
              className="sm:self-end"
              disabled={createMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              {createMutation.isPending ? 'Creando…' : 'Crear centro'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular o mover empresa
          </CardTitle>
          <CardDescription>
            Puedes asignar empresas sin centro o moverlas de un centro a otro. Opcional: nombre corto y prefijo TPV (ej. M / SL).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLink} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Centro laboral</Label>
                <Select value={linkWorkCenterId} onValueChange={setLinkWorkCenterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar centro" />
                  </SelectTrigger>
                  <SelectContent>
                    {workCenters.map((wc) => (
                      <SelectItem key={wc.id} value={wc.id}>
                        {wc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={linkCompanyId} onValueChange={handleCompanySelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {companySelectLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nombre corto (UI TPV)</Label>
                <Input
                  value={linkShortName}
                  onChange={(e) => setLinkShortName(e.target.value)}
                  placeholder="Ej. Mar Lamas"
                />
              </div>
              <div>
                <Label>Prefijo ticket TPV</Label>
                <Input
                  value={linkTicketPrefix}
                  onChange={(e) => setLinkTicketPrefix(e.target.value)}
                  placeholder="Ej. M o SL"
                />
              </div>
            </div>
            {linkIsMove && selectedLinkCompany?.work_center_id && (
              <p className="text-sm text-amber-700">
                Se moverá desde{' '}
                <strong>{workCenterNameById.get(selectedLinkCompany.work_center_id)}</strong>
                {' '}al centro seleccionado.
              </p>
            )}
            <Button
              type="submit"
              disabled={linkMutation.isPending || workCenters.length === 0 || companies.length === 0}
            >
              {linkMutation.isPending
                ? 'Guardando…'
                : linkIsMove
                  ? 'Mover empresa'
                  : 'Vincular empresa'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Centros laborales ({workCenters.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {error && (
            <p className="text-sm text-destructive">Error: {(error as Error).message}</p>
          )}
          {!isLoading && workCenters.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay centros laborales creados.</p>
          )}
          <div className="space-y-4">
            {workCenters.map((wc) => {
              const linked = companiesByCenter.get(wc.id) ?? [];
              return (
                <div key={wc.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{wc.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {linked.length} empresa{linked.length === 1 ? '' : 's'} vinculada{linked.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`¿Eliminar el centro "${wc.name}"? Las empresas quedarán desvinculadas.`)) {
                          deleteMutation.mutate(wc.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {linked.length === 0 ? (
                    <p className="text-sm text-amber-700">Sin empresas vinculadas.</p>
                  ) : (
                    <ul className="space-y-2">
                      {linked.map((company) => {
                        const moveTargets = workCenters.filter((wc) => wc.id !== company.work_center_id);
                        return (
                        <li
                          key={company.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{company.name}</span>
                            {company.tax_id && (
                              <span className="text-muted-foreground"> · {company.tax_id}</span>
                            )}
                            {(company.short_name || company.tpv_ticket_prefix) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {[company.short_name, company.tpv_ticket_prefix && `TPV: ${company.tpv_ticket_prefix}`]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {moveTargets.length > 0 && (
                              <Select
                                value=""
                                onValueChange={(targetId) =>
                                  moveMutation.mutate({ companyId: company.id, workCenterId: targetId })
                                }
                                disabled={moveMutation.isPending}
                              >
                                <SelectTrigger className="h-8 w-[160px] text-xs">
                                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1 shrink-0" />
                                  <SelectValue placeholder="Mover a…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {moveTargets.map((target) => (
                                    <SelectItem key={target.id} value={target.id}>
                                      {target.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={unlinkMutation.isPending}
                              onClick={() => unlinkMutation.mutate(company.id)}
                              title="Desvincular del centro"
                            >
                              <Unlink className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
