import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit2, X, Check, Users } from 'lucide-react';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16',
];

interface EmployeeFormData {
  name: string;
  email: string;
  phone: string;
  color: string;
  active: boolean;
}

const emptyForm: EmployeeFormData = { name: '', email: '', phone: '', color: COLORS[0], active: true };

export const EmployeesConfig: React.FC = () => {
  const { employees, isLoading, createEmployee, updateEmployee } = useAgendaEmployees();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(emptyForm);

  const allEmployees = employees || [];

  const handleCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (emp: any) => {
    setForm({
      name: emp.name,
      email: emp.email || '',
      phone: emp.phone || '',
      color: emp.color || COLORS[0],
      active: emp.is_active ?? true,
    });
    setEditingId(emp.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editingId) {
      await updateEmployee.mutateAsync({
        id: editingId,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        color: form.color,
        is_active: form.active,
      } as any);
    } else {
      await createEmployee.mutateAsync({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        color: form.color,
        is_active: form.active,
      });
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleDeactivate = async (id: string, currentActive: boolean) => {
    await updateEmployee.mutateAsync({ id, is_active: !currentActive } as any);
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

  return (
    <div className="space-y-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@ejemplo.com" />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+34 600 000 000" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <Label className="text-xs mb-1 block">Color</Label>
                  <div className="flex gap-1.5">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, color: c })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-125' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
                  <Label className="text-sm">Activo</Label>
                </div>
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
              {allEmployees.map(emp => (
                <div key={emp.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: emp.color || COLORS[0] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[emp.email, emp.phone].filter(Boolean).join(' · ') || 'Sin contacto'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${emp.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                    {emp.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(emp)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDeactivate(emp.id, emp.is_active ?? true)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
