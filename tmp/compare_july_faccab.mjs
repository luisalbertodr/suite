import { loadDbfFilteredRows, dbfStr, dbfNum, dbfDateIso } from '/root/style-sync-agent/dist/dbfSource.js';

const rows = await loadDbfFilteredRows('/mnt/style', 'faccab', (r) => {
  const d = dbfDateIso(r, 'fecfac');
  return dbfStr(r, 'ejefac') === '2026' && dbfStr(r, 'serfac') === 'A' && d && d.startsWith('2026-07');
});

const facByNum = new Map();
for (const r of rows) {
  const num = dbfStr(r, 'numfac');
  facByNum.set(num, dbfNum(r, 'totfac'));
}

const { execSync } = await import('child_process');
const sql = `
SELECT split_part(m.style_key,'/',3) AS numfac,
       round(sum(i.total_amount)::numeric,2) AS suite_total,
       count(*) AS n_inv
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE m.style_key LIKE '2026/A/%'
  AND i.issue_date>='2026-07-01' AND i.issue_date<'2026-08-01'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
GROUP BY 1
ORDER BY 1::int;
`;
const out = execSync(`docker exec supabase-db psql -U postgres -d postgres -t -A -F'|' -c "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });

let suiteSum = 0, facSum = 0, over = 0, under = 0, onlySuite = 0, onlyFac = 0;
const suiteNums = new Set();
for (const line of out.trim().split('\n').filter(Boolean)) {
  const [num, total, n] = line.split('|');
  const st = parseFloat(total);
  suiteSum += st;
  suiteNums.add(num);
  const ft = facByNum.get(num);
  if (ft == null) { onlySuite += st; continue; }
  facSum += ft;
  const d = st - ft;
  if (d > 0.05) over += d;
  if (d < -0.05) under += -d;
}
for (const [num, ft] of facByNum) {
  if (!suiteNums.has(num)) onlyFac += ft;
}

console.log('July 2026 A serie');
console.log('faccab live sum:', [...facByNum.values()].reduce((a,b)=>a+b,0).toFixed(2), 'docs', facByNum.size);
console.log('suite sum:', suiteSum.toFixed(2), 'nums', suiteNums.size);
console.log('only in suite:', onlySuite.toFixed(2));
console.log('only in faccab:', onlyFac.toFixed(2));
console.log('overpricing vs faccab:', over.toFixed(2));
console.log('under vs faccab:', under.toFixed(2));
