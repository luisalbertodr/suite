import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Dbf } from "dbf-reader";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { incrementAgentErrors, patchAgentState } from "./agentState.js";
import { isSyncV2Active } from "./controlSync.js";
import { writeDeadLetter } from "./deadLetter.js";
import { isRetryableFsError, withFsRetry } from "./fsRetry.js";
import { resolveVersion, serviciosJsonToLegacy } from "./servicios.js";

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

const POLL_MS = Number(process.env.POLL_MS ?? "1500");
const INBOUND_POLL_MS = Number(process.env.INBOUND_POLL_MS ?? "3000");
const INBOUND_BATCH = Number(process.env.INBOUND_BATCH ?? "50");
const HEARTBEAT_CHECK_MS = Number(process.env.HEARTBEAT_CHECK_MS ?? "60000");
const HEARTBEAT_STALE_MS = Number(process.env.HEARTBEAT_STALE_MS ?? "300000");
const LAG_ALERT_MS = Number(process.env.LAG_ALERT_MS ?? "30000");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const companyId = process.env.COMPANY_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type ColaRow = {
  id: number;
  tabla_afectada: string;
  id_registro: string;
  accion: string;
  procesado: boolean;
  codemp?: string;
  codcli?: string;
  fecha?: Date | string | null;
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
  style_modified_at?: string;
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
  return withFsRetry(
    () => {
      if (!fs.existsSync(COLA_DBF)) return [];
      const buf = fs.readFileSync(COLA_DBF);
      const dt = Dbf.read(buf as unknown as Buffer);
      return (dt.rows as unknown as ColaRow[])
        .filter((r) => r && Number(r.id) > lastColaId)
        .filter((r) => String(r.tabla_afectada ?? "").toLowerCase() === "plan2009")
        .sort((a, b) => Number(a.id) - Number(b.id));
    },
    {
      label: "read cola_sincro.dbf",
      onRetry: (a, e) => logFsRetry("cola_dbf", a, e),
    },
  );
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

async function processRow(row: ColaRow): Promise<void> {
  log(`procesar plan2009 id=${row.id_registro} accion=${row.accion}`);
  if (!companyId) throw new Error("Falta COMPANY_ID");

  const accion = String(row.accion ?? "").toUpperCase();
  const rpcAccion = accion === "DEL" ? "DELETE" : "UPDATE";
  const fecha =
    row.fecha instanceof Date
      ? row.fecha.toISOString().slice(0, 10)
      : typeof row.fecha === "string"
        ? row.fecha.slice(0, 10)
        : null;

  const { error } = await supabase.rpc("style_reservas_apply_from_style", {
    p_company_id: companyId,
    p_accion: rpcAccion,
    p_idplan: Number(row.id_registro),
    p_codemp: row.codemp ?? "",
    p_codcli: row.codcli ?? "",
    p_fecha: fecha,
    p_horini: row.horini ?? "",
    p_horfin: row.horfin ?? "",
    p_texto: row.texto ?? "",
    p_codrec: row.codrec ?? "",
    p_nomcli: row.nomcli ?? "",
    p_tel1cli: row.tel1cli ?? "",
    p_facturado: Boolean(row.facturado),
    p_servicios: serviciosJsonToLegacy(row.servicios),
    p_colfon: Number(row.colfon ?? 0),
    p_collet: Number(row.collet ?? 0),
    p_style_modified_at: row.style_modified_at ?? (row.version ? String(row.version) : null),
  });
  if (error) throw error;
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
    idand: Number(p["idand"] ?? 0),
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

  for (const row of rows) {
    const out = inboundPath(row.id);
    const exists = await withFsRetry(() => fs.existsSync(out), {
      label: `exists ${out}`,
      onRetry: (a, e) => logFsRetry("inbound_exists", a, e),
    }).catch(() => false);
    if (exists) continue;

    await withFsRetry(
      () => {
        fs.writeFileSync(out, JSON.stringify(toVfpPullShape(row), null, 2), "utf8");
      },
      { label: `write ${out}`, onRetry: (a, e) => logFsRetry("inbound_write", a, e) },
    );
    log(`inbound -> ${out}`);
  }
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

    const { idand, idplan, macand, ok } = parseAckFile(raw);
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

async function tick(): Promise<void> {
  try {
    const v2 = await isSyncV2Active(STYLE_ROOT);
    if (!v2) {
      log("modo_activo != 2 — outbound omitido (kill switch v1)");
      return;
    }
    const lastColaId = await getLastColaId();
    const rows = await readPendingCola(lastColaId);
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

async function main() {
  log(`Style sync agent v${AGENT_VERSION} — root=${STYLE_ROOT} poll=${POLL_MS}ms`);
  log(`Inbound: ${INBOUND_DIR} | ack: ${INBOUND_ACK_DIR} | archive: ${ARCHIVE_DIR}`);
  log(`Dead-letter: ${DEADLETTER_DIR} | heartbeat: ${HEARTBEAT_PATH}`);

  setInterval(() => {
    void tick().catch((e) => log(`tick error: ${e instanceof Error ? e.message : String(e)}`));
  }, POLL_MS);

  setInterval(() => {
    void pollInboundToJson().catch((e) => log(`inbound poll error: ${e instanceof Error ? e.message : String(e)}`));
  }, INBOUND_POLL_MS);

  setInterval(() => {
    void drainInboundAcks().catch((e) => log(`ack drain error: ${e instanceof Error ? e.message : String(e)}`));
  }, INBOUND_POLL_MS);

  setInterval(() => {
    void checkInboundWorkerHeartbeat().catch((e) =>
      log(`heartbeat error: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, HEARTBEAT_CHECK_MS);

  setInterval(() => {
    void purgeStaleInboundJson().catch((e) =>
      log(`stale purge error: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, 60 * 60 * 1000);

  await tick();
  await checkInboundWorkerHeartbeat();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
