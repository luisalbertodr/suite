
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SuperuserProtectedRoute } from './components/SuperuserProtectedRoute';
import { Layout } from './components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import ClientesPage from '@/pages/ClientesPage';
import ArticulosPage from '@/pages/ArticulosPage';
import PlanillasPage from '@/pages/PlanillasPage';
import FacturacionPage from '@/pages/FacturacionPage';
import TPVPage from '@/pages/TPVPage';
import AgendaPage from '@/pages/AgendaPage';
import DunasoftAgendaPage from '@/pages/DunasoftAgendaPage';
import GestionDocumentalPage from '@/pages/GestionDocumentalPage';
import ConfiguracionPage from '@/pages/ConfiguracionPage';
import RecursosCabinasPage from '@/pages/RecursosCabinasPage';
import AsistenciaPage from '@/pages/AsistenciaPage';
import MarketingPage from '@/pages/MarketingPage';
import WhatsappPage from '@/pages/WhatsappPage';
import TelefonoPage from '@/pages/TelefonoPage';
import DepositPaymentPage from '@/pages/DepositPaymentPage';
import SuperuserPage from '@/pages/SuperuserPage';
import SuperuserManagementPage from '@/pages/SuperuserManagementPage';
import ReportesPage from '@/pages/ReportesPage';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <Router
      future={{
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={
          <ProtectedLayout><Navigate to="/agenda" replace /></ProtectedLayout>
        } />
        <Route path="/inicio" element={
          <ProtectedLayout><DashboardPage /></ProtectedLayout>
        } />
        <Route path="/agenda" element={
          <ProtectedLayout><DunasoftAgendaPage /></ProtectedLayout>
        } />
        <Route path="/agenda-suite" element={
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
          <Navigate to="/facturacion?tab=proveedores" replace />
        } />
        <Route path="/gestion-documental" element={
          <ProtectedLayout><GestionDocumentalPage /></ProtectedLayout>
        } />
        <Route path="/reportes" element={
          <ProtectedLayout><ReportesPage /></ProtectedLayout>
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
        <Route path="/telefono" element={
          <ProtectedLayout><TelefonoPage /></ProtectedLayout>
        } />
        <Route path="/pago/:token/exito" element={<DepositPaymentPage />} />
        <Route path="/pago/:token" element={<DepositPaymentPage />} />
        <Route path="/superuser" element={<SuperuserPage />} />
        <Route path="/superuser-management" element={
          <SuperuserProtectedRoute>
            <SuperuserManagementPage />
          </SuperuserProtectedRoute>
        } />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/agenda" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
