/**
 * Aplica a Suite todas las citas de plan2009.dbf que no coinciden con Postgres
 * (altas, cambios de fecha/hora/empleado/texto, etc.), sin filtrar por día.
 *
 * Uso:
 *   STYLE_ROOT=... COMPANY_ID=... npx tsx src/scripts/sync-plan2009-unsynced-gap.ts
 *   ... --dry-run
 *   ... --no-delete
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  dbfBool,
  dbfDateIso,
  dbfStr,
  loadDbfFilteredRows,
  loadDbfIndexed,
  type DbfRow,
} from "../dbfSource.js";
import { serviciosJsonToLegacy } from "../servicios.js";
import { loadPlan2009TailIdPlans, loadRecentPlanincIdPlans } from "../planincRecent.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CONCURRENCY = Number(process.env.SYNC_CONCURRENCY ?? "4");
const LOG_EVERY = Number(process.env.SYNC_LOG_EVERY ?? "100");
const dryRun = process.argv.includes("--dry-run");
const noDelete = process.argv.includes("--no-delete");

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan STYLE_ROOT, COMPANY_ID, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PLAN_FIELDS = [
  "codemp",
  "codcli",
  "fecha",
  "horini",
  "horfin",
  "texto",
  "codrec",
  "nomcli",
  "tel1cli",
  "facturado",
  "colfon",
  "collet",
] as const;

function normalizePlanKey(key: string): string {
  const t = String(key ?? "").trim();
  return /^\d+$/.test(t) ? t.replace(/^0+/, "") || "0" : t;
}

function styleFingerprint(row: DbfRow, serviciosJson: string): string {
  const parts = PLAN_FIELDS.map((f) => {
    if (f === "fecha") return `fecha=${dbfDateIso(row, f) ?? ""}`;
    if (f === "facturado") return `facturado=${dbfBool(row, f) ? "1" : "0"}`;
    return `${f}=${dbfStr(row, f)}`;
  });
  parts.push(`servicios=${serviciosJson}`);
  return createHash("sha256").update(parts.join("\x1e")).digest("hex").slice(0, 40);
}

function normCode(raw: string): string {
  const t = raw.trim();
  if (!t || t === "0") return "";
  return t;
}

/** Diff operativo Style vs PG (respeta style_code_or_keep: codcli vacío en Style no cuenta). */
function appointmentDiffers(styleRow: DbfRow, pgRow: Record<string, unknown>): boolean {
  const styleFecha = dbfDateIso(styleRow, "fecha") ?? "";
  const pgFecha = String(pgRow.fecha ?? "").slice(0, 10);
  if (styleFecha !== pgFecha) return true;

  const styleIni = dbfStr(styleRow, "horini").slice(0, 5);
  const styleFin = dbfStr(styleRow, "horfin").slice(0, 5);
  const pgIni = String(pgRow.horini ?? "").trim().slice(0, 5);
  const pgFin = String(pgRow.horfin ?? "").trim().slice(0, 5);
  if (styleIni !== pgIni || styleFin !== pgFin) return true;

  const styleEmp = normCode(dbfStr(styleRow, "codemp"));
  const pgEmp = normCode(String(pgRow.codemp ?? ""));
  if (styleEmp && styleEmp !== pgEmp) return true;

  const styleRec = dbfStr(styleRow, "codrec").trim();
  const pgRec = String(pgRow.codrec ?? "").trim();
  if (styleRec && styleRec !== pgRec) return true;

  const styleFact = dbfBool(styleRow, "facturado");
  const pgFact = pgRow.facturado === true || pgRow.facturado === "t" || pgRow.facturado === 1;
  if (styleFact !== pgFact) return true;

  const styleCli = normCode(dbfStr(styleRow, "codcli"));
  const pgCli = normCode(String(pgRow.codcli ?? ""));
  if (styleCli && styleCli !== pgCli) return true;

  return false;
}

