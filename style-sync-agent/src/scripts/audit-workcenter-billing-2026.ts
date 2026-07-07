import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { dbfDateIso, dbfNum, dbfStr, loadDbfFilteredRows } from "../dbfSource.js";

const H = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4";
const MED = H;
const EST = "816af484-92a0-4f65-a5a7-1c907aa4bb3d";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const rows = await loadDbfFilteredRows(
  process.env.STYLE_ROOT!,
  "faccab",
  (r) => dbfStr(r, "ejefac") === "2026" && dbfStr(r, "serfac") !== "00",
);

const styleByMonth = new Map<string, number>();
let styleTotal = 0;
for (const r of rows) {
  const d = dbfDateIso(r, "fecfac");
  const t = dbfNum(r, "totfac");
  styleTotal += t;
  if (d) {
    const k = d.slice(0, 7);
    styleByMonth.set(k, (styleByMonth.get(k) ?? 0) + t);
  }
}

const { data: maps } = await sb
  .schema("dunasoft")
  .from("style_sync_entity_map")
  .select("style_key, suite_id")
  .eq("company_id", H)
  .eq("entity_type", "invoice")
  .like("style_key", "2026/%");

const ids = [...new Set((maps ?? []).map((m) => m.suite_id))];
const { data: inv } = await sb
  .from("invoices")
  .select("id, issue_date, total_amount, company_id, status")
  .in("id", ids);

const byCo = new Map<string, number>();
const byMonth = new Map<string, number>();
let suiteTotal = 0;
for (const i of inv ?? []) {
  if (i.status === "cancelled") continue;
  const t = Number(i.total_amount ?? 0);
  suiteTotal += t;
  byCo.set(i.company_id, (byCo.get(i.company_id) ?? 0) + t);
  const m = String(i.issue_date).slice(0, 7);
  byMonth.set(m, (byMonth.get(m) ?? 0) + t);
}

console.log("Style DBF 2026:", rows.length, "facturas, total", styleTotal.toFixed(2));
console.log("Suite mapped:", ids.length, "facturas, total", suiteTotal.toFixed(2));
console.log("  Medicina (hub):", (byCo.get(MED) ?? 0).toFixed(2));
console.log("  Estética (SL):", (byCo.get(EST) ?? 0).toFixed(2));
console.log("  Δ total:", (suiteTotal - styleTotal).toFixed(2));

for (const m of ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]) {
  const st = styleByMonth.get(m) ?? 0;
  const su = byMonth.get(m) ?? 0;
  console.log(m, "Style", st.toFixed(2), "Suite", su.toFixed(2), "Δ", (su - st).toFixed(2));
}

// Facturas activas 2026 sin mapeo (inflan vista 2 empresas)
const { data: extra } = await sb
  .from("invoices")
  .select("id, total_amount, company_id")
  .in("company_id", [MED, EST])
  .gte("issue_date", "2026-01-01")
  .lte("issue_date", "2026-12-31")
  .neq("status", "cancelled");

const mappedSet = new Set(ids);
const orphans = (extra ?? []).filter((i) => !mappedSet.has(i.id));
const orphanByCo = new Map<string, number>();
for (const i of orphans) {
  orphanByCo.set(i.company_id, (orphanByCo.get(i.company_id) ?? 0) + Number(i.total_amount));
}
console.log("\nFacturas 2026 SIN mapeo Style:", orphans.length);
console.log("  Medicina huérfanas EUR:", (orphanByCo.get(MED) ?? 0).toFixed(2));
console.log("  Estética huérfanas EUR:", (orphanByCo.get(EST) ?? 0).toFixed(2));
console.log("  Suma bruta 2 empresas:", (extra ?? []).reduce((s, i) => s + Number(i.total_amount), 0).toFixed(2));
