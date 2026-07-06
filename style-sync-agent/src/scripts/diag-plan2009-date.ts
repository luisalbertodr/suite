import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfFilteredRows } from "../dbfSource.js";

const root = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const date = process.argv[2] ?? "2026-07-07";

// Citas con fecha ISO parseada
const byFecha = await loadDbfFilteredRows(root, "plan2009", (r) => dbfDateIso(r, "fecha") === date);

// Citas cuyo campo fecha raw (YYYYMMDD) termina en 0707 para 2026
const ymd = date.replace(/-/g, "");
const byRaw = await loadDbfFilteredRows(root, "plan2009", (r) => {
  const raw = String(r.fecha ?? "").trim();
  if (/^\d{8}$/.test(raw)) return raw === ymd;
  if (raw.includes(ymd)) return true;
  return false;
});

console.log("root:", root);
console.log(`fecha_iso=${date}:`, byFecha.length);
console.log(`raw YYYYMMDD=${ymd}:`, byRaw.length);

const onlyRaw = byRaw.filter((r) => !byFecha.includes(r));
if (onlyRaw.length) {
  console.log("\nEn raw pero NO en fecha_iso (posible bug parseo):");
  for (const r of onlyRaw.slice(0, 20)) {
    console.log("  raw fecha=", r.fecha, "iso=", dbfDateIso(r, "fecha"), dbfStr(r, "horini"), dbfStr(r, "nomcli").slice(0, 40));
  }
}

// planinc fechax (cambios pendientes mostrados en agenda Style)
const incFechax = await loadDbfFilteredRows(root, "planinc", (r) => dbfDateIso(r, "fechax") === date);
const incFecha = await loadDbfFilteredRows(root, "planinc", (r) => dbfDateIso(r, "fecha") === date);
console.log(`\nplaninc fecha=${date}:`, incFecha.length);
console.log(`planinc fechax=${date}:`, incFechax.length);
for (const r of [...incFechax, ...incFecha].slice(0, 15)) {
  console.log(
    `  idplan=${r.idplan} ${dbfStr(r, "horinix") || dbfStr(r, "horini")} emp=${dbfStr(r, "codemp")} ${dbfStr(r, "nomcli").slice(0, 40)}`,
  );
}
