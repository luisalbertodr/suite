import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, ShoppingBag, Receipt, Users, Package, Building2, Settings, MapPin, Megaphone, MessageCircle } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useWhatsappUnread } from '@/hooks/useWhatsappUnread';
import { useMarketingUnread } from '@/hooks/useMarketingUnread';
import { useNotificationSoundOnIncrease } from '@/hooks/useNotificationSoundOnIncrease';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

const dockItems = [
  { label: 'Inicio', path: '/', icon: Home, color: 'text-red-500', permission: { resource: 'dashboard', action: 'read' } },
  { label: 'Agenda', path: '/agenda', icon: Calendar, color: 'text-blue-500', permission: { resource: 'agenda', action: 'read' } },
  { label: 'TPV', path: '/tpv', icon: ShoppingBag, color: 'text-green-500', permission: { resource: 'sales', action: 'read' } },
  { label: 'Facturación', path: '/facturacion', icon: Receipt, color: 'text-amber-500', permission: { resource: 'invoices', action: 'read' } },
  { label: 'Clientes', path: '/clientes', icon: Users, color: 'text-pink-500', permission: { resource: 'customers', action: 'read' } },
  { label: 'Artículos', path: '/articulos', icon: Package, color: 'text-purple-500', permission: { resource: 'articles', action: 'read' } },
  { label: 'Proveedores', path: '/proveedores', icon: Building2, color: 'text-teal-500', permission: { resource: 'suppliers', action: 'read' } },
  { label: 'Marketing', path: '/marketing', icon: Megaphone, color: 'text-rose-500', permission: { resource: 'marketing', action: 'read' } },
  { label: 'WhatsApp', path: '/whatsapp', icon: MessageCircle, color: 'text-emerald-600', permission: { resource: 'whatsapp', action: 'read' } },
  { label: 'Fichaje', path: '/asistencia', icon: MapPin, color: 'text-emerald-500', permission: { resource: 'attendance', action: 'read' } },
  { label: 'Configuración', path: '/configuracion', icon: Settings, color: 'text-gray-500', permission: { resource: 'settings', action: 'read' } },
];

export const DockBar: React.FC = () => {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const canSeeWhatsapp = hasPermission('whatsapp', 'read');
  const canSeeMarketing = hasPermission('marketing', 'read');
  const { total: whatsappUnread } = useWhatsappUnread();
  const { total: marketingUnread } = useMarketingUnread();
  useNotificationSoundOnIncrease(whatsappUnread, 'whatsapp', { enabled: canSeeWhatsapp });

  const visibleItems = dockItems.filter(item =>
    hasPermission(item.permission.resource, item.permission.action)
  );

  const badgeForItem = (path: string): number => {
    if (path === '/whatsapp' && canSeeWhatsapp) return whatsappUnread;
    if (path === '/marketing' && canSeeMarketing) return marketingUnread;
    return 0;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-end gap-1 px-3 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-2xl shadow-black/10">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === '/facturacion' && ['/facturacion', '/facturas', '/presupuestos', '/presupuestos-n', '/albaranes-entrada', '/albaranes-salida'].includes(location.pathname));
            
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    className={`
                      group relative flex flex-col items-center justify-center
                      w-14 h-14 rounded-xl
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
                    {/* Active indicator dot */}
                    {isActive && (
                      <div className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};
