import fs from "node:fs";
import { normalizePlanKey } from "./plan2009Poll.js";
import { resolveDbfPath, type DbfRow } from "./dbfSource.js";

const PLANINC_MAX_IDS = Number(process.env.PLANINC_MAX_IDS ?? "500");
/** Solo escanear las últimas N filas de planinc (log histórico enorme). */
const PLANINC_TAIL_RECORDS = Number(process.env.PLANINC_TAIL_RECORDS ?? "4000");

type TailField = { name: string; pos: number; flen: number; type: string };

function readPlanincTailRows(styleRoot: string, tailRecords: number): DbfRow[] {
  const dbfPath = resolveDbfPath(styleRoot, "planinc");
  if (!dbfPath) return [];

  const buf = fs.readFileSync(dbfPath);
  let off = 32;
  const fields: TailField[] = [];
  let pos = 1;
  while (buf[off] !== 0x0d) {
    const name = buf.slice(off, off + 11).toString("ascii").replace(/\0/g, "").trim().toLowerCase();
    const type = String.fromCharCode(buf[off + 11]);
    const flen = buf[off + 16];
    fields.push({ name, pos, flen, type });
    pos += flen;
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
      if (!raw) continue;
      row[f.name] = raw;
    }
    out.push(row);
  }
  return out;
}

/** idplans con incidencias recientes en planinc (últimas filas del log), más recientes primero. */
export async function loadRecentPlanincIdPlans(styleRoot: string): Promise<string[]> {
  let rows: DbfRow[];
  try {
    rows = readPlanincTailRows(styleRoot, PLANINC_TAIL_RECORDS);
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const id = normalizePlanKey(String(rows[i].idplan ?? ""));
    if (!id || id === "0" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= PLANINC_MAX_IDS) break;
  }
  return out;
}
