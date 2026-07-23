import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { incrementAgentErrors, patchAgentState } from "./agentState.js";
import { isSyncV2Active } from "./controlSync.js";
import { writeDeadLetter } from "./deadLetter.js";
import { dbfDateFromJsDate } from "./dbfSource.js";
import { isRetryableFsError, withFsRetry } from "./fsRetry.js";
import { maybeTriggerInboundWorker } from "./inboundWorkerTrigger.js";
import { writeVfpJsonFile } from "./vfpJsonFile.js";
import { resolveVersion, serviciosJsonToLegacy } from "./servicios.js";
import {
  drainOutboxAcks,
  pollOutboxToInbound,
  processEntitiesFromStyle,
  type EntityEngineDeps,
} from "./entitySync.js";
import { ENTITY_HANDLERS } from "./handlers.js";
import { readColaRows } from "./colaDbf.js";
import { pollDbfEntityChanges } from "./dbfPoll.js";
import { pollPlan2009FromDbf, pollPlan2009Lightweight } from "./plan2009Poll.js";
import { logDeferHeavyPoll, logDeferEntityDbfPoll, shouldDeferEntityDbfPoll, shouldDeferHeavyPoll } from "./styleSession.js";
import { resolveDbfPath } from "./dbfSource.js";
import {
  dbfBool,
  dbfDateIso,
  dbfStr,
  loadDbfRowsForKeySet,
  type DbfRow,
} from "./dbfSource.js";
import {
  normalizePlanKey,
  rowFingerprint,
  upsertFingerprints,
  type PollDeps,
} from "./plan2009Poll.js";
import { startFileWatchers, startRealtimeWatchers } from "./eventWatchers.js";

const require = createRequire(import.meta.url);
const { version: pkgVersion } = require("../package.json") as { version: string };

/**
 * Agente Style ↔ Suite (cola_sincro + inbound JSON/ack).
 *
 * Resiliencia:
 * - Reintentos con backoff en lecturas/escrituras CIFS y cola_sincro.dbf
 * - Archivo de histórico tras ack OK (evita acumular miles de JSON/.ok)
 * - Monitor heartbeat del worker VFP → alerta en Postgres
 */

const STYLE_ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const COLA_DBF = path.join(STYLE_ROOT, "cola_sincro.dbf");
const INBOUND_DIR = process.env.INBOUND_DIR ?? path.join(STYLE_ROOT, "sync", "inbound");
const INBOUND_ACK_DIR = process.env.INBOUND_ACK_DIR ?? path.join(STYLE_ROOT, "sync", "inbound_ack");
const ARCHIVE_DIR = process.env.ARCHIVE_DIR ?? path.join(STYLE_ROOT, "sync", "archive");
const DEADLETTER_DIR = process.env.DEADLETTER_DIR ?? path.join(STYLE_ROOT, "sync", "deadletter");
const HEARTBEAT_PATH = process.env.HEARTBEAT_PATH ?? path.join(STYLE_ROOT, "sync", "heartbeat.txt");

const AGENT_VERSION = process.env.AGENT_VERSION ?? pkgVersion;
const OUTBOUND_MAX_RETRIES = Number(process.env.OUTBOUND_MAX_RETRIES ?? "5");
const INBOUND_ACK_MAX_RETRIES = Number(process.env.INBOUND_ACK_MAX_RETRIES ?? "5");

const SYNC_EVENT_DRIVEN = process.env.SYNC_EVENT_DRIVEN !== "0";
const SYNC_DEBOUNCE_MS = Number(process.env.SYNC_DEBOUNCE_MS ?? "300");
const SYNC_POLL_FALLBACK_MS = Number(process.env.SYNC_POLL_FALLBACK_MS ?? "120000");

const POLL_MS = Number(process.env.POLL_MS ?? "3000");
const INBOUND_POLL_MS = Number(process.env.INBOUND_POLL_MS ?? "3000");
const INBOUND_BATCH = Number(process.env.INBOUND_BATCH ?? "50");
const OUTBOUND_BATCH = Number(process.env.OUTBOUND_BATCH ?? "50");
const HEARTBEAT_CHECK_MS = Number(process.env.HEARTBEAT_CHECK_MS ?? "60000");
const HEARTBEAT_STALE_MS = Number(process.env.HEARTBEAT_STALE_MS ?? "300000");
const LAG_ALERT_MS = Number(process.env.LAG_ALERT_MS ?? "30000");
const ENTITY_BATCH = Number(process.env.ENTITY_BATCH ?? "50");
const ENTITY_POLL_MS = Number(process.env.ENTITY_POLL_MS ?? "5000");
/** Barrido completo de DBFs maestros; omitir si solo se usa cola_sincro (DBF_ENTITY_POLL_ENABLED=0). */
const DBF_ENTITY_POLL_ENABLED =
  process.env.DBF_ENTITY_POLL_ENABLED !== "0" && process.env.DBF_ENTITY_POLL_ENABLED !== "false";
