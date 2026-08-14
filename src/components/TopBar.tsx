import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, Settings, ChevronDown, Moon, Sun } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import {
  TopBarCustomerLookup,
  topBarShowsCustomerLookup,
} from '@/components/TopBarCustomerLookup';

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
/** En pantallas anchas nunca apilar: el falso positivo venía de medir mal el centro. */
const NEVER_STACK_MIN_PX = 1200;
/** Por debajo de esto, fecha arriba y hora debajo en el chip de ahora. */
const STACK_DATETIME_MAX_PX = 1100;
const TOPBAR_SINGLE_H = '3rem';
const TOPBAR_DOUBLE_H = '6rem';

function setTopbarHeightVar(stacked: boolean) {
  document.documentElement.style.setProperty(
    '--suite-topbar-h',
    stacked ? TOPBAR_DOUBLE_H : TOPBAR_SINGLE_H,
  );
}

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const canSeeSettings = permissionsLoading || hasPermission('settings', 'read');
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { loading: companyLoading } = useCompanyFilter();
  const { displayName, logoUrlLight, logoUrlDark, isLoading: brandingLoading } = useWorkCenterBranding();
  const { enabled: billingScopeEnabled } = useBillingScopeRoute();
  const { content } = useTopBarContent();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [hideRouteTitle, setHideRouteTitle] = useState(false);
  const [stackDateTime, setStackDateTime] = useState(false);
  const [stacked, setStacked] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const stackedRef = useRef(stacked);
  stackedRef.current = stacked;

  const showCustomerLookup = topBarShowsCustomerLookup(pathname);
  const hasCenterActions = Boolean(content.actions) || showCustomerLookup;

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setHideRouteTitle(w < HIDE_TITLE_MAX_PX);
      setStackDateTime(w < STACK_DATETIME_MAX_PX);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useLayoutEffect(() => {
    const applyStacked = (next: boolean) => {
      if (stackedRef.current === next) {
        setTopbarHeightVar(next);
        return;
      }
      setStacked(next);
      setTopbarHeightVar(next);
    };

    const measure = () => {
      const header = headerRef.current;
      const actions = actionsRef.current;
      if (!header || !hasCenterActions || !actions) {
        applyStacked(false);
        return;
      }

      const width = header.clientWidth;
      // Pantalla completa / ancha: una sola fila siempre.
      if (width >= NEVER_STACK_MIN_PX) {
        applyStacked(false);
        return;
      }

      // Grid 3 columnas iguales → el centro dispone de ~1/3 del ancho.
      const centerBudget = width / 3 - 16;
      const needed = actions.scrollWidth;

      if (stackedRef.current) {
        if (needed <= centerBudget - 20) applyStacked(false);
      } else if (needed > centerBudget + 8) {
        applyStacked(true);
      }
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    if (headerRef.current) ro.observe(headerRef.current);
    if (actionsRef.current) ro.observe(actionsRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [content.actions, hideRouteTitle, billingScopeEnabled, showCustomerLookup, hasCenterActions, stacked]);

  useEffect(() => () => setTopbarHeightVar(false), []);

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

  const brandBlock = showBrandSkeleton ? (
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
  );

  const titleBlock =
    routeTitle && !hideRouteTitle ? (
      <>
        <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
        <span className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base">
          {routeTitle}
        </span>
      </>
    ) : null;

  const rightControls = (
    <>
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
        className={cn(
          'inline-flex rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground/80 hover:bg-muted hover:text-foreground transition-colors tabular-nums',
          stackDateTime
            ? 'flex-col items-end gap-0 leading-tight'
            : 'items-center gap-1.5',
        )}
      >
        {stackDateTime ? (
          <>
            <span className="font-medium capitalize">{dateLabel}</span>
            <span className="font-semibold">{timeLabel}</span>
          </>
        ) : (
          <>
            <span className="font-semibold">{timeLabel}</span>
            <span className="text-foreground/50" aria-hidden>
              ·
            </span>
            <span className="font-medium capitalize">{dateLabel}</span>
          </>
        )}
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
          {canSeeSettings ? (
            <DropdownMenuItem className="text-xs" onClick={() => navigate('/configuracion')}>
              <Settings className="h-3.5 w-3.5 mr-2" />
              Configuración
            </DropdownMenuItem>
          ) : null}
          {canSeeSettings ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem className="text-xs text-destructive" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  const actionsNode = hasCenterActions ? (
    <div
      ref={actionsRef}
      className="flex min-w-0 max-w-full flex-nowrap items-center justify-center gap-1.5"
    >
      {showCustomerLookup ? <TopBarCustomerLookup /> : null}
      {content.actions}
    </div>
  ) : null;

  return (
    <header
      ref={headerRef}
      className={cn(
        'fixed top-0 left-0 right-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        stacked ? 'h-24' : 'h-12',
      )}
    >
      {stacked ? (
        <div className="flex h-full flex-col">
          <div className="flex h-12 items-center justify-between gap-2 px-2 sm:gap-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              {brandBlock}
              {titleBlock}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">{rightControls}</div>
          </div>
          <div className="flex h-12 min-w-0 items-center justify-center border-t border-border/50 px-2 sm:px-5">
            {actionsNode}
          </div>
        </div>
      ) : (
        <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-2 sm:gap-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {brandBlock}
            {titleBlock}
          </div>

          <div className="flex min-w-0 max-w-full items-center justify-center overflow-hidden">
            {actionsNode}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">{rightControls}</div>
        </div>
      )}
    </header>
  );
};
