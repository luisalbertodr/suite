import { createHash } from "node:crypto";
import fs from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dbfBool,
  dbfDateIso,
  dbfStr,
  loadDbfFilteredRows,
  loadDbfIndexed,
  resolveDbfPath,
  type DbfRow,
} from "./dbfSource.js";
import { serviciosJsonToLegacy } from "./servicios.js";

const TABLA = "plan2009";
const PLAN_FIELDS = [
  "codemp", "codcli", "fecha", "horini", "horfin", "texto", "codrec",
  "nomcli", "tel1cli", "facturado", "colfon", "collet",
];

type PollDeps = {
  supabase: SupabaseClient;
  companyId: string;
  styleRoot: string;
  log: (msg: string) => void;
};

function rowFingerprint(row: DbfRow, serviciosJson: string): string {
  const parts = PLAN_FIELDS.map((f) => {
    if (f === "fecha") return `fecha=${dbfDateIso(row, f) ?? ""}`;
    if (f === "facturado") return `facturado=${dbfBool(row, f) ? "1" : "0"}`;
    return `${f}=${dbfStr(row, f)}`;
  });
  parts.push(`servicios=${serviciosJson}`);
  return createHash("sha256").update(parts.join("\x1e")).digest("hex").slice(0, 40);
}

/** Índice idplan → JSON servicios (una lectura de planart.dbf por tick). */
async function loadPlanartServiciosIndex(styleRoot: string): Promise<Map<string, string>> {
  const rows = await loadDbfFilteredRows(styleRoot, "planart", () => true);
  const buckets = new Map<string, Array<{ servicio: string; hora: string }>>();
  for (const r of rows) {
    const raw = String(r.idplan ?? "").trim();
    if (!raw) continue;
    const key = raw.replace(/^0+/, "") || "0";
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

function normalizePlanKey(key: string): string {
  const t = String(key ?? "").trim();
  return /^\d+$/.test(t) ? t.replace(/^0+/, "") || "0" : t;
}

async function loadFingerprintMap(deps: PollDeps): Promise<Map<string, string>> {
  const { data, error } = await deps.supabase
    .schema("dunasoft")
    .from("style_sync_dbf_fingerprint")
    .select("style_key,fingerprint")
    .eq("company_id", deps.companyId)
    .eq("tabla", TABLA);
  if (error) throw error;
  const out = new Map<string, string>();
  for (const row of data ?? []) out.set(String(row.style_key), String(row.fingerprint));
  return out;
}

async function upsertFingerprints(
  deps: PollDeps,
  entries: Array<{ style_key: string; fingerprint: string }>,
): Promise<void> {
  if (!entries.length) return;
  const chunk = 200;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk).map((e) => ({
      company_id: deps.companyId,
      tabla: TABLA,
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

async function applyPlan2009(
  deps: PollDeps,
  idplan: string,
  row: DbfRow | null,
  accion: "UPDATE" | "DELETE",
  serviciosJson: string,
): Promise<void> {
  const idNum = Number(idplan);
  const fecha = row ? dbfDateIso(row, "fecha") : null;
  const { error } = await deps.supabase.rpc("style_reservas_apply_from_style", {
    p_company_id: deps.companyId,
    p_accion: accion,
    p_idplan: idNum,
    p_codemp: row ? dbfStr(row, "codemp") : "",
    p_codcli: row ? dbfStr(row, "codcli") : "",
    p_fecha: fecha,
    p_horini: row ? dbfStr(row, "horini") : "",
    p_horfin: row ? dbfStr(row, "horfin") : "",
    p_texto: row ? dbfStr(row, "texto") : "",
    p_codrec: row ? dbfStr(row, "codrec") : "",
    p_nomcli: row ? dbfStr(row, "nomcli") : "",
    p_tel1cli: row ? dbfStr(row, "tel1cli") : "",
    p_facturado: row ? dbfBool(row, "facturado") : false,
    p_servicios: serviciosJsonToLegacy(serviciosJson),
    p_colfon: row ? Number(dbfStr(row, "colfon") || 0) : 0,
    p_collet: row ? Number(dbfStr(row, "collet") || 0) : 0,
    p_style_modified_at: null,
  });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  deps.log(`dbf-poll ${TABLA} idplan=${idplan} -> style_reservas_apply_from_style (${accion})`);
}

const lastMtime = { plan2009: 0, planart: 0 };

/**
 * Detecta cambios en plan2009/planart cuando Style no encola en cola_sincro.
 * Primera pasada: solo siembra huellas (no reimporta historial de citas).
 */
export async function pollPlan2009FromDbf(deps: PollDeps, batch: number): Promise<void> {
  const planPath = resolveDbfPath(deps.styleRoot, "plan2009");
  if (!planPath) return;

  let planMtime = 0;
  let artMtime = 0;
  try {
    planMtime = fs.statSync(planPath).mtimeMs;
    const artPath = resolveDbfPath(deps.styleRoot, "planart");
    if (artPath) artMtime = fs.statSync(artPath).mtimeMs;
  } catch {
    return;
  }

  const known = await loadFingerprintMap(deps);
  const seeded = known.size > 0;
  if (seeded && planMtime === lastMtime.plan2009 && artMtime === lastMtime.planart) return;
  lastMtime.plan2009 = planMtime;
  lastMtime.planart = artMtime;

  const index = await loadDbfIndexed(deps.styleRoot, "plan2009", "idplan");
  const serviciosByPlan = await loadPlanartServiciosIndex(deps.styleRoot);
  const changed: Array<{ key: string; row: DbfRow; fp: string; accion: "UPDATE" | "DELETE" }> = [];
  const allEntries: Array<{ style_key: string; fingerprint: string }> = [];

  for (const [key, row] of index) {
    const normKey = normalizePlanKey(key);
    const serviciosJson = serviciosByPlan.get(normKey) ?? "[]";
    const fp = rowFingerprint(row, serviciosJson);
    allEntries.push({ style_key: normKey, fingerprint: fp });
    if (!seeded) continue;
    if (known.get(normKey) !== fp) changed.push({ key: normKey, row, fp, accion: "UPDATE" });
  }

  if (seeded) {
    const currentKeys = new Set([...index.keys()].map((k) => normalizePlanKey(k)));
    for (const key of known.keys()) {
      if (!currentKeys.has(key)) {
        changed.push({ key, row: null as unknown as DbfRow, fp: "", accion: "DELETE" });
      }
    }
  }

  if (!seeded) {
    await upsertFingerprints(deps, allEntries);
    deps.log(`dbf-poll ${TABLA}: baseline ${allEntries.length} huellas (sin reimportar historial)`);
    return;
  }

  if (!changed.length) return;

  deps.log(`dbf-poll ${TABLA}: ${changed.length} cambio(s) detectado(s)`);
  for (const item of changed.slice(0, batch)) {
    try {
      const serviciosJson = item.accion === "DELETE" ? "[]" : (serviciosByPlan.get(item.key) ?? "[]");
      await applyPlan2009(deps, item.key, item.accion === "DELETE" ? null : item.row, item.accion, serviciosJson);
      if (item.accion === "DELETE") {
        await deps.supabase
          .schema("dunasoft")
          .from("style_sync_dbf_fingerprint")
          .delete()
          .eq("company_id", deps.companyId)
          .eq("tabla", TABLA)
          .eq("style_key", item.key);
      } else {
        await upsertFingerprints(deps, [{ style_key: item.key, fingerprint: item.fp }]);
      }
    } catch (err) {
      deps.log(
        `dbf-poll ${TABLA} idplan=${item.key} error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (changed.length > batch) {
    deps.log(`dbf-poll ${TABLA}: quedan ${changed.length - batch} pendientes (siguiente tick)`);
  }
}
