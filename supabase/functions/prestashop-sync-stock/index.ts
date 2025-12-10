
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncStockRequest {
  direction: 'inbound' | 'outbound' | 'bidirectional';
  company_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { direction, company_id }: SyncStockRequest = await req.json();

    if (!direction || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Direction and company_id are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting stock sync for company:', company_id, 'direction:', direction);

    // Get PrestaShop configuration
    const { data: config, error: configError } = await supabase
      .from('prestashop_configurations')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (configError || !config) {
      console.error('PrestaShop config not found:', configError);
      return new Response(
        JSON.stringify({ error: 'PrestaShop configuration not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!config.is_active) {
      return new Response(
        JSON.stringify({ error: 'PrestaShop integration is not active' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get product mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('prestashop_product_mappings')
      .select(`
        *,
        articles:article_id (id, codigo, descripcion, stock_actual),
        article_variations:variation_id (id, stock_actual)
      `)
      .eq('company_id', company_id)
      .eq('sync_enabled', true);

    if (mappingsError) {
      console.error('Error fetching product mappings:', mappingsError);
      return new Response(
        JSON.stringify({ error: 'Error fetching product mappings' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${mappings?.length || 0} product mappings to sync`);

    // Log sync start
    await supabase
      .from('prestashop_sync_logs')
      .insert({
        company_id,
        sync_type: 'stock',
        direction,
        status: 'success',
        message: `Stock sync started for ${mappings?.length || 0} products`,
        details: { direction, product_count: mappings?.length || 0 }
      });

    // Update last sync timestamp
    await supabase
      .from('prestashop_configurations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('company_id', company_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Stock sync initiated for ${direction} direction`,
        synced_products: mappings?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in prestashop-sync-stock function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Stock sync failed',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
