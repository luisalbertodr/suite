/**
 * Compara plan2009 DBF (Style) vs dunasoft.plan2009 (Suite) en ventana reciente.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { dbfDateIso, dbfStr, loadDbfIndexed } from "../dbfSource.js";

const ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DAYS_BACK = Number(process.env.DAYS_BACK ?? "14");
const DAYS_FWD = Number(process.env.DAYS_FWD ?? "7");

if (!ROOT || !COMPANY_ID || !SUPABASE_URL || !KEY) {
  console.error("Faltan env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY);

function inWindow(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso + "T12:00:00Z");
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - DAYS_BACK);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + DAYS_FWD);
  return d >= from && d <= to;
}

async function main() {
  console.log(`Comparando DBF ${ROOT} vs Suite (ventana -${DAYS_BACK}/+${DAYS_FWD} días)\n`);
  const index = await loadDbfIndexed(ROOT, "plan2009", "idplan");

  const { data: suiteRows, error } = await supabase
    .schema("dunasoft")
    .from("plan2009")
    .select("idplan,fecha,horini,horfin,nomcli,codcli");
  if (error) throw error;

  const suiteById = new Map<string, (typeof suiteRows)[0]>();
  for (const r of suiteRows ?? []) suiteById.set(String(r.idplan).trim(), r);

  const dbfOnly: Array<{ id: string; fecha: string; horini: string; nomcli: string }> = [];
  const fieldDiff: string[] = [];

  for (const [key, row] of index) {
    const fecha = dbfDateIso(row, "fecha");
    if (!inWindow(fecha)) continue;
    const id = String(row.idplan ?? key).trim();
    const suite = suiteById.get(id);
    if (!suite) {
      dbfOnly.push({
        id,
        fecha: fecha ?? "?",
        horini: dbfStr(row, "horini"),
        nomcli: dbfStr(row, "nomcli").slice(0, 40),
      });
      continue;
    }
    const sFecha = String(suite.fecha ?? "").slice(0, 10);
    const sHorini = String(suite.horini ?? "").slice(0, 5);
    const dHorini = dbfStr(row, "horini").slice(0, 5);
    const sNom = String(suite.nomcli ?? "").trim();
    const dNom = dbfStr(row, "nomcli").trim();
    if (sFecha !== fecha || sHorini !== dHorini || (sNom && dNom && sNom !== dNom)) {
      fieldDiff.push(
        `${id} ${fecha} DBF:${dHorini} ${dNom.slice(0, 30)} | Suite:${sHorini} ${sNom.slice(0, 30)}`,
      );
    }
  }

  const suiteOnly: Array<{ id: string; fecha: string; horini: string; nomcli: string }> = [];
  for (const [id, r] of suiteById) {
    const fecha = String(r.fecha ?? "").slice(0, 10);
    if (!inWindow(fecha)) continue;
    if (!index.has(id) && !index.has(id.replace(/^0+/, "") || "0")) {
      suiteOnly.push({
        id,
        fecha,
        horini: String(r.horini ?? ""),
        nomcli: String(r.nomcli ?? "").slice(0, 40),
      });
    }
  }

  dbfOnly.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horini.localeCompare(b.horini));
  suiteOnly.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horini.localeCompare(b.horini));

  console.log(`=== En DBF pero NO en Suite plan2009: ${dbfOnly.length} ===`);
  for (const r of dbfOnly.slice(0, 40)) {
    console.log(`  ${r.fecha} ${r.horini} id=${r.id} ${r.nomcli}`);
  }
  if (dbfOnly.length > 40) console.log(`  ... y ${dbfOnly.length - 40} más`);

  console.log(`\n=== En Suite plan2009 pero NO en DBF: ${suiteOnly.length} ===`);
  for (const r of suiteOnly.slice(0, 20)) {
    console.log(`  ${r.fecha} ${r.horini} id=${r.id} ${r.nomcli}`);
  }

  console.log(`\n=== Divergencias campo (misma idplan): ${fieldDiff.length} ===`);
  for (const line of fieldDiff.slice(0, 25)) console.log(`  ${line}`);

  const { data: noBridge } = await supabase
    .schema("dunasoft")
    .from("plan2009")
    .select("idplan,fecha,horini,nomcli")
    .gte("fecha", new Date(Date.now() - DAYS_BACK * 86400000).toISOString().slice(0, 10))
    .lte("fecha", new Date(Date.now() + DAYS_FWD * 86400000).toISOString().slice(0, 10));

  const ids = (noBridge ?? []).map((r) => String(r.idplan));
  const { data: bridges } = await supabase
    .from("agenda_dunasoft_bridge")
    .select("legacy_idplan")
    .eq("company_id", COMPANY_ID)
    .in("legacy_idplan", ids.length ? ids : ["__none__"]);

  const bridged = new Set((bridges ?? []).map((b) => b.legacy_idplan));
  const planNoAgenda = (noBridge ?? []).filter((r) => !bridged.has(String(r.idplan)));

  console.log(`\n=== En plan2009 Suite sin bridge agenda: ${planNoAgenda.length} ===`);
  for (const r of planNoAgenda.slice(0, 20)) {
    console.log(`  ${r.fecha} ${r.horini} id=${r.idplan} ${String(r.nomcli ?? "").slice(0, 35)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
