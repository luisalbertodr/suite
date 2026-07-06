/**
 * Re-aplica entidades Style→Suite desde DBF (fechas corregidas).
 * Uso: node dist/scripts/resync-entities-from-dbf.js [tabla]
 * Sin argumento: ciecab, faccab, bonoscli, clientes (mapeados).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ENTITY_HANDLERS } from "../handlers.js";
import { loadDbfIndexed, dbfStr } from "../dbfSource.js";
import type { EntityEngineDeps, EntityHandler } from "../entitySync.js";

const depsStub = {
  styleRoot: STYLE_ROOT,
  companyId: COMPANY_ID,
  supabase,
  log: () => {},
} as EntityEngineDeps;

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CONCURRENCY = Number(process.env.SYNC_CONCURRENCY ?? "15");

const TABLES = process.argv[2]
  ? [process.argv[2]]
  : ["ciecab", "faccab", "bonoscli", "clientes"];

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyHandler(handler: EntityHandler, key: string, row: NonNullable<Parameters<typeof dbfStr>[0]>) {
  const cola = { id: 0, tabla: handler.tabla, id_reg: dbfStr(row, handler.source!.keyField) || key, accion: "UPD" };
  const args = await Promise.resolve(
    handler.buildArgs(COMPANY_ID, cola, row, depsStub),
  );
  if (!args) return;
  const { error } = await supabase.schema("dunasoft").rpc(handler.rpc, args);
  if (error) throw new Error(`${handler.tabla}/${key}: ${error.message}`);
}

async function resyncTable(handler: EntityHandler): Promise<void> {
  const src = handler.source!;
  console.log(`\n--- ${handler.tabla} ---`);
  const index = await loadDbfIndexed(STYLE_ROOT, src.table, src.keyField);
  const { data: maps } = await supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key")
    .eq("company_id", COMPANY_ID)
    .eq("entity_type", handler.entityType);
  const mappedKeys = new Set((maps ?? []).map((m) => String(m.style_key).replace(/^0+/, "") || "0"));

  let targets = [...index.entries()];
  if (handler.tabla !== "faccab") {
    targets = targets.filter(([k]) => mappedKeys.has(k.replace(/^0+/, "") || "0"));
  }
  // faccab: importar también sin mapeo (baseline pendiente)
  if (handler.tabla === "clientes") {
    const luisa = index.get("8201") ?? index.get("008201");
    if (luisa && !targets.some(([k]) => k === "8201" || k === "008201")) {
      targets.push(["8201", luisa]);
    }
  }

  console.log(`Aplicando ${targets.length} registros...`);
  let ok = 0;
  let err = 0;

  async function worker(batch: Array<[string, Parameters<typeof dbfStr>[0]]>) {
    for (const [key, row] of batch) {
      try {
        await applyHandler(handler, key, row);
        ok++;
        if (ok <= 3 || ok % 200 === 0) console.log(`  ok ${ok}/${targets.length} key=${key}`);
      } catch (e) {
        err++;
        if (err <= 10) console.error(`  ERR ${key}:`, e instanceof Error ? e.message : String(e));
      }
    }
  }

  const chunk = Math.ceil(targets.length / CONCURRENCY) || 1;
  const chunks: Array<Array<[string, Parameters<typeof dbfStr>[0]]>> = [];
  for (let i = 0; i < targets.length; i += chunk) chunks.push(targets.slice(i, i + chunk));
  await Promise.all(chunks.map((c) => worker(c)));
  console.log(`Listo ${handler.tabla}: ok=${ok} err=${err}`);
}

async function main() {
  for (const tabla of TABLES) {
    const handler = ENTITY_HANDLERS.find((h) => h.tabla === tabla);
    if (!handler?.source) {
      console.error(`Tabla desconocida: ${tabla}`);
      continue;
    }
    await resyncTable(handler);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
