import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Receipt,
  Users,
  Package,
  Megaphone,
  MessageCircle,
  Phone,
  LayoutDashboard,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useWhatsappUnread } from '@/hooks/useWhatsappUnread';
import { useMarketingUnread } from '@/hooks/useMarketingUnread';
import { usePhoneMissedCalls } from '@/hooks/usePhoneMissedCalls';
import { canAccessPhone } from '@/lib/phonePermissions';
import { canAccessDashboard } from '@/lib/menuPermissions';
import { useNotificationSoundOnIncrease } from '@/hooks/useNotificationSoundOnIncrease';
import { usePrefetchDockPanel } from '@/contexts/DockKeepAliveContext';
import { matchDockRoute } from '@/lib/dockRoutes';
import { DOCK_BAR_Z } from '@/lib/dialogLayers';
import { useDockCollapsed } from '@/hooks/useDockCollapsed';
/** Por encima de modales para poder cambiar de pestaña con popups abiertos. */
const DOCK_Z_CLASS = DOCK_BAR_Z;

type DockItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  permission?: { resource: string; action: string };
  phoneAccess?: boolean;
  dashboardAccess?: boolean;
};

const dockItems: DockItem[] = [
  { label: 'Agenda', path: '/agenda', icon: Calendar, color: 'text-blue-500', permission: { resource: 'agenda', action: 'read' } },
  { label: 'TPV', path: '/tpv', icon: ShoppingBag, color: 'text-green-500', permission: { resource: 'sales', action: 'read' } },
  { label: 'Facturación', path: '/facturacion', icon: Receipt, color: 'text-amber-500', permission: { resource: 'invoices', action: 'read' } },
  { label: 'Clientes', path: '/clientes', icon: Users, color: 'text-pink-500', permission: { resource: 'customers', action: 'read' } },
  { label: 'Artículos', path: '/articulos', icon: Package, color: 'text-purple-500', permission: { resource: 'articles', action: 'read' } },
  {
    label: 'Llamadas',
    path: '/telefono',
    icon: Phone,
    color: 'text-sky-500',
    phoneAccess: true,
  },
  { label: 'Marketing', path: '/marketing', icon: Megaphone, color: 'text-rose-500', permission: { resource: 'marketing', action: 'read' } },
  { label: 'WhatsApp', path: '/whatsapp', icon: MessageCircle, color: 'text-emerald-600', permission: { resource: 'whatsapp', action: 'read' } },
  { label: 'Dashboard', path: '/inicio', icon: LayoutDashboard, color: 'text-indigo-500', dashboardAccess: true },
];

const FACTURACION_PATHS = [
  '/facturacion',
  '/facturas',
  '/presupuestos',
  '/presupuestos-n',
  '/albaranes-entrada',
  '/albaranes-salida',
];

function isDockItemActive(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) return true;
  return itemPath === '/facturacion' && FACTURACION_PATHS.includes(pathname);
}

function DockBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white dark:ring-gray-900">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export const DockBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, setCollapsed } = useDockCollapsed();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const canSeeMarketing = hasPermission('marketing', 'read');
  const canSeeWhatsapp = hasPermission('whatsapp', 'read') || canSeeMarketing;
  const { total: whatsappUnread } = useWhatsappUnread();
  const { total: marketingUnread } = useMarketingUnread();
  const { missedUnread } = usePhoneMissedCalls();
  const prefetchDockPanel = usePrefetchDockPanel();
  const scrollRef = useRef<HTMLDivElement>(null);
  useNotificationSoundOnIncrease(whatsappUnread, 'whatsapp', { enabled: canSeeWhatsapp });

  const visibleItems = dockItems.filter((item) => {
    // No fall-open en Marketing/WhatsApp/Dashboard: evita flash de pestañas sin permiso.
    if (permissionsLoading) {
      if (item.path === '/marketing' || item.path === '/whatsapp' || item.path === '/inicio') {
        return false;
      }
      return true;
    }
    if (item.path === '/marketing') return canSeeMarketing;
    if (item.phoneAccess) return canAccessPhone(hasPermission);
    if (item.dashboardAccess) return canAccessDashboard(hasPermission);
    if (item.permission) {
      return hasPermission(item.permission.resource, item.permission.action);
    }
    return false;
  });

  const badgeForItem = (path: string): number => {
    if (path === '/whatsapp' && canSeeWhatsapp) return whatsappUnread;
    if (path === '/marketing' && canSeeMarketing) return marketingUnread;
    if (path === '/telefono') return missedUnread;
    return 0;
  };

  const pendingNotifications =
    (canSeeWhatsapp ? whatsappUnread : 0) +
    (canSeeMarketing ? marketingUnread : 0) +
    missedUnread;

  // Mantener el ítem activo visible al cambiar de ruta o al cargar en pantallas estrechas.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || collapsed) return;
    const active = root.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [location.pathname, visibleItems.length, collapsed]);

  if (typeof document === 'undefined') return null;

  const bottomStyle = { bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' } as const;

  if (collapsed) {
    return createPortal(
      <div
        className={`fixed left-0 ${DOCK_Z_CLASS} pointer-events-none`}
        data-suite-dock-bar
        data-collapsed="true"
        style={bottomStyle}
      >
        <button
          type="button"
          title="Mostrar barra de pestañas"
          aria-label={
            pendingNotifications > 0
              ? `Mostrar barra de pestañas, ${pendingNotifications} notificaciones pendientes`
              : 'Mostrar barra de pestañas'
          }
          onClick={() => setCollapsed(false)}
          className="
            pointer-events-auto relative flex h-12 w-8 items-center justify-center
            rounded-r-xl border border-l-0 border-white/20 bg-white/95 shadow-2xl shadow-black/10
            backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/95
          "
        >
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
          <DockBadge count={pendingNotifications} />
        </button>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className={`fixed left-0 right-0 flex justify-center px-2 ${DOCK_Z_CLASS} pointer-events-none`}
      data-suite-dock-bar
      style={bottomStyle}
    >
      <div
        ref={scrollRef}
        className="
          pointer-events-auto max-w-[calc(100vw-1rem)]
          overflow-x-auto overflow-y-visible overscroll-x-contain touch-pan-x
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
        "
      >
        <div className="flex w-max items-end gap-1 px-2 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-2xl shadow-black/10">
          <button
            type="button"
            title="Ocultar barra a la izquierda"
            aria-label="Ocultar barra de pestañas"
            onClick={() => setCollapsed(true)}
            className="
              group relative mb-1 flex shrink-0 cursor-pointer flex-col items-center justify-center
              h-12 w-8 rounded-xl border-0 bg-transparent p-0 text-muted-foreground
              transition-all duration-300 ease-out hover:bg-white/60 dark:hover:bg-gray-800/60
            "
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {visibleItems.map((item) => {
            const isActive = isDockItemActive(location.pathname, item.path);

            const dockKey = matchDockRoute(item.path);

            const goTo = () => {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              if (!isActive) navigate(item.path);
            };

            return (
              <button
                key={item.path}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onPointerEnter={() => {
                  if (dockKey) prefetchDockPanel(dockKey);
                }}
                onPointerDown={(e) => {
                  // En touch no capturar pointerdown: permite scroll horizontal del dock.
                  // En ratón sí: evita perder el clic si un input (TPV, WhatsApp…) tiene el foco.
                  if (e.pointerType === 'touch') return;
                  e.preventDefault();
                  goTo();
                }}
                onClick={() => {
                  // Tap táctil (y fallback) tras soltar sin haber hecho scroll cancelatorio.
                  goTo();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goTo();
                  }
                }}
                className={`
                  group relative flex shrink-0 cursor-pointer flex-col items-center justify-center
                  w-14 h-14 rounded-xl border-0 bg-transparent p-0
                  transition-all duration-300 ease-out
                  hover:scale-125 hover:-translate-y-2
                  active:scale-95
                  ${isActive ? 'scale-110 -translate-y-1' : ''}
                `}
              >
                <div className={`
                  relative flex items-center justify-center w-12 h-12 rounded-xl
                  transition-all duration-300
                  ${isActive
                    ? 'bg-white dark:bg-gray-800 shadow-lg shadow-black/10'
                    : 'hover:bg-white/60 dark:hover:bg-gray-800/60'
                  }
                `}>
                  <item.icon className={`h-6 w-6 transition-all duration-300 ${item.color} ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <DockBadge count={badgeForItem(item.path)} />
                </div>
                {isActive && (
                  <div className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};
