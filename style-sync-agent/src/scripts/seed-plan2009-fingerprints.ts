/**
 * Siembra huellas plan2009 desde DBF actual (sin reimportar citas).
 * Uso tras corregir parseo de fechas o para evitar backlog masivo en el poll.
 */
import "dotenv/config";
import { loadDbfFilteredRows, loadDbfIndexed, dbfStr } from "../dbfSource.js";
import { createClient } from "@supabase/supabase-js";
import { normalizePlanKey, rowFingerprint, upsertFingerprints } from "../plan2009Poll.js";

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

async function main() {
  console.log("Cargando plan2009 + planart...");
  const index = await loadDbfIndexed(STYLE_ROOT, "plan2009", "idplan");
  const serviciosByPlan = await loadPlanartServiciosIndex();
  const deps = {
    supabase,
    companyId: COMPANY_ID,
    styleRoot: STYLE_ROOT,
    log: (m: string) => console.log(m),
  };

  const entries: Array<{ style_key: string; fingerprint: string }> = [];
  for (const [key, row] of index) {
    const normKey = normalizePlanKey(key);
    const serviciosJson = serviciosByPlan.get(normKey) ?? "[]";
    entries.push({ style_key: normKey, fingerprint: rowFingerprint(row, serviciosJson) });
  }

  console.log(`Siembra ${entries.length} huellas plan2009...`);
  const chunk = 500;
  for (let i = 0; i < entries.length; i += chunk) {
    await upsertFingerprints(deps, entries.slice(i, i + chunk));
    if (i === 0 || (i + chunk) % 5000 === 0) console.log(`  ${Math.min(i + chunk, entries.length)}/${entries.length}`);
  }
  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
