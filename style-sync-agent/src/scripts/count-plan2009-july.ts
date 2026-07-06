import "dotenv/config";
import { dbfDateIso, loadDbfFilteredRows } from "../dbfSource.js";

const root = process.argv[2] ?? "\\\\192.168.99.16\\c$\\Style-Dunasoft";
const buckets = new Map<string, number>();

const rows = await loadDbfFilteredRows(root, "plan2009", (r) => {
  const f = dbfDateIso(r, "fecha");
  return !!f && f >= "2026-07-01" && f <= "2026-07-31";
});

for (const r of rows) {
  const f = dbfDateIso(r, "fecha")!;
  buckets.set(f, (buckets.get(f) ?? 0) + 1);
}

console.log("root:", root);
console.log("july 2026 total:", rows.length);
for (const [d, n] of [...buckets.entries()].sort()) {
  console.log(`  ${d}: ${n}`);
}
