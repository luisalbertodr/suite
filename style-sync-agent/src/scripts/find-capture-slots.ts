/**
 * Busca en plan2009 (test) citas jul 2026 por hora/nombre de la captura.
 */
import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfFilteredRows } from "../dbfSource.js";

const ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";

const SLOTS = [
  { hor: "11:00", name: "Fernanda" },
  { hor: "11:45", name: "Tere" },
  { hor: "12:15", name: "Tere" },
  { hor: "13:00", name: "Luisa" },
  { hor: "15:30", name: "Beatriz" },
  { hor: "15:45", name: "Loreto" },
  { hor: "16:15", name: "Beatriz/Loreto" },
  { hor: "16:45", name: "Balbina" },
  { hor: "17:00", name: "Milena" },
  { hor: "17:45", name: "Raquel/Milena" },
];

const jul = await loadDbfFilteredRows(ROOT, "plan2009", (r) =>
  (dbfDateIso(r, "fecha") ?? "").startsWith("2026-07"),
);

const byDay = new Map<string, number>();
for (const r of jul) {
  const d = dbfDateIso(r, "fecha")!;
  byDay.set(d, (byDay.get(d) ?? 0) + 1);
}
console.log("plan2009 jul 2026 por día:");
for (const [d, c] of [...byDay.entries()].sort()) console.log(`  ${d}: ${c}`);

console.log("\nSlots captura (cualquier día jul):");
for (const s of SLOTS) {
  const hits = jul.filter(
    (r) =>
      dbfStr(r, "horini") === s.hor &&
      dbfStr(r, "nomcli").toLowerCase().includes(s.name.split("/")[0].toLowerCase()),
  );
  console.log(`  ${s.hor} ${s.name}: ${hits.length}`);
  for (const r of hits.slice(0, 3)) {
    console.log(`    ${dbfDateIso(r, "fecha")} emp=${dbfStr(r, "codemp")} id=${r.idplan} ${dbfStr(r, "nomcli").slice(0, 40)}`);
  }
}

// Luis idplan 1000000000
const luis = jul.filter((r) => String(r.idplan).trim() === "1000000000");
console.log("\nLuis idplan=1000000000 en jul:", luis.length);
for (const r of luis) console.log(`  ${dbfDateIso(r, "fecha")} ${dbfStr(r, "horini")} emp=${dbfStr(r, "codemp")}`);
