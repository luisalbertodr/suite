
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SuperuserProtectedRoute } from './components/SuperuserProtectedRoute';
import { Layout } from './components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import ClientesPage from '@/pages/ClientesPage';
import ArticulosPage from '@/pages/ArticulosPage';
import PlanillasPage from '@/pages/PlanillasPage';
import PresupuestosPage from '@/pages/PresupuestosPage';
import PresupuestosNPage from '@/pages/PresupuestosNPage';
import FacturasPage from '@/pages/FacturasPage';
import AlbaranesEntradaPage from '@/pages/AlbaranesEntradaPage';
import AlbaranesSalidaPage from '@/pages/AlbaranesSalidaPage';
import ProveedoresPage from '@/pages/ProveedoresPage';
import TPVPage from '@/pages/TPVPage';
import AgendaPage from '@/pages/AgendaPage';
import GestionDocumentalPage from '@/pages/GestionDocumentalPage';
import ReportesPage from '@/pages/ReportesPage';
import EmpresasPage from '@/pages/EmpresasPage';
import ConfiguracionPage from '@/pages/ConfiguracionPage';
import SuperuserPage from '@/pages/SuperuserPage';
import SuperuserManagementPage from '@/pages/SuperuserManagementPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/superuser" element={<SuperuserPage />} />
        <Route path="/superuser-management" element={
          <SuperuserProtectedRoute>
            <SuperuserManagementPage />
          </SuperuserProtectedRoute>
        } />
        <Route path="/clientes" element={
          <ProtectedRoute>
            <Layout>
              <ClientesPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/articulos" element={
          <ProtectedRoute>
            <Layout>
              <ArticulosPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/planillas" element={
          <ProtectedRoute>
            <Layout>
              <PlanillasPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/presupuestos" element={
          <ProtectedRoute>
            <Layout>
              <PresupuestosPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/presupuestos-n" element={
          <ProtectedRoute>
            <Layout>
              <PresupuestosNPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/facturas" element={
          <ProtectedRoute>
            <Layout>
              <FacturasPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/albaranes-entrada" element={
          <ProtectedRoute>
            <Layout>
              <AlbaranesEntradaPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/albaranes-salida" element={
          <ProtectedRoute>
            <Layout>
              <AlbaranesSalidaPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/proveedores" element={
          <ProtectedRoute>
            <Layout>
              <ProveedoresPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/tpv" element={
          <ProtectedRoute>
            <Layout>
              <TPVPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/agenda" element={
          <ProtectedRoute>
            <Layout>
              <AgendaPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/gestion-documental" element={
          <ProtectedRoute>
            <Layout>
              <GestionDocumentalPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/reportes" element={
          <ProtectedRoute>
            <Layout>
              <ReportesPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/empresas" element={
          <ProtectedRoute>
            <Layout>
              <EmpresasPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/configuracion" element={
          <ProtectedRoute>
            <Layout>
              <ConfiguracionPage />
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
