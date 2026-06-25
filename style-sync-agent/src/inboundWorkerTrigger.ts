import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Dispara el worker VFP inbound (headless) en Windows.
 * Task Scheduler no baja de ~60 s; el agente puede lanzarlo en cuanto hay JSON pendiente.
 */
export type InboundWorkerTriggerConfig = {
  styleRoot: string;
  heartbeatPath: string;
  inboundDir: string;
  log: (msg: string) => void;
};

const INBOUND_WORKER_TRIGGER = process.env.INBOUND_WORKER_TRIGGER !== "0";
const INBOUND_WORKER_MIN_INTERVAL_MS = Number(process.env.INBOUND_WORKER_MIN_INTERVAL_MS ?? "8000");
const INBOUND_WORKER_STALE_MS = Number(process.env.INBOUND_WORKER_STALE_MS ?? "15000");

let lastSpawnMs = 0;
let spawnInFlight = false;

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

  const hbAge = heartbeatAgeMs(cfg.heartbeatPath);
  const now = Date.now();
  if (now - lastSpawnMs < INBOUND_WORKER_MIN_INTERVAL_MS) return;
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
    cfg.log(`inbound worker lanzado (${reason}, pending=${pending})`);
  } catch (err) {
    spawnInFlight = false;
    cfg.log(`inbound worker spawn error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
