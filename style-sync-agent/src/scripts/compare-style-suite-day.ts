/**
 * Compara citas de un día: Style-Suite-Test (plan2009/planinc/plantmp) vs dunasoft.plan2009 en Suite.
 * Uso: npx tsx src/scripts/compare-style-suite-day.ts 2026-07-07
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { dbfDateIso, dbfStr, loadDbfFilteredRows, resolveDbfPath } from "../dbfSource.js";
import fs from "node:fs";

const ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const DATE = process.argv[2] ?? "2026-07-07";

type Apt = {
  source: string;
  id: string;
  emp: string;
  horini: string;
  horfin: string;
  nomcli: string;
  codrec?: string;
  texto?: string;
  planartCount?: number;
};

function aptLine(a: Apt): string {
  const extra = [
    a.codrec ? `rec=${a.codrec}` : "",
    a.texto ? `txt=${a.texto.slice(0, 24)}` : "",
    a.planartCount != null ? `art=${a.planartCount}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `${a.horini}-${a.horfin} emp=${a.emp.padStart(2)} id=${a.id} ${a.nomcli.slice(0, 36)}${extra ? ` ${extra}` : ""}`;
}

function aptKey(a: Apt): string {
  return [a.id, a.emp, a.horini, a.horfin, a.nomcli, a.codrec ?? "", a.texto ?? "", String(a.planartCount ?? "")].join("|");
}

function effectiveDate(row: Record<string, unknown>, useX: boolean): string | null {
  const f = useX ? "fechax" : "fecha";
  return dbfDateIso(row, f);
}

function effectiveHorini(row: Record<string, unknown>, useX: boolean): string {
  return useX ? dbfStr(row, "horinix") || dbfStr(row, "horini") : dbfStr(row, "horini");
}

function effectiveHorfin(row: Record<string, unknown>, useX: boolean): string {
  return useX ? dbfStr(row, "horfinx") || dbfStr(row, "horfin") : dbfStr(row, "horfin");
}

function effectiveEmp(row: Record<string, unknown>, useX: boolean): string {
  return (useX ? dbfStr(row, "codempx") || dbfStr(row, "codemp") : dbfStr(row, "codemp")).trim();
}

function effectiveNom(row: Record<string, unknown>, useX: boolean): string {
  return (useX ? dbfStr(row, "nomclix") || dbfStr(row, "nomcli") : dbfStr(row, "nomcli")).trim();
}

// --- planart counts ---
const planartRows = await loadDbfFilteredRows(ROOT, "planart", () => true);
const planartCountById = new Map<string, number>();
for (const r of planartRows) {
  const key = String(r.idplan ?? "").trim();
  if (!key) continue;
  planartCountById.set(key, (planartCountById.get(key) ?? 0) + 1);
}

// --- plan2009 (estado actual en DBF) ---
const plan2009 = await loadDbfFilteredRows(ROOT, "plan2009", (r) => dbfDateIso(r, "fecha") === DATE);
const stylePlan: Apt[] = plan2009.map((r) => {
  const id = String(r.idplan ?? "").trim();
  return {
    source: "plan2009",
    id,
    emp: dbfStr(r, "codemp").trim(),
    horini: dbfStr(r, "horini"),
    horfin: dbfStr(r, "horfin"),
    nomcli: dbfStr(r, "nomcli"),
    codrec: dbfStr(r, "codrec"),
    texto: dbfStr(r, "texto"),
    planartCount: planartCountById.get(id) ?? 0,
  };
});

// --- planinc: incidencias con fechax = día (cambio de fecha/hora pendiente o histórico) ---
const planincFechax = await loadDbfFilteredRows(ROOT, "planinc", (r) => dbfDateIso(r, "fechax") === DATE);
const planincFecha = await loadDbfFilteredRows(ROOT, "planinc", (r) => dbfDateIso(r, "fecha") === DATE);

// --- plantmp: reservas temporales sin confirmar (fechax = día) ---
const plantmp = await loadDbfFilteredRows(ROOT, "plantmp", (r) => dbfDateIso(r, "fechax") === DATE);

const planPath = resolveDbfPath(ROOT, "plan2009");

// --- Postgres Suite ---
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: pgRows, error } = await sb
  .schema("dunasoft")
  .from("plan2009")
  .select("idplan,fecha,horini,horfin,codemp,nomcli,codrec,texto")
  .eq("fecha", DATE)
  .order("horini");
if (error) throw error;

const { data: pgPlanart, error: paErr } = await sb
  .schema("dunasoft")
  .from("planart")
  .select("idplan")
  .in(
    "idplan",
    (pgRows ?? []).map((r) => Number(r.idplan)).filter((n) => Number.isFinite(n)),
  );
if (paErr) throw paErr;
const pgPlanartCount = new Map<string, number>();
for (const r of pgPlanart ?? []) {
  const key = String(r.idplan);
  pgPlanartCount.set(key, (pgPlanartCount.get(key) ?? 0) + 1);
}

const pg: Apt[] = (pgRows ?? []).map((r) => {
  const id = String(r.idplan);
  return {
    source: "pg",
    id,
    emp: String(r.codemp ?? "").trim(),
    horini: String(r.horini ?? ""),
    horfin: String(r.horfin ?? ""),
    nomcli: String(r.nomcli ?? ""),
    codrec: String(r.codrec ?? ""),
    texto: String(r.texto ?? ""),
    planartCount: pgPlanartCount.get(id) ?? 0,
  };
});

console.log("STYLE_ROOT:", ROOT);
console.log("Fecha:", DATE);
console.log("plan2009.dbf mtime:", planPath ? fs.statSync(planPath).mtime.toISOString() : "?");
console.log("");
console.log("| Fuente | Citas |");
console.log("|--------|------:|");
console.log(`| plan2009 (fecha=${DATE}) | ${stylePlan.length} |`);
console.log(`| planinc fechax=${DATE} | ${planincFechax.length} |`);
console.log(`| planinc fecha=${DATE} | ${planincFecha.length} |`);
console.log(`| plantmp fechax=${DATE} | ${plantmp.length} |`);
console.log(`| Suite Postgres plan2009 | ${pg.length} |`);

if (stylePlan.length) {
  console.log("\n--- plan2009 Style ---");
  for (const a of stylePlan.sort((x, y) => x.horini.localeCompare(y.horini))) console.log(" ", aptLine(a));
}

if (planincFechax.length) {
  console.log("\n--- planinc (fechax) muestra ---");
  for (const r of planincFechax.slice(0, 20)) {
    console.log(
      `  tip=${dbfStr(r, "tipinc")} idplan=${r.idplan} ${effectiveHorini(r, true)} emp=${effectiveEmp(r, true)} ${effectiveNom(r, true).slice(0, 40)}`,
    );
  }
}

if (plantmp.length) {
  console.log("\n--- plantmp (pendientes confirmación) ---");
  for (const r of plantmp) {
    console.log(
      `  tip=${dbfStr(r, "tiptmp")} idplan=${r.idplan} ${effectiveHorini(r, true)} emp=${effectiveEmp(r, true)} ${effectiveNom(r, true).slice(0, 40)}`,
    );
  }
}

console.log("\n--- Suite Postgres ---");
for (const a of pg.sort((x, y) => x.horini.localeCompare(y.horini))) console.log(" ", aptLine(a));

const pgIds = new Set(pg.map((a) => a.id));
const styleIds = new Set(stylePlan.map((a) => a.id));
const onlyStyle = stylePlan.filter((a) => !pgIds.has(a.id));
const onlyPg = pg.filter((a) => !styleIds.has(a.id));
if (onlyStyle.length || onlyPg.length) {
  console.log("\n--- Solo en Style (plan2009) ---");
  for (const a of onlyStyle) console.log(" ", aptLine(a));
  console.log("--- Solo en Suite ---");
  for (const a of onlyPg) console.log(" ", aptLine(a));
}

const pgById = new Map(pg.map((a) => [a.id, a]));
const fieldDiffs: string[] = [];
for (const s of stylePlan) {
  const p = pgById.get(s.id);
  if (!p) continue;
  if (aptKey(s) !== aptKey(p)) {
    fieldDiffs.push(`  id=${s.id}\n    Style: ${aptLine(s)}\n    Suite: ${aptLine(p)}`);
  }
}
if (fieldDiffs.length) {
  console.log(`\n--- Diferencias de campos (${fieldDiffs.length}) ---`);
  for (const line of fieldDiffs) console.log(line);
} else if (stylePlan.length && pg.length) {
  console.log("\n--- Campos coincidentes para idplans comunes ---");
}
