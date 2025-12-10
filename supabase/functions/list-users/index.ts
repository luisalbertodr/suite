
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== LIST-USERS FUNCTION STARTED ===')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('Environment variables check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      url: supabaseUrl
    })
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables')
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing environment variables',
          users: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('authorization')
    let currentUserId = null
    let isSuperuser = false

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseAdmin.auth.getUser(token)
        currentUserId = user?.id
        console.log('Current user ID:', currentUserId)
      } catch (error) {
        console.error('Error getting current user:', error)
      }
    }

    // Check if it's a superuser session (from localStorage/sessionStorage)
    const url = new URL(req.url)
    const isSuperuserParam = url.searchParams.get('is_superuser')
    if (isSuperuserParam === 'true') {
      isSuperuser = true
      console.log('Superuser mode detected')
    }

    console.log('Fetching all users from auth...')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: authError.message,
          users: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log('Found total users:', authData?.users?.length || 0)

    let targetCompanyId = null

    // If not superuser, get the current user's company ID
    if (!isSuperuser && currentUserId) {
      const { data: currentUserProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('company_id')
        .eq('user_id', currentUserId)
        .maybeSingle()

      targetCompanyId = currentUserProfile?.company_id
      console.log('Current user company ID:', targetCompanyId)
      
      if (!targetCompanyId) {
        console.warn('No company ID found for current user')
        return new Response(
          JSON.stringify({ 
            success: true,
            users: [],
            total: 0
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    // Process users and filter by company if needed
    const users = await Promise.all(
      (authData?.users || []).map(async (user) => {
        try {
          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('company_id, companies:company_id(name)')
            .eq('user_id', user.id)
            .maybeSingle()

          // Get roles for this user
          const { data: roles } = await supabaseAdmin
            .from('user_company_roles')
            .select('id, role:roles(name, description), company_id')
            .eq('user_id', user.id)

          return {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            email_confirmed_at: user.email_confirmed_at,
            profiles: profile,
            user_company_roles: roles || []
          }
        } catch (error) {
          console.error('Error processing user:', error)
          return {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            email_confirmed_at: user.email_confirmed_at,
            profiles: null,
            user_company_roles: []
          }
        }
      })
    )

    // Filter users by company if not superuser
    let filteredUsers = users
    if (!isSuperuser && targetCompanyId) {
      filteredUsers = users.filter(user => user.profiles?.company_id === targetCompanyId)
      console.log(`Filtered to ${filteredUsers.length} users for company ${targetCompanyId}`)
    } else if (isSuperuser) {
      console.log('Superuser mode: showing all users')
    }

    console.log('Final processed users:', filteredUsers.length)

    return new Response(
      JSON.stringify({ 
        success: true,
        users: filteredUsers,
        total: filteredUsers.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        users: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
