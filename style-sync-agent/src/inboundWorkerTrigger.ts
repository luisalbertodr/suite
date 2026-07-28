import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { shouldThrottleInboundWorker } from "./styleSession.js";

/**
 * Dispara el worker VFP inbound (headless) en Windows.
 * Task Scheduler no baja de ~60 s; el agente puede lanzarlo en cuanto hay JSON pendiente.
 *
 * Con la UI de Style abierta se espacia el spawn: RLOCK en plan2009/planart
 * compite con la agenda y provoca pausas.
 */
export type InboundWorkerTriggerConfig = {
  styleRoot: string;
  heartbeatPath: string;
  inboundDir: string;
  log: (msg: string) => void;
};

const INBOUND_WORKER_TRIGGER = process.env.INBOUND_WORKER_TRIGGER !== "0";
const INBOUND_WORKER_MIN_INTERVAL_MS = Number(process.env.INBOUND_WORKER_MIN_INTERVAL_MS ?? "8000");
/** Mientras Duna/agenda está activa: menos spawns (default 60s). */
const INBOUND_WORKER_MIN_INTERVAL_WHILE_STYLE_MS = Number(
  process.env.INBOUND_WORKER_MIN_INTERVAL_WHILE_STYLE_MS ?? "60000",
);
const INBOUND_WORKER_STALE_MS = Number(process.env.INBOUND_WORKER_STALE_MS ?? "15000");
/** 0 = no lanzar worker mientras UI Style abierta (solo Task Scheduler / cierre). */
const INBOUND_WORKER_DEFER_WHILE_STYLE =
  process.env.INBOUND_WORKER_DEFER_WHILE_STYLE === "1" ||
  process.env.INBOUND_WORKER_DEFER_WHILE_STYLE === "true";

let lastSpawnMs = 0;
let spawnInFlight = false;
let lastThrottleLogAt = 0;

function workerVbsPath(styleRoot: string): string {
  const custom = process.env.INBOUND_WORKER_VBS?.trim();
  if (custom) return custom;
  return path.join(styleRoot, "run_inbound_worker_hidden.vbs");
}

function countPendingJson(inboundDir: string): number {
  if (!fs.existsSync(inboundDir)) return 0;
  return fs.readdirSync(inboundDir).filter((f) => f.toLowerCase().endsWith(".json")).length;
}

function heartbeatAgeMs(heartbeatPath: string): number | null {
  if (!fs.existsSync(heartbeatPath)) return null;
  try {
    return Date.now() - fs.statSync(heartbeatPath).mtimeMs;
  } catch {
    return null;
  }
}

export function maybeTriggerInboundWorker(cfg: InboundWorkerTriggerConfig, reason: string): void {
  if (!INBOUND_WORKER_TRIGGER) return;
  if (process.platform !== "win32") return;

  const pending = countPendingJson(cfg.inboundDir);
  if (pending <= 0) return;

  const styleBusy = shouldThrottleInboundWorker(cfg.styleRoot);
  if (styleBusy && INBOUND_WORKER_DEFER_WHILE_STYLE) {
    const now = Date.now();
    if (now - lastThrottleLogAt >= 60_000) {
      lastThrottleLogAt = now;
      cfg.log(
        `inbound worker diferido (UI Style/agenda activa, pending=${pending}) — reintento al liberar`,
      );
    }
    return;
  }

  const minInterval = styleBusy
    ? Math.max(INBOUND_WORKER_MIN_INTERVAL_MS, INBOUND_WORKER_MIN_INTERVAL_WHILE_STYLE_MS)
    : INBOUND_WORKER_MIN_INTERVAL_MS;

  const hbAge = heartbeatAgeMs(cfg.heartbeatPath);
  const now = Date.now();
  if (now - lastSpawnMs < minInterval) return;
  if (spawnInFlight) return;
  // Si el worker acaba de latir, no relanzar salvo JSON nuevos explícitos.
  if (reason !== "json_written" && hbAge != null && hbAge < INBOUND_WORKER_STALE_MS) return;

  const vbs = workerVbsPath(cfg.styleRoot);
  if (!fs.existsSync(vbs)) {
    cfg.log(`inbound worker omitido: no existe ${vbs}`);
    return;
  }

  lastSpawnMs = now;
  spawnInFlight = true;
  try {
    const child = spawn("wscript.exe", [vbs], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    child.on("exit", () => {
      spawnInFlight = false;
    });
    setTimeout(() => {
      spawnInFlight = false;
    }, 120_000);
    const throttleNote = styleBusy ? `, throttled=${minInterval}ms` : "";
    cfg.log(`inbound worker lanzado (${reason}, pending=${pending}${throttleNote})`);
  } catch (err) {
    spawnInFlight = false;
    cfg.log(`inbound worker spawn error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
