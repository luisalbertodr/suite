import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, UserPlus, Users, Shield, Mail, Phone, AlertCircle, CheckCircle, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRoles } from '@/hooks/useRoles';
import { UserListTable } from './UserListTable';
import { EditUserModal } from './EditUserModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { useNavigate } from 'react-router-dom';

interface Company {
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
  created_at: string;
}

interface UserWithDetails {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  profiles?: {
    company_id: string;
    companies?: {
      name: string;
    };
  };
  user_company_roles?: Array<{
    id: string;
    role: {
      name: string;
      description: string;
    };
  }>;
}

interface MenuPermission {
  resource: string;
  action: string;
  label: string;
  description: string;
}

const MENU_PERMISSIONS: MenuPermission[] = [
  { resource: 'dashboard', action: 'read', label: 'Dashboard', description: 'Ver el panel principal' },
  { resource: 'customers', action: 'read', label: 'Clientes', description: 'Ver y gestionar clientes' },
  { resource: 'articles', action: 'read', label: 'Artículos', description: 'Ver y gestionar productos' },
  { resource: 'planillas', action: 'read', label: 'Planillas', description: 'Ver y gestionar planillas' },
  { resource: 'quotes', action: 'read', label: 'Presupuestos', description: 'Ver y gestionar presupuestos' },
  { resource: 'presupuestos_n', action: 'read', label: 'PresupuestosN', description: 'Ver y gestionar presupuestos N' },
  { resource: 'invoices', action: 'read', label: 'Facturas', description: 'Ver y gestionar facturas' },
  { resource: 'delivery_notes', action: 'read', label: 'Alb. Entrada', description: 'Ver y gestionar albaranes de entrada' },
  { resource: 'delivery_notes_out', action: 'read', label: 'Alb. Salida', description: 'Ver y gestionar albaranes de salida' },
  { resource: 'suppliers', action: 'read', label: 'Proveedores', description: 'Ver y gestionar proveedores' },
  { resource: 'sales', action: 'read', label: 'TPV', description: 'Acceso al terminal de punto de venta' },
  { resource: 'agenda', action: 'read', label: 'Agenda', description: 'Ver y gestionar citas' },
  { resource: 'documents', action: 'read', label: 'Gestión Documental', description: 'Gestionar documentos' },
  { resource: 'reports', action: 'read', label: 'Reportes', description: 'Ver reportes y estadísticas' },
  { resource: 'companies', action: 'read', label: 'Empresas', description: 'Gestionar información de empresas' },
  { resource: 'settings', action: 'read', label: 'Configuración', description: 'Acceso a configuración del sistema' }
];

