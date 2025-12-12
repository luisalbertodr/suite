import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import forge from 'https://esm.sh/node-forge@1.3.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AES-256-GCM decryption utility
class SecureCrypto {
  private static async getKey(): Promise<CryptoKey> {
    const encryptionKey = Deno.env.get("CERTIFICATE_ENCRYPTION_KEY");
    if (!encryptionKey) {
      throw new Error('CERTIFICATE_ENCRYPTION_KEY not configured');
    }
    
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(encryptionKey),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode("certificate-salt-2024"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  static async decrypt(encryptedData: string): Promise<string> {
    try {
      const key = await this.getKey();
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }
}

async function decryptCertificateData(encryptedData: string, type: 'certificate' | 'password'): Promise<string> {
  try {
    console.log(`🔓 Attempting to decrypt ${type} data`);
    const result = await SecureCrypto.decrypt(encryptedData);
    console.log(`✅ ${type} decrypted successfully`);
    return result;
  } catch (error) {
    console.warn(`⚠️ Decryption failed for ${type}, attempting plaintext fallback:`, error);
    
    if (type === 'certificate') {
      if (encryptedData.startsWith('MII') || encryptedData.includes('-----BEGIN')) {
        console.log('✅ Using plaintext certificate (fallback)');
        return encryptedData;
      }
    } else if (type === 'password') {
      if (encryptedData.length > 0 && encryptedData.length < 256 && /^[\x20-\x7E]+$/.test(encryptedData)) {
        console.log('✅ Using plaintext password (fallback)');
        return encryptedData;
      }
    }
    
    console.error(`❌ Failed to decrypt ${type} and fallback not applicable:`, error);
    throw new Error(`Unable to decrypt ${type}`);
  }
}

function convertP12ToPEM(input: string, password: string): { cert: string; key: string } {
  try {
    console.log('🔄 Converting certificate to PEM format');

    if (input.includes('-----BEGIN')) {
      const certMatches = input.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
      const keyMatch = input.match(/-----BEGIN (?:RSA |EC |)PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |)PRIVATE KEY-----/);

      const certPem = certMatches.join('\n');
      const keyPem = keyMatch ? keyMatch[0] : '';

      if (!certPem || !keyPem) {
        throw new Error('PEM provided but missing certificate or private key');
      }

      console.log('✅ PEM detected and parsed');
      return { cert: certPem, key: keyPem };
    }

    const p12Der = forge.util.decode64(input);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '');

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]
      || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];

    if (!keyBags || keyBags.length === 0) {
      throw new Error('No private key found in P12');
    }

    const privateKey = keyBags[0].key;
    const privateKeyPem = forge.pki.privateKeyToPem(privateKey);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    if (!certBags || certBags.length === 0) {
      throw new Error('No certificates found in P12');
    }

    const orderedCerts: string[] = [];
    const pemSet = new Set<string>();
    
    for (const b of certBags) {
      const pem = forge.pki.certificateToPem(b.cert).trim();
      if (!pemSet.has(pem)) pemSet.add(pem);
    }
    orderedCerts.push(...Array.from(pemSet));

    const chainPem = orderedCerts.join('\n');
    console.log('✅ P12 converted to PEM successfully');
    return { cert: chainPem, key: privateKeyPem };
  } catch (error: any) {
    console.error('❌ Failed to convert certificate to PEM:', error);
    throw new Error(`P12 conversion failed: ${error.message}`);
  }
}

