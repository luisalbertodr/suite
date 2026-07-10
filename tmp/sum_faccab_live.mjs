import { loadDbfFilteredRows, dbfStr, dbfNum, dbfDateIso } from '/root/style-sync-agent/dist/dbfSource.js';

const rows = await loadDbfFilteredRows('/mnt/style', 'faccab', (r) => {
  return dbfStr(r, 'ejefac') === '2026' && dbfStr(r, 'serfac') !== '00';
});

const byMonth = new Map();
for (const r of rows) {
  const m = dbfDateIso(r, 'fecfac')?.slice(0, 7);
  if (!m) continue;
  byMonth.set(m, (byMonth.get(m) ?? 0) + dbfNum(r, 'totfac'));
}

for (const [k, v] of [...byMonth.entries()].sort()) {
  console.log(`${k}\t${v.toFixed(2)}`);
}
