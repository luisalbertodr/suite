import { loadDbfFilteredRows, dbfStr, dbfNum, dbfDateIso } from '/root/style-sync-agent/dist/dbfSource.js';
import { execSync } from 'child_process';

const facRows = await loadDbfFilteredRows('/mnt/style', 'faccab', (r) =>
  dbfStr(r, 'ejefac') === '2026' && dbfStr(r, 'serfac') === 'A',
);
const facByNum = new Map();
for (const r of facRows) {
  facByNum.set(dbfStr(r, 'numfac'), {
    totfac: dbfNum(r, 'totfac'),
    fecfac: dbfDateIso(r, 'fecfac'),
  });
}

const sql = `
SELECT split_part(m.style_key,'/',3) AS numfac,
       round(sum(i.total_amount)::numeric,2) AS suite_total
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE m.style_key LIKE '2026/A/%'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
GROUP BY 1`;
const out = execSync(
  `docker exec supabase-db psql -U postgres -d postgres -t -A -F'|' -c "${sql.replace(/"/g, '\\"')}"`,
  { encoding: 'utf8' },
);

let matched = 0,
  over = 0,
  under = 0,
  suiteOnly = 0,
  facOnly = 0,
  overN = 0;
const suiteNums = new Set();
for (const line of out.trim().split('\n').filter(Boolean)) {
  const [num, total] = line.split('|');
  const st = parseFloat(total);
  suiteNums.add(num);
  const f = facByNum.get(num);
  if (!f) {
    suiteOnly += st;
    continue;
  }
  matched++;
  const d = st - f.totfac;
  if (d > 0.05) {
    over += d;
    overN++;
  }
  if (d < -0.05) under += -d;
}
for (const [num, f] of facByNum) {
  if (!suiteNums.has(num)) facOnly += f.totfac;
}

console.log('2026 matched invoices:', matched);
console.log('Suite only (no faccab):', suiteOnly.toFixed(2));
console.log('Faccab only (no suite):', facOnly.toFixed(2));
console.log('Overpricing vs faccab:', over.toFixed(2), 'in', overN, 'invoices');
console.log('Under vs faccab:', under.toFixed(2));

// Top overpriced
const overs = [];
for (const line of out.trim().split('\n').filter(Boolean)) {
  const [num, total] = line.split('|');
  const f = facByNum.get(num);
  if (!f) continue;
  const d = parseFloat(total) - f.totfac;
  if (d > 1) overs.push({ num, suite: parseFloat(total), fac: f.totfac, d });
}
overs.sort((a, b) => b.d - a.d);
console.log('\nTop 10 overpriced:');
for (const o of overs.slice(0, 10)) {
  console.log(`  ${o.num}: suite ${o.suite.toFixed(2)} faccab ${o.fac.toFixed(2)} +${o.d.toFixed(2)}`);
}
