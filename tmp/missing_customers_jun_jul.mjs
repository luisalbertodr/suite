import { loadDbfFilteredRows, dbfStr, dbfDateIso } from "./dist/dbfSource.js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

globalThis.WebSocket = WebSocket;
const CID = process.env.COMPANY_ID;
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const months = ["2026-06", "2026-07"];

const rows = await loadDbfFilteredRows("/mnt/style", "faccab", (r) => {
  if (dbfStr(r, "ejefac") !== "2026" || dbfStr(r, "serfac") === "00") return false;
  const m = dbfDateIso(r, "fecfac")?.slice(0, 7);
  return months.includes(m ?? "");
});

const codclis = new Set();
for (const r of rows) {
  const cli = dbfStr(r, "codcli");
  if (!cli || cli === "0") continue;
  codclis.add(cli.replace(/^0+/, "") || "0");
}

const { data: maps } = await sb.schema("dunasoft").from("style_sync_entity_map")
  .select("style_key").eq("company_id", CID).eq("entity_type", "customer");
const mapped = new Set((maps ?? []).map((m) => String(m.style_key).replace(/^0+/, "") || "0"));

const missing = [...codclis].filter((c) => !mapped.has(c));
console.log("codclis_invoices", codclis.size, "missing_customers", missing.length);
console.log(missing.slice(0, 30).join(", "));
