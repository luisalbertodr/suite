/**
 * One-shot: sincronización hard (cola + outbox + barrido DBF maestros).
 * Pensado para la ventana nocturna tras cerrar Duna2.exe.
 *
 * Uso:
 *   node dist/scripts/run-hard-sync-once.js
 *   (con .env del agente: STYLE_ROOT, COMPANY_ID, SUPABASE_*)
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { isSyncV2Active } from "../controlSync.js";
import {
  drainOutboxAcks,
  pollOutboxToInbound,
  processEntitiesFromStyle,
} from "../entitySync.js";
import { ENTITY_HANDLERS } from "../handlers.js";
import { pollDbfEntityChanges } from "../dbfPoll.js";
import { maybeTriggerInboundWorker } from "../inboundWorkerTrigger.js";
import {
  isStyleProcessRunning,
  logDeferEntityDbfPoll,
  shouldDeferEntityDbfPoll,
} from "../styleSession.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const COLA_DBF = process.env.COLA_DBF ?? path.join(STYLE_ROOT, "cola_sincro.dbf");
const INBOUND_DIR = process.env.INBOUND_DIR ?? path.join(STYLE_ROOT, "sync", "inbound");
const INBOUND_ACK_DIR = process.env.INBOUND_ACK_DIR ?? path.join(STYLE_ROOT, "sync", "inbound_ack");
const HEARTBEAT_PATH = process.env.HEARTBEAT_PATH ?? path.join(STYLE_ROOT, "sync", "heartbeat.txt");
const ENTITY_BATCH = Number(process.env.ENTITY_BATCH ?? "50");
const INBOUND_BATCH = Number(process.env.INBOUND_BATCH ?? "50");
const DBF_ENTITY_POLL_ENABLED =
  process.env.DBF_ENTITY_POLL_ENABLED !== "0" && process.env.DBF_ENTITY_POLL_ENABLED !== "false";

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan env STYLE_ROOT/COMPANY_ID/SUPABASE_*");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

const deps = {
  supabase,
  companyId: COMPANY_ID,
  styleRoot: STYLE_ROOT,
  colaPath: COLA_DBF,
  inboundDir: INBOUND_DIR,
  inboundAckDir: INBOUND_ACK_DIR,
  log,
};

const v2 = await isSyncV2Active(STYLE_ROOT);
if (!v2) {
  log("hard-sync omitido: control_sincro no está en modo v2");
  process.exit(0);
}

if (isStyleProcessRunning()) {
  log("hard-sync omitido: UI Style aún abierta (Duna/Duna2/mscomctl)");
  process.exit(1);
}

log("hard-sync: procesando cola_sincro (entidades)");
await processEntitiesFromStyle(deps, ENTITY_HANDLERS, ENTITY_BATCH);

log("hard-sync: outbox Suite→Style");
const wrote = await pollOutboxToInbound(deps, ENTITY_HANDLERS, INBOUND_BATCH);
if (wrote > 0) {
  maybeTriggerInboundWorker(
    { styleRoot: STYLE_ROOT, heartbeatPath: HEARTBEAT_PATH, inboundDir: INBOUND_DIR, log },
    "hard_sync_nightly",
  );
}
await drainOutboxAcks(deps);

if (shouldDeferEntityDbfPoll(STYLE_ROOT)) {
  logDeferEntityDbfPoll(log, STYLE_ROOT);
  process.exit(1);
}

if (!DBF_ENTITY_POLL_ENABLED) {
  log("hard-sync: DBF_ENTITY_POLL_ENABLED=0 — fin sin barrido DBF");
  process.exit(0);
}

log("hard-sync: barrido DBF maestros (Style cerrado)");
await pollDbfEntityChanges(deps, ENTITY_HANDLERS, ENTITY_BATCH);
log("hard-sync: fin ok");
