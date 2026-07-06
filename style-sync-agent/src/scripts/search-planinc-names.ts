/**
 * Busca clientes en planinc (todo julio 2026 o día concreto).
 */
import "dotenv/config";
import fs from "node:fs";
import { resolveDbfPath } from "../dbfSource.js";
import { Dbf } from "dbf-reader";

const ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const MONTH = process.argv[2] ?? "2026-07";
const DAY = process.argv[3]; // opcional yyyy-mm-dd

function parseLayout(buf: Buffer) {
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const nRecords = buf.readUInt32LE(4);
  let off = 32;
  const fields: Array<{ name: string; flen: number; pos: number }> = [];
  let pos = 1;
  while (buf[off] !== 0x0d) {
    const name = buf.slice(off, off + 11).toString("ascii").replace(/\0/g, "").trim();
    const flen = buf[off + 16];
    fields.push({ name: name.toUpperCase(), flen, pos });
    pos += flen;
    off += 32;
  }
  return { headerLen, recordLen, nRecords, fields };
}

function fp(fields: ReturnType<typeof parseLayout>["fields"], n: string) {
  return fields.find((f) => f.name === n)!;
}

function raw(buf: Buffer, recOff: number, f: { pos: number; flen: number }) {
  return buf.slice(recOff + f.pos, recOff + f.pos + f.flen).toString("ascii").trim();
}

function ymd(buf: Buffer, recOff: number, f: { pos: number; flen: number }) {
  const s = raw(buf, recOff, f).slice(0, 8);
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

const names = process.argv.slice(DAY ? 4 : 3);
const needles = names.length
  ? names.map((n) => n.toLowerCase())
  : ["beatriz casais", "fernanda piccolini", "raquel lema", "milena silva", "loreto", "luis alberto", "tere montoto", "balbina"];

const path = resolveDbfPath(ROOT, "planinc")!;
const buf = fs.readFileSync(path);
const layout = parseLayout(buf);
const dt = Dbf.read(buf as unknown as Buffer);
const F = {
  tip: fp(layout.fields, "TIPINC"),
  idplan: fp(layout.fields, "IDPLAN"),
  fecha: fp(layout.fields, "FECHA"),
  fechax: fp(layout.fields, "FECHAX"),
  horini: fp(layout.fields, "HORINI"),
  horinix: fp(layout.fields, "HORINIX"),
  nomcli: fp(layout.fields, "NOMCLI"),
  nomclix: fp(layout.fields, "NOMCLIX"),
  codemp: fp(layout.fields, "CODEMP"),
  codempx: fp(layout.fields, "CODEMPX"),
};

console.log("root:", ROOT, "month:", MONTH, DAY ? `day:${DAY}` : "");
let ri = 0;
const hits: string[] = [];
for (let i = 0; i < layout.nRecords; i++) {
  const recOff = layout.headerLen + i * layout.recordLen;
  if (buf[recOff] === 0x2a) continue;
  ri++;
  const row = dt.rows[ri - 1];
  if (!row) continue;
  const nom = (raw(buf, recOff, F.nomclix) || raw(buf, recOff, F.nomcli)).toLowerCase();
  if (!needles.some((n) => nom.includes(n))) continue;
  const fecha = ymd(buf, recOff, F.fecha);
  const fechax = ymd(buf, recOff, F.fechax);
  if (DAY) {
    if (fecha !== DAY && fechax !== DAY) continue;
  } else if (!fecha?.startsWith(MONTH) && !fechax?.startsWith(MONTH)) continue;
  const tip = raw(buf, recOff, F.tip).toUpperCase();
  const hor = raw(buf, recOff, F.horinix) || raw(buf, recOff, F.horini);
  const emp = raw(buf, recOff, F.codempx) || raw(buf, recOff, F.codemp);
  hits.push(
    `${tip.padEnd(9)} id=${raw(buf, recOff, F.idplan).padStart(6)} fecha=${fecha ?? "-"} fechax=${fechax ?? "-"} ${hor} emp=${emp} ${nom.slice(0, 45)}`,
  );
}
console.log("hits:", hits.length);
for (const h of hits.slice(0, 50)) console.log(" ", h);
