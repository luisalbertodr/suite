import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Ban, Edit2, X, Check, Users, UserRoundCheck } from 'lucide-react';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { DeactivateAgendaEmployeeDialog } from '@/components/DeactivateAgendaEmployeeDialog';
import { BillingCompanySelect } from '@/components/forms/BillingCompanySelect';
import { useWorkCenter } from '@/hooks/useWorkCenter';

const COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16',
];

interface EmployeeFormData {
  name: string;
  color: string;
  active: boolean;
  agenda_sort_order: number;
  billing_company_id: string | null;
}

const emptyForm: EmployeeFormData = {
  name: '',
  color: COLORS[0],
  active: true,
  agenda_sort_order: 0,
  billing_company_id: null,
};

export const EmployeesConfig: React.FC = () => {
  const { companyId } = useCompanyFilter();
  const { isMultiEntity, companyLabels } = useWorkCenter();
  const { employees, isLoading, createEmployee, updateEmployee } = useAgendaEmployees({ agendaOnly: false });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<{
    id: string;
    name: string;
    patch: Record<string, unknown>;
    closeFormAfter?: boolean;
  } | null>(null);
  const deactivateCloseFormAfterRef = useRef(false);

  const allEmployees = employees || [];
  const editingEmployee = editingId ? allEmployees.find((e) => e.id === editingId) ?? null : null;
  const editingManagedByStyle = Boolean(String(editingEmployee?.dunasoft_codemp ?? '').trim());

  const handleCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (emp: {
    id: string;
    name: string;
    color?: string | null;
    active?: boolean | null;
    agenda_sort_order?: number | null;
    billing_company_id?: string | null;
  }) => {
    const ord = emp.agenda_sort_order;
    setForm({
      name: emp.name,
      color: emp.color || COLORS[0],
      active: emp.active ?? true,
      agenda_sort_order: typeof ord === 'number' && Number.isFinite(ord) ? ord : 0,
      billing_company_id: emp.billing_company_id ?? null,
    });
    setEditingId(emp.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editingId) {
      const existing = allEmployees.find((e) => e.id === editingId);
      const wasActive = existing?.active !== false;
      if (!editingManagedByStyle && !form.active && wasActive) {
        deactivateCloseFormAfterRef.current = true;
        setDeactivateTarget({
          id: editingId,
          name: form.name.trim(),
          patch: {
            name: form.name.trim(),
            color: form.color,
            agenda_sort_order: Math.max(0, Math.floor(Number(form.agenda_sort_order)) || 0),
          },
          closeFormAfter: true,
        });
        setDeactivateOpen(true);
        return;
      }
      const payload: {
        id: string;
        name: string;
        color: string;
        agenda_sort_order: number;
        billing_company_id: string | null;
        active?: boolean;
      } = {
        id: editingId,
        name: form.name,
        color: form.color,
        agenda_sort_order: Math.max(0, Math.floor(Number(form.agenda_sort_order)) || 0),
        billing_company_id: form.billing_company_id,
      };
      if (!editingManagedByStyle) {
        payload.active = form.active;
      }
      await updateEmployee.mutateAsync(payload);
    } else {
      const nextOrder =
        allEmployees.length === 0
          ? 0
          : Math.max(0, ...allEmployees.map((e) => (typeof e.agenda_sort_order === 'number' ? e.agenda_sort_order : 0))) + 1;
      const desired = Math.max(0, Math.floor(Number(form.agenda_sort_order)) || 0);
      const agenda_sort_order =
        desired > 0 || allEmployees.length === 0 ? desired : nextOrder;
      await createEmployee.mutateAsync({
        name: form.name,
        color: form.color,
        active: form.active,
        agenda_sort_order,
        billing_company_id: form.billing_company_id,
      });
    }
    setShowForm(false);
    setEditingId(null);
  };

  const openDeactivateFromList = (emp: { id: string; name: string }) => {
    deactivateCloseFormAfterRef.current = false;
    setDeactivateTarget({ id: emp.id, name: emp.name, patch: {}, closeFormAfter: false });
    setDeactivateOpen(true);
  };

  const handleReactivate = async (id: string) => {
    await updateEmployee.mutateAsync({ id, active: true });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const reassignmentTargets = allEmployees
    .filter((e) => e.active !== false && e.id !== deactivateTarget?.id)
    .map((e) => ({
      id: e.id,
      name: e.name,
      label: `${e.name} (${e.id.slice(0, 8)})`,
    }));

  return (
    <div className="space-y-4">
      <DeactivateAgendaEmployeeDialog
        open={deactivateOpen}
        onOpenChange={(o) => {
          setDeactivateOpen(o);
          if (!o) setDeactivateTarget(null);
        }}
        employeeId={deactivateTarget?.id ?? null}
        employeeName={deactivateTarget?.name ?? ''}
        companyId={companyId}
        reassignmentTargets={reassignmentTargets}
        employeeRowPatch={deactivateTarget?.patch}
        onSuccess={() => {
          if (deactivateCloseFormAfterRef.current) {
            setShowForm(false);
            setEditingId(null);
            deactivateCloseFormAfterRef.current = false;
          }
        }}
      />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Empleados
              </CardTitle>
              <CardDescription>Gestiona el equipo de la clínica</CardDescription>
            </div>
            <Button size="sm" onClick={handleCreate} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Form */}
          {showForm && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
              <h4 className="font-medium text-sm">{editingId ? 'Editar empleado' : 'Nuevo empleado'}</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <Label className="text-xs mb-1 block">Color</Label>
                  <div className="flex gap-1.5">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        title={`Seleccionar color ${c}`}
                        aria-label={`Seleccionar color ${c}`}
                        onClick={() => setForm({ ...form, color: c })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-125' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.active}
                    disabled={editingManagedByStyle}
                    onCheckedChange={v => setForm({ ...form, active: v })}
                  />
                  <Label className="text-sm">Activo en la agenda</Label>
                </div>
              </div>
              {editingManagedByStyle && (
                <p className="text-xs text-muted-foreground">
                  Este empleado está sincronizado con Style (`codemp {editingEmployee?.dunasoft_codemp}`).
                  Su estado activo/inactivo se toma de Style; aquí solo puedes editar color, orden y empresa.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                  <Label>Posición en la agenda</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={form.agenda_sort_order}
                    onChange={(e) =>
                      setForm({ ...form, agenda_sort_order: Math.max(0, Math.floor(Number(e.target.value)) || 0) })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">0 = primera columna. En creación, si dejas 0 se asigna el siguiente hueco libre.</p>
                </div>
                {isMultiEntity && (
                  <BillingCompanySelect
                    value={form.billing_company_id}
                    onChange={(id) => setForm({ ...form, billing_company_id: id })}
                    label="Empresa contratante"
                    inheritLabel="Tenant por defecto"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={!form.name.trim()} className="gap-1">
                  <Check className="h-4 w-4" /> Guardar
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }} className="gap-1">
                  <X className="h-4 w-4" /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* List */}
          {allEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay empleados configurados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...allEmployees]
                .sort((a, b) => {
                  const ao = a.agenda_sort_order ?? 0;
                  const bo = b.agenda_sort_order ?? 0;
                  if (ao !== bo) return ao - bo;
                  return a.name.localeCompare(b.name, 'es');
                })
                .map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: emp.color || COLORS[0] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium break-words">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Agenda pos. {emp.agenda_sort_order ?? 0}
                      {isMultiEntity && emp.billing_company_id && (
                        <> · {companyLabels.get(emp.billing_company_id) ?? 'Empresa'}</>
                      )}
                      {emp.dunasoft_codemp && <> · Style {emp.dunasoft_codemp}</>}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${emp.active !== false ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                    {emp.active !== false ? 'Activo' : 'Inactivo'}
                  </span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(emp)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  {emp.dunasoft_codemp ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-50 cursor-not-allowed"
                      title="Activo sincronizado desde Style"
                      disabled
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  ) : emp.active !== false ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Desactivar"
                      onClick={() => openDeactivateFromList(emp)}
                    >
                      <Ban className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Reactivar"
                      onClick={() => handleReactivate(emp.id)}
                    >
                      <UserRoundCheck className="h-3.5 w-3.5 text-emerald-600" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
