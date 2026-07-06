import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfFilteredRows } from "../dbfSource.js";

const root = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["Beatriz Casais", "Fernanda Piccolini", "Raquel Lema", "Milena Silva", "Loreto Martinez", "Luis Alberto"];

for (const name of names) {
  const rows = await loadDbfFilteredRows(root, "plan2009", (r) =>
    dbfStr(r, "nomcli").toLowerCase().includes(name.toLowerCase()),
  );
  const jul7 = rows.filter((r) => dbfDateIso(r, "fecha") === "2026-07-07");
  const jul = rows.filter((r) => (dbfDateIso(r, "fecha") ?? "").startsWith("2026-07"));
  console.log(`\n${name}: jul7=${jul7.length} jul_total=${jul.length}`);
  for (const r of [...jul7, ...jul.filter((x) => !jul7.includes(x))].slice(0, 8)) {
    console.log(
      `  ${dbfDateIso(r, "fecha")} ${dbfStr(r, "horini")}-${dbfStr(r, "horfin")} emp=${dbfStr(r, "codemp")} id=${r.idplan}`,
    );
  }
}
