#!/usr/bin/env node
/**
 * Candado de agente único por directorio de trabajo (anti-clobbering).
 *
 * Problema que resuelve: si se lanzan varios agentes de Cursor en paralelo sobre
 * el MISMO directorio (p. ej. varios cloud agents en el mismo worker privado),
 * se sobrescriben los archivos unos a otros. Este hook garantiza que solo un
 * agente pueda ejecutar acciones (herramientas/terminal) a la vez en este árbol.
 *
 * Funcionamiento:
 * - El primer agente que actúa adquiere un lock keyed por la ruta del proyecto,
 *   guardado FUERA del repo (en el TEMP del sistema) para no ensuciar git.
 * - Cualquier otro agente (otra conversación) recibe `deny` en cada acción,
 *   con instrucciones de parar o de trabajar en un git worktree aislado.
 * - El lock se libera al terminar la sesión (sessionEnd) y caduca solo tras
 *   15 min sin actividad (TTL), por si un agente muere sin liberar.
 * - Los git worktrees son directorios distintos → locks distintos → forma
 *   soportada de trabajar en paralelo.
 *
 * Acciones (argv[2]): acquire | gate | release
 * Fail-open: ante cualquier error inesperado se permite la acción para no
 * bloquear el trabajo legítimo.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const TTL_MS = 15 * 60 * 1000;

function lockPathForProject(projectRoot) {
  const dir = path.join(os.tmpdir(), 'cursor-single-agent-locks');
  fs.mkdirSync(dir, { recursive: true });
  const key = crypto.createHash('sha1').update(projectRoot.toLowerCase()).digest('hex').slice(0, 16);
  return path.join(dir, `${key}.json`);
}

function readPayload() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sessionIdFrom(payload) {
  return (
    payload.conversation_id ||
    payload.conversationId ||
    payload.session_id ||
    payload.sessionId ||
    null
  );
}

function readLock(lockFile) {
  try {
    return JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  } catch {
    return null;
  }
}

function writeLock(lockFile, sessionId) {
  const now = Date.now();
  const data = JSON.stringify(
    { sessionId, pid: process.ppid, acquiredAt: now, lastSeenAt: now },
    null,
    2,
  );
  fs.writeFileSync(lockFile, data);
}

function refreshLock(lockFile, lock) {
  lock.lastSeenAt = Date.now();
  try {
    fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2));
  } catch {
    /* fail-open */
  }
}

function isFresh(lock) {
  return Boolean(lock && typeof lock.lastSeenAt === 'number' && Date.now() - lock.lastSeenAt < TTL_MS);
}

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
}

function deny(lock, lockFile) {
  const since = lock.acquiredAt ? new Date(lock.acquiredAt).toLocaleTimeString() : '?';
  process.stdout.write(
    JSON.stringify({
      permission: 'deny',
      user_message:
        `Bloqueado: ya hay otro agente activo en este directorio desde las ${since} ` +
        `(sesión ${String(lock.sessionId).slice(0, 8)}…). Para evitar que se sobrescriban ` +
        `los cambios, espera a que termine o lanza el otro agente sobre un git worktree aislado. ` +
        `Lock: ${lockFile}`,
      agent_message:
        `STOP: another agent session holds the single-worker lock for this working tree ` +
        `(only one active agent is allowed here to prevent file clobbering). Do NOT retry, ` +
        `do NOT modify files in this directory. End your turn now and tell the user that ` +
        `another agent is already working here; suggest re-running this task later or in an ` +
        `isolated git worktree.`,
    }),
  );
  process.exit(0);
}

function main() {
  const action = process.argv[2] || 'gate';
  const payload = readPayload();
  const projectRoot = process.cwd();
  const lockFile = lockPathForProject(projectRoot);
  const sessionId = sessionIdFrom(payload);

  // Sin id de sesión no podemos distinguir agentes: fail-open.
  if (!sessionId) {
    if (action === 'gate') allow();
    process.exit(0);
  }

  const lock = readLock(lockFile);

  if (action === 'release') {
    if (lock && lock.sessionId === sessionId) {
      try {
        fs.unlinkSync(lockFile);
      } catch {
        /* fail-open */
      }
    }
    process.exit(0);
  }

  // acquire (sessionStart) y gate (preToolUse / beforeShellExecution / beforeMCPExecution)
  if (!lock || lock.sessionId === sessionId || !isFresh(lock)) {
    if (!lock || lock.sessionId !== sessionId) {
      try {
        writeLock(lockFile, sessionId);
      } catch {
        /* fail-open */
      }
    } else {
      refreshLock(lockFile, lock);
    }
    if (action === 'gate') allow();
    process.exit(0);
  }

  // Lock fresco de otra sesión.
  if (action === 'gate') deny(lock, lockFile);
  process.exit(0);
}

try {
  main();
} catch {
  // Fail-open: nunca bloquear por un fallo del propio hook.
  try {
    process.stdout.write(JSON.stringify({ permission: 'allow' }));
  } catch {
    /* noop */
  }
  process.exit(0);
}
