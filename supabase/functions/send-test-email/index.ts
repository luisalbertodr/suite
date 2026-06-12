
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadEmailConfig, sendOutgoingEmail } from '../_shared/emailSender.ts'
import { resolveUserCompanyId } from '../_shared/resolveCompanyId.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestEmailRequest {
  destinationEmail: string
  company_id?: string
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

    // Empresa del usuario (soporta varios perfiles)
    console.log('🏢 Resolving company for user:', user.id)
    const companyId = await resolveUserCompanyId(
      supabaseClient,
      user.id,
      emailData.company_id,
    )

    if (!companyId) {
      console.error('❌ User has no company associated')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User has no company associated',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log('🏢 Company ID found:', companyId)

    // Get company information
    console.log('🏢 Fetching company data')
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', companyId)
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

    // Get email configuration (SMTP Gmail o Resend)
    console.log('⚙️ Fetching email settings')
    let emailCfg
    try {
      emailCfg = await loadEmailConfig(supabaseClient, companyId)
    } catch (settingsError) {
      console.error('❌ Error fetching email settings:', settingsError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error fetching email settings: ' + (settingsError as Error).message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!emailCfg) {
      console.error('❌ Email not configured')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email no configurado (SMTP o Resend). Contacta con el administrador.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log('🔑 Email configuration:', {
      provider: emailCfg.provider,
      from: emailCfg.from,
    })

    // Send test email
    console.log('🚀 Sending test email to:', emailData.destinationEmail)
    let messageId: string | undefined
    try {
      const html = `
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
                  🎉 El sistema de envío de emails está funcionando correctamente.
                </p>
              </div>
              
              <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
                <h3 style="color: #333; margin-bottom: 10px;">Información del Test:</h3>
                <ul style="color: #666; line-height: 1.6;">
                  <li><strong>Fecha y hora:</strong> ${new Date().toLocaleString('es-ES')}</li>
                  <li><strong>Enviado desde:</strong> ${emailCfg.from}</li>
                  <li><strong>Proveedor:</strong> ${emailCfg.provider.toUpperCase()}</li>
                  <li><strong>Usuario:</strong> ${user.email}</li>
                  <li><strong>Empresa:</strong> ${company.name}</li>
                </ul>
              </div>
              
              <p style="color: #333;">
                Saludos cordiales,<br>
                <strong>Sistema Lipoout</strong>
              </p>
            </div>
          </div>
        `

      const sent = await sendOutgoingEmail(emailCfg, {
        to: emailData.destinationEmail,
        subject: 'Email de Prueba - Lipoout',
        html,
      })

      if (!sent.ok) throw new Error(sent.error)
      messageId = sent.messageId

      console.log('✅ Test email sent successfully:', { messageId })

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
          company_id: companyId,
          setting_key: `last_test_email_sent`,
          setting_value: new Date().toISOString(),
          setting_type: 'text',
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
        messageId: messageId,
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
