import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfFilteredRows } from "../dbfSource.js";

const date = process.argv[2] ?? "2026-07-07";
const root = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";

console.log("===", root, "===");
const rows = await loadDbfFilteredRows(root, "plan2009", (r) => dbfDateIso(r, "fecha") === date);
console.log("total:", rows.length);
const sorted = [...rows].sort((a, b) => {
  const ea = dbfStr(a, "codemp").padStart(4, "0");
  const eb = dbfStr(b, "codemp").padStart(4, "0");
  return ea.localeCompare(eb) || dbfStr(a, "horini").localeCompare(dbfStr(b, "horini"));
});
for (const r of sorted) {
  console.log(
    `  idplan=${String(r.idplan).trim()} emp=${dbfStr(r, "codemp").trim()} ${dbfStr(r, "horini")}-${dbfStr(r, "horfin")} ${dbfStr(r, "nomcli").slice(0, 50)}`,
  );
}
