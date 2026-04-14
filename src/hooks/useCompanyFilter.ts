
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
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

const debugWarn = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};

export const useCompanyFilter = () => {
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const setupInProgressForUser = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    const setupKey = authLoading ? null : (userId ?? '__anonymous__');

    if (setupKey && setupInProgressForUser.current === setupKey) {
      return;
    }

    if (setupKey) {
      setupInProgressForUser.current = setupKey;
    }

    let cancelled = false;

    const setupCompanyFilter = async () => {
      debugLog('=== setupCompanyFilter START ===');
      debugLog('Auth loading:', authLoading);
      debugLog('Current user:', user?.id, user?.email);
      
      // Si auth está cargando, esperar
      if (authLoading) {
        debugLog('⏳ Auth still loading, waiting...');
        return;
      }

      // Si no hay usuario, limpiar y finalizar
      if (!user) {
        debugLog('❌ No authenticated user, clearing company filter');
        if (cancelled) return;
        setCompanyId(null);
        sessionStorage.removeItem('current_company_id');
        sessionStorage.removeItem('current_user_id');
        setLoading(false);
        return;
      }

      try {
        debugLog('🔄 Setting up company filter for user:', user.id, user.email);
        
        // Verificar si el company_id cacheado corresponde al usuario actual
        const cachedCompanyId = sessionStorage.getItem('current_company_id');
        const cachedUserId = sessionStorage.getItem('current_user_id');
        
        if (cachedCompanyId && cachedUserId === user.id) {
          debugLog('✅ Using cached company ID for current user:', cachedCompanyId);
          if (cancelled) return;
          setCompanyId(cachedCompanyId);
          setLoading(false);
          return;
        } else if (cachedCompanyId && cachedUserId !== user.id) {
          debugLog('🔄 Cached company ID belongs to different user, clearing cache');
          sessionStorage.removeItem('current_company_id');
        }

        debugLog('🔍 Fetching user profile from database...');
        // Get user's company ID from user_profiles
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();

        debugLog('📋 Profile query result:', {
          profile, 
          error,
          user_id: user.id,
          user_email: user.email 
        });

        if (error && error.code !== 'PGRST116') {
          debugError('❌ Error fetching user profile:', error);
          
          // If no profile exists, let's check if there are any profiles for this user
          const { data: allProfiles, error: allProfilesError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id);
            
          debugLog('🔍 All profiles for user:', { allProfiles, allProfilesError });
          
          // Also let's check what companies exist
          const { data: companies, error: companiesError } = await supabase
            .from('companies')
            .select('id, name');
            
          debugLog('🏢 Available companies:', { companies, companiesError });
          
          // Check if RLS policies are working
          debugLog('🔐 Testing RLS - calling get_user_company_id function');
          const { data: funcResult, error: funcError } = await supabase
            .rpc('get_user_company_id');
          debugLog('🔐 get_user_company_id result:', { funcResult, funcError });
          
          // If RLS function works, use that result
          if (funcResult && !funcError) {
            debugLog('✅ Using company ID from RLS function:', funcResult);
            if (cancelled) return;
            setCompanyId(funcResult);
            sessionStorage.setItem('current_company_id', funcResult);
            sessionStorage.setItem('current_user_id', user.id);
            setLoading(false);
            return;
          }
          
          if (cancelled) return;
          setCompanyId(null);
          setLoading(false);
        } else if (profile?.company_id) {
          debugLog('✅ Company filter set for company:', profile.company_id);
          if (cancelled) return;
          setCompanyId(profile.company_id);
          
          // Store in session storage with user tracking
          sessionStorage.setItem('current_company_id', profile.company_id);
          sessionStorage.setItem('current_user_id', user.id);
          setLoading(false);
        } else {
          debugWarn('⚠️ No company_id found for user profile:', profile);
          
          // Try the RLS function as fallback
          debugLog('🔐 Trying RLS function as fallback');
          const { data: funcResult, error: funcError } = await supabase
            .rpc('get_user_company_id');
          debugLog('🔐 Fallback get_user_company_id result:', { funcResult, funcError });
          
          if (funcResult && !funcError) {
            debugLog('✅ Using fallback company ID from RLS function:', funcResult);
            if (cancelled) return;
            setCompanyId(funcResult);
            sessionStorage.setItem('current_company_id', funcResult);
            sessionStorage.setItem('current_user_id', user.id);
          } else {
            if (cancelled) return;
            setCompanyId(null);
          }
          if (cancelled) return;
          setLoading(false);
        }
      } catch (error) {
        debugError('❌ Error setting up company filter:', error);
        
        // Last resort: try the RLS function
        try {
          debugLog('🔐 Last resort: trying RLS function');
          const { data: funcResult, error: funcError } = await supabase
            .rpc('get_user_company_id');
          debugLog('🔐 Last resort get_user_company_id result:', { funcResult, funcError });
          
          if (funcResult && !funcError) {
            debugLog('✅ Using last resort company ID from RLS function:', funcResult);
            if (cancelled) return;
            setCompanyId(funcResult);
            sessionStorage.setItem('current_company_id', funcResult);
            sessionStorage.setItem('current_user_id', user.id);
          } else {
            if (cancelled) return;
            setCompanyId(null);
          }
        } catch (finalError) {
          debugError('❌ Final error in company filter setup:', finalError);
          if (cancelled) return;
          setCompanyId(null);
        }
        if (cancelled) return;
        setLoading(false);
      }
      
      debugLog('=== setupCompanyFilter END ===');
    };

    setupCompanyFilter();

    return () => {
      cancelled = true;
      if (setupKey && setupInProgressForUser.current === setupKey) {
        setupInProgressForUser.current = null;
      }
    };
  }, [user, authLoading]);

  // Log company filter state changes
  useEffect(() => {
    debugLog('🏢 Company filter state changed:', {
      companyId,
      loading: authLoading || loading,
      user: user?.email,
      userId: user?.id
    });
  }, [companyId, authLoading, loading, user?.email, user?.id]);

  return { companyId, loading: authLoading || loading };
};
