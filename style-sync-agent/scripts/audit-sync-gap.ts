/**
 * Audita Style DBF vs entity_map en Suite.
 * Ejecutar: cd style-sync-agent && npx tsx scripts/audit-sync-gap.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Dbf } from "dbf-reader";
import { normalizeStyleKey, resolveDbfPath } from "../src/dbfSource.js";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, "..", ".env") });

const STYLE_ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const COMPANY_ID = process.env.COMPANY_ID!;

type TableDef = {
  dbf: string;
  entityType: string | null;
  styleKey: (row: Record<string, unknown>) => string;
};

const TABLES: TableDef[] = [
  {
    dbf: "clientes",
    entityType: "customer",
    styleKey: (r) => normalizeStyleKey(String(r.codcli ?? "")),
  },
  {
    dbf: "articulos",
    entityType: "article",
    styleKey: (r) => String(r.codart ?? "").trim(),
  },
  {
    dbf: "bonoscli",
    entityType: "bono",
    styleKey: (r) => normalizeStyleKey(String(r.codboncli ?? "")),
  },
  {
    dbf: "albcab",
    entityType: "sale",
    styleKey: (r) => {
      const serie = String(r.serie ?? r.seralb ?? "").trim();
      const num = String(r.numalb ?? "").trim();
      return serie && num ? `${serie}/${num}` : num;
    },
  },
  {
    dbf: "faccab",
    entityType: "invoice",
    styleKey: (r) => {
      const serie = String(r.serie ?? r.serfac ?? "").trim();
      const num = String(r.numfac ?? "").trim();
      const cli = normalizeStyleKey(String(r.codcli ?? ""));
      return [serie, num, cli].filter(Boolean).join("/");
    },
  },
  {
    dbf: "ciecab",
    entityType: "cash_session",
    styleKey: (r) => normalizeStyleKey(String(r.numcie ?? "")),
  },
  { dbf: "plan2009", entityType: null, styleKey: (r) => normalizeStyleKey(String(r.idplan ?? "")) },
];

function loadDbfKeys(def: TableDef) {
  const dbfPath = resolveDbfPath(STYLE_ROOT, def.dbf);
  if (!dbfPath) return null;
  const dt = Dbf.read(fs.readFileSync(dbfPath) as unknown as Buffer);
  const keys = new Set<string>();
  for (const raw of dt.rows as Record<string, unknown>[]) {
    const row: Record<string, unknown> = {};
    for (const k of Object.keys(raw)) row[k.toLowerCase()] = raw[k];
    const key = def.styleKey(row);
    if (key && key !== "0" && key !== "|") keys.add(key);
  }
  return { path: dbfPath, rows: dt.rows.length, keys, mtime: fs.statSync(dbfPath).mtime.toISOString() };
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function mappedKeys(entityType: string) {
  const { data, error } = await supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key")
    .eq("company_id", COMPANY_ID)
    .eq("entity_type", entityType);
  if (error) throw error;
  const norm = ["customer", "bono", "cash_session"].includes(entityType);
  return new Set(
    (data ?? []).map((r) => {
      const k = String(r.style_key);
      return norm ? normalizeStyleKey(k) : k;
    }),
  );
}

async function cursorRow(tabla: string) {
  const { data } = await supabase
    .schema("dunasoft")
    .from("style_sync_cursor")
    .select("enabled,dbf_baseline_seeded,last_error")
    .eq("company_id", COMPANY_ID)
    .eq("tabla", tabla)
    .maybeSingle();
  return data;
}

async function fpCount(tabla: string) {
  const { count } = await supabase
    .schema("dunasoft")
    .from("style_sync_dbf_fingerprint")
    .select("*", { count: "exact", head: true })
    .eq("company_id", COMPANY_ID)
    .eq("tabla", tabla);
  return count ?? 0;
}

console.log(`STYLE_ROOT=${STYLE_ROOT}\n`);
console.log(
  "tabla\t\tdbf_rows\tkeys\tmapped\tGAP\tbaseline\tfingerprints",
);
console.log("-".repeat(80));

const gaps: Record<string, string[]> = {};

for (const t of TABLES) {
  const loaded = loadDbfKeys(t);
  if (!loaded) {
    console.log(`${t.dbf}\t\t(sin DBF)`);
    continue;
  }
  const mapped = t.entityType ? await mappedKeys(t.entityType) : new Set<string>();
  const missing = [...loaded.keys].filter((k) => !mapped.has(k));
  const cur = await cursorRow(t.dbf);
  const fps = await fpCount(t.dbf);
  console.log(
    [
      t.dbf,
      loaded.rows,
      loaded.keys.size,
      mapped.size,
      t.entityType ? missing.length : "-",
      cur?.dbf_baseline_seeded ?? "?",
      fps,
    ].join("\t"),
  );
  if (missing.length > 0 && missing.length <= 15) gaps[t.dbf] = missing;
  else if (missing.length > 15) gaps[t.dbf] = missing.slice(0, 8).concat([`...+${missing.length - 8}`]);
}

console.log("\nMuestras sin mapear:");
for (const [tabla, s] of Object.entries(gaps)) console.log(`  ${tabla}: ${s.join(", ")}`);