async function loadPlanartServiciosIndex(): Promise<Map<string, string>> {
  const rows = await loadDbfFilteredRows(STYLE_ROOT, "planart", () => true);
  const buckets = new Map<string, Array<{ servicio: string; hora: string }>>();
  for (const r of rows) {
    const key = normalizePlanKey(String(r.idplan ?? ""));
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

async function loadAllPgPlans(): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .schema("dunasoft")
      .from("plan2009")
      .select("idplan,codemp,codcli,fecha,horini,horfin,texto,codrec,nomcli,tel1cli,facturado,colfon,collet")
      .order("idplan", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      const key = normalizePlanKey(String(row.idplan ?? ""));
      if (key) out.set(key, row as Record<string, unknown>);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = /502|503|504|ECONNRESET|ETIMEDOUT|fetch failed|Bad Gateway/i.test(msg);
      if (!retryable || i === attempts) throw e;
      const wait = Math.min(30_000, 500 * 2 ** i);
      console.warn(`retry ${i}/${attempts} ${label}: ${msg.slice(0, 80)} (wait ${wait}ms)`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function applyUpdate(row: DbfRow, serviciosJson: string): Promise<void> {
  const idplan = Number(String(row.idplan ?? "").trim());
  await withRetry(async () => {
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
  }, `UPD ${idplan}`);
}

async function applyDelete(idplan: number): Promise<void> {
  const { error } = await supabase.rpc("style_reservas_apply_from_style", {
    p_company_id: COMPANY_ID,
    p_accion: "DELETE",
    p_idplan: idplan,
    p_codemp: "",
    p_codcli: "",
    p_fecha: null,
    p_horini: "",
    p_horfin: "",
    p_texto: "",
    p_codrec: "",
    p_nomcli: "",
    p_tel1cli: "",
    p_facturado: false,
    p_servicios: "",
    p_colfon: 0,
    p_collet: 0,
    p_style_modified_at: null,
  });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
}

async function upsertFingerprints(entries: Array<{ style_key: string; fingerprint: string }>) {
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

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

async function main() {
  console.log(`Gap sync Style→Suite (dryRun=${dryRun}, noDelete=${noDelete})`);
  console.log(`STYLE_ROOT=${STYLE_ROOT}`);

  console.log("Cargando plan2009.dbf...");
  const index = await loadDbfIndexed(STYLE_ROOT, "plan2009", "idplan");
  console.log(`Style filas: ${index.size}`);

  console.log("Cargando planart.dbf...");
  const serviciosByPlan = await loadPlanartServiciosIndex();

  console.log("Cargando dunasoft.plan2009...");
  const pg = await loadAllPgPlans();
  console.log(`Suite filas: ${pg.size}`);

  // Incidencias recientes en Style (cualquier día tocado recientemente en planinc/tail).
  process.env.PLANINC_TAIL_RECORDS = process.env.PLANINC_TAIL_RECORDS ?? "8000";
  process.env.PLANINC_MAX_IDS = process.env.PLANINC_MAX_IDS ?? "3000";
  process.env.PLAN2009_TAIL_RECORDS = process.env.PLAN2009_TAIL_RECORDS ?? "5000";
  const recentPlaninc = await loadRecentPlanincIdPlans(STYLE_ROOT);
  const recentTail = loadPlan2009TailIdPlans(STYLE_ROOT);
  const forceIds = new Set<string>([...recentPlaninc, ...recentTail]);
  console.log(`Forzar por planinc/tail: ${forceIds.size} idplan(s)`);

  type Upd = { key: string; row: DbfRow; reason: "missing" | "changed" | "recent"; fecha: string };
  const toUpdate: Upd[] = [];
  const allStyleFp: Array<{ style_key: string; fingerprint: string }> = [];
  const seenUpdate = new Set<string>();

  for (const [rawKey, row] of index) {
    const key = normalizePlanKey(rawKey);
    const serviciosJson = serviciosByPlan.get(key) ?? "[]";
    allStyleFp.push({ style_key: key, fingerprint: styleFingerprint(row, serviciosJson) });
    const pgRow = pg.get(key);
    const fecha = dbfDateIso(row, "fecha") ?? "";
    if (!pgRow) {
      toUpdate.push({ key, row, reason: "missing", fecha });
      seenUpdate.add(key);
      continue;
    }
    if (appointmentDiffers(row, pgRow)) {
      const pgFecha = String(pgRow.fecha ?? "").slice(0, 10);
      // Cambios estructurales solo si afectan agenda reciente o el día Style/PG es >= 2026-07-01
      // (evita reescribir histórico por campos vacíos en DBF). El resto de mods reales van por planinc.
      if (fecha >= "2026-07-01" || pgFecha >= "2026-07-01") {
        toUpdate.push({ key, row, reason: "changed", fecha });
        seenUpdate.add(key);
        continue;
      }
    }
    if (forceIds.has(key)) {
      // planinc/tail: solo si aún hay diff (si no, reaplicaríamos siempre el mismo set).
      if (appointmentDiffers(row, pgRow)) {
        toUpdate.push({ key, row, reason: "recent", fecha });
        seenUpdate.add(key);
      }
    }
  }

  // Altas en cola de planinc cuyo id aún no estaba en el bucle (no debería ocurrir).
  for (const key of forceIds) {
    if (seenUpdate.has(key)) continue;
    const row = index.get(key) ?? [...index.entries()].find(([k]) => normalizePlanKey(k) === key)?.[1];
    if (!row) continue;
    if (!pg.has(key)) {
      toUpdate.push({ key, row, reason: "missing", fecha: dbfDateIso(row, "fecha") ?? "" });
      seenUpdate.add(key);
    }
  }

  const styleKeys = new Set([...index.keys()].map(normalizePlanKey));
  const toDelete: string[] = [];
  if (!noDelete) {
    for (const key of pg.keys()) {
      if (!styleKeys.has(key)) toDelete.push(key);
    }
  }

  const missing = toUpdate.filter((u) => u.reason === "missing").length;
  const changed = toUpdate.filter((u) => u.reason === "changed").length;
  const recent = toUpdate.filter((u) => u.reason === "recent").length;
  console.log(`Pendientes UPDATE: ${toUpdate.length} (missing=${missing}, changed=${changed}, recent=${recent})`);
  console.log(`Pendientes DELETE: ${toDelete.length}`);

  const byFecha = new Map<string, number>();
  for (const u of toUpdate) {
    const f = u.fecha || "?";
    byFecha.set(f, (byFecha.get(f) ?? 0) + 1);
  }
  const topFechas = [...byFecha.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log("Top fechas afectadas:");
  for (const [f, n] of topFechas) console.log(`  ${f}: ${n}`);

  for (const u of toUpdate.slice(0, 20)) {
    console.log(
      `  ${u.reason} id=${u.key} ${u.fecha} ${dbfStr(u.row, "horini")}-${dbfStr(u.row, "horfin")} emp=${dbfStr(u.row, "codemp")} ${dbfStr(u.row, "nomcli").slice(0, 36)}`,
    );
  }
  if (toUpdate.length > 20) console.log(`  ... +${toUpdate.length - 20} más`);

  if (dryRun) {
    console.log("Dry-run: no se aplicaron cambios.");
    return;
  }

  let ok = 0;
  let err = 0;
  await mapPool(toUpdate, CONCURRENCY, async (u) => {
    const serviciosJson = serviciosByPlan.get(u.key) ?? "[]";
    try {
      await applyUpdate(u.row, serviciosJson);
      ok++;
      if (ok % LOG_EVERY === 0) console.log(`  UPD ${ok}/${toUpdate.length}...`);
    } catch (e) {
      err++;
      if (err <= 40) {
        console.error(`ERR UPD idplan=${u.key}:`, e instanceof Error ? e.message : String(e));
      }
    }
  });

  let delOk = 0;
  let delErr = 0;
  await mapPool(toDelete, CONCURRENCY, async (key) => {
    const id = Number(key);
    if (!Number.isFinite(id)) return;
    try {
      await applyDelete(id);
      delOk++;
      if (delOk % LOG_EVERY === 0) console.log(`  DEL ${delOk}/${toDelete.length}...`);
    } catch (e) {
      delErr++;
      if (delErr <= 20) {
        console.error(`ERR DEL idplan=${key}:`, e instanceof Error ? e.message : String(e));
      }
    }
  });

  console.log("Actualizando huellas de filas aplicadas...");
  const touchedFp = allStyleFp.filter((e) => seenUpdate.has(e.style_key));
  await upsertFingerprints(touchedFp);

  await supabase.schema("dunasoft").from("style_sync_agent_state").upsert(
    {
      company_id: COMPANY_ID,
      last_outbound_ok_at: new Date().toISOString(),
      agent_last_tick_at: new Date().toISOString(),
      last_outbound_lag_ms: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" },
  );

  console.log(`Listo: upd_ok=${ok} upd_err=${err} del_ok=${delOk} del_err=${delErr} huellas=${touchedFp.length}`);
  if (err > 0 || delErr > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
