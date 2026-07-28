import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withFsRetry } from "./fsRetry.js";
import { readColaRows } from "./colaDbf.js";
import { loadDbfIndexed, lookupDbfRow, normalizeStyleKey, type DbfRow } from "./dbfSource.js";
import { writeVfpJsonFile } from "./vfpJsonFile.js";

/**
 * Motor genérico Style ↔ Suite para maestros y transacciones (clientes, artículos,
 * bonos, ventas, facturas, caja). Reutiliza cola_sincro como notificación de cambio
 * (tabla, id_reg, acción) y lee el registro completo del DBF origen.
 *
 * - Style → Suite: por cada fila de cola con tabla habilitada, se llama al RPC del handler.
 * - Suite → Style: dunasoft.style_sync_outbox → JSON inbound `e<id>.json` que el worker VFP aplica.
 */

export type EntityColaRow = {
  id: number;
  tabla: string;
  id_reg: string;
  accion: string;
  modif?: string | number;
  creado?: Date | string | null;
};

export type OutboxRow = {
  id: number;
  entity_type: string;
  operation: "create" | "update" | "delete";
  style_key: string | null;
  suite_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type HandlerSource = { table: string; keyField: string };

export interface EntityHandler {
  /** Tipo lógico (customer, article, ...) usado en el mapeo. */
  entityType: string;
  /** Nombre de tabla Style en cola_sincro (clientes, articulos, ...). */
  tabla: string;
  /** DBF origen del que leer el registro completo (omitir si la cola basta). */
  source?: HandlerSource;
  /** RPC en esquema dunasoft que aplica el cambio en Suite. */
  rpc: string;
  /** Construye argumentos del RPC. Devuelve null para omitir (p. ej. clave 0). */
  buildArgs(
    companyId: string,
    cola: EntityColaRow,
    src: DbfRow | null,
    deps?: EntityEngineDeps,
  ): Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
  /** Da forma al JSON inbound para Suite→Style (si la entidad lo soporta). */
  toInboundJson?(row: OutboxRow): Record<string, unknown>;
}

export type EntityEngineDeps = {
  supabase: SupabaseClient;
  companyId: string;
  styleRoot: string;
  colaPath: string;
  inboundDir: string;
  inboundAckDir: string;
  log: (msg: string) => void;
};

function colaCreatedMs(row: EntityColaRow): number | null {
  const raw = row.creado;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "string" && raw.trim()) {
    const t = Date.parse(raw);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

/** Lee cola_sincro.dbf (tail) y devuelve filas de las tablas indicadas. */
async function readPendingByTabla(
  colaPath: string,
  tablas: Set<string>,
): Promise<Map<string, EntityColaRow[]>> {
  const rows = await readColaRows(colaPath, { tablas, sinceId: 0 });
  const byTabla = new Map<string, EntityColaRow[]>();
  for (const row of rows) {
    const tabla = String(row.tabla ?? "").trim().toLowerCase();
    if (!tablas.has(tabla)) continue;
    const list = byTabla.get(tabla) ?? [];
    list.push(row);
    byTabla.set(tabla, list);
  }
  for (const list of byTabla.values()) list.sort((a, b) => a.id - b.id);
  return byTabla;
}

type CursorRow = { tabla: string; last_id: number; enabled: boolean };

async function loadEnabledCursors(deps: EntityEngineDeps): Promise<Map<string, number>> {
  const { data, error } = await deps.supabase
    .schema("dunasoft")
    .from("style_sync_cursor")
    .select("tabla,last_id,enabled")
    .eq("company_id", deps.companyId)
    .eq("enabled", true);
  if (error) throw error;
  const out = new Map<string, number>();
  for (const r of (data ?? []) as CursorRow[]) {
    out.set(String(r.tabla), Number(r.last_id ?? 0));
  }
  return out;
}

/** Procesa todas las entidades maestras/transacción habilitadas (Style → Suite). */
export async function processEntitiesFromStyle(
  deps: EntityEngineDeps,
  handlers: EntityHandler[],
  batch: number,
): Promise<void> {
  const byTablaHandler = new Map<string, EntityHandler>();
  for (const h of handlers) byTablaHandler.set(h.tabla, h);

  const cursors = await loadEnabledCursors(deps);
  if (cursors.size === 0) return;

  const activeTablas = new Set<string>();
  for (const tabla of cursors.keys()) {
    if (byTablaHandler.has(tabla)) activeTablas.add(tabla);
  }
  if (activeTablas.size === 0) return;

  const pending = await readPendingByTabla(deps.colaPath, activeTablas);

  for (const tabla of activeTablas) {
    const handler = byTablaHandler.get(tabla)!;
    const lastId = cursors.get(tabla) ?? 0;
    const rows = (pending.get(tabla) ?? []).filter((r) => r.id > lastId).slice(0, batch);
    if (rows.length === 0) continue;

    let srcIndex: Map<string, DbfRow> | null = null;
    if (handler.source) {
      try {
        srcIndex = await loadDbfIndexed(deps.styleRoot, handler.source.table, handler.source.keyField);
      } catch (err) {
        deps.log(`entity ${tabla}: no se pudo leer ${handler.source.table}.dbf: ${errMsg(err)}`);
      }
    }

    let maxId = lastId;
    let lastLagMs: number | null = null;
    try {
      for (const row of rows) {
        const src = srcIndex
          ? lookupDbfRow(srcIndex, handler.source!.table, row.id_reg)
          : null;
        const args = await Promise.resolve(handler.buildArgs(deps.companyId, row, src, deps));
        let hadConflict = false;
        if (args) {
          const { data, error } = await deps.supabase.schema("dunasoft").rpc(handler.rpc, args);
          if (error) throw new Error(error.message ?? JSON.stringify(error));
          const result = data as Record<string, unknown> | null;
          hadConflict = result?.conflict === true;
          if (hadConflict) {
            deps.log(
              `entity ${tabla} PARTIAL_MERGE+CONFLICT id_reg=${row.id_reg} fields=${JSON.stringify(result?.fields ?? [])}`,
            );
          }
        }
        maxId = Math.max(maxId, row.id);
        const createdMs = colaCreatedMs(row);
        lastLagMs = createdMs != null ? Math.max(0, Date.now() - createdMs) : lastLagMs;
        if (!hadConflict) {
          deps.log(`entity ${tabla} id_reg=${row.id_reg} accion=${row.accion} -> ${handler.rpc}`);
        }
      }
      if (maxId > lastId) {
        await deps.supabase.schema("dunasoft").rpc("style_sync_cursor_advance", {
          p_company_id: deps.companyId,
          p_tabla: tabla,
          p_last_id: maxId,
          p_lag_ms: lastLagMs,
        });
      }
    } catch (err) {
      deps.log(`entity ${tabla} error: ${errMsg(err)}`);
      await deps.supabase
        .schema("dunasoft")
        .rpc("style_sync_cursor_error", {
          p_company_id: deps.companyId,
          p_tabla: tabla,
          p_error: errMsg(err),
        })
        .then(() => undefined, () => undefined);
      // Avanzar hasta la última fila OK para no reprocesar las correctas.
      if (maxId > lastId) {
        await deps.supabase
          .schema("dunasoft")
          .rpc("style_sync_cursor_advance", {
            p_company_id: deps.companyId,
            p_tabla: tabla,
            p_last_id: maxId,
            p_lag_ms: lastLagMs,
          })
          .then(() => undefined, () => undefined);
      }
    }
  }
}

function entityInboundPath(inboundDir: string, outboxId: number): string {
  return path.join(inboundDir, `e${outboxId}.json`);
}

function entityAckPath(inboundAckDir: string, outboxId: number): string {
  return path.join(inboundAckDir, `e${outboxId}.ok`);
}

/** Vuelca style_sync_outbox pendiente a JSON inbound `e<id>.json` para el worker VFP. */
export async function pollOutboxToInbound(
  deps: EntityEngineDeps,
  handlers: EntityHandler[],
  batch: number,
): Promise<number> {
  const byType = new Map<string, EntityHandler>();
  for (const h of handlers) byType.set(h.entityType, h);

  const { data, error } = await deps.supabase
    .schema("dunasoft")
    .from("style_sync_outbox")
    .select("id,entity_type,operation,style_key,suite_id,payload,created_at")
    .eq("company_id", deps.companyId)
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(batch);
  if (error) throw error;

  const rows = (data ?? []) as OutboxRow[];
  let wrote = 0;
  for (const row of rows) {
    const handler = byType.get(row.entity_type);
    const shape = handler?.toInboundJson
      ? handler.toInboundJson(row)
      : {
          ...row.payload,
          entity_type: row.entity_type,
          operation: row.operation,
          style_key: row.style_key ?? "",
          outbox_id: row.id,
          created_at: row.created_at,
        };
    const out = entityInboundPath(deps.inboundDir, row.id);
    const exists = await withFsRetry(() => fs.existsSync(out), { label: `exists ${out}` }).catch(
      () => false,
    );
    if (exists) continue;
    await withFsRetry(
      () => writeVfpJsonFile(out, { ...shape, entity_type: row.entity_type, outbox_id: row.id }),
      { label: `write ${out}` },
    );
    deps.log(`outbox ${row.entity_type} -> ${out}`);
    wrote++;
  }
  return wrote;
}

function parseEntityAck(raw: string): { ok: boolean; styleKey: string; error: string | null } {
  const parts = new Map<string, string>();
  for (const chunk of raw.split(/[;\r\n]+/)) {
    const [k, ...rest] = chunk.split("=");
    if (!k || rest.length === 0) continue;
    parts.set(k.trim().toLowerCase(), rest.join("=").trim());
  }
  return {
    ok: (parts.get("ok") ?? "1") !== "0",
    styleKey: parts.get("style_key") ?? parts.get("stylekey") ?? "",
    error: parts.get("error") ?? null,
  };
}

/** Drena ACKs `e<id>.ok` del worker VFP y confirma la outbox genérica. */
export async function drainOutboxAcks(deps: EntityEngineDeps): Promise<void> {
  const files = await withFsRetry(
    () =>
      fs
        .readdirSync(deps.inboundAckDir)
        .filter((f) => /^e\d+\.ok$/i.test(f)),
    { label: "readdir outbox ack" },
  ).catch(() => [] as string[]);

  for (const f of files) {
    const outboxId = Number(f.replace(/^e/i, "").replace(/\.ok$/i, ""));
    if (!Number.isFinite(outboxId) || outboxId <= 0) continue;
    const okPath = entityAckPath(deps.inboundAckDir, outboxId);
    let raw: string;
    try {
      raw = await withFsRetry(() => fs.readFileSync(okPath, "utf8").trim(), { label: `read ${okPath}` });
    } catch (err) {
      deps.log(`outbox ack read error e${outboxId}: ${errMsg(err)}`);
      continue;
    }
    const { ok, styleKey, error } = parseEntityAck(raw);
    const { error: rpcErr } = await deps.supabase.schema("dunasoft").rpc("style_entity_ack", {
      p_company_id: deps.companyId,
      p_outbox_id: outboxId,
      p_style_key: styleKey || null,
      p_ok: ok,
      p_error: error,
    });
    if (rpcErr) {
      deps.log(`outbox ack RPC error e${outboxId}: ${rpcErr.message}`);
      continue;
    }
    // Limpiar artefactos (JSON + ack) tras confirmar.
    for (const p of [entityInboundPath(deps.inboundDir, outboxId), okPath]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        /* se reintenta en el siguiente ciclo */
      }
    }
    deps.log(`outbox ack -> e${outboxId} ok=${ok}`);
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
