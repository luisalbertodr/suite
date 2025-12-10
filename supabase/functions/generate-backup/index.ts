import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get company_id from user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error('Company not found for user');
    }

    const companyId = profile.company_id;

    // Generate SQL backup
    let sqlBackup = `-- Backup generated at ${new Date().toISOString()}\n`;
    sqlBackup += `-- Company ID: ${companyId}\n\n`;

    // Tables to backup (in order to respect foreign keys)
    const tables = [
      'companies',
      'customers',
      'suppliers',
      'articles',
      'article_variations',
      'article_families',
      'quotes',
      'quote_items',
      'presupuestos_n',
      'presupuestos_n_items',
      'invoices',
      'invoice_items',
      'delivery_notes',
      'delivery_note_items',
      'sales',
      'sale_items',
      'planillas',
      'planilla_items',
      'vehicles',
      'maintenance_schedules',
      'inventory_items',
      'inventory_movements',
      'agenda_employees',
      'agenda_appointments',
      'documents',
      'system_settings',
      'user_appearance_preferences',
      'prestashop_configurations',
      'prestashop_product_mappings',
      'prestashop_sync_logs',
      'prestashop_sync_queue',
      'verifactu_certificates',
      'verifactu_logs',
      'verifactu_queue',
      'verifactu_xml_documents',
    ];

    for (const table of tables) {
      try {
        const { data, error } = await supabaseClient
          .from(table)
          .select('*')
          .eq('company_id', companyId);

        if (error) {
          console.log(`Skipping table ${table}: ${error.message}`);
          continue;
        }

        if (data && data.length > 0) {
          sqlBackup += `-- Table: ${table}\n`;
          
          for (const row of data) {
            const columns = Object.keys(row);
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              if (Array.isArray(val)) return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
              return val;
            });

            sqlBackup += `INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
          }
          sqlBackup += '\n';
        }
      } catch (tableError) {
        console.error(`Error processing table ${table}:`, tableError);
      }
    }

    return new Response(sqlBackup, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="backup-${companyId}-${Date.now()}.sql"`,
      },
    });
  } catch (error) {
    console.error('Error generating backup:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
