
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestEmailRequest {
  destinationEmail: string
}

serve(async (req) => {
  console.log('🚀 Test email function called, method:', req.method)
  console.log('📋 Headers received:', Object.fromEntries(req.headers.entries()))
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Basic environment checks
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('🔧 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      supabaseUrlLength: supabaseUrl?.length || 0
    })

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing environment variables')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required environment variables' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    console.log('📧 Supabase client created successfully')

    // Get the authorization header - check multiple possible formats
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    console.log('🔐 Authorization header found:', !!authHeader)
    console.log('🔐 Authorization header length:', authHeader?.length || 0)
    
    if (!authHeader) {
      console.error('❌ No authorization header found')
      console.log('Available headers:', Object.fromEntries(req.headers.entries()))
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No authorization header found' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user from token - handle both Bearer and direct token formats
    let token = authHeader
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '')
    }
    
    console.log('🔐 Verifying user token, length:', token.length)
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      console.error('❌ Invalid token:', userError?.message || 'No user found')
      console.log('🔐 Token verification failed for token starting with:', token.substring(0, 20) + '...')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid token: ' + (userError?.message || 'No user found')
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('👤 User authenticated:', user.email)

    // Parse request body with better error handling
    let emailData: TestEmailRequest
    try {
      const body = await req.text()
      console.log('📝 Request body length:', body.length)
      emailData = JSON.parse(body)
      console.log('📧 Test email data parsed:', {
        destinationEmail: emailData.destinationEmail,
      })
    } catch (parseError) {
      console.error('❌ Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request body: ' + parseError.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user's company
    console.log('🏢 Fetching user profile for user:', user.id)
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error fetching user profile: ' + profileError.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!userProfile?.company_id) {
      console.error('❌ User has no company associated')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User has no company associated' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🏢 Company ID found:', userProfile.company_id)

    // Get company information
    console.log('🏢 Fetching company data')
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', userProfile.company_id)
      .single()

    if (companyError) {
      console.error('❌ Error fetching company:', companyError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error fetching company: ' + companyError.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!company) {
      console.error('❌ Company not found')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Company not found' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🏢 Company found:', company.name)

    // Get email configuration
    console.log('⚙️ Fetching email settings')
    const { data: emailSettings, error: settingsError } = await supabaseClient
      .from('system_settings')
      .select('setting_key, setting_value')
      .eq('company_id', userProfile.company_id)
      .in('setting_key', ['resend_api_key', 'email_from'])

    if (settingsError) {
      console.error('❌ Error fetching email settings:', settingsError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error fetching email settings: ' + settingsError.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('⚙️ Email settings found:', emailSettings?.length || 0, 'settings')

    const resendApiKey = emailSettings?.find(s => s.setting_key === 'resend_api_key')?.setting_value
    const emailFrom = emailSettings?.find(s => s.setting_key === 'email_from')?.setting_value || 'noreply@moges.com'

    console.log('🔑 Email configuration:', {
      hasResendApiKey: !!resendApiKey,
      emailFrom: emailFrom,
      resendApiKeyLength: resendApiKey?.length || 0
    })

    if (!resendApiKey) {
      console.error('❌ Resend API key not configured')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Resend API key not configured for this company. Please configure it in the system settings.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Resend
    let resend
    try {
      resend = new Resend(resendApiKey)
      console.log('📧 Resend client created')
    } catch (resendError) {
      console.error('❌ Error creating Resend client:', resendError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error creating email client: ' + resendError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Send test email
    console.log('🚀 Sending test email to:', emailData.destinationEmail)
    let emailResponse
    try {
      emailResponse = await resend.emails.send({
        from: emailFrom,
        to: [emailData.destinationEmail],
        subject: 'Email de Prueba - MOGES',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #333; margin-bottom: 10px;">${company.name}</h2>
              ${company.email ? `<p style="margin: 5px 0; color: #666;">${company.email}</p>` : ''}
              ${company.phone ? `<p style="margin: 5px 0; color: #666;">${company.phone}</p>` : ''}
            </div>
            
            <div style="padding: 20px 0;">
              <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">
                ✅ Email de Prueba Enviado Correctamente
              </h1>
              
              <div style="margin: 20px 0; padding: 15px; background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px;">
                <p style="margin: 8px 0; color: #155724; font-weight: bold;">
                  🎉 ¡Felicidades! El sistema de envío de emails está funcionando correctamente.
                </p>
                <p style="margin: 8px 0; color: #155724;">
                  Este es un email de prueba enviado desde el sistema MOGES para verificar que la configuración de email está correctamente establecida.
                </p>
              </div>
              
              <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
                <h3 style="color: #333; margin-bottom: 10px;">Información del Test:</h3>
                <ul style="color: #666; line-height: 1.6;">
                  <li><strong>Fecha y hora:</strong> ${new Date().toLocaleString('es-ES')}</li>
                  <li><strong>Enviado desde:</strong> ${emailFrom}</li>
                  <li><strong>Usuario:</strong> ${user.email}</li>
                  <li><strong>Empresa:</strong> ${company.name}</li>
                </ul>
              </div>
              
              <p style="color: #333; margin-top: 20px;">
                Si recibiste este email, significa que el sistema de envío de emails está funcionando correctamente.
              </p>
              
              <p style="color: #333;">
                Saludos cordiales,<br>
                <strong>Sistema MOGES</strong>
              </p>
            </div>
            
            <div style="border-top: 1px solid #e9ecef; padding-top: 20px; margin-top: 30px;">
              <p style="color: #666; font-size: 12px; text-align: center;">
                ${company.address_street ? `${company.address_street}, ` : ''}${company.address_city || ''} ${company.address_postal_code || ''}
                ${company.tax_id ? `<br>CIF: ${company.tax_id}` : ''}
              </p>
            </div>
          </div>
        `,
      })

      console.log('✅ Test email sent successfully:', {
        id: emailResponse.data?.id,
        error: emailResponse.error
      })

      if (emailResponse.error) {
        throw new Error(emailResponse.error.message || 'Failed to send test email')
      }

    } catch (emailError) {
      console.error('❌ Error sending test email:', emailError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error sending test email: ' + emailError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log the test email sending
    try {
      await supabaseClient
        .from('system_settings')
        .upsert({
          company_id: userProfile.company_id,
          setting_key: `last_test_email_sent`,
          setting_value: new Date().toISOString(),
          setting_type: 'datetime',
          description: `Test email sent to ${emailData.destinationEmail} by ${user.email}`
        }, {
          onConflict: 'company_id,setting_key'
        })

      console.log('📝 Test email sending logged')
    } catch (logError) {
      console.error('⚠️ Warning: Could not log test email sending:', logError)
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id,
        message: 'Test email sent successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('❌ Unexpected error in test email function:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error: ' + (error.message || 'Unknown error')
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
