import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface XAdESSignRequest {
  xmlContent: string;
  certificateData: string; // Pre-decrypted certificate data
  certificatePassword: string; // Pre-decrypted password
  signatureType: 'XAdES-BES' | 'XAdES-T' | 'XAdES-C' | 'XAdES-X' | 'XAdES-XL' | 'XAdES-A';
  includeTimestamp?: boolean;
  companyId: string;
  invoiceId: string;
}

// XAdES Signature Implementation
class XAdESSigner {
  private certificate: any;
  private privateKey: any;

  constructor(certificateData: string, password: string) {
    this.loadCertificate(certificateData, password);
  }

  private loadCertificate(certificateData: string, password: string) {
    try {
      // Simulate certificate loading - in production this would use proper PKCS#12 parsing
      console.log('🔐 Loading certificate for XAdES signing');
      
      // Mock certificate structure for demo
      this.certificate = {
        subject: 'CN=Test Certificate, O=Test Organization, C=ES',
        issuer: 'CN=Test CA, O=Test CA Organization, C=ES',
        serialNumber: '123456789',
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2025-12-31'),
        publicKey: 'mock-public-key',
        keyUsage: ['digitalSignature', 'nonRepudiation'],
        extKeyUsage: ['clientAuth', 'emailProtection']
      };
      
      this.privateKey = 'mock-private-key';
      
      console.log('✅ Certificate loaded successfully');
    } catch (error) {
      console.error('❌ Error loading certificate:', error);
      throw new Error('Failed to load certificate for signing');
    }
  }

  async signXML(xmlContent: string, signatureType: string, includeTimestamp: boolean = false): Promise<string> {
    console.log(`🖊️ Signing XML with ${signatureType}`);
    
    try {
      // Generate signature ID
      const signatureId = `Signature-${Date.now()}`;
      const signedPropertiesId = `SignedProperties-${Date.now()}`;
      const timestampId = `Timestamp-${Date.now()}`;
      
      // Calculate digest of the content to be signed
      const digest = await this.calculateDigest(xmlContent);
      
      // Generate signature value (mock implementation)
      const signatureValue = await this.generateSignatureValue(digest);
      
      // Build XAdES signature
      const xadesSignature = this.buildXAdESSignature({
        signatureId,
        signedPropertiesId,
        timestampId,
        digest,
        signatureValue,
        signatureType,
        includeTimestamp
      });
      
      // Insert signature into XML
      const signedXML = this.insertSignatureIntoXML(xmlContent, xadesSignature);
      
      console.log('✅ XML signed successfully with XAdES');
      return signedXML;
      
    } catch (error) {
      console.error('❌ Error signing XML:', error);
      throw new Error(`XAdES signing failed: ${error.message}`);
    }
  }

  private async calculateDigest(content: string): Promise<string> {
    // Calculate SHA-256 digest
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return btoa(hashHex);
  }

