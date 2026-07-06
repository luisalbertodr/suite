/**
 * Importación completa plan2009.dbf → Suite (fuente de verdad: Style Test).
 * Uso: npm run build && node dist/scripts/full-sync-plan2009-from-dbf.js
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  dbfBool,
  dbfDateIso,
  dbfStr,
  loadDbfIndexed,
  loadDbfFilteredRows,
} from "../dbfSource.js";
import { serviciosJsonToLegacy } from "../servicios.js";
import type { DbfRow } from "../dbfSource.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BATCH_LOG = Number(process.env.SYNC_LOG_EVERY ?? "500");
const CONCURRENCY = Number(process.env.SYNC_CONCURRENCY ?? "20");

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan STYLE_ROOT, COMPANY_ID, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PLAN_FIELDS = [
  "codemp", "codcli", "fecha", "horini", "horfin", "texto", "codrec",
  "nomcli", "tel1cli", "facturado", "colfon", "collet",
];

function rowFingerprint(row: DbfRow, serviciosJson: string): string {
  const parts = PLAN_FIELDS.map((f) => {
    if (f === "fecha") return `fecha=${dbfDateIso(row, f) ?? ""}`;
    if (f === "facturado") return `facturado=${dbfBool(row, f) ? "1" : "0"}`;
    return `${f}=${dbfStr(row, f)}`;
  });
  parts.push(`servicios=${serviciosJson}`);
  return createHash("sha256").update(parts.join("\x1e")).digest("hex").slice(0, 40);
}

function normalizePlanKey(key: string): string {
  const t = String(key ?? "").trim();
  return /^\d+$/.test(t) ? t.replace(/^0+/, "") || "0" : t;
}

async function loadPlanartServiciosIndex(): Promise<Map<string, string>> {
  const rows = await loadDbfFilteredRows(STYLE_ROOT, "planart", () => true);
  const buckets = new Map<string, Array<{ servicio: string; hora: string }>>();
  for (const r of rows) {
    const raw = String(r.idplan ?? "").trim();
    if (!raw) continue;
    const key = raw.replace(/^0+/, "") || "0";
    const cod = dbfStr(r, "codart");
    if (!cod) continue;
    const list = buckets.get(key) ?? [];
    list.push({ servicio: cod, hora: dbfStr(r, "hora") });
    buckets.set(key, list);
  }
  const out = new Map<string, string>();
  for (const [key, items] of buckets) out.set(key, JSON.stringify(items));
  return out;
}

async function applyRow(row: DbfRow, serviciosJson: string): Promise<void> {
  const idplan = Number(String(row.idplan ?? "").trim());
  const { error } = await supabase.rpc("style_reservas_apply_from_style", {
    p_company_id: COMPANY_ID,
    p_accion: "UPDATE",
    p_idplan: idplan,
    p_codemp: dbfStr(row, "codemp"),
    p_codcli: dbfStr(row, "codcli"),
    p_fecha: dbfDateIso(row, "fecha"),
    p_horini: dbfStr(row, "horini"),
    p_horfin: dbfStr(row, "horfin"),
    p_texto: dbfStr(row, "texto"),
    p_codrec: dbfStr(row, "codrec"),
    p_nomcli: dbfStr(row, "nomcli"),
    p_tel1cli: dbfStr(row, "tel1cli"),
    p_facturado: dbfBool(row, "facturado"),
    p_servicios: serviciosJsonToLegacy(serviciosJson),
    p_colfon: Number(dbfStr(row, "colfon") || 0),
    p_collet: Number(dbfStr(row, "collet") || 0),
    p_style_modified_at: null,
  });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
}

async function upsertFingerprints(
  entries: Array<{ style_key: string; fingerprint: string }>,
): Promise<void> {
  const chunk = 200;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk).map((e) => ({
      company_id: COMPANY_ID,
      tabla: "plan2009",
      style_key: e.style_key,
      fingerprint: e.fingerprint,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .schema("dunasoft")
      .from("style_sync_dbf_fingerprint")
      .upsert(slice, { onConflict: "company_id,tabla,style_key" });
    if (error) throw error;
  }
}

async function main(): Promise<void> {
  console.log("Cargando plan2009.dbf...");
  const index = await loadDbfIndexed(STYLE_ROOT, "plan2009", "idplan");
  const serviciosByPlan = await loadPlanartServiciosIndex();
  const total = index.size;
  console.log(`Filas: ${total}`);

  let ok = 0;
  let err = 0;
  const fingerprints: Array<{ style_key: string; fingerprint: string }> = [];
  const entries = [...index.entries()];

  async function worker(batch: Array<[string, DbfRow]>): Promise<void> {
    for (const [key, row] of batch) {
      const normKey = normalizePlanKey(key);
      const serviciosJson = serviciosByPlan.get(normKey) ?? "[]";
      fingerprints.push({ style_key: normKey, fingerprint: rowFingerprint(row, serviciosJson) });
      try {
        await applyRow(row, serviciosJson);
        ok++;
        if (ok % BATCH_LOG === 0) console.log(`  ${ok}/${total}...`);
      } catch (e) {
        err++;
        if (err <= 30) {
          console.error(`ERR idplan=${normKey}:`, e instanceof Error ? e.message : String(e));
        }
      }
    }
  }

  const chunkSize = Math.ceil(entries.length / CONCURRENCY);
  const chunks: Array<Array<[string, DbfRow]>> = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }
  console.log(`Sincronizando con concurrencia ${chunks.length}...`);
  await Promise.all(chunks.map((c) => worker(c)));

  console.log("Resembrando huellas plan2009...");
  await supabase
    .schema("dunasoft")
    .from("style_sync_dbf_fingerprint")
    .delete()
    .eq("company_id", COMPANY_ID)
    .eq("tabla", "plan2009");
  await upsertFingerprints(fingerprints);

  console.log(`Listo: ok=${ok} err=${err} huellas=${fingerprints.length}`);
  if (err > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
