
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { waitForAuthBootstrap, markAuthReady, resetAuthReadyBarrier } from '@/lib/authSession';

const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH === '1') {
    console.log(...args);
  }
};

const debugError = (...args: unknown[]) => {
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH === '1') {
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
  const superuserCheckScheduled = useRef(false);

  const checkSuperuserStatus = () => {
    const superuserSession = localStorage.getItem('superuser_session');
    const loginTime = localStorage.getItem('superuser_login_time');

    if (superuserSession === 'true' && loginTime) {
      const timeDiff = Date.now() - parseInt(loginTime);
      const hours = timeDiff / (1000 * 60 * 60);

      if (hours < 24) {
        setIsSuperuser(true);
        return true;
      }

      localStorage.removeItem('superuser_session');
      localStorage.removeItem('superuser_login_time');
      localStorage.removeItem('superuser_data');
      setIsSuperuser(false);
    }
    return false;
  };

  const detectSupabaseSuperuser = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('current_user_is_superuser');
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === '42883' || code === 'PGRST202') return false;
        debugError('current_user_is_superuser error:', error);
        return false;
      }
      if (data === true) {
        debugLog('Supabase Auth user detectado como superuser por email');
        setIsSuperuser(true);
        localStorage.setItem('superuser_session', 'true');
        localStorage.setItem('superuser_login_time', Date.now().toString());
        return true;
      }
      return false;
    } catch (e) {
      debugError('detectSupabaseSuperuser failed:', e);
      return false;
    }
  };

  const scheduleSuperuserCheck = () => {
    if (superuserCheckScheduled.current) return;
    superuserCheckScheduled.current = true;
    void waitForAuthBootstrap().then(async () => {
      superuserCheckScheduled.current = false;
      if (!checkSuperuserStatus()) {
        await detectSupabaseSuperuser();
      }
    });
  };

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
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signOut = async () => {
    debugLog('Auth signOut called');

    localStorage.removeItem('superuser_session');
    localStorage.removeItem('superuser_login_time');
    localStorage.removeItem('superuser_data');
    setIsSuperuser(false);

    sessionStorage.removeItem('current_company_id');
    sessionStorage.removeItem('current_user_id');

    await supabase.auth.signOut();
  };

  useEffect(() => {
    checkSuperuserStatus();

    let cancelled = false;

    const applySession = (nextSession: Session | null) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      debugLog('Auth state changed:', event, nextSession?.user?.email);

      // El cliente Supabase ya gestiona el token; re-renderizar aquí provoca
      // bucle de refrescos (refresh_token_not_found / 400) en useCompanyFilter.
      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('current_company_id');
        sessionStorage.removeItem('current_user_id');
        setIsSuperuser(false);
        resetAuthReadyBarrier();
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (nextSession?.user) {
          const currentUserId = sessionStorage.getItem('current_user_id');
          if (currentUserId && currentUserId !== nextSession.user.id) {
            sessionStorage.removeItem('current_company_id');
          }
          sessionStorage.setItem('current_user_id', nextSession.user.id);
          scheduleSuperuserCheck();
        }
        markAuthReady();
      }

      if (!cancelled) {
        applySession(nextSession);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    loading,
    isSuperuser,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
