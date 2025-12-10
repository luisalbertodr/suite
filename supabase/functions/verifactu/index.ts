
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import forge from "npm:node-forge@1.3.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifactuRequest {
  invoiceId: string;
  action: 'send' | 'query' | 'cancel';
}

serve(async (req: Request) => {
  console.log('🚀 Verifactu function called, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request');
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    console.log('🔗 Creating Supabase client');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header found');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔐 Verifying user token');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ Invalid token:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 User authenticated:', user.email);

    console.log('🏢 Fetching user profile');
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !userProfile?.company_id) {
      console.error('❌ User has no company associated:', profileError);
      return new Response(
        JSON.stringify({ error: 'User has no company associated' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🏢 Company ID found:', userProfile.company_id);

    console.log('📝 Parsing request body');
    const requestData: VerifactuRequest = await req.json();
    console.log('📧 Verifactu data received:', {
      action: requestData.action,
      invoiceId: requestData.invoiceId
    });

    console.log('📋 Fetching invoice data');
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select(`
        *,
        customers!inner(name, tax_id, address_street, address_city, 
                        address_postal_code, address_country),
        companies!inner(name, tax_id, address_street, address_city, 
                       address_postal_code, address_country)
      `)
      .eq('id', requestData.invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error('❌ Invoice not found:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Invoice found:', invoice.number);

    console.log('⚙️ Fetching company Verifactu configuration');
    const { data: companyConfig, error: configError } = await supabaseClient
      .from('verifactu_company_config')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .maybeSingle();

    if (configError) {
      console.error('❌ Error fetching company config:', configError);
      return new Response(
        JSON.stringify({ error: 'Error fetching company configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!companyConfig) {
      console.error('❌ No company configuration found');
      return new Response(
        JSON.stringify({ error: 'Company Verifactu configuration not found. Please configure it first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Fetching active certificate');
    const { data: certificate, error: certError } = await supabaseClient
      .from('verifactu_certificates')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .eq('is_active', true)
      .single();

    if (certError || !certificate) {
      console.error('❌ No active certificate found:', certError);
      return new Response(
        JSON.stringify({ error: 'No active certificate found for this company' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Certificate loaded securely for company');

    let result;
    switch (requestData.action) {
      case 'send':
        console.log('📤 Processing send action');
        result = await sendToVerifactu(invoice, certificate, companyConfig, supabaseClient);
        break;
      case 'query':
        console.log('🔍 Processing query action');
        result = await queryVerifactu(invoice, certificate, companyConfig);
        break;
      case 'cancel':
        console.log('❌ Processing cancel action');
        result = await cancelVerifactu(invoice, certificate, companyConfig);
        break;
      default:
        console.error('❌ Invalid action:', requestData.action);
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log('✅ Operation completed:', result);

    await logVerifactuOperation(userProfile.company_id, requestData.invoiceId, requestData.action, result, supabaseClient);

    await updateInvoiceVerifactuStatus(requestData.invoiceId, result, supabaseClient);

    console.log('✅ Verifactu operation completed successfully');
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Verifactu error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// AES-256-GCM encryption/decryption utilities
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
    console.log(`🔓 Attempting to decrypt ${type} data locally`);
    const result = await SecureCrypto.decrypt(encryptedData);
    console.log(`✅ ${type} decrypted successfully`);
    return result;
  } catch (error) {
    console.warn(`⚠️ Decryption failed for ${type}, attempting plaintext fallback:`, error);
    
    // Fallback: check if data looks like plaintext
    if (type === 'certificate') {
      // Check if it looks like PFX/PEM data (base64 starting with 'MII' or contains PEM headers)
      if (encryptedData.startsWith('MII') || encryptedData.includes('-----BEGIN')) {
        console.log('✅ Using plaintext certificate (fallback)');
        return encryptedData;
      }
    } else if (type === 'password') {
      // Check if it looks like a plaintext password (printable ASCII, reasonable length)
      if (encryptedData.length > 0 && encryptedData.length < 256 && /^[\x20-\x7E]+$/.test(encryptedData)) {
        console.log('✅ Using plaintext password (fallback)');
        return encryptedData;
      }
    }
    
    console.error(`❌ Failed to decrypt ${type} and fallback not applicable:`, error);
    throw new Error(`Unable to decrypt ${type}. Check CERTIFICATE_ENCRYPTION_KEY configuration.`);
  }
}

// Convert P12/PFX certificate to PEM format (cert + key)
function convertP12ToPEM(input: string, password: string): { cert: string; key: string } {
  try {
    console.log('🔄 Converting certificate to PEM format');

    // If already PEM, extract certs and key
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

    // Otherwise assume base64-encoded P12/PFX
    const p12Der = forge.util.decode64(input);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '');

    // Extract private key
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]
      || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
    if (!keyBags || keyBags.length === 0) {
      throw new Error('No private key found in P12 file');
    }

    const privateKey = keyBags[0].key;
    const privateKeyPem = forge.pki.privateKeyToPem(privateKey);

    // Extract full cert chain
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    if (certBags.length === 0) {
      throw new Error('No certificate found in P12 file');
    }

    // Identify the leaf certificate that corresponds to the private key
    let leafIndex = -1;
    try {
      const pubFromPriv = forge.pki.rsa.setPublicKey(privateKey.n, privateKey.e);
      for (let i = 0; i < certBags.length; i++) {
        const cert = certBags[i].cert;
        if (cert.publicKey && cert.publicKey.n && cert.publicKey.e) {
          const sameN = cert.publicKey.n.compareTo(pubFromPriv.n) === 0;
          const sameE = cert.publicKey.e.compareTo(pubFromPriv.e) === 0;
          if (sameN && sameE) {
            leafIndex = i;
            break;
          }
        }
      }
    } catch (_) {
      // Fallback: try by localKeyId
    }

    if (leafIndex < 0) {
      // Fallback: try by localKeyId
      try {
        const keyLocalId = keyBags[0].attributes?.localKeyId?.[0]?.value as string | undefined;
        if (keyLocalId) {
          for (let i = 0; i < certBags.length; i++) {
            const certLocalId = certBags[i].attributes?.localKeyId?.[0]?.value as string | undefined;
            if (certLocalId && certLocalId === keyLocalId) {
              leafIndex = i;
              break;
            }
          }
        }
      } catch (_) {
        // No-op
      }
    }

    // Build chain with leaf first (required for mTLS) and exclude self-signed roots
    let orderedCerts: string[];
    if (leafIndex >= 0) {
      const leaf = certBags[leafIndex].cert;

      // Validate certificate dates
      try {
        const nb = leaf.validity?.notBefore as Date | undefined;
        const na = leaf.validity?.notAfter as Date | undefined;
        if (nb) console.log(`🗓️ Cert notBefore: ${nb.toISOString()}`);
        if (na) console.log(`🗓️ Cert notAfter: ${na.toISOString()}`);
        const now = new Date();
        if (nb && nb > now) {
          throw new Error('El certificado aún no es válido (notBefore en el futuro)');
        }
        if (na && na < now) {
          throw new Error('El certificado del cliente ha expirado');
        }
      } catch (e: any) {
        console.warn('⚠️ No se pudo validar fechas del certificado:', e?.message || e);
      }

      // Log subject, issuer and serial
      try {
        const subjectStr = leaf.subject.attributes.map((a: any) => `${a.shortName || a.name}=${a.value}`).join(', ');
        const issuerStr = leaf.issuer.attributes.map((a: any) => `${a.shortName || a.name}=${a.value}`).join(', ');
        const serial = leaf.serialNumber;
        console.log(`🔎 Client leaf subject: ${subjectStr}`);
        console.log(`🔎 Client leaf issuer: ${issuerStr}`);
        console.log(`🆔 Client cert serial: ${serial}`);
      } catch (_) {}

      const isSelfSigned = (c: any) => {
        try {
          const subj = JSON.stringify(c.subject?.attributes || []);
          const iss = JSON.stringify(c.issuer?.attributes || []);
          return subj === iss;
        } catch {
          return false;
        }
      };

      const leafPem = forge.pki.certificateToPem(leaf);

      // Build intermediates excluding self-signed roots and duplicates
      const pemSet = new Set<string>();
      pemSet.add(leafPem.trim());

      for (let i = 0; i < certBags.length; i++) {
        if (i === leafIndex) continue;
        const c = certBags[i].cert;
        if (isSelfSigned(c)) continue; // exclude root
        const pem = forge.pki.certificateToPem(c).trim();
        if (!pemSet.has(pem)) pemSet.add(pem);
      }

      orderedCerts = Array.from(pemSet);
    } else {
      // Fallback: use original order but log warning (also exclude self-signed roots)
      const isSelfSigned = (c: any) => {
        try {
          const subj = JSON.stringify(c.subject?.attributes || []);
          const iss = JSON.stringify(c.issuer?.attributes || []);
          return subj === iss;
        } catch {
          return false;
        }
      };
      const pemSet = new Set<string>();
      for (const b of certBags) {
        if (isSelfSigned(b.cert)) continue;
        const pem = forge.pki.certificateToPem(b.cert).trim();
        if (!pemSet.has(pem)) pemSet.add(pem);
      }
      orderedCerts = Array.from(pemSet);
      console.warn('⚠️ Could not identify leaf certificate. Using filtered order (no root).');
    }

    const chainPem = orderedCerts.join('\n');
    console.log('✅ P12 converted to PEM successfully with leaf-first ordering and no root');
    return { cert: chainPem, key: privateKeyPem };
  } catch (error: any) {
    console.error('❌ Failed to convert certificate to PEM:', error);
    throw new Error(`P12 conversion failed: ${error.message}`);
  }
}

// Helper function to build the correct verification URL based on environment
function buildVerificationURL(companyConfig: any, csv: string): string {
  const endpoint = companyConfig.endpoint_url || '';
  const isProduction = companyConfig.is_production || 
                      companyConfig.environment === 'production' || 
                      endpoint.includes('www7.aeat.es');
  
  const baseUrl = isProduction 
    ? 'https://www2.agenciatributaria.gob.es'
    : 'https://prewww10.aeat.es';
  
  const qrUrl = `${baseUrl}/wlpl/TIKE-CONT/ValidarFactura?csv=${csv}`;
  console.log(`🧭 Using validation URL base: ${baseUrl}`);
  return qrUrl;
}

async function sendToVerifactu(invoice: any, certificate: any, companyConfig: any, supabaseClient: any) {
  console.log('📤 Processing invoice for Verifactu transmission');
  
  let decryptedCertificate: string;
  let decryptedPassword: string;
  
  try {
    decryptedCertificate = await decryptCertificateData(certificate.certificate_data, 'certificate');
    decryptedPassword = await decryptCertificateData(certificate.certificate_password, 'password');
    console.log('🔐 Certificate data decrypted securely for processing');
  } catch (error) {
    console.error('❌ Failed to decrypt certificate:', error);
    throw new Error('Certificate access failed - security validation error');
  }
  
  const requestXML = await buildCompleteVerifactuXML(invoice, { 
    ...certificate, 
    certificate_data: decryptedCertificate,
    certificate_password: decryptedPassword 
  }, companyConfig, supabaseClient);
  console.log('📄 Verifactu XML built with correct format');
  
  let finalXML = requestXML;
  if (companyConfig.enable_xades_signature) {
    console.log('🖊️ Signing XML with XAdES');
    try {
      console.log('📤 Passing decrypted certificate to XAdES signer');
      const signedXML = await signXMLWithXAdES(requestXML, decryptedCertificate, decryptedPassword, certificate.company_id, invoice.id, companyConfig, supabaseClient);
      finalXML = signedXML;
      console.log('✅ XML signed with XAdES successfully');
    } catch (error: any) {
      console.error('❌ XAdES signing failed:', error);
      await logVerifactuOperation(invoice.company_id, invoice.id, 'xades_sign_error', { error: error.message }, supabaseClient);
    }
  }
  
  await storeXMLDocument(supabaseClient, {
    companyId: invoice.company_id,
    invoiceId: invoice.id,
    xmlType: 'request',
    xmlContent: finalXML,
  });

  let response;
  try {
    console.log('📤 Attempting direct send to AEAT with decrypted certificate');
    const certForTLS = {
      ...certificate,
      certificate_data: decryptedCertificate,
      certificate_password: decryptedPassword
    };
    response = await sendToAEATWithRetry(finalXML, companyConfig, certForTLS);
    
    // ✅ Clear sensitive data AFTER use
    decryptedCertificate = '';
    decryptedPassword = '';
    
    if (response.status === 'accepted' && response.csv) {
      console.log(`✅ CSV detected: ${response.csv}`);
      
      // Recalculate QR with correct host
      response.qr_code = buildVerificationURL(companyConfig, response.csv);
      console.log(`✅ QR URL: ${response.qr_code}`);
      
      const currentHashMatch = finalXML.match(/<Huella>([^<]+)<\/Huella>/);
      response.current_hash = currentHashMatch ? currentHashMatch[1] : null;
      response.company_id = invoice.company_id;
      
      if (!response.timestamp) {
        response.timestamp = new Date().toISOString();
      }
      if (!response.numero_registro) {
        response.numero_registro = Date.now();
      }
    }
    
  } catch (error: any) {
    console.error('❌ AEAT service error:', error);
    
    // Check if it's a 401 certificate error (revoked/unauthorized)
    const errorMsg = error.message || '';
    const is401CertError = error.status === 401 || errorMsg.includes('401') || 
                          errorMsg.toLowerCase().includes('revocado') || 
                          errorMsg.toLowerCase().includes('revoked') ||
                          errorMsg.toLowerCase().includes('no autorizado') ||
                          errorMsg.toLowerCase().includes('unauthorized');
    
    if (is401CertError) {
      console.error('🚫 Certificate authentication failed (401/revoked/unauthorized) - NOT adding to retry queue');
      
      const certificateError = errorMsg.toLowerCase().includes('revocado') || errorMsg.toLowerCase().includes('revoked')
        ? 'certificate_revoked'
        : 'certificate_unauthorized';
      
      return {
        status: 'error',
        response_code: certificateError.toUpperCase(),
        response_message: `Certificado rechazado por AEAT: ${errorMsg}. Verifique que el certificado sea válido y no esté revocado.`,
        certificate_error: certificateError,
        requires_action: 'Debe cargar un certificado válido en la sección de Verifactu > Certificados',
      };
    }
    
    // For network/timeout errors, add to retry queue
    console.log('⏳ Network/timeout error, adding to queue for retry');
    await addToVerifactuQueue(supabaseClient, {
      company_id: invoice.company_id,
      invoice_id: invoice.id,
      action: 'send',
      request_data: { invoice, certificate, companyConfig },
      max_retries: companyConfig.max_retries || 3,
      error_message: error.message
    });
    
    return {
      status: 'queued',
      response_code: 'RETRY',
      response_message: `Service temporarily unavailable: ${error.message}. Added to retry queue.`,
      queued: true
    };
  }
  
  if (response.responseXML) {
    await storeXMLDocument(supabaseClient, {
      companyId: invoice.company_id,
      invoiceId: invoice.id,
      xmlType: 'response',
      xmlContent: response.responseXML,
    });
  }

  console.log('✅ Verifactu response received:', response);
  
  return {
    ...response,
    requestXML: finalXML,
    responseXML: response.responseXML,
    signed: companyConfig.enable_xades_signature && finalXML !== requestXML,
  };
}

async function queryVerifactu(invoice: any, certificate: any, companyConfig: any) {
  console.log('🔍 Querying Verifactu status for invoice:', invoice.number);
  
  try {
    // Decrypt certificate for mTLS
    const { certificate: decryptedCertificate, password: decryptedPassword } = 
      await decryptCertificateData(certificate.certificate_data, certificate.certificate_password);
    
    const certForTLS = {
      ...certificate,
      certificate_data: decryptedCertificate,
      certificate_password: decryptedPassword
    };
    
    const queryXML = buildQueryXML(invoice, companyConfig);
    const response = await sendToAEATWithRetry(queryXML, companyConfig, certForTLS);
    
    console.log('✅ Query response:', response);
    return response;
  } catch (error: any) {
    console.error('❌ Query failed:', error);
    
    return {
      status: invoice.verifactu_status || 'unknown',
      csv: invoice.verifactu_csv,
      response_code: 'CACHED',
      response_message: `Using cached status. Service error: ${error.message}`,
      cached: true
    };
  }
}

async function cancelVerifactu(invoice: any, certificate: any, companyConfig: any) {
  console.log('❌ Cancelling Verifactu for invoice:', invoice.number);
  
  try {
    // Decrypt certificate for mTLS
    const { certificate: decryptedCertificate, password: decryptedPassword } = 
      await decryptCertificateData(certificate.certificate_data, certificate.certificate_password);
    
    const certForTLS = {
      ...certificate,
      certificate_data: decryptedCertificate,
      certificate_password: decryptedPassword
    };
    
    const cancelXML = buildCancelXML(invoice, companyConfig);
    const response = await sendToAEATWithRetry(cancelXML, companyConfig, certForTLS);
    
    console.log('✅ Cancellation response:', response);
    return response;
  } catch (error: any) {
    console.error('❌ Cancellation failed:', error);
    
    return {
      status: 'error',
      response_code: 'ERROR',
      response_message: `Cancellation failed: ${error.message}`,
    };
  }
}

async function buildCompleteVerifactuXML(invoice: any, certificate: any, companyConfig: any, supabaseClient: any): Promise<string> {
  console.log('🔨 Building Verifactu XML according to official specification');
  
  const currentDate = new Date().toISOString();
  const invoiceDate = new Date(invoice.issue_date).toISOString().split('T')[0];
  const [year, month, day] = invoiceDate.split('-');
  const formattedInvoiceDate = `${day}-${month}-${year}`;
  
  console.log('🔗 Getting last hash for chaining');
  const { data: chainData } = await supabaseClient.rpc('get_last_verifactu_hash', {
    p_company_id: invoice.company_id
  });
  
  const lastHashData = chainData?.[0] || { es_primer_registro: true, hash_anterior: null };
  
  const fingerprint = await calculateVerifactuHash(invoice, companyConfig, currentDate, lastHashData.hash_anterior);
  
  console.log('🔒 Calculated legal hash:', { 
    isFirstRecord: lastHashData.es_primer_registro,
    previousHash: lastHashData.hash_anterior ? 'EXISTS' : 'NULL',
    newHash: fingerprint.substring(0, 16) + '...' 
  });
  
  // Build XML according to Verifactu specification (NOT SII)
  const xml = `<RegistroFactura>
  <IDFactura>
    <Emisor>
      <NIF>${invoice.companies.tax_id}</NIF>
      <Nombre>${escapeXml(invoice.companies.name)}</Nombre>
    </Emisor>
    <NumFactura>${escapeXml(invoice.number)}</NumFactura>
    <FechaExpedicion>${formattedInvoiceDate}</FechaExpedicion>
  </IDFactura>
  <TipoFactura>${invoice.tipo_factura || 'F1'}</TipoFactura>
  <ClaveRegimen>${invoice.clave_regimen_especial || '01'}</ClaveRegimen>
  <DescripcionFactura>${escapeXml(invoice.descripcion_operacion || 'Venta de bienes/servicios')}</DescripcionFactura>
  <Destinatario>
    <IDDestinatario>
      <NIF>${invoice.customers.tax_id}</NIF>
      <Nombre>${escapeXml(invoice.customers.name)}</Nombre>
    </IDDestinatario>
  </Destinatario>
  <ImporteTotal>${Number(invoice.total_amount).toFixed(2)}</ImporteTotal>
  <BaseImponible>${Number(invoice.subtotal).toFixed(2)}</BaseImponible>
  <Cuota>${Number(invoice.tax_amount).toFixed(2)}</Cuota>
  <TipoImpositivo>21.00</TipoImpositivo>
  <Huella>
    <EncadenamientoRegistroAnterior>
      <PrimerRegistro>${lastHashData.es_primer_registro ? 'S' : 'N'}</PrimerRegistro>
      ${!lastHashData.es_primer_registro && lastHashData.hash_anterior ? `<RegistroAnterior>
        <Huella>${lastHashData.hash_anterior}</Huella>
      </RegistroAnterior>` : ''}
    </EncadenamientoRegistroAnterior>
    <Software>
      <Nombre>${escapeXml(companyConfig.software_name || 'MOGES')}</Nombre>
      <Version>${escapeXml(companyConfig.software_version || '1.0')}</Version>
      ${companyConfig.id_software ? `<ID>${escapeXml(companyConfig.id_software)}</ID>` : ''}
    </Software>
    <FechaHoraHuella>${currentDate}</FechaHoraHuella>
    <Huella>${fingerprint}</Huella>
  </Huella>
</RegistroFactura>`;

  console.log('✅ Verifactu XML built successfully');
  return xml;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function calculateVerifactuHash(invoice: any, companyConfig: any, currentDate: string, previousHash: string | null): Promise<string> {
  console.log('🔒 Calculating Verifactu hash using SHA-256');
  
  const invoiceDate = new Date(invoice.issue_date).toISOString().split('T')[0];
  
  let hashString = '';
  
  // 1. IDEmisorFactura (NIF)
  hashString += invoice.companies.tax_id;
  
  // 2. NumSerieFacturaEmisor
  hashString += invoice.number;
  
  // 3. FechaExpedicionFacturaEmisor (DD-MM-YYYY)
  const [year, month, day] = invoiceDate.split('-');
  hashString += `${day}-${month}-${year}`;
  
  // 4. TipoFactura
  hashString += invoice.tipo_factura || 'F1';
  
  // 5. CuotaTotal (in cents)
  const taxAmountCents = Math.round(parseFloat(invoice.tax_amount || 0) * 100);
  hashString += taxAmountCents.toString();
  
  // 6. ImporteTotal (in cents)
  const totalAmountCents = Math.round(parseFloat(invoice.total_amount) * 100);
  hashString += totalAmountCents.toString();
  
  // 7. HuellaAnterior
  if (previousHash) {
    hashString += previousHash;
  }
  
  // 8. FechaHoraHuella (DD-MM-YYYYTHH:MM:SSZ)
  const timestamp = new Date(currentDate);
  const formattedTimestamp = `${String(timestamp.getUTCDate()).padStart(2, '0')}-${String(timestamp.getUTCMonth() + 1).padStart(2, '0')}-${timestamp.getUTCFullYear()}T${String(timestamp.getUTCHours()).padStart(2, '0')}:${String(timestamp.getUTCMinutes()).padStart(2, '0')}:${String(timestamp.getUTCSeconds()).padStart(2, '0')}Z`;
  hashString += formattedTimestamp;
  
  console.log('🔧 Hash components:', {
    nif: invoice.companies.tax_id,
    number: invoice.number,
    date: `${day}-${month}-${year}`,
    type: invoice.tipo_factura || 'F1',
    taxCents: taxAmountCents,
    totalCents: totalAmountCents,
    previousHash: previousHash ? 'EXISTS' : 'NULL',
    timestamp: formattedTimestamp
  });
  
  const encoder = new TextEncoder();
  const data = encoder.encode(hashString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  
  console.log('✅ SHA-256 hash calculated:', hashHex.substring(0, 16) + '...');
  return hashHex;
}

async function storeXMLDocument(supabaseClient: any, data: {
  companyId: string;
  invoiceId: string;
  xmlType: 'request' | 'response';
  xmlContent: string;
}) {
  try {
    const { error } = await supabaseClient
      .from('verifactu_xml_documents')
      .insert({
        company_id: data.companyId,
        invoice_id: data.invoiceId,
        xml_type: data.xmlType,
        xml_content: data.xmlContent,
      });

    if (error) {
      console.error('❌ Error storing XML document:', error);
    } else {
      console.log('✅ XML document stored successfully');
    }
  } catch (error) {
    console.error('❌ Exception storing XML document:', error);
  }
}

async function logVerifactuOperation(companyId: string, invoiceId: string, action: string, result: any, supabaseClient: any) {
  console.log('📝 Logging Verifactu operation');
  
  try {
    const { error } = await supabaseClient
      .from('verifactu_logs')
      .insert({
        company_id: companyId,
        invoice_id: invoiceId,
        action,
        request_data: { action, timestamp: new Date().toISOString() },
        response_data: result,
        status: result.status || 'unknown',
        error_message: result.error || null
      });

    if (error) {
      console.error('❌ Error logging Verifactu operation:', error);
    } else {
      console.log('✅ Verifactu operation logged successfully');
    }
  } catch (error) {
    console.error('❌ Exception logging Verifactu operation:', error);
  }
}

async function updateInvoiceVerifactuStatus(invoiceId: string, result: any, supabaseClient: any) {
  console.log('📝 Updating invoice Verifactu status');
  
  try {
    const updateData: any = {
      verifactu_status: result.status,
      verifactu_response_code: result.response_code,
      verifactu_response_message: result.response_message,
    };

    if (result.status === 'accepted' || result.status === 'accepted_with_warnings') {
      updateData.verifactu_sent_at = new Date().toISOString();
      updateData.verifactu_csv = result.csv;
      updateData.verifactu_qr_code = result.qr_code;
      updateData.verifactu_chain_data = result.chain_data;
      
      // If no CSV, add note to response message
      if (!result.csv) {
        updateData.verifactu_response_message = 'Factura aceptada por AEAT (entorno de pruebas sin CSV/QR)';
      }
    }

    if (result.status === 'accepted') {
      updateData.verifactu_huella = result.current_hash;
      updateData.verifactu_fecha_hora_huella = result.timestamp;
      updateData.verifactu_numero_registro = result.numero_registro;
      
      if (result.current_hash && result.numero_registro) {
        await supabaseClient.rpc('update_company_last_verifactu_hash', {
          p_company_id: result.company_id,
          p_hash: result.current_hash,
          p_numero_registro: result.numero_registro,
          p_fecha_hora: result.timestamp
        });
        console.log('🔗 Updated company hash chain for next invoice');
      }
    }

    const { error } = await supabaseClient
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId);

    if (error) {
      console.error('❌ Error updating invoice Verifactu status:', error);
    } else {
      console.log('✅ Invoice Verifactu status updated successfully');
    }
  } catch (error) {
    console.error('❌ Exception updating invoice Verifactu status:', error);
  }
}

async function isAEATServiceAvailable(endpoint: string): Promise<boolean> {
  try {
    console.log('🔍 Checking AEAT service availability:', endpoint);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(endpoint + '?wsdl', {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const available = response.ok;
    console.log(available ? '✅ AEAT service is available' : '❌ AEAT service is not available');
    return available;
  } catch (error) {
    console.log('❌ AEAT service check failed:', error);
    return false;
  }
}

async function addToVerifactuQueue(supabaseClient: any, queueData: {
  company_id: string;
  invoice_id: string;
  action: string;
  request_data: any;
  max_retries: number;
  error_message?: string;
}) {
  console.log('📋 Adding request to Verifactu queue');
  
  const retryDelaySeconds = 60;
  const nextRetryAt = new Date(Date.now() + retryDelaySeconds * 1000);
  
  try {
    const { error } = await supabaseClient
      .from('verifactu_queue')
      .insert({
        company_id: queueData.company_id,
        invoice_id: queueData.invoice_id,
        action: queueData.action,
        request_data: queueData.request_data,
        max_retries: queueData.max_retries,
        next_retry_at: nextRetryAt.toISOString(),
        error_message: queueData.error_message || null,
        status: 'pending'
      });

    if (error) {
      console.error('❌ Error adding to queue:', error);
      throw error;
    }
    
    console.log('✅ Request added to queue successfully');
  } catch (error) {
    console.error('❌ Exception adding to queue:', error);
    throw error;
  }
}

async function sendToAEATWithRetry(xmlContent: string, companyConfig: any, certificate: any, maxRetries: number = 3): Promise<any> {
  console.log('📤 Sending to AEAT with retry logic');
  
  // Normalize endpoint and default to official WSDL SOAP address
  let endpoint = companyConfig.endpoint_url || 'https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';
  
  const isProduction = companyConfig.is_production || 
                       companyConfig.environment === 'production' || 
                       endpoint.includes('www.agenciatributaria.gob.es') || 
                       endpoint.includes('www10.agenciatributaria.gob.es') || 
                       endpoint.includes('www7.aeat.es');
  
  function normalizePath(url: string, prod: boolean): string {
    let out = url || '';
    // Host fixes
    if (!prod) {
      out = out.replace('prewww7', 'prewww1');
      out = out.replace('prewww10', 'prewww1');
    } else {
      out = out.replace('www7.aeat.es', 'www1.agenciatributaria.gob.es');
      out = out.replace('www10.agenciatributaria.gob.es', 'www1.agenciatributaria.gob.es');
    }
    // Path fixes: map legacy endpoints to current SOAP path
    out = out.replace('/TIKE-CONT-WS/services/VeriFactuSistemaFacturacion', '/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP');
    out = out.replace('/wlpl/TIKE-CONT-WS/services/VeriFactuSistemaFacturacion', '/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP');
    out = out.replace('/ws/VeriFactu', '/ws/SistemaFacturacion/VerifactuSOAP');
    out = out.replace('/services/VeriFactu', '/ws/SistemaFacturacion/VerifactuSOAP');
    out = out.replace('/services/VeriFactuSistemaFacturacion', '/ws/SistemaFacturacion/VerifactuSOAP');
    out = out.replace('/ws/RegistroFactura', '/ws/SistemaFacturacion/VerifactuSOAP');
    // Ensure https scheme and host present
    if (!out || !out.startsWith('http')) {
      out = prod
        ? 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
        : 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';
    }
    return out;
  }
  
  endpoint = normalizePath(endpoint, isProduction);
  
  console.log(`📍 Final endpoint: ${endpoint}`);
  const timeout = (companyConfig.timeout_seconds || 30) * 1000;
  
  // Convert P12 certificate to PEM format for mutual TLS
  let pemCert: { cert: string; key: string } | null = null;
  try {
    pemCert = convertP12ToPEM(certificate.certificate_data, certificate.certificate_password);
    console.log('🔐 Certificate converted to PEM for mutual TLS authentication');
  } catch (error: any) {
    console.error('❌ Failed to convert certificate:', error);
    throw new Error(`Certificate conversion failed: ${error.message}`);
  }
  
  // Create HTTP client with client certificate for mutual TLS
  // @ts-ignore Deno-specific API
  const httpClient = Deno.createHttpClient({
    cert: pemCert.cert,
    key: pemCert.key,
  });
  console.log('✅ HTTP client created with client certificate');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to AEAT endpoint with mutual TLS: ${endpoint}`);
      
      const soapEnvelope = buildSOAPEnvelope(xmlContent);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '',
        },
        body: soapEnvelope,
        signal: controller.signal,
        // @ts-ignore Deno-specific client option for mutual TLS
        client: httpClient,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        const bodyLower = (errBody || '').toLowerCase();
        console.error('❌ AEAT HTTP error:', response.status, response.statusText, 'Body snippet:', errBody?.slice(0, 500));
        // Friendly mapping for common 401 causes
        if (response.status === 401) {
          if (bodyLower.includes('certificado revocado') || bodyLower.includes('revocado')) {
            throw new Error(`HTTP 401: Certificado del cliente revocado por AEAT. Cargue un certificado válido y vigente. Detalle: ${errBody.slice(0, 200)}`);
          }
          if (bodyLower.includes('no autorizado') || bodyLower.includes('unauthorized')) {
            throw new Error(`HTTP 401: Certificado no autorizado para el servicio Verifactu. Verifique que el NIF del certificado coincide con el de la empresa y que está habilitado en AEAT. Detalle: ${errBody.slice(0, 200)}`);
          }
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errBody ? ' - ' + errBody.slice(0, 200) : ''}`);
      }

      const responseText = await response.text();
      console.log('✅ AEAT Response received on attempt', attempt);
      
      return parseSOAPResponse(responseText);
      
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        // Close the HTTP client before throwing
        // @ts-ignore
        httpClient.close();
        throw new Error(`All ${maxRetries} attempts failed. Last error: ${error.message}`);
      }
      
      const delay = Math.pow(2, attempt - 1) * 2000;
      console.log(`⏰ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Close the HTTP client after all attempts
  // @ts-ignore
  httpClient.close();
  throw new Error('Unexpected error in retry logic');
}

function buildSOAPEnvelope(xmlContent: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:veri="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/VeriFactu.xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <veri:RegistroFacturaVerifactu>
      ${xmlContent}
    </veri:RegistroFacturaVerifactu>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function parseSOAPResponse(soapResponse: string): any {
  console.log('📄 Parsing SOAP response from AEAT');
  console.log('📄 Full SOAP Response (first 500 chars):', soapResponse.slice(0, 500));
  
  const csvMatch = soapResponse.match(/<CSV>([^<]+)<\/CSV>/i);
  const errorMatch = soapResponse.match(/<CodigoError>([^<]+)<\/CodigoError>/i);
  const messageMatch = soapResponse.match(/<Descripcion>([^<]+)<\/Descripcion>/i);
  const timestampMatch = soapResponse.match(/<FechaPresentacion>([^<]+)<\/FechaPresentacion>/i);
  const registroMatch = soapResponse.match(/<NumeroRegistro>([^<]+)<\/NumeroRegistro>/i);
  
  console.log('🔍 CSV found:', csvMatch ? csvMatch[1] : 'NO CSV');
  console.log('🔍 Numero Registro found:', registroMatch ? registroMatch[1] : 'NO REG');
  
  if (errorMatch && errorMatch[1] !== '0' && errorMatch[1] !== '00') {
    return {
      status: 'error',
      response_code: errorMatch[1],
      response_message: messageMatch ? messageMatch[1] : 'Unknown error',
      responseXML: soapResponse
    };
  }

  const csv = csvMatch ? csvMatch[1] : null;
  const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
  const numeroRegistro = registroMatch ? parseInt(registroMatch[1]) : Date.now();
  
  // If no CSV but we have numero_registro, log warning
  if (!csv && numeroRegistro) {
    console.warn('⚠️ AEAT accepted but did not return CSV. This may be expected in test environment.');
  }
  
  // Don't set qr_code here - will be set by sendToVerifactu with correct host
  return {
    status: 'accepted',
    csv,
    qr_code: null,
    response_code: '0',
    response_message: csv ? 'Registro realizado correctamente' : 'Registro realizado correctamente (sin CSV - entorno de pruebas)',
    responseXML: soapResponse,
    timestamp,
    numero_registro: numeroRegistro,
  };
}

function buildQueryXML(invoice: any, companyConfig: any): string {
  const invoiceDate = new Date(invoice.issue_date).toISOString().split('T')[0];
  const [year, month, day] = invoiceDate.split('-');
  
  return `<ConsultaFactura>
  <IDFactura>
    <NIF>${invoice.companies.tax_id}</NIF>
    <NumFactura>${escapeXml(invoice.number)}</NumFactura>
    <FechaExpedicion>${day}-${month}-${year}</FechaExpedicion>
  </IDFactura>
</ConsultaFactura>`;
}

function buildCancelXML(invoice: any, companyConfig: any): string {
  const invoiceDate = new Date(invoice.issue_date).toISOString().split('T')[0];
  const [year, month, day] = invoiceDate.split('-');
  
  return `<AnulacionFactura>
  <IDFactura>
    <NIF>${invoice.companies.tax_id}</NIF>
    <NumFactura>${escapeXml(invoice.number)}</NumFactura>
    <FechaExpedicion>${day}-${month}-${year}</FechaExpedicion>
  </IDFactura>
  <Motivo>Anulación solicitada</Motivo>
</AnulacionFactura>`;
}

async function signXMLWithXAdES(xmlContent: string, decryptedCertificateData: string, decryptedPassword: string, companyId: string, invoiceId: string, companyConfig: any, supabaseClient: any): Promise<string> {
  console.log('🖊️ Calling XAdES signer service with pre-decrypted certificate');
  
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/xades-signer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        xmlContent,
        certificateData: decryptedCertificateData,
        certificatePassword: decryptedPassword,
        signatureType: companyConfig.xades_signature_type || 'XAdES-BES',
        includeTimestamp: companyConfig.include_timestamp || false,
        companyId: companyId,
        invoiceId: invoiceId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`XAdES signing service error: ${errorData.error}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`XAdES signing failed: ${result.error}`);
    }

    console.log('✅ XAdES signing completed successfully');
    return result.signedXML;
    
  } catch (error: any) {
    console.error('❌ XAdES signing service error:', error);
    throw new Error(`Failed to sign XML with XAdES: ${error.message}`);
  }
}
