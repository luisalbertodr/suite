import { loadDbfIndexed, dbfStr, lookupDbfRow } from "./dist/dbfSource.js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { ENTITY_HANDLERS } from "./dist/handlers.js";

globalThis.WebSocket = WebSocket;
const CID = process.env.COMPANY_ID;
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const clientes = ENTITY_HANDLERS.find((h) => h.tabla === "clientes");
const facturas = ENTITY_HANDLERS.find((h) => h.tabla === "faccab");
const deps = { styleRoot: "/mnt/style", companyId: CID, supabase: sb, colaPath: "", inboundDir: "", inboundAckDir: "", log: () => {} };

const needCli = new Set(["8196","8201","8256","8259","8260","8257","8262"]);
const idx = await loadDbfIndexed("/mnt/style", "clientes", "codcli");

for (const cod of needCli) {
  const row = lookupDbfRow(idx, "clientes", cod) ?? lookupDbfRow(idx, "clientes", cod.padStart(6, "0"));
  if (!row) { console.log("NO_DBF", cod); continue; }
  const cola = { id: 0, tabla: "clientes", id_reg: dbfStr(row, "codcli"), accion: "UPD" };
  const args = await clientes.buildArgs(CID, cola, row, deps);
  const { data, error } = await sb.schema("dunasoft").rpc(clientes.rpc, args);
  console.log("cli", cod, error?.message ?? data?.ok ?? data);
}

// Renombrar facturas canceladas 2025 que bloquean números julio 2026
const renames = [
  ["A-1475","A-2025-1475-orphan"],
  ["A-1476","A-2025-1476-orphan"],
  ["A-1478","A-2025-1478-orphan"],
  ["A-1479","A-2025-1479-orphan"],
  ["A-1511","A-2025-1511-orphan"],
];
for (const [oldN, newN] of renames) {
  const { error } = await sb.from("invoices").update({ number: newN })
    .eq("company_id", CID).eq("number", oldN).eq("status", "cancelled");
  console.log("rename", oldN, error?.message ?? "ok");
}

const months = ["2026-06", "2026-07"];
const { loadDbfFilteredRows, dbfDateIso, styleRowKey } = await import("./dist/dbfSource.js");
const rows = await loadDbfFilteredRows("/mnt/style", "faccab", (r) => {
  if (dbfStr(r, "ejefac") !== "2026" || dbfStr(r, "serfac") === "00") return false;
  const m = dbfDateIso(r, "fecfac")?.slice(0, 7);
  return months.includes(m ?? "");
});

const { data: maps } = await sb.schema("dunasoft").from("style_sync_entity_map")
  .select("style_key").eq("company_id", CID).eq("entity_type", "invoice");
const mapped = new Set((maps ?? []).map((m) => m.style_key));

let ok = 0, fail = 0, skip = 0;
for (const r of rows) {
  const ej = dbfStr(r, "ejefac");
  const ser = dbfStr(r, "serfac") || "A";
  const num = dbfStr(r, "numfac");
  const cli = dbfStr(r, "codcli");
  const key = `${ej}/${ser}/${num}/${cli}/${CID}`;
  const short = `${ej}/${ser}/${num}`;
  const has = [...mapped].some((k) => k === key || k.startsWith(`${short}/`));
  if (has) { skip++; continue; }
  const cola = { id: 0, tabla: "faccab", id_reg: num, accion: "UPD" };
  const args = await facturas.buildArgs(CID, cola, r, deps);
  if (!args) continue;
  const { data, error } = await sb.schema("dunasoft").rpc(facturas.rpc, args);
  if (error || data?.ok === false) {
    fail++;
    if (fail <= 15) console.log("FAIL", styleRowKey("faccab", r), error?.message ?? data?.error);
  } else {
    ok++;
    if (ok <= 5 || ok % 20 === 0) console.log("OK", styleRowKey("faccab", r), data?.total ?? "");
  }
}
console.log("invoices ok", ok, "fail", fail, "skip", skip);
