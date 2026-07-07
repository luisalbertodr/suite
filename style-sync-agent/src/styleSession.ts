import { execSync } from "node:child_process";
import fs from "node:fs";
import { resolveDbfPath } from "./dbfSource.js";

const STYLE_PROCESS_NAMES = (process.env.STYLE_PROCESS_NAMES ?? "duna.exe,style.exe")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Tras cerrar Style, esperar antes del poll completo (ms). */
const STYLE_DEFER_AFTER_WRITE_MS = Number(process.env.STYLE_DEFER_AFTER_WRITE_MS ?? "90000");

let lastDeferLogAt = 0;

export function isStyleProcessRunning(): boolean {
  if (process.platform === "win32") {
    try {
      const out = execSync("tasklist /FO CSV /NH", { encoding: "utf8", timeout: 8000 });
      const lower = out.toLowerCase();
      return STYLE_PROCESS_NAMES.some((name) => lower.includes(name));
    } catch {
      return false;
    }
  }
  // En Linux/Docker no hay Duna.exe; no usar tasklist (ensucia logs y falla siempre).
  return false;
}

function plan2009RecentlyWritten(styleRoot: string): boolean {
  const planPath = resolveDbfPath(styleRoot, "plan2009");
  if (!planPath) return false;
  try {
    const age = Date.now() - fs.statSync(planPath).mtimeMs;
    return age < STYLE_DEFER_AFTER_WRITE_MS;
  } catch {
    return false;
  }
}

/**
 * Mientras Style está abierto o acaba de escribir DBFs, omitir polls pesados
 * (plan2009 completo, clientes, faccab, …). La cola sigue activa.
 */
export function shouldDeferHeavyPoll(styleRoot: string): boolean {
  return isStyleProcessRunning() || plan2009RecentlyWritten(styleRoot);
}

export function logDeferHeavyPoll(log: (msg: string) => void): void {
  const now = Date.now();
  if (now - lastDeferLogAt < 60_000) return;
  lastDeferLogAt = now;
  const reason = isStyleProcessRunning() ? "Duna.exe en ejecución" : "plan2009 recién modificado";
  log(`poll pesado diferido (${reason}) — cola_sincro + poll ligero planinc`);
}
