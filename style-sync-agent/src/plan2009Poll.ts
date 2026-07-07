import { createHash } from "node:crypto";
import fs from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dbfBool,
  dbfDateIso,
  dbfStr,
  loadDbfFilteredRows,
  loadDbfIndexed,
  loadDbfRowsForKeySet,
  parseDbfLayout,
  readRowFromBuffer,
  resolveDbfPath,
  type DbfRow,
} from "./dbfSource.js";
import { serviciosJsonToLegacy } from "./servicios.js";
import { loadPlan2009TailIdPlans, loadRecentPlanincDeletedPlans, loadRecentPlanincIdPlans } from "./planincRecent.js";
import { patchAgentState } from "./agentState.js";

const TABLA = "plan2009";
const PLAN_FIELDS = [
  "codemp", "codcli", "fecha", "horini", "horfin", "texto", "codrec",
  "nomcli", "tel1cli", "facturado", "colfon", "collet",
];

/** Re-escaneo completo aunque el mtime del DBF no haya cambiado (CIFS a veces miente). */
const FORCE_POLL_MS = Number(process.env.PLAN2009_FORCE_POLL_MS ?? "30000");

export type PollDeps = {
  supabase: SupabaseClient;
  companyId: string;
  styleRoot: string;
  log: (msg: string) => void;
};

export function rowFingerprint(row: DbfRow, serviciosJson: string): string {
  const parts = PLAN_FIELDS.map((f) => {
    if (f === "fecha") return `fecha=${dbfDateIso(row, f) ?? ""}`;
    if (f === "facturado") return `facturado=${dbfBool(row, f) ? "1" : "0"}`;
    return `${f}=${dbfStr(row, f)}`;
  });
  parts.push(`servicios=${serviciosJson}`);
  return createHash("sha256").update(parts.join("\x1e")).digest("hex").slice(0, 40);
}

/** Índice idplan → JSON servicios (una lectura de planart.dbf por tick). */
let planartServiciosCache: Map<string, string> | null = null;
let planartServiciosMtime = 0;

async function loadPlanartServiciosIndex(styleRoot: string, artMtime: number): Promise<Map<string, string>> {
  if (planartServiciosCache && artMtime === planartServiciosMtime) return planartServiciosCache;
  const rows = await loadDbfFilteredRows(styleRoot, "planart", () => true);
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
  planartServiciosCache = out;
  planartServiciosMtime = artMtime;
  return out;
}

export function normalizePlanKey(key: string): string {
  const t = String(key ?? "").trim();
  return /^\d+$/.test(t) ? t.replace(/^0+/, "") || "0" : t;
}

async function loadFingerprintMap(deps: PollDeps): Promise<Map<string, string>> {
  const { data, error } = await deps.supabase
    .schema("dunasoft")
    .from("style_sync_dbf_fingerprint")
    .select("style_key,fingerprint")
    .eq("company_id", deps.companyId)
    .eq("tabla", TABLA);
  if (error) throw error;
  const out = new Map<string, string>();
  for (const row of data ?? []) out.set(String(row.style_key), String(row.fingerprint));
  return out;
}

let fingerprintCache: { map: Map<string, string>; at: number } | null = null;
const FINGERPRINT_CACHE_MS = Number(process.env.PLAN2009_FP_CACHE_MS ?? "45000");

async function loadFingerprintMapCached(deps: PollDeps): Promise<Map<string, string>> {
  const now = Date.now();
  if (fingerprintCache && now - fingerprintCache.at < FINGERPRINT_CACHE_MS) {
    return fingerprintCache.map;
  }
  const map = await loadFingerprintMap(deps);
  fingerprintCache = { map, at: now };
  return map;
}

