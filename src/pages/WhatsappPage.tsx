import React, { useRef } from 'react';
import { Whatsapp } from '@/components/whatsapp/Whatsapp';
import { WhatsappAccessGate } from '@/components/WhatsappAccessGate';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

/**
 * Gate de empresa que no desmonta WhatsApp en recargas de company filter
 * (el PageWrapper genérico sustituye children por un spinner y pierde el chat).
 */
const WhatsappCompanyGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companyId, loading } = useCompanyFilter();
  const { user, isSuperuser, signOut } = useAuth();
  const hadCompanyRef = useRef(false);
  if (companyId) hadCompanyRef.current = true;

  if (loading && !hadCompanyRef.current) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-2">Cargando información de la empresa...</span>
      </div>
    );
  }

  if (!companyId && !hadCompanyRef.current) {
    const needsLogin = !user && !isSuperuser;
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center max-w-md px-4">
          <h2 className="text-xl font-semibold text-gray-700">
            {needsLogin ? 'Inicia sesión para continuar' : 'No se encontró información de empresa'}
          </h2>
          <p className="text-gray-500 mt-2">
            {needsLogin
              ? 'Tu sesión en suite.lipoout.com no está activa. Entra con tu usuario de Suite.'
              : 'La sesión puede haber caducado o tu usuario no tiene empresa asignada. Cierra sesión y vuelve a entrar.'}
          </p>
          {!needsLogin && (
            <Button className="mt-4" variant="outline" onClick={() => void signOut()}>
              Cerrar sesión
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const WhatsappPage: React.FC = () => {
  return (
    <WhatsappCompanyGate>
      <WhatsappAccessGate>
        <div className="-mx-4 flex suite-h-whatsapp min-h-[480px] w-[calc(100%+2rem)] min-w-0 flex-col overflow-hidden sm:-mx-6 sm:w-[calc(100%+3rem)]">
          <Whatsapp />
        </div>
      </WhatsappAccessGate>
    </WhatsappCompanyGate>
  );
};

export default WhatsappPage;
