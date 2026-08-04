/**
 * One-shot: apply faccab rows with fecfac >= FROM_DATE (default 2026-07-24).
 * Incluye serie 00 (documentos de consumo de bono) para que existan en Suite;
 * el dashboard de ingreso/beneficio las excluye (solo serie ≠ 00).
 * Skips empty ejefac/fecha.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { ENTITY_HANDLERS } from "../handlers.js";
import { dbfDateIso, dbfStr, loadDbfFilteredRows, styleRowKey } from "../dbfSource.js";
import type { EntityEngineDeps } from "../entitySync.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const FROM_DATE = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? "2026-07-24";

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan STYLE_ROOT/COMPANY_ID/SUPABASE_*");
  process.exit(1);
}

(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const handler = ENTITY_HANDLERS.find((h) => h.tabla === "faccab")!;
const deps = {
  styleRoot: STYLE_ROOT,
  companyId: COMPANY_ID,
  supabase,
  colaPath: "",
  inboundDir: "",
  inboundAckDir: "",
  log: (m: string) => console.log(m),
} as EntityEngineDeps;

const rows = await loadDbfFilteredRows(STYLE_ROOT, "faccab", (r) => {
  const ejefac = dbfStr(r, "ejefac");
  const fecha = dbfDateIso(r, "fecfac");
  return Boolean(ejefac && fecha && fecha >= FROM_DATE);
});

console.log(`Filas desde ${FROM_DATE}: ${rows.length}`);
let ok = 0;
let skip = 0;
let err = 0;
for (const row of rows) {
  const key = styleRowKey("faccab", row);
  const cola = { id: 0, tabla: "faccab", id_reg: dbfStr(row, "numfac"), accion: "UPD" };
  try {
    const args = await handler.buildArgs!(COMPANY_ID, cola, row, deps);
    if (!args) {
      skip++;
      continue;
    }
    const { data, error } = await supabase.schema("dunasoft").rpc(handler.rpc, args);
    if (error) throw new Error(error.message);
    if ((data as { conflict?: boolean } | null)?.conflict) {
      console.log(`CONFLICT ${key}`);
    } else {
      ok++;
      if (ok % 10 === 0) console.log(`ok=${ok} last=${key} fecha=${dbfDateIso(row, "fecfac")}`);
    }
  } catch (e) {
    err++;
    console.error(`ERR ${key}:`, e instanceof Error ? e.message : e);
  }
}
console.log(`DONE ok=${ok} skip=${skip} err=${err}`);
