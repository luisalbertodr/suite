
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SuperuserProtectedRoute } from './components/SuperuserProtectedRoute';
import { Layout } from './components/Layout';
import { SuiteMainContent } from '@/components/SuiteMainContent';
import DepositPaymentPage from '@/pages/DepositPaymentPage';
import QuestionnaireKioskPage from '@/pages/QuestionnaireKioskPage';
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
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/pago/:token/exito" element={<DepositPaymentPage />} />
        <Route path="/pago/:token" element={<DepositPaymentPage />} />
        <Route path="/cuestionario/:questionnaireId/paciente" element={<QuestionnaireKioskPage />} />
        <Route path="/superuser" element={<SuperuserPage />} />
        <Route
          path="/superuser-management"
          element={
            <SuperuserProtectedRoute>
              <SuperuserManagementPage />
            </SuperuserProtectedRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedLayout>
              <SuiteMainContent />
            </ProtectedLayout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
