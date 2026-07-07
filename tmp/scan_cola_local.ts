import fs from "node:fs";
import path from "node:path";
import { Dbf } from "dbf-reader";

const ROOT = process.argv[2] ?? "\\\\192.168.99.16\\c$\\Style-Dunasoft";
function find(name: string) {
  for (const p of [path.join(ROOT, name), path.join(ROOT, "dbf", name)]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readDbf(file: string) {
  const buf = fs.readFileSync(file);
  const dt = Dbf.read(buf as unknown as Buffer);
  return dt.rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(r)) o[k.toLowerCase()] = (r as Record<string, unknown>)[k];
    return o;
  });
}

const colaPath = find("cola_sincro.dbf");
if (!colaPath) {
  console.log("cola_sincro.dbf not found");
  process.exit(1);
}
const rows = readDbf(colaPath);
const ids = rows.map((r) => Number(r.id)).filter((n) => !Number.isNaN(n));
const maxId = Math.max(...ids, 0);
const byTabla: Record<string, number> = {};
for (const r of rows) {
  const t = String(r.tabla ?? "").toLowerCase();
  byTabla[t] = (byTabla[t] ?? 0) + 1;
}
console.log("cola_path", colaPath);
console.log("cola_rows", rows.length);
console.log("cola_max_id", maxId);
console.log("last_cola_id_suite", 5);
console.log("cola_gap", maxId - 5);
console.log("by_tabla", byTabla);
const tail = rows.slice(-10);
for (const r of tail) {
  console.log("TAIL", r.id, r.tabla, r.accion, "id_reg=" + r.id_reg, r.fechaiso, r.horini + "-" + r.horfin, r.nomcli);
}
