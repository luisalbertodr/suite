import { createClient } from '@supabase/supabase-js';
import { ENTITY_HANDLERS } from './dist/handlers.js';
import { loadDbfFilteredRows, dbfStr } from './dist/dbfSource.js';

const COMPANY_ID = process.env.COMPANY_ID;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const handler = ENTITY_HANDLERS.find((h) => h.tabla === 'faccab');
const deps = {
  styleRoot: process.env.STYLE_ROOT,
  companyId: COMPANY_ID,
  supabase,
  colaPath: '',
  inboundDir: '',
  inboundAckDir: '',
  log: () => {},
};

const rows = await loadDbfFilteredRows(process.env.STYLE_ROOT, 'faccab', (r) =>
  dbfStr(r, 'ejefac') === '2026' && dbfStr(r, 'serfac') !== '00',
);

let ok = 0;
let err = 0;
for (const row of rows) {
  try {
    const args = await handler.buildArgs(
      COMPANY_ID,
      { id: 0, tabla: 'faccab', id_reg: dbfStr(row, 'numfac'), accion: 'UPD' },
      row,
      deps,
    );
    if (!args) continue;
    const { error } = await supabase.schema('dunasoft').rpc(handler.rpc, args);
    if (error) throw error;
    ok += 1;
    if (ok % 300 === 0) console.log('ok', ok);
  } catch (e) {
    err += 1;
    if (err < 5) console.error('ERR', dbfStr(row, 'numfac'), e.message ?? e);
  }
}
console.log('done ok=', ok, 'err=', err);
