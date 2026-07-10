import { loadDbfFilteredRows, dbfStr, dbfDateIso, styleRowKey } from "./dist/dbfSource.js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { ENTITY_HANDLERS } from "./dist/handlers.js";

(globalThis).WebSocket = WebSocket;

const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CID = process.env.COMPANY_ID;
const sb = createClient(process.env.SUPABASE_URL, SR);
const handler = ENTITY_HANDLERS.find((h) => h.tabla === "faccab");
const deps = { styleRoot: "/mnt/style", companyId: CID, supabase: sb, colaPath: "", inboundDir: "", inboundAckDir: "", log: console.log };

const months = ["2026-06", "2026-07"];
const rows = await loadDbfFilteredRows("/mnt/style", "faccab", (r) => {
  if (dbfStr(r, "ejefac") !== "2026" || dbfStr(r, "serfac") === "00") return false;
  const m = dbfDateIso(r, "fecfac")?.slice(0, 7);
  return months.includes(m ?? "");
});

const { data: maps } = await sb.schema("dunasoft").from("style_sync_entity_map")
  .select("style_key").eq("company_id", CID).eq("entity_type", "invoice");
const mapped = new Set((maps ?? []).map((m) => m.style_key));

const missing = [];
for (const r of rows) {
  const ej = dbfStr(r, "ejefac");
  const ser = dbfStr(r, "serfac") || "A";
  const num = dbfStr(r, "numfac");
  const cli = dbfStr(r, "codcli");
  const key = `${ej}/${ser}/${num}/${cli}/${CID}`;
  const short = `${ej}/${ser}/${num}`;
  const has = [...mapped].some((k) => k === key || k.startsWith(`${short}/`));
  if (!has) missing.push({ r, key: styleRowKey("faccab", r), tot: r.totfac, fec: dbfDateIso(r, "fecfac") });
}

console.log("missing_count", missing.length);
let missTot = 0;
for (const m of missing) {
  missTot += Number(m.tot ?? 0);
  console.log(m.key, m.fec, m.tot);
}
console.log("missing_total", missTot.toFixed(2));

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let ok = 0, err = 0;
for (const m of missing) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const cola = { id: 0, tabla: "faccab", id_reg: dbfStr(m.r, "numfac"), accion: "UPD" };
      const args = await handler.buildArgs(CID, cola, m.r, deps);
      if (!args) { console.log("skip no args", m.key); break; }
      const { error } = await sb.schema("dunasoft").rpc(handler.rpc, args);
      if (error) throw error;
      console.log("OK", m.key);
      ok++;
      await sleep(500);
      break;
    } catch (e) {
      if (attempt === 3) {
        console.error("FAIL", m.key, e.message?.slice(0, 120));
        err++;
      } else {
        await sleep(2000 * attempt);
      }
    }
  }
}
console.log("sync_missing ok", ok, "err", err);
