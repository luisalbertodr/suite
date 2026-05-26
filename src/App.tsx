
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SuperuserProtectedRoute } from './components/SuperuserProtectedRoute';
import { Layout } from './components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import ClientesPage from '@/pages/ClientesPage';
import ArticulosPage from '@/pages/ArticulosPage';
import PlanillasPage from '@/pages/PlanillasPage';
import FacturacionPage from '@/pages/FacturacionPage';
import ProveedoresPage from '@/pages/ProveedoresPage';
import TPVPage from '@/pages/TPVPage';
import AgendaPage from '@/pages/AgendaPage';
import GestionDocumentalPage from '@/pages/GestionDocumentalPage';
import ConfiguracionPage from '@/pages/ConfiguracionPage';
import RecursosCabinasPage from '@/pages/RecursosCabinasPage';
import AsistenciaPage from '@/pages/AsistenciaPage';
import MarketingPage from '@/pages/MarketingPage';
import WhatsappPage from '@/pages/WhatsappPage';
import SuperuserPage from '@/pages/SuperuserPage';
import SuperuserManagementPage from '@/pages/SuperuserManagementPage';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* Default: redirect to Agenda */}
        <Route path="/" element={
          <ProtectedLayout><DashboardPage /></ProtectedLayout>
        } />
        <Route path="/agenda" element={
          <ProtectedLayout><AgendaPage /></ProtectedLayout>
        } />
        <Route path="/tpv" element={
          <ProtectedLayout><TPVPage /></ProtectedLayout>
        } />
        <Route path="/facturacion" element={
          <ProtectedLayout><FacturacionPage /></ProtectedLayout>
        } />
        <Route path="/clientes" element={
          <ProtectedLayout><ClientesPage /></ProtectedLayout>
        } />
        <Route path="/articulos" element={
          <ProtectedLayout><ArticulosPage /></ProtectedLayout>
        } />
        <Route path="/planillas" element={
          <ProtectedLayout><PlanillasPage /></ProtectedLayout>
        } />
        <Route path="/proveedores" element={
          <ProtectedLayout><ProveedoresPage /></ProtectedLayout>
        } />
        <Route path="/gestion-documental" element={
          <ProtectedLayout><GestionDocumentalPage /></ProtectedLayout>
        } />
        <Route path="/configuracion" element={
          <ProtectedLayout><ConfiguracionPage /></ProtectedLayout>
        } />
        <Route path="/recursos-cabinas" element={
          <ProtectedLayout><RecursosCabinasPage /></ProtectedLayout>
        } />
        <Route path="/asistencia" element={
          <ProtectedLayout><AsistenciaPage /></ProtectedLayout>
        } />
        <Route path="/marketing" element={
          <ProtectedLayout><MarketingPage /></ProtectedLayout>
        } />
        <Route path="/whatsapp" element={
          <ProtectedLayout><WhatsappPage /></ProtectedLayout>
        } />
        <Route path="/superuser" element={<SuperuserPage />} />
        <Route path="/superuser-management" element={
          <SuperuserProtectedRoute>
            <SuperuserManagementPage />
          </SuperuserProtectedRoute>
        } />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
