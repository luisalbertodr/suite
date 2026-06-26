/**
 * Sincroniza un cliente concreto desde clientes.dbf → Suite (one-shot).
 * Uso: npx tsx scripts/sync-cliente-once.ts 000553
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Dbf } from "dbf-reader";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, "..", ".env") });

const codcli = process.argv[2]?.trim();
if (!codcli) {
  console.error("Uso: npx tsx scripts/sync-cliente-once.ts <codcli>");
  process.exit(1);
}

const styleRoot = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const companyId = process.env.COMPANY_ID!;
const dbfPath = [path.join(styleRoot, "dbf", "clientes.dbf"), path.join(styleRoot, "clientes.dbf")].find((p) =>
  fs.existsSync(p),
);
if (!dbfPath) throw new Error("No se encuentra clientes.dbf");

function str(row: Record<string, unknown>, f: string): string {
  const v = row[f.toLowerCase()];
  return v == null ? "" : String(v).trim();
}

const buf = fs.readFileSync(dbfPath);
const dt = Dbf.read(buf as unknown as Buffer);
let src: Record<string, unknown> | null = null;
const target = codcli.replace(/^0+/, "") || "0";
for (const raw of dt.rows as Record<string, unknown>[]) {
  const row: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) row[k.toLowerCase()] = raw[k];
  const k = str(row, "codcli").replace(/^0+/, "") || "0";
  if (k === target) {
    src = row;
    break;
  }
}
if (!src) throw new Error(`codcli ${codcli} no encontrado en ${dbfPath}`);

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data, error } = await supabase.schema("dunasoft").rpc("style_clientes_apply_from_style", {
  p_company_id: companyId,
  p_accion: "UPSERT",
  p_codcli: str(src, "codcli"),
  p_nomcli: str(src, "nomcli"),
  p_ape1: str(src, "ape1cli"),
  p_tel1: str(src, "tel1cli"),
  p_tel2: str(src, "tel2cli"),
  p_email: str(src, "email"),
  p_dni: str(src, "dnicli"),
  p_dir: str(src, "dircli"),
  p_codpos: str(src, "codposcli"),
  p_pob: str(src, "pobcli"),
  p_pro: str(src, "procli"),
  p_pais: str(src, "pais"),
  p_percon: str(src, "percon"),
  p_obs: str(src, "obscli"),
  p_fecnac: null,
  p_obsoleto: str(src, "obsoleto").toUpperCase() === "SI",
  p_sync_version: 0,
});
if (error) throw error;
console.log(JSON.stringify(data, null, 2));
