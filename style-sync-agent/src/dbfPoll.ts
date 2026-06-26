import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  dbfStr,
  loadDbfIndexed,
  normalizeStyleKey,
  resolveDbfPath,
  type DbfRow,
} from "./dbfSource.js";
import type { EntityEngineDeps, EntityHandler } from "./entitySync.js";

/** Campos por tabla para calcular huella de cambio. */
const FINGERPRINT_FIELDS: Record<string, string[]> = {
  clientes: [
    "nomcli", "ape1cli", "ape2cli", "tel1cli", "tel2cli", "email", "dnicli",
    "dircli", "codposcli", "pobcli", "procli", "pais", "percon", "obscli", "obsoleto",
  ],
  articulos: ["desart", "familia1", "pvpa", "coste", "stock", "ivaart", "tiempo", "obsoleto"],
  bonoscli: ["codcli", "codbon", "desbon", "sesiones", "consumi", "importe", "obsoleto"],
  albcab: ["serie", "seralb", "codcli", "fecha", "total", "totalalb"],
  faccab: ["serie", "serfac", "codcli", "fecha", "fecfac", "totfac", "totimpbas"],
  ciecab: ["fecha", "efectivo", "efec", "tarjeta", "tarj", "total", "totalcie"],
};

function rowFingerprint(row: DbfRow, fields: string[]): string {
  const parts = fields.map((f) => `${f}=${dbfStr(row, f)}`);
  return createHash("sha256").update(parts.join("\x1e")).digest("hex").slice(0, 40);
}

async function loadEntityMapKeys(
  deps: EntityEngineDeps,
  entityType: string,
): Promise<Set<string>> {
  const { data, error } = await deps.supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key")
    .eq("company_id", deps.companyId)
    .eq("entity_type", entityType);
  if (error) throw error;
  return new Set((data ?? []).map((r) => normalizeStyleKey(String(r.style_key))));
}

async function loadFingerprintMap(
  deps: EntityEngineDeps,
  tabla: string,
): Promise<Map<string, string>> {
  const { data, error } = await deps.supabase
    .schema("dunasoft")
    .from("style_sync_dbf_fingerprint")
    .select("style_key,fingerprint")
    .eq("company_id", deps.companyId)
    .eq("tabla", tabla);
  if (error) throw error;
  const out = new Map<string, string>();
  for (const row of data ?? []) {
    out.set(String(row.style_key), String(row.fingerprint));
  }
  return out;
}

