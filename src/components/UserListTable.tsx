import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Shield, Users } from 'lucide-react';

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

interface UserListTableProps {
  users: UserWithDetails[];
  loading: boolean;
  onDeleteUser: (userId: string, email: string) => void;
  onEditUser: (user: UserWithDetails) => void;
}

export const UserListTable: React.FC<UserListTableProps> = ({
  users,
  loading,
  onDeleteUser,
  onEditUser
}) => {
  console.log('UserListTable received:', { users, loading, userCount: users?.length });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="text-gray-500 mb-4">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-lg font-medium">No hay usuarios registrados</p>
          <p className="text-sm">Los usuarios que crees aparecerán aquí</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        Total de usuarios: {users.length}
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Último acceso</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{user.email}</p>
                  <p className="text-xs text-gray-500">
                    ID: {user.id.substring(0, 8)}...
                  </p>
                  <p className="text-xs text-gray-500">
                    Registrado: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                {user.profiles?.companies?.name || 'Sin empresa'}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.user_company_roles?.map((userRole) => (
                    <Badge key={userRole.id} variant="secondary" className="text-xs">
                      {userRole.role.name}
                    </Badge>
                  ))}
                  {(!user.user_company_roles || user.user_company_roles.length === 0) && (
                    <Badge variant="outline" className="text-xs">Sin roles</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={user.email_confirmed_at ? "default" : "destructive"}
                  className="text-xs"
                >
                  {user.email_confirmed_at ? "Confirmado" : "Pendiente"}
                </Badge>
              </TableCell>
              <TableCell>
                {user.last_sign_in_at 
                  ? new Date(user.last_sign_in_at).toLocaleDateString()
                  : 'Nunca'
                }
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditUser(user)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDeleteUser(user.id, user.email)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
