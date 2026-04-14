
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

const debugError = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSuperuser: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperuser, setIsSuperuser] = useState(false);

  // Función para verificar si es superusuario
  const checkSuperuserStatus = () => {
    const superuserSession = localStorage.getItem('superuser_session');
    const loginTime = localStorage.getItem('superuser_login_time');
    
    if (superuserSession === 'true' && loginTime) {
      const timeDiff = Date.now() - parseInt(loginTime);
      const hours = timeDiff / (1000 * 60 * 60);
      
      // Sesión válida por 24 horas
      if (hours < 24) {
        setIsSuperuser(true);
        return true;
      } else {
        // Limpiar sesión expirada
        localStorage.removeItem('superuser_session');
        localStorage.removeItem('superuser_login_time');
        localStorage.removeItem('superuser_data');
        setIsSuperuser(false);
      }
    }
    return false;
  };

  // Auth methods
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    debugLog('🚪 Auth signOut called - clearing all session data');
    
    // Clear superuser session if exists
    localStorage.removeItem('superuser_session');
    localStorage.removeItem('superuser_login_time');
    localStorage.removeItem('superuser_data');
    setIsSuperuser(false);
    
    // IMPORTANT: Clear company session data
    sessionStorage.removeItem('current_company_id');
    sessionStorage.removeItem('current_user_id');
    debugLog('🧹 Cleared company and user session data');
    
    await supabase.auth.signOut();
  };

  useEffect(() => {
    // Verificar estado de superusuario al inicializar
    checkSuperuserStatus();

    // Configurar listener para auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog('🔐 Auth state changed:', event, session?.user?.email);
        
        // Si el usuario cambió, limpiar datos de empresa cacheados
        if (event === 'SIGNED_IN' && session?.user) {
          const currentUserId = sessionStorage.getItem('current_user_id');
          if (currentUserId && currentUserId !== session.user.id) {
            debugLog('🔄 Different user detected, clearing company cache');
            sessionStorage.removeItem('current_company_id');
          }
          // Guardar el ID del usuario actual
          sessionStorage.setItem('current_user_id', session.user.id);
        }
        
        // Si se desloguea, limpiar todo
        if (event === 'SIGNED_OUT') {
          debugLog('🚪 User signed out, clearing all cached data');
          sessionStorage.removeItem('current_company_id');
          sessionStorage.removeItem('current_user_id');
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          debugError('Error getting session:', error);
        } else {
          debugLog('🔍 Initial session check:', session?.user?.email || 'No user');
          setSession(session);
          setUser(session?.user ?? null);
          
          // Si hay sesión, verificar consistencia del usuario cacheado
          if (session?.user) {
            const currentUserId = sessionStorage.getItem('current_user_id');
            if (currentUserId && currentUserId !== session.user.id) {
              debugLog('🔄 Initial check: Different user detected, clearing company cache');
              sessionStorage.removeItem('current_company_id');
            }
            sessionStorage.setItem('current_user_id', session.user.id);
          }
        }
      } catch (error) {
        debugError('Error in getInitialSession:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listener para cambios en localStorage (para superusuario)
    const handleStorageChange = () => {
      checkSuperuserStatus();
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const value = {
    user,
    session,
    loading,
    isSuperuser,
    signIn,
    signUp,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
