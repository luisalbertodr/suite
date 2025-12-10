import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import forge from "npm:node-forge@1.3.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to build the correct verification URL based on environment
const buildVerificationURL = (companyConfig: any, csv: string): string => {
  const endpoint = companyConfig.endpoint_url || '';
  const isProduction = companyConfig.is_production || 
                      companyConfig.environment === 'production' || 
                      endpoint.includes('www7.aeat.es');
  
  const baseUrl = isProduction 
    ? 'https://www2.agenciatributaria.gob.es'
    : 'https://prewww10.aeat.es';
  
  return `${baseUrl}/wlpl/TIKE-CONT/ValidarFactura?csv=${csv}`;
};

const buildSOAPEnvelope = (xmlContent: string): string => {
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
};

class AEATWebServiceClient {
  private endpoint: string;
  private timeout: number;
  private httpClient: any;

  constructor(endpoint: string, timeout: number = 30000, certPEM?: { cert: string; key: string }) {
    this.endpoint = endpoint;
    this.timeout = timeout;
    
    // Create HTTP client with client certificate for mutual TLS if provided
    if (certPEM) {
      // @ts-ignore Deno-specific API
      this.httpClient = Deno.createHttpClient({
        cert: certPEM.cert,
        key: certPEM.key,
      });
      console.log('✅ HTTP client created with client certificate for mutual TLS');
    } else {
      this.httpClient = null;
    }
  }

  async sendRequest(xmlContent: string, certificate: any): Promise<any> {
    console.log('📤 Sending request to AEAT Verifactu with mutual TLS:', this.endpoint);
    
    const soapEnvelope = buildSOAPEnvelope(xmlContent);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const fetchOptions: any = {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '',
        },
        body: soapEnvelope,
        signal: controller.signal,
      };
      
      // Add client certificate if available
      if (this.httpClient) {
        // @ts-ignore Deno-specific client option
        fetchOptions.client = this.httpClient;
      }

