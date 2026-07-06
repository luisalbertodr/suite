/**
 * Cancela facturas Style sync no canónicas (serie≠00) y elimina mapeos huérfanos.
 * Por defecto todos los ejercicios; un año: BILLING_EJEFAC=2025 o --year=2025
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  dbfDateIso,
  dbfNum,
  dbfStr,
  fiscalInvoiceMapKey,
  listDistinctFiscalEjefac,
  loadDbfFilteredRows,
} from "../dbfSource.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const HUB_ID = COMPANY_ID;
const SL_ID = "816af484-92a0-4f65-a5a7-1c907aa4bb3d";
const BILLING_COMPANY_IDS = [HUB_ID, SL_ID];
const DRY_RUN = process.argv.includes("--dry-run");
const yearArg = process.argv.find((a) => a.startsWith("--year="))?.split("=")[1];
const ALL_YEARS = process.argv.includes("--all-years") || !yearArg;
const EJEFAC = yearArg ?? process.env.BILLING_EJEFAC ?? "";

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseMapKey(styleKey: string): {
  ejefac: string | null;
  ser: string;
  num: string;
  cli: string;
  billingId: string;
} | null {
  const parts = styleKey.split("/");
  if (parts.length === 5 && /^\d{4}$/.test(parts[0]!)) {
    return { ejefac: parts[0]!, ser: parts[1]!, num: parts[2]!, cli: parts[3]!, billingId: parts[4]! };
  }
  if (parts.length === 4) {
    return { ejefac: null, ser: parts[0]!, num: parts[1]!, cli: parts[2]!, billingId: parts[3]! };
  }
  return null;
}

async function loadCanonicalKeys(ejefacYears: string[]): Promise<Set<string>> {
  const canonicalKeys = new Set<string>();
  for (const year of ejefacYears) {
    const fiscal = await loadDbfFilteredRows(
      STYLE_ROOT,
      "faccab",
      (r) => dbfStr(r, "ejefac") === year && dbfStr(r, "serfac") !== "00",
    );
    for (const row of fiscal) {
      const ej = dbfStr(row, "ejefac");
      const ser = dbfStr(row, "serfac") || "A";
      const num = dbfStr(row, "numfac");
      const cli = dbfStr(row, "codcli");
      for (const bid of BILLING_COMPANY_IDS) {
        canonicalKeys.add(fiscalInvoiceMapKey(ej, ser, num, cli, bid));
        canonicalKeys.add(`${ser}/${num}/${cli}/${bid}`);
      }
    }
    console.log(`  ejefac ${year}: ${fiscal.length} facturas fiscales DBF`);
  }
  return canonicalKeys;
}

async function main(): Promise<void> {
  console.log(DRY_RUN ? "MODO dry-run" : "MODO ejecución");

  const ejefacYears = ALL_YEARS
    ? await listDistinctFiscalEjefac(STYLE_ROOT)
    : [EJEFAC];
  console.log(`Ejercicios: ${ejefacYears.join(", ")}`);

  const canonicalKeys = await loadCanonicalKeys(ejefacYears);
  console.log(`Claves canónicas (nuevas+legacy): ${canonicalKeys.size}`);

  const { data: maps, error: mapErr } = await supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key, suite_id")
    .eq("company_id", COMPANY_ID)
    .eq("entity_type", "invoice");
  if (mapErr) throw mapErr;

  const { data: invRows, error: invErr } = await supabase
    .from("invoices")
    .select("id, issue_date, status, notes")
    .in("company_id", BILLING_COMPANY_IDS);
  if (invErr) throw invErr;
  const invById = new Map((invRows ?? []).map((i) => [i.id, i]));

  const toRemoveMaps: Array<{ style_key: string; suite_id: string }> = [];
  const keepSuiteIds = new Set<string>();

  for (const m of maps ?? []) {
    if (canonicalKeys.has(m.style_key)) {
      keepSuiteIds.add(m.suite_id);
      continue;
    }
    const parsed = parseMapKey(m.style_key);
    const inv = invById.get(m.suite_id);
    const invYear = inv?.issue_date ? String(inv.issue_date).slice(0, 4) : null;
    if (parsed && invYear) {
      const legacyNew = fiscalInvoiceMapKey(invYear, parsed.ser, parsed.num, parsed.cli, parsed.billingId);
      if (canonicalKeys.has(legacyNew) || canonicalKeys.has(m.style_key)) {
        keepSuiteIds.add(m.suite_id);
        continue;
      }
    }
    toRemoveMaps.push(m);
  }

  console.log(`Mapeos totales: ${maps?.length ?? 0}`);
  console.log(`  conservar: ${keepSuiteIds.size}`);
  console.log(`  eliminar: ${toRemoveMaps.length}`);

  const { data: styleInvoices, error: styleInvErr } = await supabase
    .from("invoices")
    .select("id, number, issue_date, total_amount, status, notes, company_id")
    .in("company_id", BILLING_COMPANY_IDS)
    .ilike("notes", "%Factura Style sync%");
  if (styleInvErr) throw styleInvErr;

  const toCancel: string[] = [];
  for (const inv of styleInvoices ?? []) {
    if (inv.status === "cancelled") continue;
    if (keepSuiteIds.has(inv.id)) continue;
    toCancel.push(inv.id);
  }

  console.log(`Facturas Style sync activas: ${styleInvoices?.filter((i) => i.status !== "cancelled").length ?? 0}`);
  console.log(`  cancelar (huérfanas/serie 00/duplicados): ${toCancel.length}`);

  if (DRY_RUN) {
    console.log("\nDry-run: no se aplicaron cambios.");
    return;
  }

  const chunk = 50;
  let cancelled = 0;
  for (let i = 0; i < toCancel.length; i += chunk) {
    const ids = toCancel.slice(i, i + chunk);
    const { error } = await supabase
      .from("invoices")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw error;
    cancelled += ids.length;
  }

  let removedMaps = 0;
  for (const m of toRemoveMaps) {
    const { error } = await supabase
      .schema("dunasoft")
      .from("style_sync_entity_map")
      .delete()
      .eq("company_id", COMPANY_ID)
      .eq("entity_type", "invoice")
      .eq("style_key", m.style_key);
    if (error) throw error;
    removedMaps++;
  }

  console.log(`\nListo: canceladas=${cancelled} mapeos_eliminados=${removedMaps}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
