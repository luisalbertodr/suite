import { loadDbfFilteredRows, dbfStr, dbfDateIso } from "./dist/dbfSource.js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { ENTITY_HANDLERS } from "./dist/handlers.js";

globalThis.WebSocket = WebSocket;
const CID = process.env.COMPANY_ID;
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const handler = ENTITY_HANDLERS.find((h) => h.tabla === "faccab");
const deps = { styleRoot: "/mnt/style", companyId: CID, supabase: sb, colaPath: "", inboundDir: "", inboundAckDir: "", log: console.log };

const rows = await loadDbfFilteredRows("/mnt/style", "faccab", (r) =>
  dbfStr(r, "ejefac") === "2026" && dbfStr(r, "numfac") === "1370" && dbfStr(r, "serfac") === "A",
);
const row = rows[0];
console.log("row", dbfDateIso(row, "fecfac"), row.totfac, dbfStr(row, "codcli"));
const cola = { id: 0, tabla: "faccab", id_reg: "1370", accion: "UPD" };
const args = await handler.buildArgs(CID, cola, row, deps);
console.log("args", JSON.stringify(args, null, 2));
const { data, error } = await sb.schema("dunasoft").rpc(handler.rpc, args);
console.log("rpc", error ?? data);