const callEdgeFunction = async (functionName: string, body: any = {}) => {
  const functionUrl = `https://kztelbnarzrpbjlqastg.supabase.co/functions/v1/${functionName}`;
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6dGVsYm5hcnpycGJqbHFhc3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjcxNjEsImV4cCI6MjA2NDYwMzE2MX0.0jdEKfZgKsAqmZUWhhFqhZMWXYK-R8AABzwEQMgGjvU';

  console.log(`Calling edge function: ${functionName} at ${functionUrl}`);
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Edge function ${functionName} failed:`, response.status, text);
    throw new Error(`Edge function failed: ${response.status} ${text}`);
  }

  const result = await response.json();
  console.log(`Edge function ${functionName} response:`, result);
  return result;
};

export const SuperuserManagement: React.FC = () => {
  const navigate = useNavigate();
  
  const [newCompany, setNewCompany] = useState({
    name: '',
    tax_id: '',
    email: '',
    phone: '',
    address_street: '',
    address_city: '',
    address_state: '',
    address_postal_code: '',
    address_country: 'España'
  });

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    company_id: '',
    role_id: '',
    selectedPermissions: [] as string[]
  });

  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { roles } = useRoles();

  const handleLogout = () => {
    // Clear superuser session
    localStorage.removeItem('superuser_session');
    localStorage.removeItem('superuser_login_time');
    localStorage.removeItem('superuser_data');
    
    // Show confirmation
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión como superusuario correctamente.",
      duration: 3000
    });
    
    // Redirect to superuser login page
    navigate('/superuser');
  };

  // Get current superuser email from localStorage
  const getSuperuserEmail = () => {
    const superuserData = localStorage.getItem('superuser_data');
    if (superuserData) {
      try {
        const data = JSON.parse(superuserData);
        return data.email || '';
      } catch {
        return '';
      }
    }
    return '';
  };

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Company[];
    }
  });

  const { data: usersResponse, isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['superuser-users'],
    queryFn: async () => {
      console.log('Calling list-users function...')
      return await callEdgeFunction('list-users');
    },
    retry: 1,
    retryDelay: 1000
  });

  const users = usersResponse?.users || [];

  const { data: availablePermissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  const testConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Probando conexión...');
    
    try {
      const result = await callEdgeFunction('list-users');
      setTestStatus('success');
      setTestMessage(`Conexión exitosa. Usuarios encontrados: ${result?.users?.length || 0}`);
    } catch (error) {
      console.error('Test failed:', error);
      setTestStatus('error');
      setTestMessage(`Error: ${(error as any).message}`);
    }
  };

  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: typeof newCompany) => {
      const { error } = await supabase
        .from('companies')
        .insert([companyData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({
        title: "Empresa creada",
        description: "La empresa ha sido creada correctamente."
      });
      setNewCompany({
        name: '',
        tax_id: '',
        email: '',
        phone: '',
        address_street: '',
        address_city: '',
        address_state: '',
        address_postal_code: '',
        address_country: 'España'
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear la empresa: " + (error as any).message,
        variant: "destructive"
      });
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      console.log('Creating user via function with data:', userData)
      return await callEdgeFunction('create-user', {
        email: userData.email,
        password: userData.password,
        company_id: userData.company_id,
        role_id: userData.role_id,
        permissions: userData.selectedPermissions
      });
    },
    onSuccess: (data) => {
      if (!data?.success) {
        throw new Error(data?.error || 'Error desconocido al crear usuario')
      }
      queryClient.invalidateQueries({ queryKey: ['superuser-users'] });
      toast({
        title: "Usuario creado",
        description: `El usuario ha sido creado correctamente. Permisos asignados: ${newUser.selectedPermissions.length}`,
        duration: 5000
      });
      setNewUser({
        email: '',
        password: '',
        company_id: '',
        role_id: '',
        selectedPermissions: []
      });
    },
    onError: (error: any) => {
      console.error('User creation failed:', error)
      toast({
        title: "Error al crear usuario",
        description: error.message || 'Error desconocido',
        variant: "destructive",
        duration: 10000
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await callEdgeFunction('delete-user', { userId });
      if (!result?.success) throw new Error(result?.error || 'Error al eliminar usuario');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superuser-users'] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado correctamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario: " + (error.message || 'Error desconocido'),
        variant: "destructive"
      });
    }
  });

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    createCompanyMutation.mutate(newCompany);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUser.email.trim() || !newUser.password.trim() || !newUser.company_id || !newUser.role_id) {
      toast({
        title: "Error de validación",
        description: "Todos los campos obligatorios deben completarse",
        variant: "destructive"
      });
      return;
    }
    
    if (newUser.selectedPermissions.length === 0) {
      toast({
        title: "Advertencia",
        description: "El usuario no tendrá acceso a ninguna sección del sistema. ¿Está seguro?",
        variant: "destructive"
      });
    }
    
    console.log('Creating user with permissions:', newUser.selectedPermissions);
    createUserMutation.mutate(newUser);
  };

  const handleDeleteUser = (userId: string, email: string) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el usuario ${email}?`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleEditUser = (user: UserWithDetails) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setNewUser(prev => ({
      ...prev,
      selectedPermissions: checked 
        ? [...prev.selectedPermissions, permissionId]
        : prev.selectedPermissions.filter(id => id !== permissionId)
    }));
  };

  const handleSelectAllPermissions = (checked: boolean) => {
    if (checked) {
      const menuPermissionIds = MENU_PERMISSIONS
        .map(permission => {
          return availablePermissions.find(
            p => p.resource === permission.resource && p.action === permission.action
          )?.id;
        })
        .filter(Boolean) as string[];
      
      setNewUser(prev => ({
        ...prev,
        selectedPermissions: menuPermissionIds
      }));
    } else {
      setNewUser(prev => ({
        ...prev,
        selectedPermissions: []
      }));
    }
  };

  const allMenuPermissionsSelected = MENU_PERMISSIONS.every(permission => {
    const matchingPermission = availablePermissions.find(
      p => p.resource === permission.resource && p.action === permission.action
    );
    return matchingPermission && newUser.selectedPermissions.includes(matchingPermission.id);
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-red-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel de Superusuario</h1>
            <p className="text-gray-600">Gestión de empresas y usuarios del sistema</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <ChangePasswordModal superuserEmail={getSuperuserEmail()} />
          <Button
            onClick={handleLogout}
            variant="outline"
            className="flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </Button>
        </div>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Estado del Sistema:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Usuarios:</span>
              <div className={usersLoading ? 'text-orange-600' : usersError ? 'text-red-600' : 'text-green-600'}>
                {usersLoading ? 'Cargando...' : usersError ? 'Error' : `${users.length} encontrados`}
              </div>
            </div>
            <div>
              <span className="font-medium">Empresas:</span>
              <div className="text-green-600">{companies.length} registradas</div>
            </div>
            <div>
              <span className="font-medium">Permisos:</span>
              <div className="text-green-600">{availablePermissions.length} disponibles</div>
            </div>
            <div>
              <span className="font-medium">Roles:</span>
              <div className="text-green-600">{roles.length} configurados</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-green-800 mb-2">Prueba de Conexión:</h3>
              <div className="flex items-center space-x-2">
                {testStatus === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                {testStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                <span className="text-sm text-gray-700">{testMessage || 'No se ha probado'}</span>
              </div>
            </div>
            <Button 
              onClick={testConnection}
              disabled={testStatus === 'testing'}
              className="bg-green-600 hover:bg-green-700"
            >
              {testStatus === 'testing' ? 'Probando...' : 'Probar Conexión'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="companies" className="flex items-center space-x-2">
            <Building2 className="w-4 h-4" />
            <span>Empresas</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Crear Usuario</span>
          </TabsTrigger>
          <TabsTrigger value="user-list" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Lista Usuarios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="w-5 h-5" />
                <span>Crear Nueva Empresa</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company-name">Nombre de la empresa *</Label>
                    <Input
                      id="company-name"
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-tax-id">CIF/NIF *</Label>
                    <Input
                      id="company-tax-id"
                      value={newCompany.tax_id}
                      onChange={(e) => setNewCompany({...newCompany, tax_id: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company-email">Email *</Label>
                    <Input
                      id="company-email"
                      type="email"
                      value={newCompany.email}
                      onChange={(e) => setNewCompany({...newCompany, email: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-phone">Teléfono</Label>
                    <Input
                      id="company-phone"
                      value={newCompany.phone}
                      onChange={(e) => setNewCompany({...newCompany, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="company-address">Dirección</Label>
                  <Input
                    id="company-address"
                    value={newCompany.address_street}
                    onChange={(e) => setNewCompany({...newCompany, address_street: e.target.value})}
                    placeholder="Calle"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="company-city">Ciudad</Label>
                    <Input
                      id="company-city"
                      value={newCompany.address_city}
                      onChange={(e) => setNewCompany({...newCompany, address_city: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-state">Provincia</Label>
                    <Input
                      id="company-state"
                      value={newCompany.address_state}
                      onChange={(e) => setNewCompany({...newCompany, address_state: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-postal">Código Postal</Label>
                    <Input
                      id="company-postal"
                      value={newCompany.address_postal_code}
                      onChange={(e) => setNewCompany({...newCompany, address_postal_code: e.target.value})}
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={createCompanyMutation.isPending}
                  className="w-full"
                >
                  {createCompanyMutation.isPending ? 'Creando...' : 'Crear Empresa'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Empresas Existentes ({companies.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {companiesLoading ? (
                <p>Cargando empresas...</p>
              ) : companies.length === 0 ? (
                <p className="text-gray-500">No hay empresas registradas</p>
              ) : (
                <div className="space-y-4">
                  {companies.map((company) => (
                    <div key={company.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{company.name}</h3>
                          <p className="text-sm text-gray-600">CIF: {company.tax_id}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Mail className="w-4 h-4" />
                              <span>{company.email}</span>
                            </div>
                            {company.phone && (
                              <div className="flex items-center space-x-1">
                                <Phone className="w-4 h-4" />
                                <span>{company.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(company.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5" />
                <span>Crear Nuevo Usuario</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="user-email">Email *</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      required
                      placeholder="usuario@ejemplo.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="user-password">Contraseña *</Label>
                    <Input
                      id="user-password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="user-company">Empresa *</Label>
                    <Select value={newUser.company_id} onValueChange={(value) => setNewUser({...newUser, company_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="user-role">Rol Base *</Label>
                    <Select value={newUser.role_id} onValueChange={(value) => setNewUser({...newUser, role_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar rol" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name} - {role.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Permisos de Acceso a Secciones</Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Selecciona las secciones a las que el usuario tendrá acceso ({newUser.selectedPermissions.length} seleccionados)
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all"
                        checked={allMenuPermissionsSelected}
                        onCheckedChange={handleSelectAllPermissions}
                      />
                      <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                        Seleccionar todo
                      </Label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {MENU_PERMISSIONS.map((permission) => {
                      const matchingPermission = availablePermissions.find(
                        p => p.resource === permission.resource && p.action === permission.action
                      );
                      
                      if (!matchingPermission) return null;
                      
                      return (
                        <div key={`${permission.resource}-${permission.action}`} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                          <Checkbox
                            id={matchingPermission.id}
                            checked={newUser.selectedPermissions.includes(matchingPermission.id)}
                            onCheckedChange={(checked) => handlePermissionChange(matchingPermission.id, checked as boolean)}
                          />
                          <div className="flex-1">
                            <Label 
                              htmlFor={matchingPermission.id} 
                              className="font-medium cursor-pointer text-sm"
                            >
                              {permission.label}
                            </Label>
                            <p className="text-xs text-gray-500 mt-1">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={createUserMutation.isPending || companies.length === 0}
                  className="w-full"
                >
                  {createUserMutation.isPending ? 'Creando...' : 'Crear Usuario'}
                </Button>
                
                {companies.length === 0 && (
                  <p className="text-sm text-amber-600 text-center">
                    Primero debe crear al menos una empresa
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user-list" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Usuarios Registrados ({users.length})</CardTitle>
                <Button onClick={() => refetchUsers()} variant="outline" size="sm">
                  Actualizar
                </Button>
              </div>
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
        </TabsContent>
      </Tabs>

      <EditUserModal
        user={editingUser}
        companies={companies}
        availablePermissions={availablePermissions}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        onUserUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['superuser-users'] });
        }}
      />
    </div>
  );
};
