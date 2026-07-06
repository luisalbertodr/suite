import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfFilteredRows } from "../dbfSource.js";

const root = "Z:\\Style-Dunasoft";
const date = "2026-07-07";

function show(label: string, rows: Record<string, unknown>[]) {
  console.log(`\n${label}: ${rows.length}`);
  for (const r of rows.slice(0, 30)) {
    console.log(
      `  idplaninc=${dbfStr(r, "idplaninc")} idplan=${r.idplan} fecha=${dbfDateIso(r, "fecha")} fechax=${dbfDateIso(r, "fechax")} ${dbfStr(r, "horinix") || dbfStr(r, "horini")} emp=${dbfStr(r, "codemp")} ${dbfStr(r, "nomcli").slice(0, 40)}`,
    );
  }
}

show(
  `planinc fecha=${date}`,
  await loadDbfFilteredRows(root, "planinc", (r) => dbfDateIso(r, "fecha") === date),
);
show(
  `planinc fechax=${date}`,
  await loadDbfFilteredRows(root, "planinc", (r) => dbfDateIso(r, "fechax") === date),
);

const names = ["Beatriz Casais", "Raquel Lema", "Fernanda Piccolini", "Milena Silva"];
for (const name of names) {
  const rows = await loadDbfFilteredRows(root, "planinc", (r) => {
    const fx = dbfDateIso(r, "fechax");
    const f = dbfDateIso(r, "fecha");
    return (
      dbfStr(r, "nomcli").toLowerCase().includes(name.toLowerCase()) &&
      (fx === date || f === date)
    );
  });
  if (rows.length) show(`planinc ${name} @ ${date}`, rows);
}
