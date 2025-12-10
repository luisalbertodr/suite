
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { api_url, api_key } = await req.json();

    if (!api_url || !api_key) {
      return new Response(
        JSON.stringify({ error: 'API URL and API Key are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Clean the API URL to ensure it ends properly
    const baseUrl = api_url.replace(/\/+$/, '');
    const testUrl = `${baseUrl}/products?limit=1&display=id`;

    console.log('Testing connection to:', testUrl);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(api_key + ':')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PrestaShop API error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: 'Connection failed',
          details: `HTTP ${response.status}: ${errorText}`,
          status: response.status
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.text();
    console.log('Connection test successful');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection established successfully',
        data: 'API responding correctly'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error testing PrestaShop connection:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Connection test failed',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
