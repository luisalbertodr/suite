import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same encryption utilities as encrypt-certificate function
class SecureCrypto {
  private static async getKey(): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(Deno.env.get("CERTIFICATE_ENCRYPTION_KEY")),
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

  static async encrypt(plaintext: string): Promise<string> {
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(plaintext);

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  // Check if data is already encrypted (basic heuristic)
  static isEncrypted(data: string): boolean {
    try {
      // If it's base64 encoded certificate data, it's likely not encrypted yet
      // Encrypted data will be much longer and have different characteristics
      if (data.length > 1000 && data.includes('MIIF')) {
        return false; // Likely unencrypted certificate
      }
      return true; // Assume encrypted if shorter or different format
    } catch {
      return true; // If we can't determine, assume encrypted for safety
    }
  }
}

serve(async (req: Request) => {
  console.log('🔄 Certificate migration function called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!Deno.env.get("CERTIFICATE_ENCRYPTION_KEY")) {
      console.error('❌ CERTIFICATE_ENCRYPTION_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Encryption key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // This function should only be called by superuser/admin
    // For security, we'll require a special header
    const migrationKey = req.headers.get('X-Migration-Key');
    if (migrationKey !== 'secure-migration-2024') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized migration attempt' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Fetching all certificates for migration...');
    
    // Get all certificates
    const { data: certificates, error: fetchError } = await supabaseClient
      .from('verifactu_certificates')
      .select('*');

    if (fetchError) {
      console.error('❌ Error fetching certificates:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch certificates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!certificates || certificates.length === 0) {
      console.log('ℹ️ No certificates found to migrate');
      return new Response(
        JSON.stringify({ message: 'No certificates found to migrate', migrated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let migratedCount = 0;
    let skippedCount = 0;

    console.log(`🔄 Processing ${certificates.length} certificates...`);

    for (const cert of certificates) {
      try {
        // Check if certificate data is already encrypted
        const certAlreadyEncrypted = SecureCrypto.isEncrypted(cert.certificate_data);
        const passwordAlreadyEncrypted = SecureCrypto.isEncrypted(cert.certificate_password);

        if (certAlreadyEncrypted && passwordAlreadyEncrypted) {
          console.log(`⏭️ Certificate ${cert.certificate_name} already appears to be encrypted, skipping`);
          skippedCount++;
          continue;
        }

        // Encrypt the data
        const encryptedCertData = certAlreadyEncrypted 
          ? cert.certificate_data 
          : await SecureCrypto.encrypt(cert.certificate_data);
        
        const encryptedPassword = passwordAlreadyEncrypted 
          ? cert.certificate_password 
          : await SecureCrypto.encrypt(cert.certificate_password);

        // Update the certificate with encrypted data
        const { error: updateError } = await supabaseClient
          .from('verifactu_certificates')
          .update({
            certificate_data: encryptedCertData,
            certificate_password: encryptedPassword,
            updated_at: new Date().toISOString()
          })
          .eq('id', cert.id);

        if (updateError) {
          console.error(`❌ Error updating certificate ${cert.certificate_name}:`, updateError);
          continue;
        }

        console.log(`✅ Migrated certificate: ${cert.certificate_name}`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error processing certificate ${cert.certificate_name}:`, error);
        continue;
      }
    }

    const result = {
      message: 'Certificate migration completed',
      total: certificates.length,
      migrated: migratedCount,
      skipped: skippedCount,
      errors: certificates.length - migratedCount - skippedCount
    };

    console.log('✅ Migration summary:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Migration function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});