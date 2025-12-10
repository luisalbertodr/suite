
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, currentPassword, newPassword } = await req.json();

    console.log('Attempting to change password for superuser:', email);

    if (!email || !currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email, current password and new password are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Call the database function to change password
    const { data, error } = await supabase.rpc('change_superuser_password', {
      p_email: email,
      p_current_password: currentPassword,
      p_new_password: newPassword
    });

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error changing password' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!data || data.length === 0) {
      console.log('No data returned from change_superuser_password');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error changing password' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = data[0];
    
    if (!result.success) {
      console.log('Password change failed:', result.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Password changed successfully for:', email);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: result.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Change password error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Password change service error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
