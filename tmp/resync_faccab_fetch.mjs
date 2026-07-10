import { ENTITY_HANDLERS } from '/root/style-sync-agent/dist/handlers.js';
import { loadDbfFilteredRows, dbfStr } from '/root/style-sync-agent/dist/dbfSource.js';

const COMPANY_ID = process.env.COMPANY_ID;
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STYLE_ROOT = process.env.STYLE_ROOT;

const handler = ENTITY_HANDLERS.find((h) => h.tabla === 'faccab');
const deps = {
  styleRoot: STYLE_ROOT,
  companyId: COMPANY_ID,
  supabase: {
    schema: () => ({
      from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }),
      rpc: async () => ({ error: null }),
    }),
  },
  colaPath: '',
  inboundDir: '',
  inboundAckDir: '',
  log: () => {},
};

async function rpc(name, args) {
  const res = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'dunasoft',
      'Content-Profile': 'dunasoft',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

const { data: exclusions } = await (async () => {
  const res = await fetch(
    `${URL}/rest/v1/style_sync_billing_exclusions?company_id=eq.${COMPANY_ID}&select=style_key`,
    {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Accept-Profile': 'dunasoft',
      },
    },
  );
  return { data: await res.json() };
})();

const excluded = new Set((exclusions ?? []).map((e) => e.style_key));
const rows = await loadDbfFilteredRows(STYLE_ROOT, 'faccab', (r) =>
  dbfStr(r, 'ejefac') === '2026' && dbfStr(r, 'serfac') !== '00',
);

let ok = 0;
let err = 0;
for (const row of rows) {
  const ser = dbfStr(row, 'serfac') || 'A';
  const num = dbfStr(row, 'numfac');
  const cli = dbfStr(row, 'codcli');
  const prefix = `${ser}/${num}/`;
  if ([...excluded].some((k) => k === `${ser}/${num}/${cli}` || k.startsWith(prefix))) continue;

  try {
    const args = await handler.buildArgs(
      COMPANY_ID,
      { id: 0, tabla: 'faccab', id_reg: num, accion: 'UPD' },
      row,
      deps,
    );
    if (!args) continue;
    await rpc(handler.rpc, args);
    ok += 1;
    if (ok % 300 === 0) console.log('ok', ok);
  } catch (e) {
    err += 1;
    if (err < 5) console.error('ERR', num, e.message ?? e);
  }
}
console.log('done ok=', ok, 'err=', err);
