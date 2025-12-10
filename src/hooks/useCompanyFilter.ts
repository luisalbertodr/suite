
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useCompanyFilter = () => {
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupCompanyFilter = async () => {
      console.log('=== setupCompanyFilter START ===');
      console.log('Auth loading:', authLoading);
      console.log('Current user:', user?.id, user?.email);
      
      // Si auth está cargando, esperar
      if (authLoading) {
        console.log('⏳ Auth still loading, waiting...');
        return;
      }

      // Si no hay usuario, limpiar y finalizar
      if (!user) {
        console.log('❌ No authenticated user, clearing company filter');
        setCompanyId(null);
        sessionStorage.removeItem('current_company_id');
        sessionStorage.removeItem('current_user_id');
        setLoading(false);
        return;
      }

      try {
        console.log('🔄 Setting up company filter for user:', user.id, user.email);
        
        // Verificar si el company_id cacheado corresponde al usuario actual
        const cachedCompanyId = sessionStorage.getItem('current_company_id');
        const cachedUserId = sessionStorage.getItem('current_user_id');
        
        if (cachedCompanyId && cachedUserId === user.id) {
          console.log('✅ Using cached company ID for current user:', cachedCompanyId);
          setCompanyId(cachedCompanyId);
          setLoading(false);
          return;
        } else if (cachedCompanyId && cachedUserId !== user.id) {
          console.log('🔄 Cached company ID belongs to different user, clearing cache');
          sessionStorage.removeItem('current_company_id');
        }

        console.log('🔍 Fetching user profile from database...');
        // Get user's company ID from user_profiles
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();

        console.log('📋 Profile query result:', { 
          profile, 
          error,
          user_id: user.id,
          user_email: user.email 
        });

        if (error && error.code !== 'PGRST116') {
          console.error('❌ Error fetching user profile:', error);
          
          // If no profile exists, let's check if there are any profiles for this user
          const { data: allProfiles, error: allProfilesError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id);
            
          console.log('🔍 All profiles for user:', { allProfiles, allProfilesError });
          
          // Also let's check what companies exist
          const { data: companies, error: companiesError } = await supabase
            .from('companies')
            .select('id, name');
            
          console.log('🏢 Available companies:', { companies, companiesError });
          
          // Check if RLS policies are working
          console.log('🔐 Testing RLS - calling get_user_company_id function');
          const { data: funcResult, error: funcError } = await supabase
            .rpc('get_user_company_id');
          console.log('🔐 get_user_company_id result:', { funcResult, funcError });
          
          // If RLS function works, use that result
          if (funcResult && !funcError) {
            console.log('✅ Using company ID from RLS function:', funcResult);
            setCompanyId(funcResult);
            sessionStorage.setItem('current_company_id', funcResult);
            sessionStorage.setItem('current_user_id', user.id);
            setLoading(false);
            return;
          }
          
          setCompanyId(null);
          setLoading(false);
        } else if (profile?.company_id) {
          console.log('✅ Company filter set for company:', profile.company_id);
          setCompanyId(profile.company_id);
          
          // Store in session storage with user tracking
          sessionStorage.setItem('current_company_id', profile.company_id);
          sessionStorage.setItem('current_user_id', user.id);
          setLoading(false);
        } else {
          console.warn('⚠️ No company_id found for user profile:', profile);
          
          // Try the RLS function as fallback
          console.log('🔐 Trying RLS function as fallback');
          const { data: funcResult, error: funcError } = await supabase
            .rpc('get_user_company_id');
          console.log('🔐 Fallback get_user_company_id result:', { funcResult, funcError });
          
          if (funcResult && !funcError) {
            console.log('✅ Using fallback company ID from RLS function:', funcResult);
            setCompanyId(funcResult);
            sessionStorage.setItem('current_company_id', funcResult);
            sessionStorage.setItem('current_user_id', user.id);
          } else {
            setCompanyId(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error setting up company filter:', error);
        
        // Last resort: try the RLS function
        try {
          console.log('🔐 Last resort: trying RLS function');
          const { data: funcResult, error: funcError } = await supabase
            .rpc('get_user_company_id');
          console.log('🔐 Last resort get_user_company_id result:', { funcResult, funcError });
          
          if (funcResult && !funcError) {
            console.log('✅ Using last resort company ID from RLS function:', funcResult);
            setCompanyId(funcResult);
            sessionStorage.setItem('current_company_id', funcResult);
            sessionStorage.setItem('current_user_id', user.id);
          } else {
            setCompanyId(null);
          }
        } catch (finalError) {
          console.error('❌ Final error in company filter setup:', finalError);
          setCompanyId(null);
        }
        setLoading(false);
      }
      
      console.log('=== setupCompanyFilter END ===');
    };

    setupCompanyFilter();
  }, [user, authLoading]);

  // Log company filter state changes
  useEffect(() => {
    console.log('🏢 Company filter state changed:', {
      companyId,
      loading: authLoading || loading,
      user: user?.email,
      userId: user?.id
    });
  }, [companyId, authLoading, loading, user?.email, user?.id]);

  return { companyId, loading: authLoading || loading };
};
