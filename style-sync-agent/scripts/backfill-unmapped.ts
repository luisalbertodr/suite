/**
 * Importa registros Style presentes en DBF pero ausentes en style_sync_entity_map.
 * Uso:
 *   npx tsx scripts/backfill-unmapped.ts              # todas las tablas, lote 100
 *   npx tsx scripts/backfill-unmapped.ts clientes 200 # solo clientes, lote 200
 *   npx tsx scripts/backfill-unmapped.ts --loop       # repite hasta vaciar gaps
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  loadDbfIndexed,
  dbfStr,
  normalizeStyleKey,
  type DbfRow,
} from "../src/dbfSource.js";
import { ENTITY_HANDLERS } from "../src/handlers.js";
import type { EntityEngineDeps, EntityHandler } from "../src/entitySync.js";

(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const STYLE_ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const COMPANY_ID = process.env.COMPANY_ID!;
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const args = process.argv.slice(2);
const loop = args.includes("--loop");
const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);
const strs = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const tablaFilter = strs[0] ?? null;
const batchSize = nums[0] ?? Number(process.env.ENTITY_BATCH ?? "100");

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function loadMappedKeys(entityType: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key")
    .eq("company_id", COMPANY_ID)
    .eq("entity_type", entityType);
  if (error) throw error;
  return new Set((data ?? []).map((r) => normalizeStyleKey(String(r.style_key))));
}

async function applyRow(handler: EntityHandler, key: string, row: DbfRow): Promise<boolean> {
  const rawKey = dbfStr(row, handler.source!.keyField) || key;
  const cola = { id: 0, tabla: handler.tabla, id_reg: rawKey, accion: "UPD" };
  const deps: EntityEngineDeps = {
    supabase,
    companyId: COMPANY_ID,
    styleRoot: STYLE_ROOT,
    colaPath: "",
    inboundDir: "",
    inboundAckDir: "",
    log,
  };
  const rpcArgs = await Promise.resolve(handler.buildArgs(COMPANY_ID, cola, row, deps));
  if (!rpcArgs) return false;
  const { data, error } = await supabase.schema("dunasoft").rpc(handler.rpc, rpcArgs);
  if (error) throw new Error(`${handler.tabla} key=${key}: ${error.message}`);
  const result = data as Record<string, unknown> | null;
  if (result?.conflict === true) {
    log(`${handler.tabla} key=${key} CONFLICT`);
  }
  return true;
}

async function backfillHandler(handler: EntityHandler): Promise<number> {
  if (!handler.source) return 0;
  const index = await loadDbfIndexed(STYLE_ROOT, handler.source.table, handler.source.keyField);
  const mapped = await loadMappedKeys(handler.entityType);
  const pending: Array<[string, DbfRow]> = [];
  for (const [key, row] of index) {
    if (!mapped.has(key)) pending.push([key, row]);
  }
  if (!pending.length) {
    log(`${handler.tabla}: sin pendientes (${index.size} en DBF, ${mapped.size} mapeados)`);
    return 0;
  }
  log(`${handler.tabla}: ${pending.length} sin mapear — importando lote ${Math.min(batchSize, pending.length)}`);
  let ok = 0;
  let err = 0;
  for (const [key, row] of pending.slice(0, batchSize)) {
    try {
      if (await applyRow(handler, key, row)) ok++;
    } catch (e) {
      err++;
      log(`${handler.tabla} key=${key} ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  log(`${handler.tabla}: lote OK=${ok} ERR=${err} (quedan ~${Math.max(0, pending.length - ok)})`);
  return Math.max(0, pending.length - ok);
}

async function runOnce(): Promise<number> {
  let remaining = 0;
  const handlers = tablaFilter
    ? ENTITY_HANDLERS.filter((h) => h.tabla === tablaFilter)
    : ENTITY_HANDLERS;
  if (!handlers.length) throw new Error(`Tabla desconocida: ${tablaFilter}`);
  for (const h of handlers) {
    remaining += await backfillHandler(h);
  }
  return remaining;
}

async function main() {
  log(`Backfill Style→Suite root=${STYLE_ROOT} batch=${batchSize} loop=${loop}`);
  if (loop) {
    for (;;) {
      const left = await runOnce();
      if (left <= 0) {
        log("Backfill completado.");
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  } else {
    await runOnce();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
