/**
 * Sincroniza un día completo Style → Suite: aplica filas del DBF y borra en Suite
 * las citas de ese día que ya no existen en Style para esa fecha.
 *
 * Uso: npx tsx src/scripts/resync-plan2009-day-from-style.ts 2026-07-06
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  dbfBool,
  dbfDateIso,
  dbfStr,
  loadDbfIndexed,
  loadDbfFilteredRows,
} from "../dbfSource.js";
import { serviciosJsonToLegacy } from "../servicios.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DATE = process.argv[2];

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATE) {
  console.error("Uso: STYLE_ROOT=... COMPANY_ID=... npx tsx resync-plan2009-day-from-style.ts YYYY-MM-DD");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function loadPlanartServiciosIndex() {
  const rows = await loadDbfFilteredRows(STYLE_ROOT, "planart", () => true);
  const buckets = new Map<string, Array<{ servicio: string; hora: string }>>();
  for (const r of rows) {
    const key = String(r.idplan ?? "").trim().replace(/^0+/, "") || "0";
    const cod = dbfStr(r, "codart");
    if (!cod) continue;
    const list = buckets.get(key) ?? [];
    list.push({ servicio: cod, hora: dbfStr(r, "hora") });
    buckets.set(key, list);
  }
  const out = new Map<string, string>();
  for (const [key, items] of buckets) out.set(key, JSON.stringify(items));
  return out;
}

async function applyUpdate(row: Record<string, unknown>, serviciosJson: string) {
  const idplan = Number(String(row.idplan ?? "").trim());
  const { error } = await supabase.rpc("style_reservas_apply_from_style", {
    p_company_id: COMPANY_ID,
    p_accion: "UPDATE",
    p_idplan: idplan,
    p_codemp: dbfStr(row, "codemp"),
    p_codcli: dbfStr(row, "codcli"),
    p_fecha: dbfDateIso(row, "fecha"),
    p_horini: dbfStr(row, "horini"),
    p_horfin: dbfStr(row, "horfin"),
    p_texto: dbfStr(row, "texto"),
    p_codrec: dbfStr(row, "codrec"),
    p_nomcli: dbfStr(row, "nomcli"),
    p_tel1cli: dbfStr(row, "tel1cli"),
    p_facturado: dbfBool(row, "facturado"),
    p_servicios: serviciosJsonToLegacy(serviciosJson),
    p_colfon: Number(dbfStr(row, "colfon") || 0),
    p_collet: Number(dbfStr(row, "collet") || 0),
    p_style_modified_at: null,
  });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
}

async function applyDelete(idplan: number) {
  const { error } = await supabase.rpc("style_reservas_apply_from_style", {
    p_company_id: COMPANY_ID,
    p_accion: "DELETE",
    p_idplan: idplan,
    p_codemp: "",
    p_codcli: "",
    p_fecha: null,
    p_horini: "",
    p_horfin: "",
    p_texto: "",
    p_codrec: "",
    p_nomcli: "",
    p_tel1cli: "",
    p_facturado: false,
    p_servicios: "",
    p_colfon: 0,
    p_collet: 0,
    p_style_modified_at: null,
  });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
}

async function main() {
  console.log(`Resync ${DATE} desde ${STYLE_ROOT}`);
  const index = await loadDbfIndexed(STYLE_ROOT, "plan2009", "idplan");
  const serviciosByPlan = await loadPlanartServiciosIndex();
  const styleRows = [...index.values()].filter((r) => dbfDateIso(r, "fecha") === DATE);
  const styleIds = new Set(styleRows.map((r) => String(r.idplan ?? "").trim()));
  const allStyleById = new Map<string, Record<string, unknown>>();
  for (const row of index.values()) {
    const id = String(row.idplan ?? "").trim();
    if (id) allStyleById.set(id, row);
  }

  let ok = 0;
  for (const row of styleRows) {
    const key = String(row.idplan ?? "").trim().replace(/^0+/, "") || "0";
    await applyUpdate(row, serviciosByPlan.get(key) ?? "[]");
    ok++;
    console.log(`  UPDATE ${key} ${dbfStr(row, "horini")}-${dbfStr(row, "horfin")} ${dbfStr(row, "nomcli").slice(0, 40)}`);
  }

  const { data: suiteRows, error } = await supabase
    .schema("dunasoft")
    .from("plan2009")
    .select("idplan, horini, nomcli")
    .eq("fecha", DATE);
  if (error) throw error;

  let moved = 0;
  let deleted = 0;
  for (const row of suiteRows ?? []) {
    const id = String(row.idplan ?? "").trim();
    if (styleIds.has(id)) continue;
    const styleRow = allStyleById.get(id);
    if (styleRow) {
      const key = id.replace(/^0+/, "") || "0";
      await applyUpdate(styleRow, serviciosByPlan.get(key) ?? "[]");
      moved++;
      console.log(
        `  MOVE ${id} → ${dbfDateIso(styleRow, "fecha")} ${dbfStr(styleRow, "horini")} (ya no está en ${DATE} en Style)`,
      );
      continue;
    }
    await applyDelete(Number(id));
    deleted++;
    console.log(`  DELETE ${id} ${row.horini} ${String(row.nomcli ?? "").slice(0, 40)} (no existe en Style)`);
  }

  console.log(`Listo: ${ok} actualizadas, ${moved} movidas, ${deleted} borradas`);

  const { error: mergeErr } = await supabase.schema("dunasoft").rpc("style_merge_consecutive_appointments", {
    p_company_id: COMPANY_ID,
    p_date: DATE,
  });
  if (mergeErr) {
    console.warn("merge consecutive:", mergeErr.message);
  } else {
    console.log("merge consecutive: OK");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
