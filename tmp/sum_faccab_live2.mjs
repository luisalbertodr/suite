import { loadDbfFilteredRows, dbfStr, dbfNum, dbfDateIso } from '/root/style-sync-agent/dist/dbfSource.js';

for (const label of ['A only', 'serfac!=00']) {
  const rows = await loadDbfFilteredRows('/mnt/style', 'faccab', (r) => {
    if (dbfStr(r, 'ejefac') !== '2026') return false;
    return label === 'A only' ? dbfStr(r, 'serfac') === 'A' : dbfStr(r, 'serfac') !== '00';
  });
  const byMonth = new Map();
  for (const r of rows) {
    const m = dbfDateIso(r, 'fecfac')?.slice(0, 7);
    if (!m) continue;
    byMonth.set(m, (byMonth.get(m) ?? 0) + dbfNum(r, 'totfac'));
  }
  console.log('\n===', label, '===');
  for (const [k, v] of [...byMonth.entries()].sort()) {
    console.log(`${k}\t${v.toFixed(2)}`);
  }
}
