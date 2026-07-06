import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfFilteredRows } from "../dbfSource.js";

const root = "Z:\\Style-Dunasoft";
const names = [
  "Raquel Lema",
  "Milena Silva",
  "Loreto Martinez",
  "Fernanda Piccolini",
  "Tere Montoto",
  "Luisa Garcia",
  "Balbina Gonzalez",
];

for (const name of names) {
  const rows = await loadDbfFilteredRows(root, "plan2009", (r) =>
    dbfStr(r, "nomcli").toLowerCase().includes(name.toLowerCase()),
  );
  const jul = rows.filter((r) => (dbfDateIso(r, "fecha") ?? "").startsWith("2026-07"));
  if (!jul.length) {
    console.log(`${name}: (sin citas jul 2026 en plan2009)`);
    continue;
  }
  console.log(`\n${name}:`);
  for (const r of jul) {
    console.log(
      `  ${dbfDateIso(r, "fecha")} ${dbfStr(r, "horini")}-${dbfStr(r, "horfin")} emp=${dbfStr(r, "codemp")} id=${r.idplan}`,
    );
  }
}
