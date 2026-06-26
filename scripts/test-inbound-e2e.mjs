import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(repoRoot, "style-sync-agent", ".env") });

const cid = process.env.COMPANY_ID;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
if (!cid || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables en style-sync-agent/.env");
}

const idplan = 111922;
const root = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";

const marker = `INBOUND_TEST_${Date.now()}`;
const { data: plan, error: planErr } = await supabase
  .schema("dunasoft")
  .from("plan2009")
  .select("codemp,codcli,nomcli,tel1cli,fecha,horini,horfin,texto,codrec")
  .eq("idplan", idplan)
  .single();
if (planErr) throw planErr;

const { data: row, error: insErr } = await supabase
  .schema("dunasoft")
  .from("style_reservas_queue")
  .insert({ company_id: cid, operation: "update", idplan, payload: { ...plan, texto: marker } })
  .select("id")
  .single();
if (insErr) throw insErr;

console.log("queued", row.id);
for (let i = 0; i < 25; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  if (fs.existsSync(path.join(root, "sync", "inbound", `${row.id}.json`))) {
    console.log("json ok");
    break;
  }
}

const vbs = path.join(root, "run_inbound_worker_hidden.vbs");
if (fs.existsSync(vbs)) execSync(`wscript.exe "${vbs}"`, { stdio: "inherit" });

const ack = path.join(root, "sync", "inbound_ack", `${row.id}.ok`);
console.log("ack", fs.existsSync(ack));
const { data: del } = await supabase
  .schema("dunasoft")
  .from("style_reservas_queue")
  .select("delivered_at")
  .eq("id", row.id)
  .single();
console.log("delivered", del?.delivered_at);
