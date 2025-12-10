
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Building2 } from 'lucide-react';
import { Home, LayoutDashboard, Users, ShoppingBag, Settings, FileText, BarChart2, Truck, Receipt, Package, Calendar, FolderOpen, Grid3X3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      permission: { resource: 'dashboard', action: 'read' }
    },
    {
      label: 'Clientes',
      path: '/clientes',
      icon: Users,
      permission: { resource: 'customers', action: 'read' }
    },
    {
      label: 'Artículos', 
      path: '/articulos',
      icon: Package,
      permission: { resource: 'articles', action: 'read' }
    },
    {
      label: 'Planillas',
      path: '/planillas',
      icon: Grid3X3,
      permission: { resource: 'planillas', action: 'read' }
    },
    {
      label: 'Presupuestos',
      path: '/presupuestos', 
      icon: FileText,
      permission: { resource: 'quotes', action: 'read' }
    },
    {
      label: 'Facturas',
      path: '/facturas',
      icon: Receipt,
      permission: { resource: 'invoices', action: 'read' }
    },
    {
      label: 'Alb. Entrada',
      path: '/albaranes-entrada',
      icon: Truck,
      permission: { resource: 'delivery_notes', action: 'read' }
    },
    {
      label: 'Alb. Salida',
      path: '/albaranes-salida', 
      icon: Truck,
      permission: { resource: 'delivery_notes_out', action: 'read' }
    },
    {
      label: 'Proveedores',
      path: '/proveedores',
      icon: Building2,
      permission: { resource: 'suppliers', action: 'read' }
    },
    {
      label: 'TPV',
      path: '/tpv',
      icon: ShoppingBag,
      permission: { resource: 'sales', action: 'read' }
    },
    {
      label: 'Agenda',
      path: '/agenda',
      icon: Calendar,
      permission: { resource: 'agenda', action: 'read' }
    },
    {
      label: 'Gestión Documental',
      path: '/gestion-documental',
      icon: FolderOpen,
      permission: { resource: 'documents', action: 'read' }
    },
    {
      label: 'Reportes',
      path: '/reportes',
      icon: BarChart2,
      permission: { resource: 'reports', action: 'read' }
    },
    {
      label: 'Empresas',
      path: '/empresas',
      icon: Building2,
      permission: { resource: 'companies', action: 'read' }
    },
    {
      label: 'Configuración',
      path: '/configuracion',
      icon: Settings,
      permission: { resource: 'settings', action: 'read' }
    }
  ];

  const visibleMenuItems = menuItems.filter(item => 
    hasPermission(item.permission.resource, item.permission.action)
  );

  return (
    <div
      className={`fixed top-0 left-0 h-full w-64 bg-gray-800 text-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } z-50`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold">
            Admin Panel
          </Link>
          <button onClick={onClose} className="text-gray-400 hover:text-white focus:outline-none">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>
      <nav className="mt-6">
        {visibleMenuItems.map((item, index) => {
          return (
            <Link
              to={item.path}
              key={index}
              className={`flex items-center space-x-3 p-4 hover:bg-gray-700 transition-colors duration-200 ${
                location.pathname === item.path ? 'bg-gray-700' : ''
              }`}
              onClick={onClose}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-0 left-0 w-full p-4 border-t border-gray-700">
        <p className="text-sm text-gray-500">
          Logged in as: {user?.email}
        </p>
        <button className="block mt-2 text-sm text-blue-400 hover:text-blue-300" onClick={onClose}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
