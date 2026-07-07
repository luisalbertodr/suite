import fs from "node:fs";
import { normalizePlanKey } from "./plan2009Poll.js";
import { resolveDbfPath, type DbfRow } from "./dbfSource.js";

const PLANINC_MAX_IDS = Number(process.env.PLANINC_MAX_IDS ?? "500");
/** Máximo de BORRAR recientes a considerar (no todo el histórico de planinc). */
const PLANINC_DELETE_MAX = Number(process.env.PLANINC_DELETE_MAX ?? "20");
/** Solo escanear las últimas N filas de planinc (log histórico enorme). */
const PLANINC_TAIL_RECORDS = Number(process.env.PLANINC_TAIL_RECORDS ?? "4000");
/** Últimas filas de plan2009 (CREAR no escribe planinc). */
const PLAN2009_TAIL_RECORDS = Number(process.env.PLAN2009_TAIL_RECORDS ?? "150");

type TailField = { name: string; pos: number; flen: number; type: string };

function readDbfTailRows(styleRoot: string, table: string, tailRecords: number): DbfRow[] {
  const dbfPath = resolveDbfPath(styleRoot, table);
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

function readPlanincTailRows(styleRoot: string, tailRecords: number): DbfRow[] {
  return readDbfTailRows(styleRoot, "planinc", tailRecords);
}

/** idplans al final de plan2009.dbf (altas nuevas de Style). */
export function loadPlan2009TailIdPlans(styleRoot: string): string[] {
  let rows: DbfRow[];
  try {
    rows = readDbfTailRows(styleRoot, "plan2009", PLAN2009_TAIL_RECORDS);
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
  }
  return out;
}

/** Últimos BORRAR en planinc (solo los más recientes; evita re-borrar historial). */
export async function loadRecentPlanincDeletedPlans(styleRoot: string): Promise<Set<string>> {
  let rows: DbfRow[];
  try {
    rows = readPlanincTailRows(styleRoot, PLANINC_TAIL_RECORDS);
  } catch {
    return new Set();
  }

  const out = new Set<string>();
  for (let i = rows.length - 1; i >= 0; i--) {
    const tip = String(rows[i].tipinc ?? rows[i].tip ?? "").trim().toUpperCase();
    if (tip !== "BORRAR") continue;
    const id = normalizePlanKey(String(rows[i].idplan ?? ""));
    if (!id || id === "0") continue;
    out.add(id);
    if (out.size >= PLANINC_DELETE_MAX) break;
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
