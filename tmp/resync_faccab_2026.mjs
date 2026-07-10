import { createClient } from '/root/style-sync-agent/node_modules/@supabase/supabase-js/dist/module/index.js';
import { loadDbfFilteredRows, dbfStr, dbfNum, dbfDateIso } from '/root/style-sync-agent/dist/dbfSource.js';
import { ENTITY_HANDLERS } from '/root/style-sync-agent/dist/handlers.js';

const COMPANY_ID = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
const SUPABASE_URL = 'https://supabase.lipoout.com';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STYLE_ROOT = '/mnt/style';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const facturasHandler = ENTITY_HANDLERS.find((h) => h.tabla === 'faccab');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const deps = {
  styleRoot: STYLE_ROOT,
  companyId: COMPANY_ID,
  supabase,
  colaPath: '',
  inboundDir: '',
  inboundAckDir: '',
  log: () => {},
};

const rows = await loadDbfFilteredRows(STYLE_ROOT, 'faccab', (r) =>
  dbfStr(r, 'ejefac') === '2026' && dbfStr(r, 'serfac') !== '00',
);

let ok = 0;
let err = 0;
for (const row of rows) {
  const cola = { id: 0, tabla: 'faccab', id_reg: dbfStr(row, 'numfac'), accion: 'UPD' };
  try {
    const args = await facturasHandler.buildArgs(COMPANY_ID, cola, row, deps);
    if (!args) continue;
    const { error } = await supabase.schema('dunasoft').rpc(facturasHandler.rpc, args);
    if (error) throw error;
    ok++;
    if (ok % 250 === 0) console.log('ok', ok);
  } catch (e) {
    err++;
    if (err <= 5) console.error('ERR', dbfStr(row, 'numfac'), e.message ?? e);
  }
}
console.log('done ok=', ok, 'err=', err);
