import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfFilteredRows } from "../dbfSource.js";

const root = process.argv[2] ?? "Z:\\Style-Dunasoft";
const codcli = (process.argv[3] ?? "553").replace(/^0+/, "");

const rows = await loadDbfFilteredRows(root, "plan2009", (r) => {
  const c = String(r.codcli ?? "").trim().replace(/^0+/, "");
  return c === codcli || dbfStr(r, "nomcli").toLowerCase().includes("luis alberto");
});

console.log("root:", root, "matches:", rows.length);
for (const r of rows.sort((a, b) => (dbfDateIso(b, "fecha") ?? "").localeCompare(dbfDateIso(a, "fecha") ?? "")).slice(0, 15)) {
  console.log({
    idplan: r.idplan,
    fecha: dbfDateIso(r, "fecha"),
    horini: dbfStr(r, "horini"),
    horfin: dbfStr(r, "horfin"),
    emp: dbfStr(r, "codemp"),
    nomcli: dbfStr(r, "nomcli"),
  });
}
