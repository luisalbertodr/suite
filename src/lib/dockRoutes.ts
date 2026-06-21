import type { ComponentType } from 'react';
import DashboardPage from '@/pages/DashboardPage';
import DunasoftAgendaPage from '@/pages/DunasoftAgendaPage';
import TPVPage from '@/pages/TPVPage';
import FacturacionPage from '@/pages/FacturacionPage';
import ClientesPage from '@/pages/ClientesPage';
import ArticulosPage from '@/pages/ArticulosPage';
import TelefonoPage from '@/pages/TelefonoPage';
import MarketingPage from '@/pages/MarketingPage';
import WhatsappPage from '@/pages/WhatsappPage';
import AsistenciaPage from '@/pages/AsistenciaPage';
import ConfiguracionPage from '@/pages/ConfiguracionPage';

export const FACTURACION_DOCK_PATHS = [
  '/facturacion',
  '/facturas',
  '/presupuestos',
  '/presupuestos-n',
  '/albaranes-entrada',
  '/albaranes-salida',
] as const;

export type DockRouteKey =
  | 'inicio'
  | 'agenda'
  | 'tpv'
  | 'facturacion'
  | 'clientes'
  | 'articulos'
  | 'telefono'
  | 'marketing'
  | 'whatsapp'
  | 'asistencia'
  | 'configuracion';

export type DockRouteDef = {
  key: DockRouteKey;
  match: (pathname: string) => boolean;
  Page: ComponentType;
};

export const DOCK_ROUTE_DEFS: DockRouteDef[] = [
  { key: 'inicio', match: (p) => p === '/inicio', Page: DashboardPage },
  { key: 'agenda', match: (p) => p === '/agenda', Page: DunasoftAgendaPage },
  { key: 'tpv', match: (p) => p === '/tpv', Page: TPVPage },
  {
    key: 'facturacion',
    match: (p) => FACTURACION_DOCK_PATHS.includes(p as (typeof FACTURACION_DOCK_PATHS)[number]),
    Page: FacturacionPage,
  },
  { key: 'clientes', match: (p) => p === '/clientes', Page: ClientesPage },
  { key: 'articulos', match: (p) => p === '/articulos', Page: ArticulosPage },
  { key: 'telefono', match: (p) => p === '/telefono', Page: TelefonoPage },
  { key: 'marketing', match: (p) => p === '/marketing', Page: MarketingPage },
  { key: 'whatsapp', match: (p) => p === '/whatsapp', Page: WhatsappPage },
  { key: 'asistencia', match: (p) => p === '/asistencia', Page: AsistenciaPage },
  { key: 'configuracion', match: (p) => p === '/configuracion', Page: ConfiguracionPage },
];

export function matchDockRoute(pathname: string): DockRouteKey | null {
  for (const def of DOCK_ROUTE_DEFS) {
    if (def.match(pathname)) return def.key;
  }
  return null;
}
