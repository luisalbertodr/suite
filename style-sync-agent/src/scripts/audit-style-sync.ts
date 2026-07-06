/**
 * Audita coincidencia Style DBF ↔ Suite para todas las entidades sincronizadas.
 * Uso: npm run build && node dist/scripts/audit-style-sync.js
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  dbfDateIso,
  dbfNum,
  dbfStr,
  loadDbfIndexed,
  normalizeStyleKey,
  type DbfRow,
} from "../dbfSource.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type AuditSpec = {
  label: string;
  table: string;
  keyField: string;
  entityType: string;
  sampleFields: Array<{ dbf: string; suite: (r: Record<string, unknown>) => unknown; label: string }>;
  dateField?: string;
};

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return String(v);
  return String(v).slice(0, 40);
}

async function loadSuiteMaps(entityType: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key,suite_id")
    .eq("company_id", COMPANY_ID)
    .eq("entity_type", entityType);
  if (error) throw error;
  const out = new Map<string, string>();
  for (const row of data ?? []) {
    out.set(normalizeStyleKey(String(row.style_key)), String(row.suite_id));
  }
  return out;
}

async function auditEntity(spec: AuditSpec): Promise<void> {
  console.log(`\n=== ${spec.label} (${spec.table}) ===`);
  const index = await loadDbfIndexed(STYLE_ROOT, spec.table, spec.keyField);
  const mapped = await loadSuiteMaps(spec.entityType);
  console.log(`DBF: ${index.size} | Mapeados en Suite: ${mapped.size}`);

  let missingInSuite = 0;
  let dateMismatches = 0;
  const samples: string[] = [];

  for (const [key, row] of index) {
    if (!mapped.has(key)) {
      missingInSuite++;
      if (missingInSuite <= 3) samples.push(`  sin mapear: ${key} ${dbfStr(row, "nomcli") || dbfStr(row, "desart") || ""}`);
      continue;
    }
    if (spec.dateField) {
      const dbfDate = dbfDateIso(row, spec.dateField);
      if (!dbfDate) continue;
      // Comparación por conteo de fechas recientes en muestra
    }
  }

  // Conteo por fecha (jul 2026) si aplica
  if (spec.dateField) {
    const jul = [...index.values()].filter((r) => dbfDateIso(r, spec.dateField!) === "2026-07-02");
    console.log(`DBF 2026-07-02: ${jul.length} registros`);
    if (jul.length > 0) {
      const sample = jul[0];
      const k = normalizeStyleKey(String(sample[spec.keyField.toLowerCase()] ?? ""));
      console.log(`  muestra DBF: key=${k} fecha=${dbfDateIso(sample, spec.dateField!)}`);
    }
  }

  // Cliente Luisa
  if (spec.table === "clientes") {
    const luisa = [...index.values()].find(
      (r) => normalizeStyleKey(dbfStr(r, "codcli")) === "8201",
    );
    if (luisa) {
      console.log(
        `Luisa (8201) DBF: fecnac=${dbfDateIso(luisa, "fecnac")} nom=${dbfStr(luisa, "nomcli")} ${dbfStr(luisa, "ape1cli")}`,
      );
      const { data } = await supabase
        .from("customers")
        .select("birth_date,name,phone,email,legacy_codcli")
        .eq("company_id", COMPANY_ID)
        .ilike("name", "%Luisa%Garcia%")
        .limit(3);
      if (data?.length) {
        for (const c of data) {
          console.log(`Luisa Suite: legacy=${c.legacy_codcli} birth_date=${c.birth_date} name=${c.name}`);
          const dbfBirth = dbfDateIso(luisa, "fecnac");
          if (dbfBirth && c.birth_date && dbfBirth !== c.birth_date) {
            console.log(`  ⚠ fecnac NO coincide (Suite=${c.birth_date} DBF=${dbfBirth})`);
            dateMismatches++;
          } else if (dbfBirth === c.birth_date) {
            console.log(`  ✓ fecnac coincide`);
          }
        }
      } else {
        console.log("  ⚠ Luisa no encontrada en Suite");
      }
    }
  }

  if (missingInSuite > 0) {
    console.log(`Sin mapear: ${missingInSuite} (primeros mostrados arriba)`);
  } else {
    console.log("Todos los registros DBF tienen mapeo en Suite");
  }
}

async function auditSalesInvoices(): Promise<void> {
  console.log("\n=== Ventas albcab (jul 2026) ===");
  const index = await loadDbfIndexed(STYLE_ROOT, "albcab", "numalb");
  const jul2 = [...index.values()].filter((r) => dbfDateIso(r, "fecha") === "2026-07-02");
  console.log(`DBF 2026-07-02: ${jul2.length} albaranes`);

  const { count: suiteJul, error: e1 } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("company_id", COMPANY_ID)
    .gte("created_at", "2026-07-02")
    .lt("created_at", "2026-07-03");
  if (e1) throw e1;
  console.log(`Suite created_at 2026-07-02: ${suiteJul ?? 0} ventas`);

  let wrongDate = 0;
  const jul2Mapped = jul2.filter((r) => dbfStr(r, "numalb"));
  for (const row of jul2Mapped.slice(0, 50)) {
    const numalb = dbfStr(row, "numalb");
    const serie = dbfStr(row, "serie") || dbfStr(row, "seralb") || "0";
    const ticket = `STY-${serie}-${numalb}`;
    const dbfDate = dbfDateIso(row, "fecha");
    const { data } = await supabase
      .from("sales")
      .select("created_at,total_amount")
      .eq("company_id", COMPANY_ID)
      .eq("ticket_number", ticket)
      .maybeSingle();
    if (!data) continue;
    const suiteDate = String(data.created_at ?? "").slice(0, 10);
    if (dbfDate && suiteDate !== dbfDate) wrongDate++;
  }
  if (jul2.length > 0) {
    console.log(`Muestra 50: fechas distintas en Suite = ${wrongDate}`);
  }

  console.log("\n=== Facturas faccab (jul 2026) ===");
  const fac = await loadDbfIndexed(STYLE_ROOT, "faccab", "numfac");
  const facJul2 = [...fac.values()].filter((r) => dbfDateIso(r, "fecfac") === "2026-07-02");
  const facJul3 = [...fac.values()].filter((r) => dbfDateIso(r, "fecfac") === "2026-07-03");
  console.log(`DBF fecfac 2026-07-02: ${facJul2.length} | 2026-07-03: ${facJul3.length}`);

  const { count: invJul2 } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("company_id", COMPANY_ID)
    .eq("issue_date", "2026-07-02");
  const { count: invJul3 } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("company_id", COMPANY_ID)
    .eq("issue_date", "2026-07-03");
  console.log(`Suite issue_date 2026-07-02: ${invJul2 ?? 0} | 2026-07-03: ${invJul3 ?? 0}`);

  // Facturas del 3 jul (actividad reciente Style)
  const facJul3rows = facJul3;
  if (facJul3rows.length > 0) {
    const r = facJul3rows[facJul3rows.length - 1];
    const num = dbfStr(r, "numfac");
    const serie = dbfStr(r, "serie") || dbfStr(r, "serfac") || "";
    const key = `${serie}/${num}`;
    const { data: map } = await supabase
      .schema("dunasoft")
      .from("style_sync_entity_map")
      .select("suite_id")
      .eq("company_id", COMPANY_ID)
      .eq("entity_type", "invoice")
      .eq("style_key", num)
      .maybeSingle();
    let inv = null;
    if (map?.suite_id) {
      const { data } = await supabase
        .from("invoices")
        .select("issue_date,total_amount,number")
        .eq("id", map.suite_id)
        .maybeSingle();
      inv = data;
    }
    console.log(
      `  fac ${num}: DBF=${dbfDateIso(r, "fecfac")} Suite=${inv?.issue_date ?? "sin mapeo"} total DBF=${dbfNum(r, "totfac")}`,
    );
  }

  const f1474 = fac.get("1474");
  if (f1474) {
    const { data: map } = await supabase
      .schema("dunasoft")
      .from("style_sync_entity_map")
      .select("suite_id")
      .eq("company_id", COMPANY_ID)
      .eq("entity_type", "invoice")
      .eq("style_key", "1474")
      .maybeSingle();
    let issue = "—";
    if (map?.suite_id) {
      const { data } = await supabase.from("invoices").select("issue_date").eq("id", map.suite_id).maybeSingle();
      issue = data?.issue_date ?? "—";
    }
    console.log(`  fac 1474: DBF=${dbfDateIso(f1474, "fecfac")} Suite=${issue}`);
  }
}

async function main(): Promise<void> {
  console.log("Auditoría Style ↔ Suite");
  console.log(`STYLE_ROOT=${STYLE_ROOT}`);

  const { data: cursors } = await supabase
    .schema("dunasoft")
    .from("style_sync_cursor")
    .select("tabla,enabled,dbf_baseline_seeded")
    .eq("company_id", COMPANY_ID);
  console.log("\nCursors:", cursors?.map((c) => `${c.tabla}:${c.enabled ? "on" : "off"}:${c.dbf_baseline_seeded ? "seeded" : "pending"}`).join(", "));

  await auditEntity({
    label: "Clientes",
    table: "clientes",
    keyField: "codcli",
    entityType: "customer",
    sampleFields: [],
    dateField: "fecnac",
  });

  await auditEntity({
    label: "Artículos",
    table: "articulos",
    keyField: "codart",
    entityType: "article",
    sampleFields: [],
  });

  await auditEntity({
    label: "Bonos",
    table: "bonoscli",
    keyField: "codboncli",
    entityType: "bono",
    sampleFields: [],
    dateField: "fecha",
  });

  await auditSalesInvoices();

  await auditEntity({
    label: "Cierres caja",
    table: "ciecab",
    keyField: "numcie",
    entityType: "cash_session",
    sampleFields: [],
    dateField: "feccie",
  });

  console.log("\n=== plan2009 (citas) ===");
  const plan = await loadDbfIndexed(STYLE_ROOT, "plan2009", "idplan");
  const jul2 = [...plan.values()].filter((r) => dbfDateIso(r, "fecha") === "2026-07-02");
  console.log(`DBF 2026-07-02: ${jul2.length} citas`);
  const luisa = plan.get("111755");
  if (luisa) console.log(`Luisa 111755 DBF: ${dbfDateIso(luisa, "fecha")} ${dbfStr(luisa, "horini")}`);

  const { data: luisaPlan } = await supabase
    .schema("dunasoft")
    .from("plan2009")
    .select("fecha,horini,nomcli")
    .eq("idplan", 111755)
    .maybeSingle();
  console.log(`Luisa Suite plan2009: ${luisaPlan?.fecha} ${luisaPlan?.horini} ${luisaPlan?.nomcli}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