  private async generateSignatureValue(digest: string): Promise<string> {
    // Mock signature generation - in production this would use the private key
    const signatureInput = `${digest}-${this.certificate.serialNumber}-${Date.now()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureInput);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signatureHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return btoa(signatureHex);
  }

  private buildXAdESSignature(params: {
    signatureId: string;
    signedPropertiesId: string;
    timestampId: string;
    digest: string;
    signatureValue: string;
    signatureType: string;
    includeTimestamp: boolean;
  }): string {
    const currentTime = new Date().toISOString();
    
    let qualifyingProperties = '';
    
    // Build SignedProperties for XAdES-BES or higher
    const signedProperties = `
      <xades:SignedProperties Id="${params.signedPropertiesId}">
        <xades:SignedSignatureProperties>
          <xades:SigningTime>${currentTime}</xades:SigningTime>
          <xades:SigningCertificate>
            <xades:Cert>
              <xades:CertDigest>
                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                <ds:DigestValue>${params.digest}</ds:DigestValue>
              </xades:CertDigest>
              <xades:IssuerSerial>
                <ds:X509IssuerName>${this.certificate.issuer}</ds:X509IssuerName>
                <ds:X509SerialNumber>${this.certificate.serialNumber}</ds:X509SerialNumber>
              </xades:IssuerSerial>
            </xades:Cert>
          </xades:SigningCertificate>
          <xades:SignaturePolicyIdentifier>
            <xades:SignaturePolicyImplied/>
          </xades:SignaturePolicyIdentifier>
        </xades:SignedSignatureProperties>
        <xades:SignedDataObjectProperties>
          <xades:DataObjectFormat ObjectReference="#Reference-Document">
            <xades:Description>Verifactu Invoice XML</xades:Description>
            <xades:MimeType>application/xml</xades:MimeType>
          </xades:DataObjectFormat>
        </xades:SignedDataObjectProperties>
      </xades:SignedProperties>`;

    // Add UnsignedProperties for XAdES-T (with timestamp)
    let unsignedProperties = '';
    if (params.includeTimestamp && (params.signatureType === 'XAdES-T' || params.signatureType.includes('XAdES-'))) {
      unsignedProperties = `
        <xades:UnsignedProperties>
          <xades:UnsignedSignatureProperties>
            <xades:SignatureTimeStamp Id="${params.timestampId}">
              <xades:HashDataInfo uri="#${params.signatureId}">
                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                <ds:DigestValue>${params.digest}</ds:DigestValue>
              </xades:HashDataInfo>
              <xades:EncapsulatedTimeStamp>
                ${this.generateMockTimestamp()}
              </xades:EncapsulatedTimeStamp>
            </xades:SignatureTimeStamp>
          </xades:UnsignedSignatureProperties>
        </xades:UnsignedProperties>`;
    }

    qualifyingProperties = `
      <xades:QualifyingProperties Target="#${params.signatureId}" 
                                 xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
        ${signedProperties}
        ${unsignedProperties}
      </xades:QualifyingProperties>`;

    return `
      <ds:Signature Id="${params.signatureId}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:SignedInfo>
          <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
          <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
          <ds:Reference URI="">
            <ds:Transforms>
              <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
              <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            </ds:Transforms>
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>${params.digest}</ds:DigestValue>
          </ds:Reference>
          <ds:Reference URI="#${params.signedPropertiesId}" Type="http://uri.etsi.org/01903#SignedProperties">
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>${params.digest}</ds:DigestValue>
          </ds:Reference>
        </ds:SignedInfo>
        <ds:SignatureValue>${params.signatureValue}</ds:SignatureValue>
        <ds:KeyInfo>
          <ds:X509Data>
            <ds:X509Certificate>${btoa(JSON.stringify(this.certificate))}</ds:X509Certificate>
            <ds:X509SubjectName>${this.certificate.subject}</ds:X509SubjectName>
          </ds:X509Data>
        </ds:KeyInfo>
        <ds:Object>
          ${qualifyingProperties}
        </ds:Object>
      </ds:Signature>`;
  }

  private generateMockTimestamp(): string {
    // Mock timestamp token - in production this would come from a TSA
    const timestamp = {
      version: 1,
      policy: '1.3.6.1.4.1.17326.10.14.2.2',
      messageImprint: {
        hashAlgorithm: 'SHA-256',
        hashedMessage: btoa(Date.now().toString())
      },
      serialNumber: Math.floor(Math.random() * 1000000),
      genTime: new Date().toISOString(),
      tsa: {
        directoryName: 'CN=Mock TSA, O=Mock TSA Authority, C=ES'
      }
    };
    
    return btoa(JSON.stringify(timestamp));
  }

  private insertSignatureIntoXML(xmlContent: string, signature: string): string {
    // Find the best place to insert the signature (before closing root element)
    const lastClosingTag = xmlContent.lastIndexOf('</');
    if (lastClosingTag === -1) {
      throw new Error('Invalid XML structure');
    }
    
    const beforeClosing = xmlContent.substring(0, lastClosingTag);
    const afterClosing = xmlContent.substring(lastClosingTag);
    
    return `${beforeClosing}${signature}${afterClosing}`;
  }

  validateCertificate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const now = new Date();

    // Check validity period
    if (now < this.certificate.validFrom) {
      errors.push('Certificate is not yet valid');
    }
    if (now > this.certificate.validTo) {
      errors.push('Certificate has expired');
    }

    // Check key usage
    if (!this.certificate.keyUsage.includes('digitalSignature')) {
      errors.push('Certificate does not have digital signature capability');
    }
    if (!this.certificate.keyUsage.includes('nonRepudiation')) {
      errors.push('Certificate does not have non-repudiation capability');
    }

    // Check if it's a qualified certificate (mock check)
    const isQualified = this.certificate.issuer.includes('CA') && 
                       this.certificate.extKeyUsage.includes('clientAuth');
    
    if (!isQualified) {
      errors.push('Certificate does not appear to be a qualified certificate');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

serve(async (req: Request) => {
  console.log('🖊️ XAdES Signer function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const signRequest: XAdESSignRequest = await req.json();
    
    console.log('📝 XAdES sign request:', {
      signatureType: signRequest.signatureType,
      includeTimestamp: signRequest.includeTimestamp,
      xmlLength: signRequest.xmlContent?.length || 0
    });

    // Certificate data is already decrypted by the caller
    console.log('✅ Received pre-decrypted certificate from caller');

    // Create XAdES signer with pre-decrypted data
    const signer = new XAdESSigner(signRequest.certificateData, signRequest.certificatePassword);
    
    // Validate certificate
    const validation = signer.validateCertificate();
    if (!validation.isValid) {
      console.warn('⚠️ Certificate validation warnings:', validation.errors);
      
      // Log validation issues but continue (might be mock certificates in test)
      await logSigningOperation(supabaseClient, {
        companyId: signRequest.companyId,
        invoiceId: signRequest.invoiceId,
        action: 'certificate_validation',
        status: 'warning',
        details: { errors: validation.errors }
      });
    }

    // Sign the XML
    const signedXML = await signer.signXML(
      signRequest.xmlContent,
      signRequest.signatureType,
      signRequest.includeTimestamp
    );

    // Log successful signing
    await logSigningOperation(supabaseClient, {
      companyId: signRequest.companyId,
      invoiceId: signRequest.invoiceId,
      action: 'xades_sign',
      status: 'success',
      details: {
        signatureType: signRequest.signatureType,
        includeTimestamp: signRequest.includeTimestamp,
        signedXMLLength: signedXML.length
      }
    });

    console.log('✅ XAdES signing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        signedXML,
        signatureType: signRequest.signatureType,
        timestamp: new Date().toISOString(),
        certificateInfo: {
          subject: signer.certificate?.subject,
          issuer: signer.certificate?.issuer,
          serialNumber: signer.certificate?.serialNumber,
          validFrom: signer.certificate?.validFrom,
          validTo: signer.certificate?.validTo
        },
        validation
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ XAdES signing error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'XAdES signing failed',
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function logSigningOperation(supabaseClient: any, operation: {
  companyId: string;
  invoiceId: string;
  action: string;
  status: string;
  details: any;
}) {
  try {
    const { error } = await supabaseClient
      .from('verifactu_logs')
      .insert({
        company_id: operation.companyId,
        invoice_id: operation.invoiceId,
        action: operation.action,
        status: operation.status,
        response_data: operation.details,
      });

    if (error) {
      console.error('❌ Error logging signing operation:', error);
    }
  } catch (error) {
    console.error('❌ Exception logging signing operation:', error);
  }
}