async function upsertFingerprints(
  deps: EntityEngineDeps,
  tabla: string,
  entries: Array<{ style_key: string; fingerprint: string }>,
): Promise<void> {
  if (entries.length === 0) return;
  const chunk = 200;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk).map((e) => ({
      company_id: deps.companyId,
      tabla,
      style_key: e.style_key,
      fingerprint: e.fingerprint,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await deps.supabase
      .schema("dunasoft")
      .from("style_sync_dbf_fingerprint")
      .upsert(slice, { onConflict: "company_id,tabla,style_key" });
    if (error) throw error;
  }
}

async function markBaselineSeeded(deps: EntityEngineDeps, tabla: string): Promise<void> {
  await deps.supabase
    .schema("dunasoft")
    .from("style_sync_cursor")
    .update({ dbf_baseline_seeded: true, updated_at: new Date().toISOString() })
    .eq("company_id", deps.companyId)
    .eq("tabla", tabla);
}

async function applyHandlerRow(
  deps: EntityEngineDeps,
  handler: EntityHandler,
  key: string,
  src: DbfRow,
): Promise<void> {
  const cola = { id: 0, tabla: handler.tabla, id_reg: key, accion: "UPD" };
  const args = await Promise.resolve(handler.buildArgs(deps.companyId, cola, src, deps));
  if (!args) return;
  const { data, error } = await deps.supabase.schema("dunasoft").rpc(handler.rpc, args);
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  const result = data as Record<string, unknown> | null;
  if (result?.conflict === true) {
    deps.log(`dbf-poll ${handler.tabla} CONFLICT key=${key}`);
  } else {
    deps.log(`dbf-poll ${handler.tabla} key=${key} -> ${handler.rpc}`);
  }
}

const lastMtime = new Map<string, number>();

/**
 * Detecta cambios leyendo el DBF maestro cuando Style no encola en cola_sincro.
 * Primera pasada: siembra huellas e importa registros que aún no están en entity_map.
 */
export async function pollDbfEntityChanges(
  deps: EntityEngineDeps,
  handlers: EntityHandler[],
  batch: number,
): Promise<void> {
  const { data: cursors, error: curErr } = await deps.supabase
    .schema("dunasoft")
    .from("style_sync_cursor")
    .select("tabla,enabled,dbf_baseline_seeded")
    .eq("company_id", deps.companyId)
    .eq("enabled", true);
  if (curErr) throw curErr;
  if (!cursors?.length) return;

  const enabled = new Map(
    cursors.map((c) => [c.tabla as string, Boolean(c.dbf_baseline_seeded)]),
  );

  for (const handler of handlers) {
    if (!handler.source) continue;
    const tabla = handler.tabla;
    if (!enabled.has(tabla)) continue;

    const dbfPath = resolveDbfPath(deps.styleRoot, handler.source.table);
    if (!dbfPath) continue;

    let mtime = 0;
    try {
      mtime = fs.statSync(dbfPath).mtimeMs;
    } catch {
      continue;
    }

    const seeded = enabled.get(tabla) ?? false;
    const prevMtime = lastMtime.get(tabla) ?? 0;
    if (seeded && mtime === prevMtime) continue;
    lastMtime.set(tabla, mtime);

    const fields = FINGERPRINT_FIELDS[tabla] ?? [handler.source.keyField];
    const index = await loadDbfIndexed(deps.styleRoot, handler.source.table, handler.source.keyField);
    const known = seeded ? await loadFingerprintMap(deps, tabla) : new Map<string, string>();
    const mappedKeys = await loadEntityMapKeys(deps, handler.entityType);

    const changed: Array<{ key: string; row: DbfRow; fp: string }> = [];
    const allEntries: Array<{ style_key: string; fingerprint: string }> = [];

    for (const [key, row] of index) {
      const fp = rowFingerprint(row, fields);
      allEntries.push({ style_key: key, fingerprint: fp });
      if (!seeded) {
        if (!mappedKeys.has(key)) changed.push({ key, row, fp });
        continue;
      }
      // Tras baseline: cambio de huella O registro aún sin entity_map (backfill pendiente).
      if (known.get(key) !== fp || !mappedKeys.has(key)) {
        changed.push({ key, row, fp });
      }
    }

    if (!seeded) {
      if (changed.length > 0) {
        deps.log(
          `dbf-poll ${tabla}: baseline pendiente, ${changed.length} sin mapear (lote ${Math.min(batch, changed.length)})`,
        );
        for (const item of changed.slice(0, batch)) {
          const rawKey = dbfStr(item.row, handler.source.keyField) || item.key;
          try {
            await applyHandlerRow(deps, handler, rawKey, item.row);
            await upsertFingerprints(deps, tabla, [{ style_key: item.key, fingerprint: item.fp }]);
          } catch (err) {
            deps.log(
              `dbf-poll ${tabla} key=${item.key} error: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
        if (changed.length > batch) continue;
      }
      await upsertFingerprints(deps, tabla, allEntries);
      await markBaselineSeeded(deps, tabla);
      deps.log(`dbf-poll ${tabla}: baseline completo (${allEntries.length} huellas)`);
      continue;
    }

    if (changed.length === 0) continue;

    deps.log(`dbf-poll ${tabla}: ${changed.length} cambio(s) detectado(s)`);
    for (const item of changed.slice(0, batch)) {
      const rawKey = dbfStr(item.row, handler.source.keyField) || item.key;
      try {
        await applyHandlerRow(deps, handler, rawKey, item.row);
        await upsertFingerprints(deps, tabla, [{ style_key: item.key, fingerprint: item.fp }]);
      } catch (err) {
        deps.log(
          `dbf-poll ${tabla} key=${item.key} error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (changed.length > batch) {
      deps.log(`dbf-poll ${tabla}: quedan ${changed.length - batch} pendientes (siguiente tick)`);
    }
  }
}
