import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Home, LayoutDashboard, Users, ShoppingBag, Settings, FileText, BarChart2, Truck, Receipt, Package, Calendar, FolderOpen, Grid3X3, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useSidebar } from '@/components/ui/sidebar';
import { useUserAppearance } from '@/hooks/useUserAppearance';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';

export const AppSidebar: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const { state } = useSidebar();
  const { sidebarColor } = useUserAppearance();
  const { companyId } = useCompanyFilter();
  
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [companyName, setCompanyName] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (companyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', companyId)
          .single();
        
        if (company) {
          setCompanyName(company.name);
        }
      }
    };

    fetchCompanyName();
  }, [companyId]);

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
      label: 'PresupuestosN',
      path: '/presupuestos-n', 
      icon: FileText,
      permission: { resource: 'presupuestos_n', action: 'read' }
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

  const isCollapsed = state === 'collapsed';

  // Mapeo de colores a clases CSS
  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-800',
      green: 'bg-green-800',
      purple: 'bg-purple-800',
      red: 'bg-red-800',
      gray: 'bg-gray-800',
      indigo: 'bg-indigo-800',
      teal: 'bg-teal-800',
      orange: 'bg-orange-800'
    };
    return colorMap[color] || colorMap.blue;
  };

  const sidebarBgClass = getColorClasses(sidebarColor);

  return (
    <Sidebar collapsible="icon" className={`border-r ${sidebarBgClass} text-white`}>
      <SidebarContent className={sidebarBgClass}>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/70 px-2 py-3">
            {!isCollapsed ? (
              <div>
                <div className="font-bold text-white text-lg">MOGES</div>
                <div className="text-xs text-white/60 mt-1">
                  Movicas Gestión
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="font-bold text-white text-xs">MG</div>
              </div>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item, index) => {
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={index}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      tooltip={isCollapsed ? item.label : undefined}
                      className="text-white hover:bg-white/10 data-[active=true]:bg-white/20 data-[active=true]:text-white"
                    >
                      <Link to={item.path} className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className={`${sidebarBgClass} border-t border-white/20 p-4`}>
        <div className="text-sm">
          {!isCollapsed ? (
            <div className="space-y-1">
              <p className="text-white font-medium text-lg">
                {currentDateTime.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </p>
              <p className="text-white font-medium text-sm">
                {currentDateTime.toLocaleDateString('es-ES', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
              {companyName && (
                <p className="text-xs text-gray-300">
                  {companyName}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-xs text-white font-medium">
                {currentDateTime.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
