import React from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, ShoppingBag, Receipt, Users, Package, Settings, MapPin, Megaphone, MessageCircle, Phone } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useWhatsappUnread } from '@/hooks/useWhatsappUnread';
import { useMarketingUnread } from '@/hooks/useMarketingUnread';
import { usePhoneMissedCalls } from '@/hooks/usePhoneMissedCalls';
import { canAccessPhone } from '@/lib/phonePermissions';
import { useNotificationSoundOnIncrease } from '@/hooks/useNotificationSoundOnIncrease';
import { usePrefetchDockPanel } from '@/contexts/DockKeepAliveContext';
import { matchDockRoute } from '@/lib/dockRoutes';
import { DOCK_BAR_Z } from '@/lib/dialogLayers';
/** Por encima de modales para poder cambiar de pestaña con popups abiertos. */
const DOCK_Z_CLASS = DOCK_BAR_Z;

type DockItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  permission?: { resource: string; action: string };
  phoneAccess?: boolean;
};

const dockItems: DockItem[] = [
  { label: 'Inicio', path: '/inicio', icon: Home, color: 'text-red-500', permission: { resource: 'dashboard', action: 'read' } },
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
  { label: 'Fichaje', path: '/asistencia', icon: MapPin, color: 'text-emerald-500', permission: { resource: 'attendance', action: 'read' } },
  { label: 'Configuración', path: '/configuracion', icon: Settings, color: 'text-gray-500', permission: { resource: 'settings', action: 'read' } },
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

export const DockBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const canSeeMarketing = hasPermission('marketing', 'read');
  const canSeeWhatsapp = hasPermission('whatsapp', 'read') || canSeeMarketing;
  const { total: whatsappUnread } = useWhatsappUnread();
  const { total: marketingUnread } = useMarketingUnread();
  const { missedUnread } = usePhoneMissedCalls();
  const prefetchDockPanel = usePrefetchDockPanel();
  useNotificationSoundOnIncrease(whatsappUnread, 'whatsapp', { enabled: canSeeWhatsapp });

  const visibleItems = dockItems.filter((item) => {
    if (permissionsLoading) return true;
    if (item.path === '/marketing') return canSeeMarketing;
    if (item.phoneAccess) return canAccessPhone(hasPermission);
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 ${DOCK_Z_CLASS} pointer-events-auto`} data-suite-dock-bar>
      <div className="flex items-end gap-1 px-3 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-2xl shadow-black/10">
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
                // Navegar en pointerdown evita perder el clic si un input (TPV, WhatsApp…) tiene el foco.
                e.preventDefault();
                goTo();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  goTo();
                }
              }}
              className={`
                group relative flex cursor-pointer flex-col items-center justify-center
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
                {(() => {
                  const badge = badgeForItem(item.path);
                  if (badge <= 0) return null;
                  return (
                    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white dark:ring-gray-900">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  );
                })()}
              </div>
              {isActive && (
                <div className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
};
