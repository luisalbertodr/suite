
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, password, company_id, role_id, permissions } = await req.json()

    console.log('Creating user with data:', { email, company_id, role_id, permissions: permissions?.length || 0 })

    // Validate required fields
    if (!email || !password || !company_id || !role_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: email, password, company_id, and role_id are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create user in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      console.error('Auth user creation failed:', authError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to create auth user: ${authError.message}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!authUser.user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create auth user: no user returned' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const userId = authUser.user.id
    console.log('Auth user created with ID:', userId)

    try {
      // Create user profile
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: userId,
          company_id: company_id
        })

      if (profileError) {
        console.error('Profile creation failed:', profileError)
        // Don't fail completely, but log the error
      } else {
        console.log('User profile created successfully')
      }

      // Assign role to user
      const { error: roleError } = await supabaseAdmin
        .from('user_company_roles')
        .insert({
          user_id: userId,
          company_id: company_id,
          role_id: role_id
        })

      if (roleError) {
        console.error('Role assignment failed:', roleError)
        throw new Error(`Failed to assign role: ${roleError.message}`)
      }

      console.log('Role assigned successfully')

      // Assign individual permissions if provided
      if (permissions && Array.isArray(permissions) && permissions.length > 0) {
        console.log('Assigning individual permissions:', permissions)
        
        const permissionInserts = permissions.map(permission_id => ({
          user_id: userId,
          company_id: company_id,
          permission_id: permission_id
        }))

        const { error: permissionsError } = await supabaseAdmin
          .from('user_permissions')
          .insert(permissionInserts)

        if (permissionsError) {
          console.error('Individual permissions assignment failed:', permissionsError)
          // Don't fail completely, the user and role are already created
          console.log('Continuing despite permission assignment failure')
        } else {
          console.log(`Successfully assigned ${permissions.length} individual permissions`)
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: userId,
          message: 'User created successfully with role and permissions'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (error) {
      console.error('Error in user setup:', error)
      
      // If user setup fails, we should clean up the auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        console.log('Cleaned up auth user after failure')
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError)
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `User setup failed: ${error.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
