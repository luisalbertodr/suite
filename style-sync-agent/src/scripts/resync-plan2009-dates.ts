/**
 * Re-sincroniza citas cuya fecha_iso en DBF difiere de la fecha ya guardada en Suite.
 * Tras corregir parseo YYYYMMDD, actualiza solo filas afectadas.
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

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno");
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

async function applyRow(row: Parameters<typeof dbfStr>[0], serviciosJson: string) {
  const idplan = Number(String(row?.idplan ?? "").trim());
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

async function main() {
  const onlyDate = process.argv[2] ?? null; // ej. 2026-07-02
  const onlyId = process.argv[3] ? Number(process.argv[3]) : null;

  console.log("Cargando plan2009...");
  const index = await loadDbfIndexed(STYLE_ROOT, "plan2009", "idplan");
  const serviciosByPlan = await loadPlanartServiciosIndex();

  let rows = [...index.values()];
  if (onlyId) rows = rows.filter((r) => Number(r.idplan) === onlyId);
  else if (onlyDate) rows = rows.filter((r) => dbfDateIso(r, "fecha") === onlyDate);

  console.log(`Aplicando ${rows.length} filas...`);
  let ok = 0;
  let err = 0;
  for (const row of rows) {
    const key = String(row.idplan ?? "").trim().replace(/^0+/, "") || "0";
    const serviciosJson = serviciosByPlan.get(key) ?? "[]";
    try {
      await applyRow(row, serviciosJson);
      ok++;
      if (ok <= 5 || ok % 50 === 0) {
        console.log(`  ok ${ok}: idplan=${key} fecha=${dbfDateIso(row, "fecha")} ${dbfStr(row, "nomcli").slice(0, 30)}`);
      }
    } catch (e) {
      err++;
      console.error(`ERR idplan=${key}:`, e instanceof Error ? e.message : String(e));
    }
  }
  console.log(`Listo ok=${ok} err=${err}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