export async function upsertFingerprints(
  deps: PollDeps,
  entries: Array<{ style_key: string; fingerprint: string }>,
): Promise<void> {
  if (!entries.length) return;
  const chunk = 200;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk).map((e) => ({
      company_id: deps.companyId,
      tabla: TABLA,
      style_key: e.style_key,
      fingerprint: e.fingerprint,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await deps.supabase
      .schema("dunasoft")
      .from("style_sync_dbf_fingerprint")
      .upsert(slice, { onConflict: "company_id,tabla,style_key" });
    if (error) throw error;
  }
  fingerprintCache = null;
}

async function applyPlan2009(
  deps: PollDeps,
  idplan: string,
  row: DbfRow | null,
  accion: "UPDATE" | "DELETE",
  serviciosJson: string,
): Promise<void> {
  const idNum = Number(idplan);
  const fecha = row ? dbfDateIso(row, "fecha") : null;
  const { error } = await deps.supabase.rpc("style_reservas_apply_from_style", {
    p_company_id: deps.companyId,
    p_accion: accion,
    p_idplan: idNum,
    p_codemp: row ? dbfStr(row, "codemp") : "",
    p_codcli: row ? dbfStr(row, "codcli") : "",
    p_fecha: fecha,
    p_horini: row ? dbfStr(row, "horini") : "",
    p_horfin: row ? dbfStr(row, "horfin") : "",
    p_texto: row ? dbfStr(row, "texto") : "",
    p_codrec: row ? dbfStr(row, "codrec") : "",
    p_nomcli: row ? dbfStr(row, "nomcli") : "",
    p_tel1cli: row ? dbfStr(row, "tel1cli") : "",
    p_facturado: row ? dbfBool(row, "facturado") : false,
    p_servicios: serviciosJsonToLegacy(serviciosJson),
    p_colfon: row ? Number(dbfStr(row, "colfon") || 0) : 0,
    p_collet: row ? Number(dbfStr(row, "collet") || 0) : 0,
    p_style_modified_at: null,
  });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  deps.log(`dbf-poll ${TABLA} idplan=${idplan} -> style_reservas_apply_from_style (${accion})`);
  await patchAgentState(deps.supabase, deps.companyId, {
    last_outbound_ok_at: new Date().toISOString(),
    agent_last_tick_at: new Date().toISOString(),
  });
}

const lastMtime = { plan2009: 0, planart: 0 };
let lastForcePollAt = 0;
let lastLightMtime = 0;
let lastLightPollAt = 0;
const LIGHT_POLL_MIN_MS = Number(process.env.PLAN2009_LIGHT_POLL_MIN_MS ?? "2000");

async function loadPlanartServiciosForKeys(
  styleRoot: string,
  keys: Set<string>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!keys.size) return out;
  const dbfPath = resolveDbfPath(styleRoot, "planart");
  if (!dbfPath) return out;
  const buf = fs.readFileSync(dbfPath);
  const layout = parseDbfLayout(buf);
  const field = layout.fields.find((f) => f.name === "IDPLAN");
  if (!field) return out;
  const buckets = new Map<string, Array<{ servicio: string; hora: string }>>();
  for (let i = 0; i < layout.nRecords; i++) {
    const recOff = layout.headerLen + i * layout.recordLen;
    if (buf[recOff] === 0x2a) continue;
    const rawKey = buf
      .slice(recOff + field.pos, recOff + field.pos + field.flen)
      .toString("ascii")
      .replace(/\0/g, "")
      .trim();
    const normKey = rawKey.replace(/^0+/, "") || "0";
    if (!keys.has(normKey)) continue;
    const row = readRowFromBuffer(buf, layout, recOff);
    const cod = dbfStr(row, "codart");
    if (!cod) continue;
    const list = buckets.get(normKey) ?? [];
    list.push({ servicio: cod, hora: dbfStr(row, "hora") });
    buckets.set(normKey, list);
  }
  for (const [key, items] of buckets) out.set(key, JSON.stringify(items));
  return out;
}

function sortChangesByPriority(
  changed: Array<{ key: string; row: DbfRow | null; fp: string; accion: "UPDATE" | "DELETE" }>,
  known: Map<string, string>,
  recentPlaninc: string[],
): void {
  const recentRank = new Map(recentPlaninc.map((id, i) => [id, i]));
  changed.sort((a, b) => {
    // Altas/modificaciones antes que borrados (evita atascar el batch con DELETE históricos).
    if (a.accion !== b.accion) {
      if (a.accion === "UPDATE") return -1;
      if (b.accion === "UPDATE") return 1;
    }
    const aRecent = recentRank.has(a.key) ? recentRank.get(a.key)! : 999_999;
    const bRecent = recentRank.has(b.key) ? recentRank.get(b.key)! : 999_999;
    if (aRecent !== bRecent) return aRecent - bRecent;
    const aNew = known.has(a.key) ? 1 : 0;
    const bNew = known.has(b.key) ? 1 : 0;
    if (aNew !== bNew) return aNew - bNew;
    const aNum = /^\d+$/.test(a.key) ? Number(a.key) : 0;
    const bNum = /^\d+$/.test(b.key) ? Number(b.key) : 0;
    return bNum - aNum;
  });
}

