import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import * as forge from 'https://esm.sh/node-forge@1.3.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyCertificateRequest {
  certificateId: string;
}

interface CertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  isExpired: boolean;
  daysUntilExpiry: number;
  ocspUrl?: string;
  crlUrl?: string;
  isRevoked?: boolean;
  revocationDate?: string;
  revocationReason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Certificate verification request received');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { certificateId } = await req.json() as VerifyCertificateRequest;

    console.log(`📋 Fetching certificate: ${certificateId}`);

    const { data: certificate, error: certError } = await supabaseClient
      .from('verifactu_certificates')
      .select('*')
      .eq('id', certificateId)
      .single();

    if (certError || !certificate) {
      throw new Error('Certificate not found');
    }

    console.log('🔓 Decrypting certificate data');

    // Decrypt certificate data using the encrypt-certificate function
    const decryptData = async (encryptedData: string): Promise<string> => {
      const { data, error } = await supabaseClient.functions.invoke('encrypt-certificate', {
        body: {
          action: 'decrypt',
          data: encryptedData,
          type: 'certificate'
        }
      });

      if (error) {
        console.error('❌ Decryption error:', error);
        throw new Error(`Failed to decrypt: ${error.message}`);
      }

      return data.result;
    };

    const certificateData = await decryptData(certificate.certificate_data);
    const password = await decryptData(certificate.encrypted_password || certificate.certificate_password);

    console.log('📜 Parsing certificate');

    const parseCertificate = (certData: string, pwd: string): CertificateInfo => {
      try {
        let cert: any;

        if (certData.includes('-----BEGIN CERTIFICATE-----')) {
          const certPem = certData.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/)?.[0];
          if (!certPem) throw new Error('No certificate found in PEM data');
          cert = forge.pki.certificateFromPem(certPem);
        } else {
          const p12Der = forge.util.decode64(certData);
          const p12Asn1 = forge.asn1.fromDer(p12Der);
          const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, pwd || '');

          const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
          if (!certBags || certBags.length === 0) {
            throw new Error('No certificate found in P12');
          }

          cert = certBags[0].cert;
        }

        const subject = cert.subject.attributes
          .map((a: any) => `${a.shortName || a.name}=${a.value}`)
          .join(', ');
        const issuer = cert.issuer.attributes
          .map((a: any) => `${a.shortName || a.name}=${a.value}`)
          .join(', ');
        const serialNumber = cert.serialNumber;
        const validFrom = cert.validity.notBefore.toISOString();
        const validTo = cert.validity.notAfter.toISOString();

        const now = new Date();
        const notAfter = cert.validity.notAfter;
        const isExpired = now > notAfter;
        const daysUntilExpiry = Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Extract OCSP and CRL URLs from extensions
        let ocspUrl: string | undefined;
        let crlUrl: string | undefined;

        if (cert.extensions) {
          for (const ext of cert.extensions) {
            // Authority Information Access (OCSP)
            if (ext.id === '1.3.6.1.5.5.7.1.1') {
              try {
                const aiaValue = ext.value || '';
                const ocspMatch = aiaValue.match(/http[s]?:\/\/[^\s]+/);
                if (ocspMatch) {
                  ocspUrl = ocspMatch[0];
                }
              } catch (e) {
                console.warn('⚠️ Could not parse AIA extension:', e);
              }
            }
            // CRL Distribution Points
            if (ext.id === '2.5.29.31') {
              try {
                const crlValue = ext.value || '';
                const crlMatch = crlValue.match(/http[s]?:\/\/[^\s]+/);
                if (crlMatch) {
                  crlUrl = crlMatch[0];
                }
              } catch (e) {
                console.warn('⚠️ Could not parse CRL extension:', e);
              }
            }
          }
        }

        return {
          subject,
          issuer,
          serialNumber,
          validFrom,
          validTo,
          isExpired,
          daysUntilExpiry,
          ocspUrl,
          crlUrl,
        };
      } catch (error: any) {
        console.error('❌ Certificate parsing error:', error);
        throw new Error(`Failed to parse certificate: ${error.message}`);
      }
    };

    const certInfo = parseCertificate(certificateData, password);

    console.log('✅ Certificate info extracted:', {
      subject: certInfo.subject,
      serialNumber: certInfo.serialNumber,
      isExpired: certInfo.isExpired,
      daysUntilExpiry: certInfo.daysUntilExpiry,
      ocspUrl: certInfo.ocspUrl,
      crlUrl: certInfo.crlUrl,
    });

    // Check revocation status via OCSP/CRL
    let isRevoked = false;
    let revocationDate: string | undefined;
    let revocationReason: string | undefined;

    console.log('🔍 Checking revocation status...');
    
    // Note: Full OCSP/CRL checking requires additional HTTP requests and complex parsing
    // For now, we'll mark this as a simplified check and log that it needs implementation
    console.log('⚠️ OCSP/CRL revocation checking not yet fully implemented');
    console.log('📌 OCSP URL:', certInfo.ocspUrl || 'not found');
    console.log('📌 CRL URL:', certInfo.crlUrl || 'not found');

    // Verificar estado básico del certificado
    let status = 'unknown';
    let statusMessage = '';

    if (isRevoked) {
      status = 'revoked';
      statusMessage = `Certificado revocado${revocationDate ? ` el ${new Date(revocationDate).toLocaleDateString('es-ES')}` : ''}`;
    } else if (certInfo.isExpired) {
      status = 'expired';
      statusMessage = `El certificado expiró el ${new Date(certInfo.validTo).toLocaleDateString('es-ES')}`;
    } else if (certInfo.daysUntilExpiry < 0) {
      status = 'not_yet_valid';
      statusMessage = `El certificado no será válido hasta ${new Date(certInfo.validFrom).toLocaleDateString('es-ES')}`;
    } else if (certInfo.daysUntilExpiry <= 30) {
      status = 'expiring_soon';
      statusMessage = `El certificado expirará en ${certInfo.daysUntilExpiry} días`;
    } else {
      status = 'valid';
      statusMessage = `Certificado válido. Expira en ${certInfo.daysUntilExpiry} días`;
    }

    console.log(`📊 Certificate status: ${status}`);

    // Update certificate metadata in database
    await supabaseClient
      .from('verifactu_certificates')
      .update({
        subject_name: certInfo.subject,
        issuer_name: certInfo.issuer,
        serial_number: certInfo.serialNumber,
        valid_from: certInfo.validFrom,
        valid_until: certInfo.validTo,
      })
      .eq('id', certificateId);

    return new Response(
      JSON.stringify({
        success: true,
        status,
        message: statusMessage,
        certificateInfo: {
          subject: certInfo.subject,
          issuer: certInfo.issuer,
          serialNumber: certInfo.serialNumber,
          validFrom: certInfo.validFrom,
          validTo: certInfo.validTo,
          daysUntilExpiry: certInfo.daysUntilExpiry,
          ocspUrl: certInfo.ocspUrl,
          crlUrl: certInfo.crlUrl,
          isRevoked,
          revocationDate,
          revocationReason,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Certificate verification error:', error);
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
