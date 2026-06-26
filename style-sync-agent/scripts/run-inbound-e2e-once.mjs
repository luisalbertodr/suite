import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, "..", ".env") });

const cid = process.env.COMPANY_ID;
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const idplan = 111922;
const root = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const marker = `INBOUND_${Date.now()}`;

const { data: plan } = await s
  .schema("dunasoft")
  .from("plan2009")
  .select("codemp,codcli,nomcli,tel1cli,fecha,horini,horfin,texto,codrec")
  .eq("idplan", idplan)
  .single();

const { data: row, error: insErr } = await s
  .schema("dunasoft")
  .from("style_reservas_queue")
  .insert({
    company_id: cid,
    operation: "update",
    idplan,
    payload: { ...plan, nomcli: "Inbound Test", texto: marker },
  })
  .select("id")
  .single();
if (insErr) throw insErr;

console.log("queued", row.id);
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  if (fs.existsSync(path.join(root, "sync", "inbound", `${row.id}.json`))) {
    console.log("json ok");
    break;
  }
}

const vbs = path.join(root, "run_inbound_worker_hidden.vbs");
if (fs.existsSync(vbs)) {
  execSync(`wscript.exe "${vbs}"`, { stdio: "inherit" });
}

await new Promise((r) => setTimeout(r, 10000));

const ack = path.join(root, "sync", "inbound_ack", `${row.id}.ok`);
console.log("ack", fs.existsSync(ack));
const { data: del } = await s
  .schema("dunasoft")
  .from("style_reservas_queue")
  .select("delivered_at")
  .eq("id", row.id)
  .single();
console.log("delivered", del?.delivered_at ?? "pending");

const { data: st } = await s
  .schema("dunasoft")
  .from("style_sync_agent_state")
  .select("last_inbound_ok_at,inbound_worker_status")
  .eq("company_id", cid)
  .single();
console.log("agent", st);
