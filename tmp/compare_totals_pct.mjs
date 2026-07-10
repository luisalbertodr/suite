import { loadDbfFilteredRows, dbfStr, dbfNum } from '/root/style-sync-agent/dist/dbfSource.js';
import { execSync } from 'child_process';

const facRows = await loadDbfFilteredRows('/mnt/style', 'faccab', (r) =>
  dbfStr(r, 'ejefac') === '2026' && dbfStr(r, 'serfac') === 'A',
);
const facByNum = new Map(facRows.map((r) => [dbfStr(r, 'numfac'), dbfNum(r, 'totfac')]));

const sql = `
SELECT split_part(m.style_key,'/',3) AS numfac,
       round(sum(i.total_amount)::numeric,2) AS suite_total,
       count(*) AS parts
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE m.style_key LIKE '2026/A/%'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
GROUP BY 1`;
const out = execSync(
  `docker exec supabase-db psql -U postgres -d postgres -t -A -F'|' -c "${sql.replace(/"/g, '\\"')}"`,
  { encoding: 'utf8' },
);

let sumSuite = 0,
  sumFac = 0,
  sumOver = 0;
for (const line of out.trim().split('\n').filter(Boolean)) {
  const [num, total, parts] = line.split('|');
  const st = parseFloat(total);
  const ft = facByNum.get(num) ?? 0;
  sumSuite += st;
  sumFac += ft;
  if (ft && st > ft + 0.05) sumOver += st - ft;
}
console.log('Suite synced total:', sumSuite.toFixed(2));
console.log('Faccab live total (all A 2026):', [...facByNum.values()].reduce((a, b) => a + b, 0).toFixed(2));
console.log('Matched faccab subset:', sumFac.toFixed(2));
console.log('Excess matched:', sumOver.toFixed(2), `(${((sumOver / sumFac) * 100).toFixed(2)}%)`);
