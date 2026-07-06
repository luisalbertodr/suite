/**
 * Re-sincroniza facturas Style (faccab serfac≠00) → Suite.
 * Un ejercicio: BILLING_EJEFAC=2025 o --year=2025
 * Todos: --all-years
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ENTITY_HANDLERS } from "../handlers.js";
import {
  dbfDateIso,
  dbfStr,
  listDistinctFiscalEjefac,
  loadDbfFilteredRows,
  styleRowKey,
} from "../dbfSource.js";
import type { EntityEngineDeps } from "../entitySync.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const yearArg = process.argv.find((a) => a.startsWith("--year="))?.split("=")[1];
const ALL_YEARS = process.argv.includes("--all-years");
const ONLY_MONTH = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a)) ?? "";
const EJEFAC = yearArg ?? process.env.BILLING_EJEFAC ?? "2026";

const facturasHandler = ENTITY_HANDLERS.find((h) => h.tabla === "faccab")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const deps = {
  styleRoot: STYLE_ROOT,
  companyId: COMPANY_ID,
  supabase,
  colaPath: "",
  inboundDir: "",
  inboundAckDir: "",
  log: (m: string) => console.log(m),
} as EntityEngineDeps;

async function syncEjefac(ejefac: string): Promise<{ ok: number; err: number; skipped: number }> {
  const rows = await loadDbfFilteredRows(
    STYLE_ROOT,
    "faccab",
    (r) =>
      dbfStr(r, "ejefac") === ejefac &&
      dbfStr(r, "serfac") !== "00" &&
      (!ONLY_MONTH || dbfDateIso(r, "fecfac")?.startsWith(ONLY_MONTH)),
  );

  const { data: exclusions } = await supabase
    .schema("dunasoft")
    .from("style_sync_billing_exclusions")
    .select("style_key")
    .eq("company_id", COMPANY_ID);
  const excluded = new Set((exclusions ?? []).map((e) => e.style_key));
  const isExcluded = (row: (typeof rows)[0]) => {
    const ser = dbfStr(row, "serfac") || "A";
    const num = dbfStr(row, "numfac");
    const cli = dbfStr(row, "codcli");
    const prefix = `${ser}/${num}/`;
    if ([...excluded].some((k) => k === `${ser}/${num}/${cli}` || k.startsWith(prefix))) return true;
    return false;
  };

  const toSync = rows.filter((r) => !isExcluded(r));
  console.log(`\n=== ejefac ${ejefac}: ${toSync.length} facturas (${rows.length - toSync.length} excluidas) ===`);

  let ok = 0;
  let err = 0;
  const skipped = rows.length - toSync.length;

  for (const row of toSync) {
    const key = styleRowKey("faccab", row);
    const cola = { id: 0, tabla: "faccab", id_reg: dbfStr(row, "numfac"), accion: "UPD" };
    try {
      const args = await facturasHandler.buildArgs!(COMPANY_ID, cola, row, deps);
      if (!args) continue;
      const { error } = await supabase.schema("dunasoft").rpc(facturasHandler.rpc, args);
      if (error) throw error;
      ok++;
      if (ok <= 2 || ok % 200 === 0) {
        console.log(`  ok ${ok}: ${key} ${dbfDateIso(row, "fecfac")}`);
      }
    } catch (e) {
      err++;
      if (err <= 10) console.error(`  ERR ${key}:`, e instanceof Error ? e.message : JSON.stringify(e));
    }
  }

  console.log(`  ejefac ${ejefac} → ok=${ok} err=${err} omitidas=${skipped}`);
  return { ok, err, skipped };
}

async function main() {
  const years = ALL_YEARS ? await listDistinctFiscalEjefac(STYLE_ROOT) : [EJEFAC];
  console.log(`Resync facturación fiscal: ${years.join(", ")}`);

  let totalOk = 0;
  let totalErr = 0;
  let totalSkipped = 0;
  for (const year of years) {
    const r = await syncEjefac(year);
    totalOk += r.ok;
    totalErr += r.err;
    totalSkipped += r.skipped;
  }
  console.log(`\nListo total ok=${totalOk} err=${totalErr} omitidas=${totalSkipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
