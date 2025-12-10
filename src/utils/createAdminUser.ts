
import { supabase } from '@/integrations/supabase/client';

export const createAdminUser = async () => {
  try {
    // First, try to create the user with email confirmation disabled
    const { data, error } = await supabase.auth.signUp({
      email: 'admin@moges.com',
      password: 'admin123',
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          email_confirm: true
        }
      }
    });

    if (error) {
      // If user already exists, try to sign in instead
      if (error.message.includes('User already registered')) {
        console.log('User already exists, attempting to sign in...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: 'admin@moges.com',
          password: 'admin123'
        });

        if (signInError) {
          if (signInError.message.includes('Email not confirmed')) {
            return { 
              success: false, 
              error: 'El usuario existe pero el email no está confirmado. Por favor, desactiva la confirmación de email en Supabase o confirma el email.' 
            };
          }
          return { success: false, error: signInError.message };
        }

        return { success: true, data: signInData };
      }

      console.error('Error creating admin user:', error.message);
      return { success: false, error: error.message };
    }

    console.log('Admin user created successfully:', data);
    return { success: true, data };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { success: false, error: 'Unexpected error occurred' };
  }
};
