import { loadDbfFilteredRows, dbfStr, dbfDateIso, styleRowKey } from "./dist/dbfSource.js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { ENTITY_HANDLERS } from "./dist/handlers.js";

globalThis.WebSocket = WebSocket;
const CID = process.env.COMPANY_ID;
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const facturas = ENTITY_HANDLERS.find((h) => h.tabla === "faccab");
const deps = { styleRoot: "/mnt/style", companyId: CID, supabase: sb, colaPath: "", inboundDir: "", inboundAckDir: "", log: () => {} };

const targets = new Set(["1308","1329","1337","1354","1370","1393","1475","1476","1478","1479","1511","1512"]);
const rows = await loadDbfFilteredRows("/mnt/style", "faccab", (r) =>
  dbfStr(r, "ejefac") === "2026" && dbfStr(r, "serfac") === "A" && targets.has(dbfStr(r, "numfac")),
);

let ok = 0, fail = 0;
for (const r of rows) {
  const num = dbfStr(r, "numfac");
  const cola = { id: 0, tabla: "faccab", id_reg: num, accion: "UPD" };
  const args = await facturas.buildArgs(CID, cola, r, deps);
  const { data, error } = await sb.schema("dunasoft").rpc(facturas.rpc, args);
  if (error || data?.ok === false) {
    fail++;
    console.log("FAIL", styleRowKey("faccab", r), error?.message ?? data?.error);
  } else {
    ok++;
    console.log("OK", styleRowKey("faccab", r), dbfDateIso(r, "fecfac"));
  }
}
console.log("done ok", ok, "fail", fail);
