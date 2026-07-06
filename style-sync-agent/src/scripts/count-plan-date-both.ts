import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfFilteredRows, resolveDbfPath } from "../dbfSource.js";
import fs from "node:fs";

const date = process.argv[2] ?? "2026-07-07";
const root = process.argv[3] ?? "\\\\192.168.99.16\\c$\\Style-Dunasoft";

for (const table of ["plan2009", "planinc"]) {
  const p = resolveDbfPath(root, table);
  const mtime = p && fs.existsSync(p) ? fs.statSync(p).mtime : null;
  console.log(`\n--- ${table} mtime=${mtime?.toISOString() ?? "?"}`);
  const rows = await loadDbfFilteredRows(root, table, (r) => dbfDateIso(r, "fecha") === date);
  console.log(`fecha=${date} count=${rows.length}`);
  for (const r of rows.slice(0, 25)) {
    console.log(
      `  id=${String(r.idplan ?? r.idplaninc ?? "").trim()} emp=${dbfStr(r, "codemp")} ${dbfStr(r, "horini")}-${dbfStr(r, "horfin")} ${dbfStr(r, "nomcli").slice(0, 45)}`,
    );
  }
  if (rows.length > 25) console.log(`  ... +${rows.length - 25} más`);
}

// fechax en planinc (fecha modificada)
const inc = await loadDbfFilteredRows(root, "planinc", (r) => dbfDateIso(r, "fechax") === date);
console.log(`\nplaninc fechax=${date} count=${inc.length}`);
for (const r of inc.slice(0, 15)) {
  console.log(
    `  idplaninc=${dbfStr(r, "idplaninc")} idplan=${r.idplan} emp=${dbfStr(r, "codemp")} ${dbfStr(r, "horinix") || dbfStr(r, "horini")} ${dbfStr(r, "nomcli").slice(0, 40)}`,
  );
}
