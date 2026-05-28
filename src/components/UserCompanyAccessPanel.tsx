import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { invokeMain } from '@/lib/invokeMain';
import { Trash2 } from 'lucide-react';

interface CompanyOption {
  id: string;
  name: string;
  tax_id?: string | null;
}

interface UserCompanyRole {
  id: string;
  company_id: string;
  role?: { name: string };
}

interface UserCompanyAccessPanelProps {
  userId: string;
  userEmail: string;
  companies: CompanyOption[];
  assignedRoles: UserCompanyRole[];
  roles: Array<{ id: string; name: string }>;
  onChanged: () => void;
}

export const UserCompanyAccessPanel: React.FC<UserCompanyAccessPanelProps> = ({
  userId,
  userEmail,
  companies,
  assignedRoles,
  roles,
  onChanged,
}) => {
  const { toast } = useToast();
  const [addCompanyId, setAddCompanyId] = useState('');
  const [addRoleId, setAddRoleId] = useState('');
  const [loading, setLoading] = useState(false);

  const assignedCompanyIds = useMemo(
    () => new Set(assignedRoles.map((r) => r.company_id).filter(Boolean)),
    [assignedRoles],
  );

  const availableCompanies = companies.filter((c) => !assignedCompanyIds.has(c.id));

  const companyName = (id: string) =>
    companies.find((c) => c.id === id)?.name ?? id.slice(0, 8);

  const handleAdd = async () => {
    if (!addCompanyId || !addRoleId) {
      toast({
        title: 'Campos incompletos',
        description: 'Selecciona empresa y rol.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await invokeMain({
        action: 'addUserCompany',
        payload: {
          userId,
          company_id: addCompanyId,
          role_id: addRoleId,
        },
      });
      toast({
        title: 'Acceso añadido',
        description: `${userEmail} puede acceder a ${companyName(addCompanyId)}.`,
      });
      setAddCompanyId('');
      setAddRoleId('');
      onChanged();
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (companyId: string) => {
    if (!confirm(`¿Quitar acceso de ${userEmail} a ${companyName(companyId)}?`)) return;

    setLoading(true);
    try {
      await invokeMain({
        action: 'removeUserCompany',
        userId,
        company_id: companyId,
      });
      toast({ title: 'Acceso eliminado' });
      onChanged();
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
      <div>
        <Label className="text-base font-semibold">Empresas con acceso</Label>
        <p className="text-sm text-muted-foreground mt-1">
          El usuario puede cambiar entre estas empresas al iniciar sesión. Las del mismo centro laboral
          también son accesibles automáticamente.
        </p>
      </div>

      {assignedRoles.length === 0 ? (
        <p className="text-sm text-amber-700">Sin empresas asignadas.</p>
      ) : (
        <ul className="space-y-2">
          {assignedRoles.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{companyName(entry.company_id)}</span>
                <span className="text-muted-foreground"> · rol {entry.role?.name ?? '—'}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading || assignedRoles.length <= 1}
                onClick={() => void handleRemove(entry.company_id)}
                title={assignedRoles.length <= 1 ? 'Debe tener al menos una empresa' : 'Quitar acceso'}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {availableCompanies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-2 border-t">
          <div className="md:col-span-1">
            <Label>Añadir empresa</Label>
            <Select value={addCompanyId} onValueChange={setAddCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                {availableCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                    {company.tax_id ? ` · ${company.tax_id}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Label>Rol en esa empresa</Label>
            <Select value={addRoleId} onValueChange={setAddRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={() => void handleAdd()} disabled={loading}>
            {loading ? 'Guardando…' : 'Añadir acceso'}
          </Button>
        </div>
      )}
    </div>
  );
};
