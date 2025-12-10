
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  documentType: 'invoice' | 'quote' | 'delivery_note'
  documentId: string
  customerEmail: string
  customerName: string
  subject: string
  message: string
  pdfBuffer: string // Base64 encoded PDF
  documentNumber: string
}

serve(async (req) => {
  console.log('🚀 Email function called, method:', req.method)
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
    let emailData: EmailRequest
    try {
      const body = await req.text()
      console.log('📝 Request body length:', body.length)
      emailData = JSON.parse(body)
      console.log('📧 Email data parsed:', {
        documentType: emailData.documentType,
        customerEmail: emailData.customerEmail,
        subject: emailData.subject,
        pdfBufferLength: emailData.pdfBuffer?.length || 0
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

    // Convert base64 PDF to buffer
    let pdfBuffer
    try {
      if (!emailData.pdfBuffer) {
        throw new Error('No PDF data provided')
      }
      
      pdfBuffer = Uint8Array.from(atob(emailData.pdfBuffer), c => c.charCodeAt(0))
      console.log('📄 PDF buffer created, size:', pdfBuffer.length, 'bytes')
      
      if (pdfBuffer.length === 0) {
        throw new Error('PDF buffer is empty')
      }
    } catch (pdfError) {
      console.error('❌ Error processing PDF:', pdfError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error processing PDF: ' + pdfError.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get document type for filename
    const getDocumentTypeName = (type: string) => {
      switch (type) {
        case 'invoice': return 'Factura'
        case 'quote': return 'Presupuesto'
        case 'delivery_note': return 'Albaran'
        default: return 'Documento'
      }
    }

    const filename = `${getDocumentTypeName(emailData.documentType)}-${emailData.documentNumber}.pdf`
    console.log('📁 Filename:', filename)

    // Send email
    console.log('🚀 Sending email to:', emailData.customerEmail)
    let emailResponse
    try {
      emailResponse = await resend.emails.send({
        from: emailFrom,
        to: [emailData.customerEmail],
        subject: emailData.subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #333; margin-bottom: 10px;">${company.name}</h2>
              ${company.email ? `<p style="margin: 5px 0; color: #666;">${company.email}</p>` : ''}
              ${company.phone ? `<p style="margin: 5px 0; color: #666;">${company.phone}</p>` : ''}
            </div>
            
            <div style="padding: 20px 0;">
              <p style="color: #333; font-size: 16px; line-height: 1.5;">
                Estimado/a ${emailData.customerName},
              </p>
              
              <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
                ${emailData.message.split('\n').map(line => `<p style="margin: 8px 0; color: #333;">${line}</p>`).join('')}
              </div>
              
              <p style="color: #333; margin-top: 20px;">
                Saludos cordiales,<br>
                <strong>${company.name}</strong>
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
        attachments: [
          {
            filename: filename,
            content: pdfBuffer,
          }
        ]
      })

      console.log('✅ Email sent successfully:', {
        id: emailResponse.data?.id,
        error: emailResponse.error
      })

      if (emailResponse.error) {
        throw new Error(emailResponse.error.message || 'Failed to send email')
      }

    } catch (emailError) {
      console.error('❌ Error sending email:', emailError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error sending email: ' + emailError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log the email sending
    try {
      await supabaseClient
        .from('system_settings')
        .upsert({
          company_id: userProfile.company_id,
          setting_key: `last_email_sent_${emailData.documentType}_${emailData.documentId}`,
          setting_value: new Date().toISOString(),
          setting_type: 'datetime',
          description: `Email sent to ${emailData.customerEmail} for ${emailData.documentType} ${emailData.documentNumber}`
        }, {
          onConflict: 'company_id,setting_key'
        })

      console.log('📝 Email sending logged')
    } catch (logError) {
      console.error('⚠️ Warning: Could not log email sending:', logError)
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id,
        message: 'Email sent successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('❌ Unexpected error in email function:', {
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