const PLAN2009_POLL_MS = Number(process.env.PLAN2009_POLL_MS ?? "2500");
const PLAN2009_BATCH = Number(process.env.PLAN2009_BATCH ?? "100");
/** Desactivado por defecto: cola_sincro con snapshot completo evita escaneo DBF. Activar solo como red de seguridad. */
const PLAN2009_POLL_ENABLED =
  process.env.PLAN2009_POLL_ENABLED === "1" ||
  process.env.PLAN2009_POLL_ENABLED === "true";

const COLA_DELETE_ACTIONS = new Set(["DEL", "BOR", "BAJA", "BORRAR", "DELETE"]);

function isColaDeleteAction(accion: string): boolean {
  return COLA_DELETE_ACTIONS.has(String(accion ?? "").trim().toUpperCase());
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const companyId = process.env.COMPANY_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const supabase = createClient(supabaseUrl, supabaseKey);

// Campos <=10 chars (tabla FREE legible por dbf-reader: no soporta memo ni nombres largos).
type ColaRow = {
  id: number;
  tabla: string;
  id_reg: string;
  accion: string;
  procesado: boolean;
  codemp?: string;
  codcli?: string;
  fecha?: Date | string | null;
  fechaiso?: string;
  horini?: string;
  horfin?: string;
  texto?: string;
  codrec?: string;
  nomcli?: string;
  tel1cli?: string;
  facturado?: boolean;
  servicios?: string;
  colfon?: number;
  collet?: number;
  modif?: string;
  version?: number;
  creado?: Date | string | null;
};

type InboundQueueRow = {
  id: number;
  operation: "create" | "update" | "delete";
  idplan: number;
  payload: Record<string, unknown>;
  created_at: string;
};

let lastInboundAlertRaised = false;
let cifsMountWarned = false;
const outboundFailCounts = new Map<number, number>();
const inboundAckFailCounts = new Map<number, number>();
const outboundDeadLettered = new Set<number>();
const inboundDeadLettered = new Set<number>();

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function logFsRetry(label: string, attempt: number, err: unknown) {
  const code = (err as NodeJS.ErrnoException)?.code ?? "unknown";
  log(`${label}: reintento ${attempt} (${code})`);
  if (!cifsMountWarned && ["EIO", "ESTALE", "ENOTCONN", "ENOENT"].includes(code)) {
    cifsMountWarned = true;
    log("AVISO: posible microcorte CIFS — el agente reintentará sin reiniciar el contenedor");
  }
}

function ensureDirSync(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function archiveDayDir(): string {
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(ARCHIVE_DIR, day);
  ensureDirSync(dir);
  return dir;
}

function inboundPath(queueId: number) {
  return path.join(INBOUND_DIR, `${queueId}.json`);
}

function inboundAckPath(queueId: number) {
  return path.join(INBOUND_ACK_DIR, `${queueId}.ok`);
}

/** Mueve JSON/.ok procesados a sync/archive/YYYY-MM-DD/ para no saturar ADIR en VFP. */
async function archiveInboundArtifacts(queueId: number): Promise<void> {
  const destDir = archiveDayDir();
  const ts = Date.now();

  const candidates = [
    { src: inboundPath(queueId), ext: "json" },
    { src: inboundAckPath(queueId), ext: "ok" },
  ];

  for (const { src, ext } of candidates) {
    await withFsRetry(
      () => {
        if (!fs.existsSync(src)) return;
        const dest = path.join(destDir, `${queueId}_${ts}.${ext}`);
        try {
          fs.renameSync(src, dest);
        } catch {
          fs.copyFileSync(src, dest);
          fs.unlinkSync(src);
        }
      },
      { label: `archive ${queueId}.${ext}`, onRetry: (a, e) => logFsRetry("archive", a, e) },
    ).catch((err) => {
      log(`archive fallo ${queueId}.${ext}: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
}

async function getLastColaId(): Promise<number> {
  if (!companyId) return 0;
  const { data, error } = await supabase
    .schema("dunasoft")
    .from("style_sync_agent_state")
    .select("last_cola_id")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.last_cola_id ?? 0);
}

async function setLastColaId(lastColaId: number): Promise<void> {
  if (!companyId) return;
  await patchAgentState(supabase, companyId, {
    last_cola_id: lastColaId,
    agent_last_tick_at: new Date().toISOString(),
    agent_version: AGENT_VERSION,
  });
}

function parseHeartbeat(raw: string): { workerVersion: string | null } {
  const line = raw.split(/\r?\n/).find((l) => l.trim())?.trim() ?? "";
  const m = line.match(/worker=([^\s|]+)/i);
  return { workerVersion: m?.[1] ?? null };
}

async function readPendingCola(lastColaId: number): Promise<ColaRow[]> {
  const rows = await readColaRows(COLA_DBF, { sinceId: lastColaId, tabla: "plan2009" });
  return rows as ColaRow[];
}

function colaCreatedMs(row: ColaRow): number | null {
  const raw = row.creado;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "string" && raw.trim()) {
    const t = Date.parse(raw);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function dbfFieldOrCola(dbfVal: string, colaVal: string): string {
  const d = dbfVal.trim();
  if (d) return d;
  return String(colaVal ?? "").trim();
}

function colaHasCompleteSnapshot(row: ColaRow): boolean {
  const accion = String(row.accion ?? "").toUpperCase();
  if (isColaDeleteAction(accion)) return true;
  const fechaIso = String(row.fechaiso ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(fechaIso) && String(row.codemp ?? "").trim() !== "";
}

function colaRowToFingerprintShape(row: ColaRow): DbfRow {
  return {
    codemp: row.codemp,
    codcli: row.codcli,
    fecha: row.fechaiso ?? row.fecha,
    horini: row.horini,
    horfin: row.horfin,
    texto: row.texto,
    codrec: row.codrec,
    nomcli: row.nomcli,
    tel1cli: row.tel1cli,
    facturado: row.facturado,
    colfon: row.colfon,
    collet: row.collet,
  };
}

async function enrichColaRow(row: ColaRow): Promise<{
  row: ColaRow;
  fingerprintRow: DbfRow | null;
  serviciosJson: string;
}> {
  const idReg = String(row.id_reg ?? "").trim();
  const serviciosFromCola = String(row.servicios ?? "").trim() || "[]";

  if (!idReg) {
    return { row, fingerprintRow: null, serviciosJson: "[]" };
  }

  if (colaHasCompleteSnapshot(row)) {
    const fechaIso = String(row.fechaiso ?? "").trim();
    const enriched: ColaRow = {
      ...row,
      fechaiso: fechaIso,
      servicios: serviciosFromCola,
    };
    return {
      row: enriched,
      fingerprintRow: colaRowToFingerprintShape(enriched),
      serviciosJson: serviciosFromCola,
    };
  }

  // Fallback raro: cola sin snapshot (cola antigua). Una sola fila, sin indexar plan2009 entero.
  const normKey = idReg.replace(/^0+/, "") || "0";
  const keySet = new Set([normKey]);
  const rowsByKey = loadDbfRowsForKeySet(STYLE_ROOT, "plan2009", "idplan", keySet);
  const dbfRow = rowsByKey.get(normKey) ?? null;

  const fechaIso = String(row.fechaiso ?? "").trim();
  const fechaFromDbf = dbfRow ? dbfDateIso(dbfRow, "fecha") : null;

  const enriched: ColaRow = {
    ...row,
    codemp: dbfRow ? dbfFieldOrCola(dbfStr(dbfRow, "codemp"), String(row.codemp ?? "")) : row.codemp,
    codcli: dbfRow ? dbfFieldOrCola(dbfStr(dbfRow, "codcli"), String(row.codcli ?? "")) : row.codcli,
    fechaiso: fechaFromDbf ?? (/^\d{4}-\d{2}-\d{2}$/.test(fechaIso) ? fechaIso : ""),
    horini: dbfRow ? dbfFieldOrCola(dbfStr(dbfRow, "horini"), String(row.horini ?? "")) : row.horini,
    horfin: dbfRow ? dbfFieldOrCola(dbfStr(dbfRow, "horfin"), String(row.horfin ?? "")) : row.horfin,
    texto: dbfRow ? dbfFieldOrCola(dbfStr(dbfRow, "texto"), String(row.texto ?? "")) : row.texto,
    codrec: dbfRow ? dbfFieldOrCola(dbfStr(dbfRow, "codrec"), String(row.codrec ?? "")) : row.codrec,
    nomcli: dbfRow ? dbfFieldOrCola(dbfStr(dbfRow, "nomcli"), String(row.nomcli ?? "")) : row.nomcli,
    tel1cli: dbfRow ? dbfFieldOrCola(dbfStr(dbfRow, "tel1cli"), String(row.tel1cli ?? "")) : row.tel1cli,
    facturado: dbfRow ? dbfBool(dbfRow, "facturado") || Boolean(row.facturado) : Boolean(row.facturado),
    servicios: serviciosFromCola,
    colfon: dbfRow
      ? Number(dbfStr(dbfRow, "colfon") || 0) || Number(row.colfon ?? 0)
      : Number(row.colfon ?? 0),
    collet: dbfRow
      ? Number(dbfStr(dbfRow, "collet") || 0) || Number(row.collet ?? 0)
      : Number(row.collet ?? 0),
  };

  return {
    row: enriched,
    fingerprintRow: dbfRow ?? colaRowToFingerprintShape(enriched),
    serviciosJson: serviciosFromCola,
  };
}

async function updatePlan2009FingerprintAfterCola(
  idReg: string,
  fingerprintRow: DbfRow | null,
  serviciosJson: string,
  accion: string,
): Promise<void> {
  if (!companyId) return;
  const deps: PollDeps = { supabase, companyId, styleRoot: STYLE_ROOT, log };
  const key = normalizePlanKey(idReg);
  if (isColaDeleteAction(accion)) {
    await supabase
      .schema("dunasoft")
      .from("style_sync_dbf_fingerprint")
      .delete()
      .eq("company_id", companyId)
      .eq("tabla", "plan2009")
      .eq("style_key", key);
    return;
  }
  if (!fingerprintRow) return;
  const fp = rowFingerprint(fingerprintRow, serviciosJson || "[]");
  await upsertFingerprints(deps, [{ style_key: key, fingerprint: fp }]);
}

async function processRow(row: ColaRow): Promise<void> {
  const { row: enriched, fingerprintRow, serviciosJson } = await enrichColaRow(row);
  log(`procesar plan2009 id=${enriched.id_reg} accion=${enriched.accion}`);
  if (!companyId) throw new Error("Falta COMPANY_ID");

  const accion = String(enriched.accion ?? "").toUpperCase();
  const rpcAccion = isColaDeleteAction(accion) ? "DELETE" : "UPDATE";
  const fechaIso = String(enriched.fechaiso ?? "").trim();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaIso)
    ? fechaIso
    : enriched.fecha instanceof Date
      ? dbfDateFromJsDate(enriched.fecha)
      : typeof enriched.fecha === "string"
        ? enriched.fecha.slice(0, 10)
        : null;

  const { error } = await supabase.rpc("style_reservas_apply_from_style", {
    p_company_id: companyId,
    p_accion: rpcAccion,
    p_idplan: Number(enriched.id_reg),
    p_codemp: enriched.codemp ?? "",
    p_codcli: enriched.codcli ?? "",
    p_fecha: fecha,
    p_horini: enriched.horini ?? "",
    p_horfin: enriched.horfin ?? "",
    p_texto: enriched.texto ?? "",
    p_codrec: enriched.codrec ?? "",
    p_nomcli: enriched.nomcli ?? "",
    p_tel1cli: enriched.tel1cli ?? "",
    p_facturado: Boolean(enriched.facturado),
    p_servicios: serviciosJsonToLegacy(enriched.servicios),
    p_colfon: Number(enriched.colfon ?? 0),
    p_collet: Number(enriched.collet ?? 0),
    p_style_modified_at: enriched.modif ?? (enriched.version ? String(enriched.version) : null),
  });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  await updatePlan2009FingerprintAfterCola(
    String(enriched.id_reg),
    fingerprintRow,
    serviciosJson,
    accion,
  );
  if (companyId) {
    const createdMs = colaCreatedMs(row);
    const lagMs = createdMs != null ? Math.max(0, Date.now() - createdMs) : undefined;
    await patchAgentState(supabase, companyId, {
      last_outbound_ok_at: new Date().toISOString(),
      last_outbound_lag_ms: lagMs,
      agent_version: AGENT_VERSION,
      last_error: null,
      last_error_at: null,
    });
    if (lagMs != null && lagMs > LAG_ALERT_MS) {
      log(`AVISO: outbound lag ${lagMs}ms > ${LAG_ALERT_MS}ms (cola_id=${row.id})`);
    }
  }
}

function toVfpPullShape(row: InboundQueueRow): Record<string, unknown> {
  const p = row.payload ?? {};
  const isDelete = row.operation === "delete";
  const version = resolveVersion({
    version: p["version"] as number | string | undefined,
    style_modified_at: p["style_modified_at"] as string | undefined,
    modificado: String(p["suite_updated_at"] ?? row.created_at ?? ""),
  });
  return {
    idplan: row.idplan,
    idand: row.id,
    macand: String(p["macand"] ?? "SUITE-STYLE"),
    codemp: String(p["codemp"] ?? ""),
    codcli: String(p["codcli"] ?? ""),
    fecha: String(p["fecha"] ?? ""),
    horini: String(p["horini"] ?? ""),
    horfin: String(p["horfin"] ?? ""),
    texto: String(p["texto"] ?? ""),
    codrec: String(p["codrec"] ?? ""),
    nomcli: String(p["nomcli"] ?? ""),
    tel1cli: String(p["tel1cli"] ?? ""),
    facturado: String(p["facturado"] ?? "NO"),
    servicios: String(p["servicios"] ?? ""),
    pendiente: "NO",
    eliminar: isDelete ? "SI" : "NO",
    collet: String(p["collet"] ?? "0"),
    colfon: String(p["colfon"] ?? "0"),
    version,
    modificado: String(version > 0 ? version : (p["suite_updated_at"] ?? row.created_at ?? "")),
    queue_id: row.id,
    operation: row.operation,
    created_at: row.created_at,
  };
}

async function pollInboundToJson(): Promise<void> {
  if (!companyId) return;
  const v2 = await isSyncV2Active(STYLE_ROOT);
  if (!v2) {
    log("modo_activo != 2 — inbound omitido (kill switch v1)");
    return;
  }
  await withFsRetry(
    () => {
      ensureDirSync(INBOUND_DIR);
      ensureDirSync(INBOUND_ACK_DIR);
    },
    { label: "ensure inbound dirs", onRetry: (a, e) => logFsRetry("inbound_mkdir", a, e) },
  );

  const { data, error } = await supabase
    .schema("dunasoft")
    .from("style_reservas_queue")
    .select("id,operation,idplan,payload,created_at")
    .eq("company_id", companyId)
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(INBOUND_BATCH);
  if (error) throw error;
  const rows = (data ?? []) as InboundQueueRow[];

  let wrote = 0;
  for (const row of rows) {
    const out = inboundPath(row.id);
    const exists = await withFsRetry(() => fs.existsSync(out), {
      label: `exists ${out}`,
      onRetry: (a, e) => logFsRetry("inbound_exists", a, e),
    }).catch(() => false);
    if (exists) continue;

    await withFsRetry(
      () => {
        writeVfpJsonFile(out, toVfpPullShape(row));
      },
      { label: `write ${out}`, onRetry: (a, e) => logFsRetry("inbound_write", a, e) },
    );
    log(`inbound -> ${out}`);
    wrote++;
  }
  if (wrote > 0) {
    maybeTriggerInboundWorker(
      { styleRoot: STYLE_ROOT, heartbeatPath: HEARTBEAT_PATH, inboundDir: INBOUND_DIR, log },
      "json_written",
    );
  }
}

function countPendingInboundJson(): number {
  if (!fs.existsSync(INBOUND_DIR)) return 0;
  return fs.readdirSync(INBOUND_DIR).filter((f) => f.toLowerCase().endsWith(".json")).length;
}

function parseAckFile(raw: string): { idand: number; idplan: number; macand: string; ok: boolean } {
  const parts = new Map<string, string>();
  for (const chunk of raw.split(/[;\r\n]+/)) {
    const [k, ...rest] = chunk.split("=");
    if (!k || rest.length === 0) continue;
    parts.set(k.trim().toLowerCase(), rest.join("=").trim());
  }
  return {
    idand: Number(parts.get("idand") ?? 0),
    idplan: Number(parts.get("idplan") ?? 0),
    macand: String(parts.get("macand") ?? "SUITE-STYLE"),
    ok: (parts.get("ok") ?? "1") !== "0",
  };
}

async function drainInboundAcks(): Promise<void> {
  if (!companyId) return;

  const files = await withFsRetry(
    () => fs.readdirSync(INBOUND_ACK_DIR).filter((f) => f.toLowerCase().endsWith(".ok")),
    { label: "readdir inbound_ack", onRetry: (a, e) => logFsRetry("ack_readdir", a, e) },
  ).catch((err) => {
    if (isRetryableFsError(err)) {
      log(`ack_readdir omitido (CIFS): ${err instanceof Error ? err.message : String(err)}`);
      return [] as string[];
    }
    throw err;
  });

  for (const f of files) {
    const base = path.basename(f, ".ok");
    const queueId = Number(base);
    if (!Number.isFinite(queueId) || queueId <= 0) continue;

    const okPath = inboundAckPath(queueId);
    let raw: string;
    try {
      raw = await withFsRetry(() => fs.readFileSync(okPath, "utf8").trim(), {
        label: `read ${okPath}`,
        onRetry: (a, e) => logFsRetry("ack_read", a, e),
      });
    } catch (err) {
      log(`ack read error queue_id=${queueId}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const { idand: ackIdand, idplan, macand, ok } = parseAckFile(raw);
    const idand = ackIdand > 0 ? ackIdand : queueId;
    const jsonPath = inboundPath(queueId);
    let inboundPayload: unknown = { queue_id: queueId, ack: raw };
    if (fs.existsSync(jsonPath)) {
      try {
        inboundPayload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      } catch {
        /* keep ack-only payload */
      }
    }

    if (!ok) {
      const errMsg = `Worker VFP rechazó queue_id=${queueId}`;
      if (companyId) await incrementAgentErrors(supabase, companyId, "inbound_errors", errMsg);
      const fails = (inboundAckFailCounts.get(queueId) ?? 0) + 1;
      inboundAckFailCounts.set(queueId, fails);
      if (fails >= INBOUND_ACK_MAX_RETRIES && !inboundDeadLettered.has(queueId)) {
        inboundDeadLettered.add(queueId);
        const dl = await writeDeadLetter(DEADLETTER_DIR, "inbound", queueId, inboundPayload, errMsg);
        log(`DEAD LETTER inbound queue_id=${queueId} -> ${dl}`);
      }
      continue;
    }

    const { error } = await supabase.rpc("style_reservas_ack", {
      p_company_id: companyId,
      p_idand: idand,
      p_idplan: idplan,
      p_macand: macand,
      p_ok: ok,
    });
    if (error) {
      log(`ack RPC error queue_id=${queueId}: ${error.message}`);
      if (companyId) await incrementAgentErrors(supabase, companyId, "inbound_errors", error.message);
      const fails = (inboundAckFailCounts.get(queueId) ?? 0) + 1;
      inboundAckFailCounts.set(queueId, fails);
      if (fails >= INBOUND_ACK_MAX_RETRIES && !inboundDeadLettered.has(queueId)) {
        inboundDeadLettered.add(queueId);
        const dl = await writeDeadLetter(DEADLETTER_DIR, "inbound", queueId, inboundPayload, error);
        log(`DEAD LETTER inbound queue_id=${queueId} -> ${dl}`);
      }
      continue;
    }

    inboundAckFailCounts.delete(queueId);
    await archiveInboundArtifacts(queueId);
    if (companyId) {
      let lagMs: number | undefined;
      if (inboundPayload && typeof inboundPayload === "object" && inboundPayload !== null) {
        const createdAt = String((inboundPayload as Record<string, unknown>)["created_at"] ?? "");
        const t = Date.parse(createdAt);
        if (Number.isFinite(t)) lagMs = Math.max(0, Date.now() - t);
      }
      await patchAgentState(supabase, companyId, {
        last_inbound_ok_at: new Date().toISOString(),
        last_inbound_lag_ms: lagMs,
        agent_version: AGENT_VERSION,
        last_error: null,
        last_error_at: null,
      });
      if (lagMs != null && lagMs > LAG_ALERT_MS) {
        log(`AVISO: inbound lag ${lagMs}ms > ${LAG_ALERT_MS}ms (queue_id=${queueId})`);
      }
    }
    log(`ack -> queue_id=${queueId} ok=${ok} (archivado)`);
  }
}

/** JSON huérfanos muy antiguos → archive/failed (worker caído o JSON corrupto). */
async function purgeStaleInboundJson(): Promise<void> {
  const maxAgeMs = Number(process.env.STALE_INBOUND_MS ?? String(24 * 60 * 60 * 1000));
  const failedDir = path.join(ARCHIVE_DIR, "failed");
  ensureDirSync(failedDir);

  const files = await withFsRetry(
    () => fs.readdirSync(INBOUND_DIR).filter((f) => f.toLowerCase().endsWith(".json")),
    { label: "readdir inbound stale" },
  ).catch(() => [] as string[]);

  const now = Date.now();
  for (const f of files) {
    const full = path.join(INBOUND_DIR, f);
    try {
      const st = fs.statSync(full);
      if (now - st.mtimeMs < maxAgeMs) continue;
      const dest = path.join(failedDir, `${path.basename(f, ".json")}_${now}.json`);
      fs.renameSync(full, dest);
      log(`stale inbound archivado: ${f}`);
    } catch {
      /* ignore per-file */
    }
  }
}

async function checkInboundWorkerHeartbeat(): Promise<void> {
  if (!companyId) return;

  let mtimeMs = 0;
  let seen = false;
  let workerVersion: string | null = null;
  try {
    await withFsRetry(
      () => {
        if (!fs.existsSync(HEARTBEAT_PATH)) return;
        mtimeMs = fs.statSync(HEARTBEAT_PATH).mtimeMs;
        seen = true;
        workerVersion = parseHeartbeat(fs.readFileSync(HEARTBEAT_PATH, "utf8")).workerVersion;
      },
      { label: "heartbeat stat", onRetry: (a, e) => logFsRetry("heartbeat", a, e) },
    );
  } catch (err) {
    log(`heartbeat check error: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const ageMs = seen ? Date.now() - mtimeMs : Number.POSITIVE_INFINITY;
  const stale = !seen || ageMs > HEARTBEAT_STALE_MS;
  const pendingInbound = countPendingInboundJson();

  if (SYNC_EVENT_DRIVEN && pendingInbound === 0 && stale) {
    lastInboundAlertRaised = false;
    await patchAgentState(supabase, companyId, {
      inbound_worker_status: "idle",
      inbound_worker_last_seen_at: seen ? new Date(mtimeMs).toISOString() : null,
      inbound_worker_alert_at: null,
      inbound_worker_alert_message: null,
      worker_version: workerVersion,
      agent_version: AGENT_VERSION,
    });
    return;
  }

  if (stale) {
    const msg = seen
      ? `Sincronización Inbound Detenida (heartbeat hace ${Math.round(ageMs / 1000)}s)`
      : "Sincronización Inbound Detenida (sin heartbeat.txt — worker VFP no corre)";
    if (!lastInboundAlertRaised) {
      log(`ALERTA: ${msg}`);
    }
    lastInboundAlertRaised = true;
    await patchAgentState(supabase, companyId, {
      inbound_worker_status: "stopped",
      inbound_worker_last_seen_at: seen ? new Date(mtimeMs).toISOString() : null,
      inbound_worker_alert_at: new Date().toISOString(),
      inbound_worker_alert_message: msg,
      worker_version: workerVersion,
      agent_version: AGENT_VERSION,
    });
    return;
  }

  if (lastInboundAlertRaised) {
    log("heartbeat OK — worker inbound recuperado");
  }
  lastInboundAlertRaised = false;
  await patchAgentState(supabase, companyId, {
    inbound_worker_status: "ok",
    inbound_worker_last_seen_at: new Date(mtimeMs).toISOString(),
    inbound_worker_alert_at: null,
    inbound_worker_alert_message: null,
    worker_version: workerVersion,
    agent_version: AGENT_VERSION,
  });
}

async function plan2009PollTick(): Promise<void> {
  if (!companyId) return;
  if (shouldDeferHeavyPoll(STYLE_ROOT)) {
    logDeferHeavyPoll(log, STYLE_ROOT);
    try {
      await pollPlan2009Lightweight(
        { supabase, companyId, styleRoot: STYLE_ROOT, log },
        PLAN2009_BATCH,
      );
    } catch (err) {
      if (isRetryableFsError(err)) {
        log(`plan2009 poll ligero omitido (CIFS/DBF): ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      throw err;
    }
    return;
  }
  try {
    await pollPlan2009FromDbf(
      { supabase, companyId, styleRoot: STYLE_ROOT, log },
      PLAN2009_BATCH,
    );
  } catch (err) {
    if (isRetryableFsError(err)) {
      log(`plan2009 poll omitido (CIFS/DBF): ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    throw err;
  }
}

async function tick(): Promise<void> {
  try {
    const v2 = await isSyncV2Active(STYLE_ROOT);
    if (!v2) {
      log("modo_activo != 2 — outbound omitido (kill switch v1)");
      return;
    }
    const lastColaId = await getLastColaId();
    const rows = (await readPendingCola(lastColaId)).slice(0, OUTBOUND_BATCH);
    let maxId = lastColaId;
    for (const row of rows) {
      const colaId = Number(row.id);
      if (outboundDeadLettered.has(colaId)) continue;
      try {
        await processRow(row);
        outboundFailCounts.delete(colaId);
        maxId = Math.max(maxId, colaId);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`error fila ${colaId}: ${errMsg}`);
        if (companyId) await incrementAgentErrors(supabase, companyId, "outbound_errors", errMsg);
        const fails = (outboundFailCounts.get(colaId) ?? 0) + 1;
        outboundFailCounts.set(colaId, fails);
        if (fails >= OUTBOUND_MAX_RETRIES && !outboundDeadLettered.has(colaId)) {
          outboundDeadLettered.add(colaId);
          const dl = await writeDeadLetter(DEADLETTER_DIR, "outbound", colaId, row, err);
          log(`DEAD LETTER outbound cola_id=${colaId} -> ${dl} (last_cola_id NO avanza)`);
        }
      }
    }
    if (maxId !== lastColaId) {
      await setLastColaId(maxId);
    } else if (companyId) {
      await patchAgentState(supabase, companyId, {
        agent_last_tick_at: new Date().toISOString(),
        agent_version: AGENT_VERSION,
      });
    }
  } catch (err) {
    if (isRetryableFsError(err)) {
      log(`tick omitido (CIFS/DBF): ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    throw err;
  }
}

function entityDeps(): EntityEngineDeps | null {
  if (!companyId) return null;
  return {
    supabase,
    companyId,
    styleRoot: STYLE_ROOT,
    colaPath: COLA_DBF,
    inboundDir: INBOUND_DIR,
    inboundAckDir: INBOUND_ACK_DIR,
    log,
  };
}

/** Style → Suite para maestros y transacciones (clientes, artículos, ...). */
async function entityTick(): Promise<void> {
  const deps = entityDeps();
  if (!deps || ENTITY_HANDLERS.length === 0) return;
  const v2 = await isSyncV2Active(STYLE_ROOT);
  if (!v2) return;
  // Cola ligera (solo filas nuevas en cola_sincro) — no lee DBF entero.
  await processEntitiesFromStyle(deps, ENTITY_HANDLERS, ENTITY_BATCH);
  if (shouldDeferEntityDbfPoll(STYLE_ROOT)) {
    logDeferEntityDbfPoll(log, STYLE_ROOT);
    return;
  }
  if (!DBF_ENTITY_POLL_ENABLED) return;
  log("dbf-poll tick: barrido maestros (Style cerrado)");
  await pollDbfEntityChanges(deps, ENTITY_HANDLERS, ENTITY_BATCH);
}

/** Suite → Style genérico: outbox → JSON inbound + drenaje de ACKs `e<id>.ok`. */
async function entityOutboundTick(): Promise<void> {
  const deps = entityDeps();
  if (!deps || ENTITY_HANDLERS.length === 0) return;
  const v2 = await isSyncV2Active(STYLE_ROOT);
  if (!v2) return;
  await withFsRetry(
    () => {
      ensureDirSync(INBOUND_DIR);
      ensureDirSync(INBOUND_ACK_DIR);
    },
    { label: "ensure entity dirs" },
  );
  const wrote = await pollOutboxToInbound(deps, ENTITY_HANDLERS, INBOUND_BATCH);
  if (wrote > 0) {
    maybeTriggerInboundWorker(
      { styleRoot: STYLE_ROOT, heartbeatPath: HEARTBEAT_PATH, inboundDir: INBOUND_DIR, log },
      "json_written",
    );
  }
  await drainOutboxAcks(deps);
}

function runSafe(label: string, fn: () => Promise<void>): void {
  void fn().catch((e) => log(`${label} error: ${e instanceof Error ? e.message : String(e)}`));
}

async function onColaChanged(): Promise<void> {
  let lastColaId = 0;
  let hasEntityRows = false;
  try {
    lastColaId = await getLastColaId();
    const entityTablas = new Set(ENTITY_HANDLERS.map((h) => h.tabla.toLowerCase()));
    const pending = await readColaRows(COLA_DBF, { sinceId: lastColaId });
    hasEntityRows = pending.some((r) => entityTablas.has(String(r.tabla ?? "").trim().toLowerCase()));
  } catch (err) {
    if (!isRetryableFsError(err)) {
      log(`cola pre-check error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await tick();
  if (PLAN2009_POLL_ENABLED) {
    try {
      await plan2009PollTick();
    } catch (err) {
      log(`plan2009 poll (cola) error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // Movimientos de agenda (plan2009) no deben disparar escaneo de clientes/faccab/… por CIFS.
  if (hasEntityRows) runSafe("entity", entityTick);
}

async function onInboundDirChanged(): Promise<void> {
  const pending = countPendingInboundJson();
  if (pending > 0) {
    maybeTriggerInboundWorker(
      { styleRoot: STYLE_ROOT, heartbeatPath: HEARTBEAT_PATH, inboundDir: INBOUND_DIR, log },
      "json_detected",
    );
  }
}

async function onAckDirChanged(): Promise<void> {
  await drainInboundAcks();
  const deps = entityDeps();
  if (deps) await drainOutboxAcks(deps);
}

async function runFallbackSync(): Promise<void> {
  await tick();
  await pollInboundToJson();
  await drainInboundAcks();
  await entityOutboundTick();
  await entityTick();
  if (PLAN2009_POLL_ENABLED) await plan2009PollTick();
}

async function main() {
  const mode = SYNC_EVENT_DRIVEN ? "event-driven" : `poll outbound=${POLL_MS}ms inbound=${INBOUND_POLL_MS}ms`;
  log(`Style sync agent v${AGENT_VERSION} — root=${STYLE_ROOT} modo=${mode}`);
  const planPath = resolveDbfPath(STYLE_ROOT, "plan2009");
  const colaOk = fs.existsSync(COLA_DBF);
  if (!planPath || !colaOk) {
    const msg = `CRÍTICO: sin acceso a DBFs de Style (plan2009=${planPath ?? "missing"}, cola=${colaOk ? "ok" : COLA_DBF}). Montar CIFS o ejecutar agente en la VM Style.`;
    log(msg);
    if (companyId) {
      await patchAgentState(supabase, companyId, {
        last_error: msg,
        last_error_at: new Date().toISOString(),
        agent_version: AGENT_VERSION,
      });
    }
  }
  log(`Entidades activas: ${ENTITY_HANDLERS.map((h) => h.tabla).join(", ") || "(ninguna)"}`);
  log(`Inbound: ${INBOUND_DIR} | ack: ${INBOUND_ACK_DIR} | archive: ${ARCHIVE_DIR}`);
  log(`Dead-letter: ${DEADLETTER_DIR} | heartbeat: ${HEARTBEAT_PATH}`);

  ensureDirSync(INBOUND_DIR);
  ensureDirSync(INBOUND_ACK_DIR);

  if (SYNC_EVENT_DRIVEN) {
    log(`Watchers: debounce=${SYNC_DEBOUNCE_MS}ms fallback=${SYNC_POLL_FALLBACK_MS}ms plan2009_poll=${PLAN2009_POLL_ENABLED}`);
    startFileWatchers({
      colaPath: COLA_DBF,
      inboundDir: INBOUND_DIR,
      ackDir: INBOUND_ACK_DIR,
      debounceMs: SYNC_DEBOUNCE_MS,
      onColaChange: () => runSafe("cola", onColaChanged),
      onInboundDirChange: () => runSafe("inbound_dir", onInboundDirChanged),
      onAckDirChange: () => runSafe("ack", onAckDirChanged),
      log,
    });
    if (companyId) {
      startRealtimeWatchers({
        supabase,
        companyId,
        debounceMs: SYNC_DEBOUNCE_MS,
        onReservasInsert: () => runSafe("realtime_reservas", pollInboundToJson),
        onOutboxInsert: () => runSafe("realtime_outbox", entityOutboundTick),
        log,
      });
    }
    if (SYNC_POLL_FALLBACK_MS > 0) {
      setInterval(() => runSafe("fallback", runFallbackSync), SYNC_POLL_FALLBACK_MS);
    }
    setInterval(() => runSafe("entity", entityTick), ENTITY_POLL_MS);
    if (PLAN2009_POLL_ENABLED) {
      setInterval(() => runSafe("plan2009", plan2009PollTick), PLAN2009_POLL_MS);
    }
  } else {
    setInterval(() => runSafe("tick", tick), POLL_MS);
    setInterval(() => runSafe("inbound", pollInboundToJson), INBOUND_POLL_MS);
    setInterval(() => runSafe("ack", drainInboundAcks), INBOUND_POLL_MS);
    setInterval(() => runSafe("entity", entityTick), ENTITY_POLL_MS);
    setInterval(() => runSafe("entity_outbound", entityOutboundTick), ENTITY_POLL_MS);
    if (PLAN2009_POLL_ENABLED) {
      setInterval(() => runSafe("plan2009", plan2009PollTick), PLAN2009_POLL_MS);
    }
  }

  setInterval(() => runSafe("heartbeat", checkInboundWorkerHeartbeat), HEARTBEAT_CHECK_MS);
  setInterval(() => runSafe("stale_purge", purgeStaleInboundJson), 60 * 60 * 1000);

  await onColaChanged();
  await pollInboundToJson();
  await onAckDirChanged();
  if (PLAN2009_POLL_ENABLED) await plan2009PollTick();
  await checkInboundWorkerHeartbeat();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
