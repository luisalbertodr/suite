/**
 * Re-aplica cierres de caja con importe 0 en Suite desde Style (ciecab + cieentsal).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ENTITY_HANDLERS } from "../handlers.js";
import { loadDbfIndexed, dbfStr, type DbfRow } from "../dbfSource.js";
import type { EntityEngineDeps } from "../entitySync.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "\\\\192.168.99.16\\c$\\Style-Dunasoft";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const handler = ENTITY_HANDLERS.find((h) => h.tabla === "ciecab")!;
const deps = {
  styleRoot: STYLE_ROOT,
  companyId: COMPANY_ID,
  supabase,
  log: (m: string) => console.log(m),
} as EntityEngineDeps;

async function apply(key: string, row: DbfRow) {
  const cola = { id: 0, tabla: "ciecab", id_reg: dbfStr(row, "numcie") || key, accion: "UPD" };
  const args = await handler.buildArgs(COMPANY_ID, cola, row, deps);
  if (!args) return;
  const { error } = await supabase.schema("dunasoft").rpc(handler.rpc, args);
  if (error) throw new Error(`${key}: ${error.message}`);
}

const { data: zeroSessions, error: zErr } = await supabase
  .from("cash_register_sessions")
  .select("id, session_date, notes, closing_cash")
  .eq("company_id", COMPANY_ID)
  .eq("closing_cash", 0)
  .like("notes", "Cierre Style %")
  .order("session_date", { ascending: false });
if (zErr) throw zErr;

const { data: maps, error: mErr } = await supabase
  .schema("dunasoft")
  .from("style_sync_entity_map")
  .select("style_key, suite_id")
  .eq("company_id", COMPANY_ID)
  .eq("entity_type", "cash_session");
if (mErr) throw mErr;

const suiteToKey = new Map((maps ?? []).map((m) => [String(m.suite_id), String(m.style_key)]));
const targets = (zeroSessions ?? [])
  .map((s) => ({ session: s, styleKey: suiteToKey.get(String(s.id)) }))
  .filter((t): t is { session: (typeof zeroSessions)[number]; styleKey: string } => !!t.styleKey);

console.log(`Cierres Style con 0 € en Suite: ${targets.length}`);
const index = await loadDbfIndexed(STYLE_ROOT, "ciecab", "numcie");
let ok = 0;
let err = 0;
for (const { styleKey } of targets) {
  const row = index.get(styleKey) ?? index.get(styleKey.replace(/^0+/, "") || "0");
  if (!row) {
    console.warn(`  sin fila DBF para numcie=${styleKey}`);
    err++;
    continue;
  }
  try {
    await apply(styleKey, row);
    ok++;
    if (ok <= 5 || ok % 50 === 0) console.log(`  ok ${ok}/${targets.length} numcie=${styleKey}`);
  } catch (e) {
    err++;
    console.error(`  error numcie=${styleKey}:`, e instanceof Error ? e.message : e);
  }
}
console.log(`Listo: ok=${ok} err=${err}`);
