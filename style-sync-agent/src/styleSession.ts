import { execSync } from "node:child_process";
import fs from "node:fs";
import { resolveDbfPath } from "./dbfSource.js";

/** Procesos de la UI de Style (NO incluir vfp9.exe: es el worker inbound headless). */
const STYLE_UI_PROCESS_NAMES = (process.env.STYLE_UI_PROCESS_NAMES ??
  process.env.STYLE_PROCESS_NAMES ??
  "duna.exe,duna2.exe,mscomctl.exe,style.exe")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter((n) => n && n !== "vfp9.exe");

/** Tras escribir DBFs de agenda, omitir polls pesados (ms). */
const STYLE_DEFER_AFTER_WRITE_MS = Number(process.env.STYLE_DEFER_AFTER_WRITE_MS ?? "90000");

let lastDeferLogAt = 0;

function dbfRecentlyWritten(styleRoot: string, table: string): boolean {
  const planPath = resolveDbfPath(styleRoot, table);
  if (!planPath) return false;
  try {
    const age = Date.now() - fs.statSync(planPath).mtimeMs;
    return age < STYLE_DEFER_AFTER_WRITE_MS;
  } catch {
    return false;
  }
}

/** tasklist CSV: "Duna2.exe","1234",... — no usar includes("duna.exe") (no matchea Duna2). */
function tasklistHasProcess(targets: string[]): boolean {
  try {
    const out = execSync("tasklist /FO CSV /NH", { encoding: "utf8", timeout: 8000 });
    const want = new Set(targets.map((n) => n.toLowerCase().replace(/\.exe$/i, "") + ".exe"));
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^"([^"]+)"/);
      if (!m) continue;
      const exe = m[1].toLowerCase();
      if (want.has(exe)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isStyleProcessRunning(): boolean {
  if (process.platform === "win32") {
    return tasklistHasProcess(STYLE_UI_PROCESS_NAMES);
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

/** Diferir escaneo plan2009 / polls que compiten con la agenda. */
export function shouldDeferHeavyPoll(styleRoot: string): boolean {
  if (isStyleProcessRunning()) return true;
  if (plan2009RecentlyWritten(styleRoot)) return true;
  if (dbfRecentlyWritten(styleRoot, "plantmp")) return true;
  if (dbfRecentlyWritten(styleRoot, "cola_sincro")) return true;
  return false;
}

/**
 * Diferir barrido de maestros (clientes, faccab, …).
 * No usa plan2009/cola_sincro: el inbound puede escribir plan2009 sin bloquear clientes.dbf.
 */
export function shouldDeferEntityDbfPoll(styleRoot: string): boolean {
  if (isStyleProcessRunning()) return true;
  if (dbfRecentlyWritten(styleRoot, "plantmp")) return true;
  return false;
}

export function logDeferHeavyPoll(log: (msg: string) => void, styleRoot: string): void {
  logDeferPoll(log, styleRoot, "pesado", shouldDeferHeavyPoll);
}

export function logDeferEntityDbfPoll(log: (msg: string) => void, styleRoot: string): void {
  logDeferPoll(log, styleRoot, "entidades DBF", shouldDeferEntityDbfPoll);
}

function logDeferPoll(
  log: (msg: string) => void,
  styleRoot: string,
  label: string,
  check: (root: string) => boolean,
): void {
  if (!check(styleRoot)) return;
  const now = Date.now();
  if (now - lastDeferLogAt < 60_000) return;
  lastDeferLogAt = now;
  let reason = "plan2009 recién modificado";
  if (isStyleProcessRunning()) reason = "UI Style abierta (Duna/Duna2/mscomctl)";
  else if (dbfRecentlyWritten(styleRoot, "plantmp")) reason = "plantmp recién modificado (agenda activa)";
  else if (dbfRecentlyWritten(styleRoot, "cola_sincro")) reason = "cola_sincro recién modificado";
  log(`poll ${label} diferido (${reason}) — cola_sincro sigue activa`);
}
