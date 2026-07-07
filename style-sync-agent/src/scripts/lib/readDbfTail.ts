import fs from "node:fs";
import { resolveDbfPath, type DbfRow } from "../../dbfSource.js";

type TailField = { name: string; pos: number; flen: number };

export function readDbfTailRows(styleRoot: string, table: string, tailRecords: number): DbfRow[] {
  const dbfPath = resolveDbfPath(styleRoot, table);
  if (!dbfPath) return [];

  const buf = fs.readFileSync(dbfPath);
  let off = 32;
  const fields: TailField[] = [];
  let pos = 1;
  while (buf[off] !== 0x0d) {
    const name = buf.slice(off, off + 11).toString("ascii").replace(/\0/g, "").trim().toLowerCase();
    fields.push({ name, pos, flen: buf[off + 16] });
    pos += buf[off + 16];
    off += 32;
  }

  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const nRecords = buf.readUInt32LE(4);
  const startRec = Math.max(0, nRecords - tailRecords);
  const out: DbfRow[] = [];

  for (let i = startRec; i < nRecords; i++) {
    const recOff = headerLen + i * recordLen;
    if (buf[recOff] === 0x2a) continue;
    const row: DbfRow = {};
    for (const f of fields) {
      const raw = buf.slice(recOff + f.pos, recOff + f.pos + f.flen).toString("ascii").replace(/\0/g, "").trim();
      if (raw) row[f.name] = raw;
    }
    out.push(row);
  }
  return out;
}
