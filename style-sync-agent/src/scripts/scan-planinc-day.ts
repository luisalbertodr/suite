/**
 * Análisis completo de planinc para un día (Style-Suite-Test).
 * Uso: npx tsx src/scripts/scan-planinc-day.ts 2026-07-07
 */
import "dotenv/config";
import fs from "node:fs";
import { resolveDbfPath } from "../dbfSource.js";
import { Dbf } from "dbf-reader";

const ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const DATE = process.argv[2] ?? "2026-07-07";
const MONTH = DATE.slice(0, 7);

type Row = Record<string, unknown>;

function ymdFromRaw(buf: Buffer, pos: number, len: number): string | null {
  const s = buf.slice(pos, pos + len).toString("ascii").trim().slice(0, 8);
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function parseLayout(buf: Buffer) {
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const nRecords = buf.readUInt32LE(4);
  let off = 32;
  const fields: Array<{ name: string; type: string; flen: number; pos: number }> = [];
  let pos = 1;
  while (buf[off] !== 0x0d) {
    const name = buf.slice(off, off + 11).toString("ascii").replace(/\0/g, "").trim();
    const type = String.fromCharCode(buf[off + 11]);
    const flen = buf[off + 16];
    fields.push({ name: name.toUpperCase(), type, flen, pos });
    pos += flen;
    off += 32;
  }
  return { headerLen, recordLen, nRecords, fields };
}

function fieldPos(fields: ReturnType<typeof parseLayout>["fields"], name: string) {
  return fields.find((f) => f.name === name.toUpperCase());
}

function rawStr(buf: Buffer, recOff: number, field: { pos: number; flen: number }) {
  return buf.slice(recOff + field.pos, recOff + field.pos + field.flen).toString("ascii").trim();
}

const path = resolveDbfPath(ROOT, "planinc");
if (!path) throw new Error("planinc.dbf no encontrado en " + ROOT);

console.log("STYLE_ROOT:", ROOT);
console.log("Fecha:", DATE);
console.log("planinc:", path);
console.log("mtime:", fs.statSync(path).mtime.toISOString());

const buf = fs.readFileSync(path);
const layout = parseLayout(buf);
const dt = Dbf.read(buf as unknown as Buffer);

const f = {
  tipinc: fieldPos(layout.fields, "TIPINC")!,
  idplan: fieldPos(layout.fields, "IDPLAN")!,
  idplaninc: fieldPos(layout.fields, "IDPLANINC")!,
  fecha: fieldPos(layout.fields, "FECHA")!,
  fechax: fieldPos(layout.fields, "FECHAX")!,
  horini: fieldPos(layout.fields, "HORINI")!,
  horinix: fieldPos(layout.fields, "HORINIX")!,
  horfin: fieldPos(layout.fields, "HORFIN")!,
  horfinx: fieldPos(layout.fields, "HORFINX")!,
  codemp: fieldPos(layout.fields, "CODEMP")!,
  codempx: fieldPos(layout.fields, "CODEMPX")!,
  nomcli: fieldPos(layout.fields, "NOMCLI")!,
  nomclix: fieldPos(layout.fields, "NOMCLIX")!,
  fechorinc: fieldPos(layout.fields, "FECHORINC")!,
};

let total = 0;
const byTipFechax: Record<string, number> = {};
const byTipFecha: Record<string, number> = {};
const byTipEither: Record<string, number> = {};
const jul2026Fechax = new Map<string, number>();
const jul2026Fecha = new Map<string, number>();
const dayRows: Array<{
  tip: string;
  idplan: string;
  idplaninc: string;
  fecha: string | null;
  fechax: string | null;
  hor: string;
  emp: string;
  nom: string;
}> = [];

const names = ["beatriz", "fernanda", "raquel", "milena", "loreto", "luis alberto", "tere montoto"];
const nameHits: typeof dayRows = [];

let readerIdx = 0;
for (let i = 0; i < layout.nRecords; i++) {
  const recOff = layout.headerLen + i * layout.recordLen;
  if (buf[recOff] === 0x2a) continue;
  total++;
  const raw = dt.rows[readerIdx++] as Row | undefined;
  if (!raw) continue;

  const fecha = ymdFromRaw(buf, recOff + f.fecha.pos, f.fecha.flen);
  const fechax = ymdFromRaw(buf, recOff + f.fechax.pos, f.fechax.flen);
  const tip = rawStr(buf, recOff, f.tipinc).toUpperCase() || "?";
  const idplan = rawStr(buf, recOff, f.idplan);
  const idplaninc = rawStr(buf, recOff, f.idplaninc);
  const hor = rawStr(buf, recOff, f.horinix) || rawStr(buf, recOff, f.horini);
  const emp = rawStr(buf, recOff, f.codempx) || rawStr(buf, recOff, f.codemp);
  const nom = rawStr(buf, recOff, f.nomclix) || rawStr(buf, recOff, f.nomcli);

  if (fechax?.startsWith(MONTH)) jul2026Fechax.set(fechax, (jul2026Fechax.get(fechax) ?? 0) + 1);
  if (fecha?.startsWith(MONTH)) jul2026Fecha.set(fecha, (jul2026Fecha.get(fecha) ?? 0) + 1);

  if (fechax === DATE) byTipFechax[tip] = (byTipFechax[tip] ?? 0) + 1;
  if (fecha === DATE) byTipFecha[tip] = (byTipFecha[tip] ?? 0) + 1;
  if (fechax === DATE || fecha === DATE) {
    byTipEither[tip] = (byTipEither[tip] ?? 0) + 1;
    const row = { tip, idplan, idplaninc, fecha, fechax, hor, emp, nom };
    dayRows.push(row);
    const nomL = nom.toLowerCase();
    if (names.some((n) => nomL.includes(n))) nameHits.push(row);
  }
}

console.log("\nTotal registros planinc (activos):", total);
console.log("\n--- Incidencias que TOCAN el día", DATE, "---");
console.log("Por fechax (destino/nuevo):", byTipFechax, "total", Object.values(byTipFechax).reduce((a, b) => a + b, 0));
console.log("Por fecha (origen/viejo):", byTipFecha, "total", Object.values(byTipFecha).reduce((a, b) => a + b, 0));
console.log("Por fecha O fechax:", byTipEither, "total", dayRows.length);

console.log("\n--- Julio 2026: incidencias por día (fechax) ---");
for (const [d, c] of [...jul2026Fechax.entries()].sort()) console.log(`  ${d}: ${c}`);

console.log("\n--- Julio 2026: incidencias por día (fecha origen) ---");
for (const [d, c] of [...jul2026Fecha.entries()].sort()) console.log(`  ${d}: ${c}`);

console.log(`\n--- Detalle ${DATE} (${dayRows.length} filas) ---`);
for (const r of dayRows.sort((a, b) => a.hor.localeCompare(b.hor))) {
  console.log(
    `  ${r.tip.padEnd(9)} idplan=${r.idplan.padStart(6)} inc=${r.idplaninc} fecha=${r.fecha ?? "-"} fechax=${r.fechax ?? "-"} ${r.hor} emp=${r.emp.padStart(2)} ${r.nom.slice(0, 42)}`,
  );
}

if (nameHits.length) {
  console.log("\n--- Nombres captura en planinc @", DATE, "---");
  for (const r of nameHits) console.log(`  ${r.tip} idplan=${r.idplan} ${r.hor} ${r.nom}`);
}

// Vista efectiva: última incidencia por idplan que deja cita en fechax=DATE
const latest = new Map<string, (typeof dayRows)[0]>();
for (const r of dayRows) {
  const prev = latest.get(r.idplan);
  if (!prev || Number(r.idplaninc) > Number(prev.idplaninc)) latest.set(r.idplan, r);
}
const effective: typeof dayRows = [];
for (const r of latest.values()) {
  if (r.tip === "BORRAR" && r.fecha === DATE) continue;
  if (r.tip === "CREAR" && r.fechax === DATE) effective.push(r);
  else if (r.tip === "MODIFICAR" && r.fechax === DATE) effective.push(r);
  else if (r.tip === "BORRAR" && r.fecha === DATE) {
    /* borrada ese día */
  } else if (r.fechax === DATE) effective.push(r);
}
console.log(`\n--- Vista aproximada desde planinc (última incidencia/idplan, fechax=${DATE}) ---`);
console.log("Citas efectivas:", effective.length);
for (const r of effective.sort((a, b) => a.hor.localeCompare(b.hor))) {
  console.log(`  ${r.tip} idplan=${r.idplan} ${r.hor} emp=${r.emp} ${r.nom.slice(0, 42)}`);
}
