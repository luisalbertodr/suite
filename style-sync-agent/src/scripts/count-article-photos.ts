import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const companyId = process.env.COMPANY_ID;

async function main() {
  const { count: withFoto } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('estado', 'activo')
    .not('foto_url', 'is', null);

  const { count: withLegacy } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('estado', 'activo')
    .not('legacy_photo_path', 'is', null);

  console.log(JSON.stringify({ activos_con_foto_url: withFoto, activos_con_legacy_photo_path: withLegacy }));
}

main();
