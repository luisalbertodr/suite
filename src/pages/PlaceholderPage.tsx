
import React from 'react';
import { Layout } from '../components/Layout';
import { useLocation } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const PlaceholderPage: React.FC = () => {
  const location = useLocation();
  const moduleName = location.pathname.replace('/', '').charAt(0).toUpperCase() + location.pathname.replace('/', '').slice(1);

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-6">
          <Construction className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Módulo {moduleName}
        </h1>
        <p className="text-gray-600 mb-8 max-w-md">
          Este módulo está en desarrollo. Pronto estará disponible con todas las funcionalidades del sistema MOGES.
        </p>
        <Link
          to="/"
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Dashboard</span>
        </Link>
      </div>
    </Layout>
  );
};

export default PlaceholderPage;
