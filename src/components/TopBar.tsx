import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const pageTitles: Record<string, string> = {
  '/': 'Inicio',
  '/agenda': 'Agenda',
  '/tpv': 'TPV',
  '/facturacion': 'Facturación',
  '/facturas': 'Facturas',
  '/presupuestos': 'Presupuestos',
  '/presupuestos-n': 'Presupuestos N',
  '/albaranes-entrada': 'Albaranes Entrada',
  '/albaranes-salida': 'Albaranes Salida',
  '/clientes': 'Clientes',
  '/articulos': 'Artículos',
  '/proveedores': 'Proveedores',
  '/planillas': 'Planillas',
  '/configuracion': 'Configuración',
  '/gestion-documental': 'Gestión Documental',
  '/reportes': 'Reportes',
  '/empresas': 'Empresas',
};

export const TopBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pageTitle = pageTitles[location.pathname] || 'Lipoout';

  const handleDateClick = () => navigate('/agenda');

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-12">
      <div className="flex items-center justify-between h-full px-5">
        {/* Left: Page title */}
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground/80">
            {pageTitle}
          </h1>
        </div>

        {/* Right: Notifications, DateTime, User */}
        <div className="flex items-center gap-4">
          {/* Notifications bell */}
          <button className="relative p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <Bell className="h-4 w-4 text-foreground/60" />
            {/* Badge placeholder */}
          </button>

          {/* Date & Time - clickable to Agenda */}
          <button
            onClick={handleDateClick}
            className="flex items-center gap-2 text-xs text-foreground/60 hover:text-foreground/80 transition-colors"
          >
            <span className="font-medium">
              {currentDateTime.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span>
              {currentDateTime.toLocaleDateString('es-ES', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors outline-none">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-medium text-foreground/70 hidden sm:block max-w-[120px] truncate">
                {user?.email?.split('@')[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-foreground/40" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-xs" onClick={() => navigate('/configuracion')}>
                <Settings className="h-3.5 w-3.5 mr-2" />
                Configuración
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-destructive" onClick={signOut}>
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
