/**
 * Cuenta registros en DBFs Style y compara con entity_map (Postgres).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Dbf } from "dbf-reader";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, "..", "style-sync-agent", ".env") });

const STYLE_ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const COMPANY_ID = process.env.COMPANY_ID;

const TABLES = [
  { dbf: "clientes", key: "codcli", entityType: "customer", normalize: true },
  { dbf: "articulos", key: "codart", entityType: "article", normalize: false },
  { dbf: "bonoscli", key: "codboncli", entityType: "bono", normalize: true },
  { dbf: "albcab", key: "numalb", entityType: "sale", normalize: false, composite: ["serie", "seralb"] },
  { dbf: "faccab", key: "numfac", entityType: "invoice", normalize: false, composite: ["serie", "serfac", "codcli"] },
  { dbf: "ciecab", key: "numcie", entityType: "cash_session", normalize: true },
  { dbf: "plan2009", key: "idplan", entityType: null, normalize: true },
];

function resolveDbf(table) {
  for (const sub of ["dbf", ""]) {
    const p = path.join(STYLE_ROOT, sub, `${table}.dbf`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function normKey(key, normalize) {
  const t = String(key ?? "").trim();
  if (!t) return "";
  if (normalize && /^\d+$/.test(t)) return t.replace(/^0+/, "") || "0";
  return t;
}

function rowKey(row, t) {
  if (t.composite) {
    return t.composite.map((f) => String(row[f.toLowerCase()] ?? "").trim()).join("|");
  }
  return normKey(row[t.key.toLowerCase()], t.normalize);
}

function loadDbfKeys(tableDef) {
  const p = resolveDbf(tableDef.dbf);
  if (!p) return { path: null, keys: new Set(), rows: 0, mtime: null };
  const buf = fs.readFileSync(p);
  const dt = Dbf.read(buf);
  const keys = new Set();
  for (const raw of dt.rows) {
    const row = {};
    for (const k of Object.keys(raw)) row[k.toLowerCase()] = raw[k];
    const k = rowKey(row, tableDef);
    if (k && k !== "0" && k !== "|") keys.add(k);
  }
  const st = fs.statSync(p);
  return { path: p, keys, rows: dt.rows.length, mtime: st.mtime.toISOString() };
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function loadMapped(entityType) {
  const { data, error } = await supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key")
    .eq("company_id", COMPANY_ID)
    .eq("entity_type", entityType);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.style_key)));
}

async function loadCursor(tabla) {
  const { data } = await supabase
    .schema("dunasoft")
    .from("style_sync_cursor")
    .select("enabled,dbf_baseline_seeded,last_error")
    .eq("company_id", COMPANY_ID)
    .eq("tabla", tabla)
    .maybeSingle();
  return data;
}

async function loadFpCount(tabla) {
  const { count } = await supabase
    .schema("dunasoft")
    .from("style_sync_dbf_fingerprint")
    .select("*", { count: "exact", head: true })
    .eq("company_id", COMPANY_ID)
    .eq("tabla", tabla);
  return count ?? 0;
}

console.log(`STYLE_ROOT=${STYLE_ROOT}`);
console.log(`COMPANY_ID=${COMPANY_ID}\n`);
console.log("tabla\t\tdbf_rows\tstyle_keys\tmapped\tmissing\tbaseline\tfingerprints\tmtime");
console.log("-".repeat(100));

const missingSamples = {};

for (const t of TABLES) {
  const { path: dbfPath, keys, rows, mtime } = loadDbfKeys(t);
  if (!dbfPath) {
    console.log(`${t.dbf}\t\t(NO DBF)`);
    continue;
  }

  let mapped = new Set();
  if (t.entityType) {
    const rawMapped = await loadMapped(t.entityType);
    mapped = new Set([...rawMapped].map((k) => (t.normalize ? normKey(k, true) : k)));
  }

  const missing = [...keys].filter((k) => !mapped.has(k));
  const cursor = await loadCursor(t.dbf === "plan2009" ? "plan2009" : t.dbf);
  const fpCount = await loadFpCount(t.dbf);

  console.log(
    [
      t.dbf.padEnd(12),
      rows,
      keys.size,
      mapped.size,
      t.entityType ? missing.length : "-",
      cursor?.dbf_baseline_seeded ?? "?",
      fpCount,
      mtime?.slice(0, 19) ?? "",
    ].join("\t"),
  );

  if (missing.length > 0 && missing.length <= 20) {
    missingSamples[t.dbf] = missing;
  } else if (missing.length > 20) {
    missingSamples[t.dbf] = missing.slice(0, 10).concat([`... +${missing.length - 10} more`]);
  }
}

console.log("\n--- Muestras sin mapear (primeros) ---");
for (const [tabla, samples] of Object.entries(missingSamples)) {
  console.log(`${tabla}: ${samples.join(", ")}`);
}

// Agent log tail
const logPath = path.join(here, "..", "style-sync-agent", "agent-run-new.log");
if (fs.existsSync(logPath)) {
  const lines = fs.readFileSync(logPath, "utf8").split(/\r?\n/).slice(-15);
  console.log("\n--- Últimas líneas agente ---");
  lines.forEach((l) => l && console.log(l));
}
