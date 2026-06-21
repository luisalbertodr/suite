import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PersistentDockRoutes } from '@/components/PersistentDockRoutes';
import { matchDockRoute } from '@/lib/dockRoutes';
import AgendaPage from '@/pages/AgendaPage';
import PlanillasPage from '@/pages/PlanillasPage';
import GestionDocumentalPage from '@/pages/GestionDocumentalPage';
import ReportesPage from '@/pages/ReportesPage';
import RecursosCabinasPage from '@/pages/RecursosCabinasPage';

/** Contenido principal: dock con keep-alive o rutas puntuales fuera del dock. */
export const SuiteMainContent: React.FC = () => {
  const { pathname } = useLocation();

  if (pathname === '/' || pathname === '') {
    return <Navigate to="/agenda" replace />;
  }

  if (pathname === '/wasui') {
    return <Navigate to="/whatsapp" replace />;
  }

  const dockKey = matchDockRoute(pathname);
  if (dockKey) {
    return <PersistentDockRoutes />;
  }

  switch (pathname) {
    case '/agenda-suite':
      return <AgendaPage />;
    case '/planillas':
      return <PlanillasPage />;
    case '/gestion-documental':
      return <GestionDocumentalPage />;
    case '/reportes':
      return <ReportesPage />;
    case '/recursos-cabinas':
      return <RecursosCabinasPage />;
    case '/proveedores':
      return <Navigate to="/facturacion?tab=proveedores" replace />;
    default:
      return <Navigate to="/agenda" replace />;
  }
};
