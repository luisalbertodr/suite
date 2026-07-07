/**
 * Elimina duplicidad facturación 2026: facturas legacy A-N vs canónicas A-2026-N
 * y mapeos style_key sin prefijo ejefac.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  dbfStr,
  fiscalInvoiceMapKey,
  loadDbfFilteredRows,
} from "../dbfSource.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EJEFAC = process.env.BILLING_EJEFAC ?? "2026";
const HUB_ID = COMPANY_ID;
const SL_ID = "816af484-92a0-4f65-a5a7-1c907aa4bb3d";
const BILLING_IDS = [HUB_ID, SL_ID];
const DRY_RUN = process.argv.includes("--dry-run");

if (!STYLE_ROOT || !HUB_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractNumfac(number: string): string | null {
  const m = number.match(/^A-\d{4}-(\d+)/);
  if (m) return m[1]!;
  const m2 = number.match(/^A-(\d+)(?:-|$)/);
  if (m2 && !number.match(/^A-\d{4}-/)) return m2[1]!;
  return null;
}

function isLegacyNumber(number: string): boolean {
  return /^A-\d+$/.test(number);
}

function isCanonicalNumber(number: string, ejefac: string): boolean {
  return number.startsWith(`A-${ejefac}-`);
}

async function main(): Promise<void> {
  console.log(DRY_RUN ? "MODO dry-run" : "MODO ejecución", `ejefac=${EJEFAC}`);

  const fiscal = await loadDbfFilteredRows(
    STYLE_ROOT,
    "faccab",
    (r) => dbfStr(r, "ejefac") === EJEFAC && dbfStr(r, "serfac") !== "00",
  );

  const canonicalKeys = new Set<string>();
  const canonicalNums = new Set<string>();
  for (const row of fiscal) {
    const ser = dbfStr(row, "serfac") || "A";
    const num = dbfStr(row, "numfac");
    const cli = dbfStr(row, "codcli");
    canonicalNums.add(num);
    for (const bid of BILLING_IDS) {
      canonicalKeys.add(fiscalInvoiceMapKey(EJEFAC, ser, num, cli, bid));
    }
  }
  console.log(`Facturas fiscales DBF ${EJEFAC}: ${fiscal.length}`);

  const { data: maps, error: mapErr } = await supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key, suite_id")
    .eq("company_id", HUB_ID)
    .eq("entity_type", "invoice");
  if (mapErr) throw mapErr;

  const canonicalSuiteIds = new Set<string>();
  const toRemoveMaps: string[] = [];

  for (const m of maps ?? []) {
    if (canonicalKeys.has(m.style_key)) {
      canonicalSuiteIds.add(m.suite_id);
      continue;
    }
    if (m.style_key.startsWith(`${EJEFAC}/`)) {
      toRemoveMaps.push(m.style_key);
      continue;
    }
    const parts = m.style_key.split("/");
    if (parts.length === 4 && canonicalNums.has(parts[1]!)) {
      toRemoveMaps.push(m.style_key);
    }
  }

  console.log(`Mapeos canónicos ${EJEFAC}: ${canonicalSuiteIds.size}`);
  console.log(`Mapeos legacy/huérfanos a eliminar: ${toRemoveMaps.length}`);

  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, number, issue_date, total_amount, status, company_id, notes")
    .in("company_id", BILLING_IDS)
    .gte("issue_date", `${EJEFAC}-01-01`)
    .lte("issue_date", `${EJEFAC}-12-31`);
  if (invErr) throw invErr;

  const toCancel = new Set<string>();
  const byCompanyNum = new Map<string, typeof invoices>();

  for (const inv of invoices ?? []) {
    if (inv.status === "cancelled") continue;
    const notes = String(inv.notes ?? "");
    if (!notes.includes("Factura Style sync")) continue;

    const num = extractNumfac(inv.number);
    if (!num || !canonicalNums.has(num)) {
      toCancel.add(inv.id);
      continue;
    }

    const bucketKey = `${inv.company_id}/${num}`;
    if (!byCompanyNum.has(bucketKey)) byCompanyNum.set(bucketKey, []);
    byCompanyNum.get(bucketKey)!.push(inv);
  }

  for (const [, group] of byCompanyNum) {
    if (group.length <= 1) continue;
    const canonical = group.filter((i) => isCanonicalNumber(i.number, EJEFAC));
    const legacy = group.filter((i) => isLegacyNumber(i.number));
    const keep =
      canonical.find((i) => canonicalSuiteIds.has(i.id)) ??
      canonical[0] ??
      group.find((i) => canonicalSuiteIds.has(i.id)) ??
      group[0];
    for (const inv of group) {
      if (inv.id !== keep!.id) toCancel.add(inv.id);
    }
    for (const inv of legacy) {
      if (canonical.length > 0) toCancel.add(inv.id);
    }
  }

  for (const inv of invoices ?? []) {
    if (inv.status === "cancelled") continue;
    if (!String(inv.notes ?? "").includes("Factura Style sync")) continue;
    if (canonicalSuiteIds.has(inv.id)) continue;
    if (toCancel.has(inv.id)) continue;
    const num = extractNumfac(inv.number);
    if (num && canonicalNums.has(num) && isLegacyNumber(inv.number)) {
      toCancel.add(inv.id);
    }
  }

  const cancelIds = [...toCancel];
  const cancelTotal = cancelIds.reduce((s, id) => {
    const inv = invoices?.find((i) => i.id === id);
    return s + Number(inv?.total_amount ?? 0);
  }, 0);

  console.log(`Facturas a cancelar (duplicados/huérfanos): ${cancelIds.length}`);
  console.log(`Importe a restar: ${cancelTotal.toFixed(2)} €`);

  if (DRY_RUN) {
    console.log("\nDry-run: sin cambios.");
    return;
  }

  const chunk = 50;
  for (let i = 0; i < cancelIds.length; i += chunk) {
    const ids = cancelIds.slice(i, i + chunk);
    const { error } = await supabase
      .from("invoices")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw error;
  }

  for (const key of toRemoveMaps) {
    const { error } = await supabase
      .schema("dunasoft")
      .from("style_sync_entity_map")
      .delete()
      .eq("company_id", HUB_ID)
      .eq("entity_type", "invoice")
      .eq("style_key", key);
    if (error) throw error;
  }

  console.log(`Listo: canceladas=${cancelIds.length} mapeos_eliminados=${toRemoveMaps.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