      const response = await fetch(this.endpoint, fetchOptions);

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        const bodyLower = (errBody || '').toLowerCase();
        console.error('❌ AEAT HTTP error:', response.status, response.statusText, 'Body snippet:', errBody?.slice(0, 500));
        if (response.status === 401) {
          if (bodyLower.includes('certificado revocado') || bodyLower.includes('revocado')) {
            throw new Error(`HTTP 401: Certificado del cliente revocado por AEAT. Cargue un certificado válido y vigente. Detalle: ${errBody.slice(0, 200)}`);
          }
          if (bodyLower.includes('no autorizado') || bodyLower.includes('unauthorized')) {
            throw new Error(`HTTP 401: Certificado no autorizado para el servicio Verifactu. Verifique NIF del certificado y habilitación en AEAT. Detalle: ${errBody.slice(0, 200)}`);
          }
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errBody ? ' - ' + errBody.slice(0, 200) : ''}`);
      }

      const responseText = await response.text();
      console.log('✅ AEAT Response received');
      
      return this.parseSOAPResponse(responseText);
    } catch (error: any) {
      console.error('❌ AEAT WS Error:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - AEAT service not responding');
      }
      
      throw new Error(`AEAT service error: ${error.message}`);
    }
  }
  
  close() {
    if (this.httpClient) {
      // @ts-ignore
      this.httpClient.close();
    }
  }

  private parseSOAPResponse(soapResponse: string): any {
    const csvMatch = soapResponse.match(/<CSV>([^<]+)<\/CSV>/i);
    const errorMatch = soapResponse.match(/<CodigoError>([^<]+)<\/CodigoError>/i);
    const messageMatch = soapResponse.match(/<Descripcion>([^<]+)<\/Descripcion>/i);
    
    if (errorMatch && errorMatch[1] !== '0' && errorMatch[1] !== '00') {
      return {
        status: 'error',
        response_code: errorMatch[1],
        response_message: messageMatch ? messageMatch[1] : 'Unknown error',
        responseXML: soapResponse
      };
    }

    // Don't set qr_code here - will be set by sendToVerifactuReal with correct host
    return {
      status: 'accepted',
      csv: csvMatch ? csvMatch[1] : null,
      qr_code: null,
      response_code: '0',
      response_message: 'Registro realizado correctamente',
      responseXML: soapResponse
    };
  }
}

serve(async (req: Request) => {
  console.log('🔄 Verifactu Queue Processor called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: queueItems, error: queueError } = await supabaseClient
      .from('verifactu_queue')
      .select(`
        *,
        invoices!inner(*, companies!inner(*), customers!inner(*))
      `)
      .eq('status', 'pending')
      .lt('next_retry_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('❌ Error fetching queue items:', queueError);
      throw queueError;
    }

    console.log(`📊 Processing ${queueItems?.length || 0} queue items`);

    const results = [];
    for (const item of queueItems || []) {
      try {
        await supabaseClient
          .from('verifactu_queue')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        const { data: companyConfig } = await supabaseClient
          .from('verifactu_company_config')
          .select('*')
          .eq('company_id', item.company_id)
          .single();

        const { data: certificate } = await supabaseClient
          .from('verifactu_certificates')
          .select('*')
          .eq('company_id', item.company_id)
          .eq('is_active', true)
          .single();

        if (!companyConfig || !certificate) {
          await handleQueueItemError(supabaseClient, item.id, 'Missing configuration or certificate');
          continue;
        }

        // Decrypt certificate data
        const decryptedCertificate = await decryptCertificateData(certificate.certificate_data, 'certificate');
        const decryptedPassword = await decryptCertificateData(certificate.certificate_password, 'password');
        
        // Convert P12 to PEM for mutual TLS
        let pemCert: { cert: string; key: string } | null = null;
        try {
          pemCert = convertP12ToPEM(decryptedCertificate, decryptedPassword);
          console.log('🔐 Certificate converted to PEM for mutual TLS authentication');
        } catch (error: any) {
          console.error('❌ Failed to convert certificate:', error);
          await handleQueueItemError(supabaseClient, item.id, `Certificate conversion failed: ${error.message}`);
          continue;
        }

        // Normalize endpoint and default to official WSDL SOAP address
        let endpoint = companyConfig.endpoint_url || 'https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';
        
        const isProduction = companyConfig.is_production || 
                             companyConfig.environment === 'production' || 
                             endpoint.includes('www.agenciatributaria.gob.es') || 
                             endpoint.includes('www10.agenciatributaria.gob.es') || 
                             endpoint.includes('www7.aeat.es');
        
        const normalizePath = (url: string, prod: boolean): string => {
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
        };
        
        endpoint = normalizePath(endpoint, isProduction);
        
        console.log(`📍 Final endpoint: ${endpoint}`);
        
        const wsClient = new AEATWebServiceClient(
          endpoint,
          (companyConfig.timeout_seconds || 30) * 1000,
          pemCert
        );

        const result = await processVerifactuRequest(
          item,
          wsClient,
          companyConfig,
          {
            ...certificate,
            certificate_data: decryptedCertificate,
            certificate_password: decryptedPassword
          },
          supabaseClient
        );
        
        // Close the HTTP client
        wsClient.close();

        await supabaseClient
          .from('verifactu_queue')
          .update({
            status: 'success',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        await updateInvoiceVerifactuStatus(item.invoice_id, result, supabaseClient);
        await logVerifactuOperation(item.company_id, item.invoice_id, item.action, result, supabaseClient);

        results.push({ id: item.id, status: 'success', result });

      } catch (error: any) {
        console.error(`❌ Error processing queue item ${item.id}:`, error);
        await handleQueueItemError(supabaseClient, item.id, error.message);
        results.push({ id: item.id, status: 'error', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: results.length,
        success: results.filter(r => r.status === 'success').length,
        errors: results.filter(r => r.status === 'error').length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Queue processor error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processVerifactuRequest(
  queueItem: any,
  wsClient: AEATWebServiceClient,
  companyConfig: any,
  certificate: any,
  supabaseClient: any
) {
  const { action } = queueItem;
  const invoice = queueItem.invoices;

  switch (action) {
    case 'send':
      return await sendToVerifactuReal(invoice, certificate, companyConfig, wsClient, supabaseClient);
    case 'query':
      return await queryVerifactuReal(invoice, certificate, companyConfig, wsClient);
    case 'cancel':
      return await cancelVerifactuReal(invoice, certificate, companyConfig, wsClient);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function sendToVerifactuReal(
  invoice: any,
  certificate: any,
  companyConfig: any,
  wsClient: AEATWebServiceClient,
  supabaseClient: any
) {
  console.log('📤 Processing Verifactu send for invoice:', invoice.number);
  
  // Certificate is already decrypted - passed from the main loop
  const requestXML = await buildCompleteVerifactuXML(invoice, certificate, companyConfig, supabaseClient);
  console.log('📄 Verifactu XML built');
  
  await storeXMLDocument(supabaseClient, {
    companyId: invoice.company_id,
    invoiceId: invoice.id,
    xmlType: 'request',
    xmlContent: requestXML,
  });
  
  const response = await wsClient.sendRequest(requestXML, certificate);
  
  // Recalculate QR with correct host if CSV was received
  if (response.status === 'accepted' && response.csv) {
    response.qr_code = buildVerificationURL(companyConfig, response.csv);
    console.log(`✅ QR URL recalculated: ${response.qr_code}`);
  }
  
  if (response.responseXML) {
    await storeXMLDocument(supabaseClient, {
      companyId: invoice.company_id,
      invoiceId: invoice.id,
      xmlType: 'response',
      xmlContent: response.responseXML,
    });
  }
  
  return {
    ...response,
    requestXML,
  };
}

async function queryVerifactuReal(
  invoice: any,
  certificate: any,
  companyConfig: any,
  wsClient: AEATWebServiceClient
) {
  console.log('🔍 Querying Verifactu status for invoice:', invoice.number);
  
  const queryXML = buildQueryXML(invoice, companyConfig);
  return await wsClient.sendRequest(queryXML, certificate);
}

async function cancelVerifactuReal(
  invoice: any,
  certificate: any,
  companyConfig: any,
  wsClient: AEATWebServiceClient
) {
  console.log('❌ Cancelling Verifactu for invoice:', invoice.number);
  
  const cancelXML = buildCancelXML(invoice, companyConfig);
  return await wsClient.sendRequest(cancelXML, certificate);
}

async function handleQueueItemError(supabaseClient: any, itemId: string, errorMessage: string) {
  const { data: item } = await supabaseClient
    .from('verifactu_queue')
    .select('retry_count, max_retries')
    .eq('id', itemId)
    .single();

  if (!item) return;

  const newRetryCount = item.retry_count + 1;
  const hasRetriesLeft = newRetryCount < item.max_retries;

  if (hasRetriesLeft) {
    const retryDelayMinutes = Math.pow(2, newRetryCount) * 5;
    const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

    await supabaseClient
      .from('verifactu_queue')
      .update({
        status: 'pending',
        retry_count: newRetryCount,
        next_retry_at: nextRetryAt.toISOString(),
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId);

    console.log(`⏰ Scheduled retry ${newRetryCount}/${item.max_retries} for queue item ${itemId} at ${nextRetryAt}`);
  } else {
    await supabaseClient
      .from('verifactu_queue')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId);

    console.log(`❌ Queue item ${itemId} failed after ${item.max_retries} retries`);
  }
}

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

async function buildCompleteVerifactuXML(invoice: any, certificate: any, companyConfig: any, supabaseClient: any): Promise<string> {
  const currentDate = new Date().toISOString();
  const invoiceDate = new Date(invoice.issue_date).toISOString().split('T')[0];
  const [year, month, day] = invoiceDate.split('-');
  const formattedInvoiceDate = `${day}-${month}-${year}`;
  
  const { data: chainData } = await supabaseClient.rpc('get_last_verifactu_hash', {
    p_company_id: invoice.company_id
  });
  
  const lastHashData = chainData?.[0] || { es_primer_registro: true, hash_anterior: null };
  const fingerprint = await calculateVerifactuHash(invoice, companyConfig, currentDate, lastHashData.hash_anterior);
  
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
  const invoiceDate = new Date(invoice.issue_date).toISOString().split('T')[0];
  
  let hashString = '';
  hashString += invoice.companies.tax_id;
  hashString += invoice.number;
  
  const [year, month, day] = invoiceDate.split('-');
  hashString += `${day}-${month}-${year}`;
  hashString += invoice.tipo_factura || 'F1';
  
  const taxAmountCents = Math.round(parseFloat(invoice.tax_amount || 0) * 100);
  hashString += taxAmountCents.toString();
  
  const totalAmountCents = Math.round(parseFloat(invoice.total_amount) * 100);
  hashString += totalAmountCents.toString();
  
  if (previousHash) {
    hashString += previousHash;
  }
  
  const timestamp = new Date(currentDate);
  const formattedTimestamp = `${String(timestamp.getUTCDate()).padStart(2, '0')}-${String(timestamp.getUTCMonth() + 1).padStart(2, '0')}-${timestamp.getUTCFullYear()}T${String(timestamp.getUTCHours()).padStart(2, '0')}:${String(timestamp.getUTCMinutes()).padStart(2, '0')}:${String(timestamp.getUTCSeconds()).padStart(2, '0')}Z`;
  hashString += formattedTimestamp;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(hashString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  
  return hashHex;
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

async function storeXMLDocument(supabaseClient: any, data: { companyId: string; invoiceId: string; xmlType: 'request' | 'response'; xmlContent: string; }) {
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
  }
}

async function logVerifactuOperation(companyId: string, invoiceId: string, action: string, result: any, supabaseClient: any) {
  const { error } = await supabaseClient
    .from('verifactu_logs')
    .insert({
      company_id: companyId,
      invoice_id: invoiceId,
      action,
      status: result.status || 'unknown',
      response_data: result,
    });

  if (error) {
    console.error('❌ Error logging operation:', error);
  }
}

async function updateInvoiceVerifactuStatus(invoiceId: string, result: any, supabaseClient: any) {
  const updateData: any = {
    verifactu_status: result.status,
    verifactu_response_code: result.response_code,
    verifactu_response_message: result.response_message,
    updated_at: new Date().toISOString(),
  };

  if (result.csv) {
    updateData.verifactu_csv = result.csv;
  }

  if (result.qr_code) {
    updateData.verifactu_qr_code = result.qr_code;
  }

  if (result.status === 'accepted') {
    updateData.verifactu_sent_at = new Date().toISOString();
  }

  const { error } = await supabaseClient
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId);

  if (error) {
    console.error('❌ Error updating invoice status:', error);
  }
}