function takePlan2009Batch<T extends { accion: "UPDATE" | "DELETE" }>(
  changed: T[],
  batch: number,
): T[] {
  const maxDeletes = Number(process.env.PLAN2009_DELETE_BATCH ?? "3");
  const updates = changed.filter((c) => c.accion === "UPDATE");
  const deletes = changed.filter((c) => c.accion === "DELETE").slice(0, maxDeletes);
  return [...updates, ...deletes].slice(0, batch);
}

/**
 * Detecta cambios en plan2009/planart cuando Style no encola en cola_sincro.
 * Primera pasada: solo siembra huellas (no reimporta historial de citas).
 */
export async function pollPlan2009FromDbf(deps: PollDeps, batch: number): Promise<void> {
  const planPath = resolveDbfPath(deps.styleRoot, "plan2009");
  if (!planPath) return;

  let planMtime = 0;
  let artMtime = 0;
  try {
    planMtime = fs.statSync(planPath).mtimeMs;
    const artPath = resolveDbfPath(deps.styleRoot, "planart");
    if (artPath) artMtime = fs.statSync(artPath).mtimeMs;
  } catch {
    return;
  }

  const known = await loadFingerprintMapCached(deps);
  const seeded = known.size > 0;
  const forcePoll = Date.now() - lastForcePollAt >= FORCE_POLL_MS;
  if (seeded && !forcePoll && planMtime === lastMtime.plan2009 && artMtime === lastMtime.planart) {
    return;
  }
  if (forcePoll) lastForcePollAt = Date.now();
  lastMtime.plan2009 = planMtime;
  lastMtime.planart = artMtime;

  const index = await loadDbfIndexed(deps.styleRoot, "plan2009", "idplan");
  const serviciosByPlan = await loadPlanartServiciosIndex(deps.styleRoot, artMtime);
  const changed: Array<{ key: string; row: DbfRow; fp: string; accion: "UPDATE" | "DELETE" }> = [];

  if (!seeded) {
    const allEntries: Array<{ style_key: string; fingerprint: string }> = [];
    for (const [key, row] of index) {
      const normKey = normalizePlanKey(key);
      const serviciosJson = serviciosByPlan.get(normKey) ?? "[]";
      allEntries.push({ style_key: normKey, fingerprint: rowFingerprint(row, serviciosJson) });
    }
    await upsertFingerprints(deps, allEntries);
    deps.log(`dbf-poll ${TABLA}: baseline ${allEntries.length} huellas (sin reimportar historial)`);
    return;
  }

  for (const [key, row] of index) {
    const normKey = normalizePlanKey(key);
    const serviciosJson = serviciosByPlan.get(normKey) ?? "[]";
    const fp = rowFingerprint(row, serviciosJson);
    if (known.get(normKey) !== fp) changed.push({ key: normKey, row, fp, accion: "UPDATE" });
  }

  if (seeded) {
    const currentKeys = new Set([...index.keys()].map((k) => normalizePlanKey(k)));
    const recentDeletes = await loadRecentPlanincDeletedPlans(deps.styleRoot);
    for (const key of recentDeletes) {
      if (!currentKeys.has(key) && known.has(key)) {
        changed.push({ key, row: null as unknown as DbfRow, fp: "", accion: "DELETE" });
      }
    }
  }

  if (!changed.length) return;

  const recentPlaninc = await loadRecentPlanincIdPlans(deps.styleRoot);
  if (recentPlaninc.length) {
    deps.log(`dbf-poll ${TABLA}: ${recentPlaninc.length} idplan(s) recientes en planinc`);
  }
  sortChangesByPriority(changed, known, recentPlaninc);

  deps.log(`dbf-poll ${TABLA}: ${changed.length} cambio(s) detectado(s)`);
  for (const item of takePlan2009Batch(changed, batch)) {
    try {
      const serviciosJson = item.accion === "DELETE" ? "[]" : (serviciosByPlan.get(item.key) ?? "[]");
      await applyPlan2009(deps, item.key, item.accion === "DELETE" ? null : item.row, item.accion, serviciosJson);
      if (item.accion === "DELETE") {
        await deps.supabase
          .schema("dunasoft")
          .from("style_sync_dbf_fingerprint")
          .delete()
          .eq("company_id", deps.companyId)
          .eq("tabla", TABLA)
          .eq("style_key", item.key);
      } else {
        await upsertFingerprints(deps, [{ style_key: item.key, fingerprint: item.fp }]);
      }
    } catch (err) {
      deps.log(
        `dbf-poll ${TABLA} idplan=${item.key} error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (changed.length > batch) {
    deps.log(`dbf-poll ${TABLA}: quedan ${changed.length - batch} pendientes (siguiente tick)`);
  }
}

/**
 * Poll ligero mientras Style está abierto: solo idplans recientes en planinc.
 * No indexa 80k filas en RAM ni recorre todo plan2009.
 */
export async function pollPlan2009Lightweight(deps: PollDeps, batch: number): Promise<void> {
  const now = Date.now();
  if (now - lastLightPollAt < LIGHT_POLL_MIN_MS) return;
  lastLightPollAt = now;

  const known = await loadFingerprintMapCached(deps);
  const recentPlaninc = await loadRecentPlanincIdPlans(deps.styleRoot);
  const tailPlan2009 = loadPlan2009TailIdPlans(deps.styleRoot);
  if (!recentPlaninc.length && !tailPlan2009.length) return;

  const keySet = new Set([...recentPlaninc.map(normalizePlanKey), ...tailPlan2009]);
  const rowsByKey = loadDbfRowsForKeySet(deps.styleRoot, "plan2009", "idplan", keySet);
  const serviciosByPlan = await loadPlanartServiciosForKeys(deps.styleRoot, keySet);

  const changed: Array<{ key: string; row: DbfRow | null; fp: string; accion: "UPDATE" | "DELETE" }> = [];
  for (const key of keySet) {
    const normKey = normalizePlanKey(key);
    const row = rowsByKey.get(normKey);
    if (!row) {
      // Solo borrar si teníamos huella (cita existía en Suite). Cola DEL cubre el resto.
      if (known.has(normKey)) {
        changed.push({ key: normKey, row: null, fp: "", accion: "DELETE" });
      }
      continue;
    }
    const serviciosJson = serviciosByPlan.get(normKey) ?? "[]";
    const fp = rowFingerprint(row, serviciosJson);
    if (known.get(normKey) !== fp) {
      changed.push({ key: normKey, row, fp, accion: "UPDATE" });
    }
  }

  if (!changed.length) return;

  sortChangesByPriority(changed, known, recentPlaninc);

  deps.log(`dbf-poll ${TABLA} (ligero): ${changed.length} cambio(s) en ${keySet.size} idplan(s) recientes`);
  for (const item of takePlan2009Batch(changed, batch)) {
    try {
      const serviciosJson = item.accion === "DELETE" ? "[]" : (serviciosByPlan.get(item.key) ?? "[]");
      await applyPlan2009(
        deps,
        item.key,
        item.accion === "DELETE" ? null : item.row,
        item.accion,
        serviciosJson,
      );
      if (item.accion === "DELETE") {
        await deps.supabase
          .schema("dunasoft")
          .from("style_sync_dbf_fingerprint")
          .delete()
          .eq("company_id", deps.companyId)
          .eq("tabla", TABLA)
          .eq("style_key", item.key);
        fingerprintCache = null;
      } else {
        await upsertFingerprints(deps, [{ style_key: item.key, fingerprint: item.fp }]);
      }
    } catch (err) {
      deps.log(
        `dbf-poll ${TABLA} (ligero) idplan=${item.key} error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const planPath = resolveDbfPath(deps.styleRoot, "plan2009");
  if (planPath) {
    try {
      lastLightMtime = fs.statSync(planPath).mtimeMs;
      lastMtime.plan2009 = lastLightMtime;
    } catch {
      /* ignore */
    }
  }
}
