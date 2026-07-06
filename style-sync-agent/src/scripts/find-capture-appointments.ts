/**
 * Localiza citas de la captura Style (7 jul 2026) en todas las tablas plan* del test.
 */
import "dotenv/config";
import fs from "node:fs";
import { dbfDateIso, dbfStr, loadDbfFilteredRows, loadDbfIndexed, resolveDbfPath } from "../dbfSource.js";

const ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const DATE = "2026-07-07";

const CAPTURE = [
  { label: "Beatriz Casais", needles: ["beatriz casais"] },
  { label: "Balbina Gonzalez", needles: ["balbina gonzalez"] },
  { label: "Raquel Lema", needles: ["raquel lema"] },
  { label: "Fernanda Piccolini", needles: ["fernanda piccolini"] },
  { label: "Tere Montoto", needles: ["tere montoto"] },
  { label: "Luisa Garcia Veiga", needles: ["luisa garcia"] },
  { label: "Loreto Martinez", needles: ["loreto martinez"] },
  { label: "Milena Silva", needles: ["milena silva"] },
  { label: "Luis Alberto Diaz", needles: ["luis alberto"] },
  { label: "vacas marta", needles: ["vacas marta", "vacas marta"] },
];

const TABLES = ["plan2009", "planinc", "plantmp"] as const;

function matchName(text: string, needles: string[]) {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n));
}

function rowNom(r: Record<string, unknown>, useX = false) {
  return (useX ? dbfStr(r, "nomclix") || dbfStr(r, "nomcli") : dbfStr(r, "nomcli")).trim();
}

function rowFecha(r: Record<string, unknown>, useX = false) {
  return dbfDateIso(r, useX ? "fechax" : "fecha");
}

function rowHor(r: Record<string, unknown>, useX = false) {
  return (useX ? dbfStr(r, "horinix") || dbfStr(r, "horini") : dbfStr(r, "horini")).trim();
}

function rowEmp(r: Record<string, unknown>, useX = false) {
  return (useX ? dbfStr(r, "codempx") || dbfStr(r, "codemp") : dbfStr(r, "codemp")).trim();
}

console.log("ROOT:", ROOT);
for (const t of TABLES) {
  const p = resolveDbfPath(ROOT, t);
  if (p) console.log(`${t}.dbf mtime:`, fs.statSync(p).mtime.toISOString());
}

// Conteo día en plan2009
const dayPlan = await loadDbfFilteredRows(ROOT, "plan2009", (r) => dbfDateIso(r, "fecha") === DATE);
console.log(`\nplan2009 fecha=${DATE}:`, dayPlan.length);
for (const r of dayPlan.sort((a, b) => dbfStr(a, "horini").localeCompare(dbfStr(b, "horini")))) {
  console.log(
    `  ${dbfStr(r, "horini")} emp=${dbfStr(r, "codemp")} id=${r.idplan} ${dbfStr(r, "nomcli").slice(0, 50)}`,
  );
}

console.log("\n=== BÚSQUEDA POR NOMBRE (captura) ===\n");

for (const cap of CAPTURE) {
  console.log(`--- ${cap.label} ---`);
  let any = false;

  for (const table of TABLES) {
    const rows = await loadDbfFilteredRows(ROOT, table, (r) => {
      const n1 = rowNom(r, false);
      const n2 = rowNom(r, true);
      return matchName(n1, cap.needles) || matchName(n2, cap.needles);
    });

    const jul7 = rows.filter((r) => rowFecha(r, false) === DATE || rowFecha(r, true) === DATE);
    const jul = rows.filter((r) => {
      const f = rowFecha(r, false);
      const fx = rowFecha(r, true);
      return (f?.startsWith("2026-07") ?? false) || (fx?.startsWith("2026-07") ?? false);
    });

    if (!rows.length) continue;
    any = true;
    console.log(`  ${table}: total=${rows.length} jul2026=${jul.length} jul7=${jul7.length}`);

    const show = jul7.length ? jul7 : jul.slice(0, 8);
    for (const r of show) {
      const tip = table === "planinc" ? dbfStr(r, "tipinc") : table === "plantmp" ? dbfStr(r, "tiptmp") : "CITA";
      const f = rowFecha(r, false);
      const fx = rowFecha(r, true);
      console.log(
        `    [${tip}] idplan=${r.idplan} fecha=${f ?? "-"} fechax=${fx ?? "-"} ${rowHor(r, fx === DATE)} emp=${rowEmp(r, fx === DATE)} ${rowNom(r, fx === DATE).slice(0, 45)}`,
      );
    }
  }

  if (!any) console.log("  (no encontrado en plan2009/planinc/plantmp)");
  console.log();
}

// Luis Alberto idplan 1000000000 / codcli 553
console.log("--- codcli 553 / idplan test ---");
const idx = await loadDbfIndexed(ROOT, "plan2009");
for (const [k, r] of idx) {
  if (dbfStr(r, "codcli").includes("553") || String(r.idplan).includes("1000000000")) {
    console.log(`  plan2009 key=${k} fecha=${dbfDateIso(r, "fecha")} ${dbfStr(r, "horini")} ${dbfStr(r, "nomcli").slice(0, 40)}`);
  }
}
