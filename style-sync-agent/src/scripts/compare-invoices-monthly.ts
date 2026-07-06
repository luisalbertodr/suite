/**
 * Comparativa facturación Style (referencia usuario) vs Suite.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { sumStyleBillingByMonth, loadDbfFilteredRows, dbfStr } from "../dbfSource.js";

const REF: Record<string, number> = {
  "2026-03": 16229.69,
  "2026-04": 24894.65,
  "2026-05": 26789.02,
  "2026-06": 23156.55,
  "2026-07": 4104,
};

const HUB_ID = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4";
const SL_ID = "816af484-92a0-4f65-a5a7-1c907aa4bb3d";
const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function suiteSyncedByMonth(): Promise<Map<string, number>> {
  const fiscal = await loadDbfFilteredRows(
    STYLE_ROOT,
    "faccab",
    (r) => dbfStr(r, "ejefac") === "2026" && dbfStr(r, "serfac") !== "00",
  );
  const canonicalKeys = new Set(
    fiscal.map(
      (r) =>
        `${dbfStr(r, "serfac") || "A"}/${dbfStr(r, "numfac")}/${dbfStr(r, "codcli")}/${HUB_ID}`,
    ),
  );

  const { data: maps } = await supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key, suite_id")
    .eq("company_id", HUB_ID)
    .eq("entity_type", "invoice");
  const ids = new Set(
    (maps ?? []).filter((m) => canonicalKeys.has(m.style_key)).map((m) => m.suite_id),
  );
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, issue_date, total_amount, status")
    .eq("company_id", HUB_ID);
  const out = new Map<string, number>();
  for (const i of inv ?? []) {
    if (!ids.has(i.id) || i.status === "cancelled") continue;
    const mes = String(i.issue_date).slice(0, 7);
    out.set(mes, (out.get(mes) ?? 0) + Number(i.total_amount ?? 0));
  }
  return out;
}

async function suiteBothCompaniesByMonth(): Promise<Map<string, number>> {
  const { data: inv } = await supabase
    .from("invoices")
    .select("issue_date, total_amount, status, company_id")
    .in("company_id", [HUB_ID, SL_ID]);
  const out = new Map<string, number>();
  for (const i of inv ?? []) {
    if (i.status === "cancelled") continue;
    const mes = String(i.issue_date).slice(0, 7);
    out.set(mes, (out.get(mes) ?? 0) + Number(i.total_amount ?? 0));
  }
  return out;
}

async function main() {
  const style = await sumStyleBillingByMonth(STYLE_ROOT, "2026");
  const synced = await suiteSyncedByMonth();
  const suiteAll = await suiteBothCompaniesByMonth();

  console.log("Facturación IVA incl. — Style (totfacres ejefac=2026) vs Suite\n");
  console.log(
    "Mes".padEnd(8),
    "Style REF".padStart(12),
    "DBF leído".padStart(12),
    "Δ DBF".padStart(10),
    "Suite sync".padStart(12),
    "Suite 2emp".padStart(12),
  );
  console.log("-".repeat(68));

  for (const mes of Object.keys(REF).sort()) {
    const dbf = Math.round((style.get(mes) ?? 0) * 100) / 100;
    const ref = REF[mes];
    const dDbf = Math.round((dbf - ref) * 100) / 100;
    const sync = Math.round((synced.get(mes) ?? 0) * 100) / 100;
    const all = Math.round((suiteAll.get(mes) ?? 0) * 100) / 100;
    console.log(
      mes,
      ref.toFixed(2).padStart(12),
      dbf.toFixed(2).padStart(12),
      dDbf.toFixed(2).padStart(10),
      sync.toFixed(2).padStart(12),
      all.toFixed(2).padStart(12),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
