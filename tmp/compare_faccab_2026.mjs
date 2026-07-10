import { loadDbfFilteredRows, dbfStr, dbfNum, dbfDateIso } from "./dist/dbfSource.js";

const months = new Map();
const rows = await loadDbfFilteredRows("/mnt/style", "faccab", (r) => {
  if (dbfStr(r, "ejefac") !== "2026") return false;
  return dbfStr(r, "serfac") === "A";
});
for (const r of rows) {
  const m = dbfDateIso(r, "fecfac")?.slice(0, 7);
  if (!m) continue;
  months.set(m, (months.get(m) ?? 0) + dbfNum(r, "totfac"));
}
console.log("faccab_live_serie_A_2026");
let total = 0;
for (const [k, v] of [...months.entries()].sort()) {
  console.log(`${k}\t${v.toFixed(2)}`);
  total += v;
}
console.log(`TOTAL\t${total.toFixed(2)}`);
