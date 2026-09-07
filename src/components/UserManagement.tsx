
import React, { useMemo, useState } from 'react';
import { useRoles } from '@/hooks/useRoles';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers } from '@/hooks/useUsers';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Shield, RefreshCw, Eye, EyeOff, KeyRound, Network, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { UserListTable } from '@/components/UserListTable';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { UserPermissionsPanel } from '@/components/UserPermissionsPanel';
import { UserCompanyAccessPanel } from '@/components/UserCompanyAccessPanel';
import { UserAllowedNetworksPanel } from '@/components/UserAllowedNetworksPanel';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { RECEPTION_ROLE_NAME } from '@/lib/receptionUserAccess';
import { applyInternalNetworksToUsers } from '@/hooks/useUserAllowedNetworks';
import { callNfcAuth, normalizeNfcUid } from '@/lib/nfcAuth';
import { useAuth } from '@/hooks/useAuth';

export const UserManagement = () => {
  const { roles, permissions, loading: rolesLoading } = useRoles();
  const { hasPermission } = usePermissions();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { isMultiEntity, billingCompanies } = useWorkCenter();
  const { users, loading: usersLoading, fetchUsers, deleteUser, createUser, updateUser } = useUsers();
  const { session } = useAuth();
  const { employees: agendaEmployees, isLoading: employeesLoading } = useAgendaEmployees({ agendaOnly: false });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRoleId, setCreateRoleId] = useState('');
  const [createEmployeeId, setCreateEmployeeId] = useState<string>('none');
  const [createPermissionIds, setCreatePermissionIds] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState<string>('none');
  const [editNfcUid, setEditNfcUid] = useState('');
  const [savingNfc, setSavingNfc] = useState(false);
  const [editPermissionIds, setEditPermissionIds] = useState<string[]>([]);
  const [editPermissionsTouched, setEditPermissionsTouched] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [editRolePermissionIds, setEditRolePermissionIds] = useState<string[]>([]);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editNewPasswordConfirm, setEditNewPasswordConfirm] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [permissionsCompanyId, setPermissionsCompanyId] = useState('');
  const [applyingInternalNetworks, setApplyingInternalNetworks] = useState(false);

  const canChangePasswords = hasPermission('users', 'update');
  const canManageNetworks = hasPermission('users', 'update');

  const rolePermissionIdsSet = useMemo(
    () => new Set(editRolePermissionIds),
    [editRolePermissionIds],
  );

  // Check if user has permission to manage users
  if (!hasPermission('users', 'read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Sin permisos</h3>
          <p className="mt-1 text-sm text-gray-500">
            No tienes permisos para gestionar usuarios.
          </p>
        </div>
      </div>
    );
  }

  const handleDeleteUser = async (userId: string, email: string) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el usuario ${email}?`)) {
      await deleteUser(userId);
    }
  };

  const handleApplyInternalNetworks = async () => {
    if (!canManageNetworks || users.length === 0) return;
    const ok = window.confirm(
      `¿Asignar redes internas (10.10.10.0/24, 192.168.99.0/24 y 192.168.1.0/24) a los ${users.length} usuarios listados?\n\n` +
        'No se modificará quien ya tenga «Cualquier IP (0.0.0.0/0)».',
    );
    if (!ok) return;
    setApplyingInternalNetworks(true);
    try {
      const applied = await applyInternalNetworksToUsers(users.map((u) => u.id));
      toast.success(
        applied > 0
          ? `Se añadieron ${applied} asignaciones de red interna`
          : 'No había redes internas pendientes de asignar',
      );
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron aplicar las redes internas');
    } finally {
      setApplyingInternalNetworks(false);
    }
  };

  const resolveUserCompanyId = (user: any): string | null =>
    user?.profiles?.company_id ||
    user?.user_company_roles?.[0]?.company_id ||
    companyId ||
    null;

  const assignedCompanyIdsForUser = (user: any): string[] => {
    const fromRoles = (user?.user_company_roles || [])
      .map((ucr: { company_id?: string }) => ucr.company_id)
      .filter(Boolean) as string[];
    const ids = new Set<string>(fromRoles);
    if (user?.profiles?.company_id) ids.add(user.profiles.company_id);
    return [...ids];
  };

  const companyLabel = (id: string) =>
    billingCompanies.find((c) => c.id === id)?.short_name?.trim() ||
    billingCompanies.find((c) => c.id === id)?.name ||
    id.slice(0, 8);

  const resolveUserRoleId = (user: any, forCompanyId?: string | null): string => {
    const targetCompanyId = forCompanyId || user?.profiles?.company_id;
    const companyRole =
      user?.user_company_roles?.find(
        (ucr: { company_id?: string }) => !targetCompanyId || ucr.company_id === targetCompanyId,
      ) ?? user?.user_company_roles?.[0];
    const roleName = companyRole?.role?.name;
    return roleName ? (roles.find((r) => r.name === roleName)?.id || '') : '';
  };

  const loadPermissionsForCompany = async (user: any, targetCompanyId: string) => {
    const cached = user?.permissions_by_company?.[targetCompanyId];
    if (Array.isArray(cached)) {
      setEditPermissionIds(cached);
      setEditPermissionsTouched(false);
      return;
    }
    const { data, error } = await supabase
      .from('user_permissions')
      .select('permission_id')
      .eq('user_id', user.id)
      .eq('company_id', targetCompanyId);
    if (error) {
      console.error('loadPermissionsForCompany', error);
      setEditPermissionIds([]);
    } else {
      setEditPermissionIds((data || []).map((r: { permission_id: string }) => r.permission_id).filter(Boolean));
    }
    setEditPermissionsTouched(false);
  };

  const handleEditUser = async (user: any) => {
    setEditingUser(user);
    const profileCompanyId = resolveUserCompanyId(user);
    const initialPermCompany = profileCompanyId ?? companyId ?? '';
    setPermissionsCompanyId(initialPermCompany);
    const roleId = resolveUserRoleId(user, initialPermCompany);
    setEditRoleId(roleId);
    setEditEmployeeId(user?.profiles?.employee_id || 'none');
    setEditNfcUid(user?.profiles?.nfc_uid || '');
    setEditNewPassword('');
    setEditNewPasswordConfirm('');
    setShowEditPassword(false);
    setIsEditOpen(true);
    if (initialPermCompany) {
      await loadPermissionsForCompany(user, initialPermCompany);
    } else {
      setEditPermissionIds(Array.isArray(user?.permission_ids) ? user.permission_ids : []);
      setEditPermissionsTouched(false);
    }
    if (roleId) {
      setEditRolePermissionIds(await getRoleDefaultPermissionIds(roleId));
    } else {
      setEditRolePermissionIds([]);
    }
  };

  const handlePermissionsCompanyChange = async (nextCompanyId: string) => {
    if (editPermissionsTouched) {
      const ok = window.confirm(
        'Hay cambios de permisos sin guardar en la empresa actual. ¿Cambiar de empresa y descartarlos?',
      );
      if (!ok) return;
    }
    setPermissionsCompanyId(nextCompanyId);
    if (!editingUser) return;
    const roleId = resolveUserRoleId(editingUser, nextCompanyId);
    setEditRoleId(roleId);
    if (roleId) {
      setEditRolePermissionIds(await getRoleDefaultPermissionIds(roleId));
    } else {
      setEditRolePermissionIds([]);
    }
    await loadPermissionsForCompany(editingUser, nextCompanyId);
  };

  const getRoleDefaultPermissionIds = async (roleId: string): Promise<string[]> => {
    if (!roleId) return [];
    const roleName = (roles.find((r) => r.id === roleId)?.name || '').toLowerCase();
    if (roleName === 'admin') {
      return permissions.map((p) => p.id).filter(Boolean);
    }

    const { data: rolePerms, error } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', roleId);
    if (error) {
      console.error('role_permissions query', error);
      return [];
    }
    return (rolePerms || []).map((rp: any) => rp.permission_id).filter(Boolean);
  };

  const handleCreateRoleChange = async (roleId: string) => {
    setCreateRoleId(roleId);
    const defaultPerms = await getRoleDefaultPermissionIds(roleId);
    setCreatePermissionIds(defaultPerms);
  };

  const handleEditRoleChange = async (roleId: string) => {
    setEditRoleId(roleId);
    const defaultPerms = await getRoleDefaultPermissionIds(roleId);
    setEditPermissionIds(defaultPerms);
    setEditRolePermissionIds(defaultPerms);
    setEditPermissionsTouched(true);
  };

  const handleRefresh = () => {
    fetchUsers();
  };

  const handleCreateUser = async () => {
    if (!companyId) {
      toast.error('No se ha podido resolver la empresa activa');
      return;
    }
    if (!createEmail.trim() || !createPassword.trim() || !createRoleId) {
      toast.error('Completa email, contraseña y rol');
      return;
    }

    setCreatingUser(true);
    try {
      const ok = await createUser({
        email: createEmail.trim(),
        password: createPassword,
        company_id: companyId,
        role_id: createRoleId,
        employee_id: createEmployeeId === 'none' ? null : createEmployeeId,
        permissions: createPermissionIds,
      });
      if (!ok) return;
      setCreateEmail('');
      setCreatePassword('');
      setCreateRoleId('');
      setCreateEmployeeId('none');
      setCreatePermissionIds([]);
      setIsCreateOpen(false);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangePassword = async () => {
    if (!editingUser?.id) return;
    if (!canChangePasswords) {
      toast.error('No tienes permiso para cambiar la contraseña (users:update)');
      return;
    }
    const pwd = editNewPassword.trim();
    if (pwd.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (pwd !== editNewPasswordConfirm.trim()) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setChangingPassword(true);
    try {
      const ok = await updateUser({
        userId: editingUser.id,
        password: pwd,
      });
      if (ok) {
        setEditNewPassword('');
        setEditNewPasswordConfirm('');
        setShowEditPassword(false);
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser?.id) return;
    const profileCompanyId = resolveUserCompanyId(editingUser);
    const scopeCompanyId = permissionsCompanyId || profileCompanyId;
    if (!scopeCompanyId) {
      toast.error('No se ha podido resolver la empresa del usuario');
      return;
    }
    const originalRoleId = resolveUserRoleId(editingUser, scopeCompanyId);
    const roleChanged = !!editRoleId && editRoleId !== originalRoleId;
    setUpdatingUser(true);
    try {
      const ok = await updateUser({
        userId: editingUser.id,
        // company_id = empresa cuyos permisos/rol se editan (Medicina o Estética).
        company_id: scopeCompanyId,
        ...(roleChanged ? { role_id: editRoleId } : {}),
        // Empleado solo en el perfil principal; no al cambiar de empresa de permisos.
        ...(scopeCompanyId === profileCompanyId
          ? { employee_id: editEmployeeId === 'none' ? null : editEmployeeId }
          : {}),
        ...(editPermissionsTouched ? { permission_ids: editPermissionIds } : {}),
      });
      if (!ok) return;
      setEditPermissionsTouched(false);
      setIsEditOpen(false);
      setEditingUser(null);
    } finally {
      setUpdatingUser(false);
    }
  };

  if (rolesLoading || usersLoading || companyLoading || employeesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('users', 'create') && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!companyId}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Nuevo usuario
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear nuevo usuario</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-user-email">Email</Label>
                    <Input
                      id="new-user-email"
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      placeholder="usuario@empresa.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-user-password">Contraseña</Label>
                    <Input
                      id="new-user-password"
                      type="password"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rol base</Label>
                    <Select value={createRoleId} onValueChange={handleCreateRoleChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar rol" />
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
                  <div className="space-y-1.5">
                    <Label>Permisos granulares</Label>
                    <div className="max-h-44 overflow-auto rounded border p-2 space-y-1">
                      {permissions.map((perm) => {
                        const checked = createPermissionIds.includes(perm.id);
                        const label = perm.name || `${perm.resource}:${perm.action}`;
                        return (
                          <label key={perm.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setCreatePermissionIds((prev) =>
                                  e.target.checked ? [...prev, perm.id] : prev.filter((id) => id !== perm.id),
                                );
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Al elegir rol se marcan permisos por defecto; puedes ajustarlos antes de crear.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Empleado vinculado (opcional)</Label>
                    <Select value={createEmployeeId} onValueChange={setCreateEmployeeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin vincular" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin vincular</SelectItem>
                        {agendaEmployees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" onClick={handleCreateUser} disabled={creatingUser || !companyId}>
                      {creatingUser ? 'Creando...' : 'Crear usuario'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          {canManageNetworks && (
            <Button
              onClick={() => void handleApplyInternalNetworks()}
              variant="outline"
              size="sm"
              disabled={applyingInternalNetworks || usersLoading || users.length === 0}
              title="Asigna 10.10.10.0/24, 192.168.99.0/24 y 192.168.1.0/24 a todos (omite quien ya tenga acceso externo)"
            >
              <Network className="h-4 w-4 mr-2" />
              {applyingInternalNetworks ? 'Aplicando…' : 'Redes internas a todos'}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">{editingUser?.email}</p>

          <Tabs defaultValue="datos" className="mt-2">
            <TabsList disableScroll className="flex h-auto w-full flex-wrap justify-stretch gap-1">
              <TabsTrigger value="datos" className="flex-1">
                Datos
              </TabsTrigger>
              {canChangePasswords && (
                <TabsTrigger value="redes" className="flex-1" disabled={!editingUser?.id}>
                  Redes
                </TabsTrigger>
              )}
              <TabsTrigger
                value="excepciones"
                className="flex-1"
                disabled={(!permissionsCompanyId && !resolveUserCompanyId(editingUser)) || !editingUser?.id}
              >
                Excepciones
              </TabsTrigger>
              {canChangePasswords && (
                <TabsTrigger value="password" className="flex-1" disabled={!editingUser?.id}>
                  Contraseña
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="datos" className="space-y-3">
              {isMultiEntity && billingCompanies.length > 1 && editingUser?.id ? (
                <div className="space-y-1.5">
                  <Label>Empresa (rol y permisos independientes)</Label>
                  <Select
                    value={permissionsCompanyId}
                    onValueChange={(v) => void handlePermissionsCompanyChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedCompanyIdsForUser(editingUser).map((id) => (
                        <SelectItem key={id} value={id}>
                          {companyLabel(id)}
                          {id === resolveUserCompanyId(editingUser) ? ' (perfil)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Los permisos de Medicina y Estética se guardan por separado. Cambia de empresa,
                    ajusta Ver/Editar Marketing u otros, y pulsa Guardar.
                  </p>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label>
                  Rol
                  {permissionsCompanyId ? ` · ${companyLabel(permissionsCompanyId)}` : ' base'}
                </Label>
                <Select value={editRoleId} onValueChange={handleEditRoleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
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
              {(!permissionsCompanyId ||
                permissionsCompanyId === resolveUserCompanyId(editingUser)) && (
                <div className="space-y-1.5">
                  <Label>Empleado vinculado (opcional)</Label>
                  <Select value={editEmployeeId} onValueChange={setEditEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin vincular" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin vincular</SelectItem>
                      {agendaEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Vincular un usuario con un empleado de agenda permite que reciba notificaciones
                    personales y aparezca como recurso en sus citas.
                  </p>
                </div>
              )}
              {canChangePasswords && (
                <div className="space-y-1.5 rounded-md border p-3">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Tarjeta NFC (ACR122U)
                  </Label>
                  <Input
                    value={editNfcUid}
                    onChange={(e) => setEditNfcUid(normalizeNfcUid(e.target.value))}
                    placeholder="UID hex (o pasa la tarjeta en modo teclado y pégalo)"
                    className="font-mono text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingNfc || !editingUser?.id}
                      onClick={() => {
                        void (async () => {
                          const uid = normalizeNfcUid(editNfcUid);
                          if (uid.length < 6) {
                            toast.error('UID demasiado corto');
                            return;
                          }
                          setSavingNfc(true);
                          try {
                            await callNfcAuth(
                              { action: 'enroll.set', user_id: editingUser.id, uid },
                              { accessToken: session?.access_token },
                            );
                            toast.success('Tarjeta NFC asociada');
                            setEditingUser((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    profiles: { ...(prev.profiles || {}), nfc_uid: uid },
                                  }
                                : prev,
                            );
                            void fetchUsers();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Error asociando NFC');
                          } finally {
                            setSavingNfc(false);
                          }
                        })();
                      }}
                    >
                      Guardar NFC
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingNfc || !editingUser?.id || !editNfcUid}
                      onClick={() => {
                        void (async () => {
                          setSavingNfc(true);
                          try {
                            await callNfcAuth(
                              { action: 'enroll.clear', user_id: editingUser.id },
                              { accessToken: session?.access_token },
                            );
                            setEditNfcUid('');
                            toast.success('Tarjeta NFC desasociada');
                            setEditingUser((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    profiles: { ...(prev.profiles || {}), nfc_uid: null },
                                  }
                                : prev,
                            );
                            void fetchUsers();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Error quitando NFC');
                          } finally {
                            setSavingNfc(false);
                          }
                        })();
                      }}
                    >
                      Quitar NFC
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    El UID lo muestra el agente ACR122U al pasar la tarjeta, o el lector en modo
                    teclado.
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>
                  Permisos ALLOW
                  {permissionsCompanyId ? ` · ${companyLabel(permissionsCompanyId)}` : ''}
                </Label>
                <div className="max-h-52 overflow-auto rounded border p-2 space-y-1">
                  {permissions.map((perm) => {
                    const checked = editPermissionIds.includes(perm.id);
                    const label = perm.name || `${perm.resource}:${perm.action}`;
                    return (
                      <label key={perm.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setEditPermissionsTouched(true);
                            setEditPermissionIds((prev) =>
                              e.target.checked ? [...prev, perm.id] : prev.filter((id) => id !== perm.id),
                            );
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Se guardan solo para la empresa seleccionada. Para denegar un permiso del rol usa la
                  pestaña <em>Excepciones</em> (también por empresa).
                </p>
              </div>

              {isMultiEntity && billingCompanies.length > 1 && editingUser?.id && (
                <>
                  <div className="rounded-md border border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/40 p-3 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                    <p className="font-medium">Centro Medicina + Estética</p>
                    <p>
                      Asigna el rol <strong>{RECEPTION_ROLE_NAME}</strong> en{' '}
                      <strong>ambas empresas</strong> (bloque inferior) si debe operar en las dos.
                      Marketing y el resto de permisos se configuran arriba eligiendo empresa.
                    </p>
                  </div>
                  <UserCompanyAccessPanel
                    userId={editingUser.id}
                    userEmail={editingUser.email}
                    companies={billingCompanies.map((c) => ({
                      id: c.id,
                      name: c.short_name?.trim() || c.name,
                      tax_id: c.tax_id,
                    }))}
                    assignedRoles={editingUser.user_company_roles ?? []}
                    roles={roles}
                    onChanged={fetchUsers}
                  />
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleUpdateUser}
                  disabled={updatingUser || !permissionsCompanyId}
                >
                  {updatingUser
                    ? 'Guardando...'
                    : `Guardar${permissionsCompanyId ? ` (${companyLabel(permissionsCompanyId)})` : ''}`}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="excepciones">
              {permissionsCompanyId && editingUser?.id ? (
                <>
                  {isMultiEntity && billingCompanies.length > 1 ? (
                    <div className="space-y-1.5 mb-3">
                      <Label>Empresa para excepciones de permisos</Label>
                      <Select
                        value={permissionsCompanyId}
                        onValueChange={(v) => void handlePermissionsCompanyChange(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {billingCompanies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.short_name?.trim() || c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Misma empresa que en Datos: los DENY/ALLOW de excepciones son independientes por empresa.
                      </p>
                    </div>
                  ) : null}
                  <UserPermissionsPanel
                    userId={editingUser.id}
                    companyId={permissionsCompanyId}
                    permissions={permissions}
                    rolePermissionIds={rolePermissionIdsSet}
                  />
                </>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Selecciona un usuario y empresa para gestionar sus excepciones.
                </div>
              )}
            </TabsContent>

            {canChangePasswords && (
              <TabsContent value="redes">
                {editingUser?.id ? (
                  <UserAllowedNetworksPanel userId={editingUser.id} />
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Selecciona un usuario para configurar sus redes de acceso.
                  </div>
                )}
              </TabsContent>
            )}

            {canChangePasswords && (
              <TabsContent value="password" className="space-y-3">
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <KeyRound className="h-3.5 w-3.5" />
                    Cambiar contraseña
                  </div>
                  <p>
                    Establece una nueva contraseña para <strong>{editingUser?.email}</strong>. El usuario
                    podrá entrar inmediatamente con la nueva contraseña.
                  </p>
                  <p>
                    Por seguridad, <strong>no es posible recuperar la contraseña actual</strong>: están
                    cifradas en la base de datos. Solo se pueden sobrescribir.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-new-password">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="edit-new-password"
                      type={showEditPassword ? 'text' : 'password'}
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showEditPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-new-password-confirm">Repetir contraseña</Label>
                  <Input
                    id="edit-new-password-confirm"
                    type={showEditPassword ? 'text' : 'password'}
                    value={editNewPasswordConfirm}
                    onChange={(e) => setEditNewPasswordConfirm(e.target.value)}
                    placeholder="Vuelve a escribir la contraseña"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditNewPassword('');
                      setEditNewPasswordConfirm('');
                    }}
                    disabled={changingPassword || (!editNewPassword && !editNewPasswordConfirm)}
                  >
                    Limpiar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={
                      changingPassword ||
                      editNewPassword.length < 6 ||
                      editNewPassword !== editNewPasswordConfirm
                    }
                  >
                    {changingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
                  </Button>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios de la Empresa</CardTitle>
          <CardDescription>
            Lista de usuarios registrados en tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserListTable
            users={users}
            loading={usersLoading}
            onDeleteUser={handleDeleteUser}
            onEditUser={handleEditUser}
          />
        </CardContent>
      </Card>
    </div>
  );
};
