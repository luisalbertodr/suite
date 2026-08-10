import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, Settings, ChevronDown, Moon, Sun, LayoutDashboard } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenterBranding } from '@/hooks/useWorkCenterBranding';
import { useBillingScopeRoute } from '@/hooks/useBillingScopeRoute';
import { BillingScopeToggle } from '@/components/BillingScopeToggle';
import { useTopBarContent } from './TopBarContentContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

const ROUTE_TITLES: Record<string, string> = {
  '/inicio': 'Inicio',
  '/agenda': 'Agenda',
  '/agenda-suite': 'Agenda Suite',
  '/tpv': 'TPV',
  '/facturacion': 'Facturación',
  '/clientes': 'Clientes',
  '/articulos': 'Artículos',
  '/planillas': 'Planillas',
  '/gestion-documental': 'Gestión Documental',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
  '/recursos-cabinas': 'Recursos y Cabinas',
  '/asistencia': 'Fichaje',
  '/marketing': 'Marketing',
  '/whatsapp': 'WhatsApp',
  '/telefono': 'Teléfono',
};

/** Por debajo de esto se oculta el título de pestaña para dar sitio al centro. */
const HIDE_TITLE_MAX_PX = 920;

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const canSeeDashboard = permissionsLoading || hasPermission('dashboard', 'read');
  const canSeeSettings = permissionsLoading || hasPermission('settings', 'read');
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { loading: companyLoading } = useCompanyFilter();
  const { displayName, logoUrlLight, logoUrlDark, isLoading: brandingLoading } = useWorkCenterBranding();
  const { enabled: billingScopeEnabled } = useBillingScopeRoute();
  const { content } = useTopBarContent();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [hideRouteTitle, setHideRouteTitle] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const check = () => setHideRouteTitle(window.innerWidth < HIDE_TITLE_MAX_PX);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const goToAgendaNow = () => {
    const ymd = format(new Date(), 'yyyy-MM-dd');
    navigate(`/agenda?date=${ymd}&now=1`);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const activeTheme = resolvedTheme ?? theme;
  const logoUrl = activeTheme === 'dark' ? (logoUrlDark || logoUrlLight) : logoUrlLight;

  const brandLabel = displayName.trim() || 'Lipoout';
  const routeTitle = content.title ?? ROUTE_TITLES[pathname] ?? '';
  const showBrandSkeleton = (companyLoading || brandingLoading) && !displayName;
  // Solo en pestañas donde M|E filtra de verdad (no deshabilitado en agenda/etc.).
  const showBillingToggle = billingScopeEnabled;

  const timeLabel = currentDateTime.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateLabel = currentDateTime.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-2 sm:gap-3 sm:px-5">
        <div className="flex items-center gap-2.5 min-w-0">
          {showBrandSkeleton ? (
            <span className="h-6 w-32 rounded bg-muted animate-pulse" aria-hidden />
          ) : (
            <>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-10 w-auto max-w-[220px] shrink-0 self-end object-contain object-center"
                />
              )}
              {!logoUrl && (
                <span className="text-sm font-semibold text-foreground truncate">{brandLabel}</span>
              )}
            </>
          )}
          {routeTitle && !hideRouteTitle && (
            <>
              <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
              <span className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base">
                {routeTitle}
              </span>
            </>
          )}
        </div>

        <div className="flex min-w-0 max-w-full items-center justify-center overflow-hidden">
          {content.actions && (
            <div className="flex min-w-0 max-w-full items-center justify-center gap-1.5 whitespace-nowrap">
              {content.actions}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0">
          {showBillingToggle && <BillingScopeToggle />}

          <button
            type="button"
            onClick={toggleTheme}
            className="relative p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-foreground/60" />
            )}
          </button>

          <NotificationBell />

          <button
            type="button"
            onClick={goToAgendaNow}
            title="Ir a la agenda en la fecha y hora actuales"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground/80 hover:bg-muted hover:text-foreground transition-colors tabular-nums"
          >
            <span className="font-semibold">{timeLabel}</span>
            <span className="text-foreground/50" aria-hidden>
              ·
            </span>
            <span className="font-medium capitalize">{dateLabel}</span>
          </button>

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
              {canSeeDashboard ? (
                <DropdownMenuItem className="text-xs" onClick={() => navigate('/inicio')}>
                  <LayoutDashboard className="h-3.5 w-3.5 mr-2" />
                  Dashboard
                </DropdownMenuItem>
              ) : null}
              {canSeeSettings ? (
                <DropdownMenuItem className="text-xs" onClick={() => navigate('/configuracion')}>
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  Configuración
                </DropdownMenuItem>
              ) : null}
              {(canSeeDashboard || canSeeSettings) ? <DropdownMenuSeparator /> : null}
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
