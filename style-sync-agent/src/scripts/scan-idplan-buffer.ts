/** idplan en planinc/plantmp — lectura rápida por buffer */
import fs from "node:fs";
import { resolveDbfPath } from "../dbfSource.js";
import { Dbf } from "dbf-reader";

const ROOT = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const IDPLAN = process.argv[2] ?? "112190";

function scan(table: string) {
  const path = resolveDbfPath(ROOT, table);
  if (!path) return;
  const buf = fs.readFileSync(path);
  let off = 32;
  const fields: Array<{ n: string; pos: number; flen: number; type: string }> = [];
  let pos = 1;
  while (buf[off] !== 0x0d) {
    const n = buf.slice(off, off + 11).toString("ascii").replace(/\0/g, "").trim();
    fields.push({ n, pos, flen: buf[off + 16], type: String.fromCharCode(buf[off + 11]) });
    pos += buf[off + 16];
    off += 32;
  }
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const nRec = buf.readUInt32LE(4);
  const idf = fields.find((f) => f.n === "IDPLAN");
  if (!idf) {
    console.log(table, "sin IDPLAN");
    return;
  }
  const dt = Dbf.read(buf as unknown as Buffer);
  let ri = 0;
  let hits = 0;
  for (let i = 0; i < nRec; i++) {
    const recOff = headerLen + i * recordLen;
    if (buf[recOff] === 0x2a) continue;
    const id = buf.slice(recOff + idf.pos, recOff + idf.pos + idf.flen).toString("ascii").trim();
    if (id !== IDPLAN) {
      ri++;
      continue;
    }
    hits++;
    const parts: string[] = [];
    for (const f of fields) {
      let v = buf.slice(recOff + f.pos, recOff + f.pos + f.flen).toString("ascii").trim();
      if (f.type === "D" && /^\d{8}/.test(v)) v = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
      if (v) parts.push(`${f.n}=${v.slice(0, 40)}`);
    }
    console.log(`\n${table} hit #${hits} rec=${i + 1}`);
    console.log(parts.join(" | "));
    ri++;
  }
  console.log(`\n${table}: ${hits} filas con idplan=${IDPLAN}`);
}

console.log("ROOT", ROOT, "idplan", IDPLAN);
scan("planinc");
scan("plantmp");
scan("plan2009");