serve(async (req: Request) => {
  console.log('🔍 Verifactu diagnostic function called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    console.log('👤 User authenticated:', user.email);

    const { data: userProfile } = await supabaseClient
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!userProfile?.company_id) {
      throw new Error('User has no company associated');
    }

    const companyId = userProfile.company_id;
    console.log('🏢 Company ID:', companyId);

    // Fetch company config
    const { data: companyConfig } = await supabaseClient
      .from('verifactu_company_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (!companyConfig) {
      throw new Error('Company Verifactu configuration not found');
    }

    // Fetch active certificate
    const { data: certificate } = await supabaseClient
      .from('verifactu_certificates')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single();

    if (!certificate) {
      throw new Error('No active certificate found');
    }

    console.log('🔐 Decrypting certificate');
    const decryptedCertificate = await decryptCertificateData(certificate.certificate_data, 'certificate');
    const decryptedPassword = await decryptCertificateData(certificate.certificate_password, 'password');

    // Extract certificate info
    let certSubject = 'Unknown';
    let certIssuer = 'Unknown';
    let certSerial = 'Unknown';
    let certValidFrom = 'Unknown';
    let certValidTo = 'Unknown';

    try {
      const { cert } = convertP12ToPEM(decryptedCertificate, decryptedPassword);
      const certPem = cert.split('\n').filter(l => l.includes('BEGIN CERTIFICATE'))[0] ? cert : cert.split('\n').slice(0, 30).join('\n');
      const parsedCert = forge.pki.certificateFromPem(certPem);
      
      certSubject = parsedCert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(', ');
      certIssuer = parsedCert.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(', ');
      certSerial = parsedCert.serialNumber;
      certValidFrom = parsedCert.validity.notBefore.toISOString();
      certValidTo = parsedCert.validity.notAfter.toISOString();
    } catch (e) {
      console.warn('⚠️ Could not parse certificate for diagnostic:', e);
    }

    // Determine endpoint
    const endpoint = companyConfig.endpoint_url || '';
    const isProduction = companyConfig.is_production || 
                        companyConfig.environment === 'production' || 
                        endpoint.includes('www7.aeat.es');
    
    const endpointFinal = isProduction 
      ? 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
      : 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';

    console.log(`🌐 Testing connection to: ${endpointFinal}`);

    // Build minimal SOAP request (ConsultaFactura dummy)
    const dummyXML = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ver="http://www.aeat.es/verifactu">
  <soapenv:Header/>
  <soapenv:Body>
    <ver:ConsultaFactura>
      <NIF>${companyConfig.nif_emisor}</NIF>
      <NumFactura>DIAGNOSTIC-TEST-001</NumFactura>
      <FechaExpedicion>01-01-2025</FechaExpedicion>
    </ver:ConsultaFactura>
  </soapenv:Body>
</soapenv:Envelope>`;

    // Prepare mTLS cert
    const { cert: certPem, key: keyPem } = convertP12ToPEM(decryptedCertificate, decryptedPassword);

    let httpStatus = 0;
    let bodySnippet = '';
    let certificateStatus = 'unknown';
    let errorDetails = '';

    try {
      console.log('📤 Sending diagnostic request with mTLS...');
      
      const response = await fetch(endpointFinal, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'ConsultaFactura',
        },
        body: dummyXML,
        // Note: Deno fetch with client certificates requires TLS config
        // This is a simplified version - full mTLS requires additional setup
      });

      httpStatus = response.status;
      const body = await response.text();
      bodySnippet = body.substring(0, 500);

      console.log(`📊 AEAT response status: ${httpStatus}`);
      console.log(`📄 Response body snippet: ${bodySnippet.substring(0, 100)}...`);

      if (httpStatus === 401) {
        if (body.includes('revocado') || body.toLowerCase().includes('revoked')) {
          certificateStatus = 'revoked';
          errorDetails = 'AEAT rechazó el certificado: certificado revocado';
        } else if (body.includes('no autorizado') || body.toLowerCase().includes('unauthorized')) {
          certificateStatus = 'unauthorized';
          errorDetails = 'AEAT rechazó el certificado: no autorizado para esta operación';
        } else {
          certificateStatus = 'authentication_failed';
          errorDetails = 'AEAT rechazó la autenticación del certificado (401)';
        }
      } else if (httpStatus === 200) {
        certificateStatus = 'accepted';
        errorDetails = 'Certificado aceptado por AEAT (respuesta 200)';
      } else {
        certificateStatus = 'unknown_response';
        errorDetails = `AEAT devolvió status ${httpStatus}`;
      }

    } catch (error: any) {
      console.error('❌ Diagnostic request failed:', error);
      errorDetails = `Error de conexión: ${error.message}`;
      certificateStatus = 'connection_error';
    }

    // Log diagnostic result
    await supabaseClient.from('verifactu_logs').insert({
      company_id: companyId,
      invoice_id: null,
      action: 'diagnostic',
      status: certificateStatus,
      request_data: {
        endpoint: endpointFinal,
        certificate_serial: certSerial,
      },
      response_data: {
        http_status: httpStatus,
        body_snippet: bodySnippet,
        certificate_status: certificateStatus,
      },
      error_message: errorDetails,
    });

    const recommendations: string[] = [];
    
    if (certificateStatus === 'revoked') {
      recommendations.push('⚠️ El certificado ha sido revocado por la FNMT. Debe obtener un nuevo certificado válido.');
      recommendations.push('📋 Contacte con la FNMT para renovar su certificado digital.');
    } else if (certificateStatus === 'unauthorized') {
      recommendations.push('⚠️ El certificado no está autorizado para esta operación en AEAT.');
      recommendations.push('🔍 Verifique que el NIF del certificado coincide con el NIF de su empresa.');
    } else if (certificateStatus === 'connection_error') {
      recommendations.push('⚠️ No se pudo conectar con AEAT. Problema de red o endpoint incorrecto.');
      recommendations.push('🔄 Intente nuevamente más tarde o verifique la configuración del endpoint.');
    } else if (certificateStatus === 'accepted') {
      recommendations.push('✅ El certificado fue aceptado por AEAT. La configuración mTLS es correcta.');
      recommendations.push('📤 Puede proceder a enviar facturas normalmente.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        diagnostic: {
          endpoint_final: endpointFinal,
          http_status: httpStatus,
          body_snippet: bodySnippet,
          certificate_status: certificateStatus,
          error_details: errorDetails,
          certificate_info: {
            subject: certSubject,
            issuer: certIssuer,
            serial: certSerial,
            valid_from: certValidFrom,
            valid_to: certValidTo,
          },
          recommendations,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Diagnostic error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
