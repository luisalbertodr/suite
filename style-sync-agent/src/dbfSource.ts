import fs from "node:fs";
import path from "node:path";
import { withFsRetry } from "./fsRetry.js";

/**
 * Lectura de DBFs maestros de Style (clientes, articulos, ...) para enriquecer
 * las notificaciones de cola_sincro. La cola transporta solo (tabla, id_reg, accion);
 * el registro completo se lee del DBF origen, evitando el límite de 254 chars de la cola.
 */

export type DbfRow = Record<string, unknown>;

/** Campos clave por tabla (VFP puede repetir numfac/numalb por ejercicio y serie). */
export const TABLE_KEY_FIELDS: Record<string, string[]> = {
  plan2009: ["idplan"],
  clientes: ["codcli"],
  articulos: ["codart"],
  bonoscli: ["codboncli"],
  albcab: ["numalb"],
  faccab: ["ejefac", "serfac", "numfac"],
  faclin: ["ejefac", "serfac", "numfac", "linfac"],
  ciecab: ["numcie"],
};

export function styleRowKey(table: string, row: DbfRow): string {
  const fields = TABLE_KEY_FIELDS[table] ?? ["idplan"];
  return fields.map((f) => dbfStr(row, f) || "0").join("/");
}

function tableKeyFields(table: string, keyField?: string): string[] {
  if (keyField) return [keyField];
  return TABLE_KEY_FIELDS[table] ?? ["idplan"];
}

export type DbfLayout = {
  headerLen: number;
  recordLen: number;
  nRecords: number;
  fields: Array<{ name: string; type: string; flen: number; pos: number }>;
};

export function parseDbfLayout(buf: Buffer): DbfLayout {
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const nRecords = buf.readUInt32LE(4);
  let off = 32;
  const fields: DbfLayout["fields"] = [];
  let pos = 1;
  while (buf[off] !== 0x0d) {
    const name = buf.slice(off, off + 11).toString("ascii").replace(/\0/g, "").trim().toUpperCase();
    const type = String.fromCharCode(buf[off + 11]);
    const flen = buf[off + 16];
    fields.push({ name, type, flen, pos });
    pos += flen;
    off += 32;
  }
  return { headerLen, recordLen, nRecords, fields };
}

/** VFP plan2009: campo D como cadena ASCII YYYYMMDD (8 bytes). dbf-reader Date lleva +1 mes. */
export function ymdFromVfpDbfDateRaw(raw: string): string | null {
  const s = raw.trim().slice(0, 8);
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function decodeDbfFieldChars(buf: Buffer, start: number, len: number): string {
  return buf.slice(start, start + len).toString('latin1').replace(/\0/g, '').trim();
}

function readRawFieldAt(buf: Buffer, layout: DbfLayout, recOff: number, fieldName: string): string {
  const field = layout.fields.find((f) => f.name === fieldName.toUpperCase());
  if (!field || buf[recOff] === 0x2a) return "";
  return decodeDbfFieldChars(buf, recOff + field.pos, field.flen);
}

/** Mapa clave compuesta → offset de registro (ej. ejefac|serfac|numfac). */
function buildCompositeKeyOffsetIndex(
  buf: Buffer,
  layout: DbfLayout,
  keyFields: string[],
): Map<string, number> {
  const fields = keyFields.map((name) => layout.fields.find((f) => f.name === name.toUpperCase()));
  if (fields.some((f) => !f)) return new Map();
  const index = new Map<string, number>();
  for (let i = 0; i < layout.nRecords; i++) {
    const recOff = layout.headerLen + i * layout.recordLen;
    if (buf[recOff] === 0x2a) continue;
    const parts = fields.map((field) =>
      decodeDbfFieldChars(buf, recOff + field!.pos, field!.flen),
    );
    index.set(parts.join("/"), recOff);
  }
  return index;
}

export function readRowFromBuffer(buf: Buffer, layout: DbfLayout, recOff: number): DbfRow {
  const row: DbfRow = {};
  for (const field of layout.fields) {
    const raw = decodeDbfFieldChars(buf, recOff + field.pos, field.flen);
    const key = field.name.toLowerCase();
    const trimmed = raw;
    if (field.type === "D") {
      const ymd = ymdFromVfpDbfDateRaw(trimmed);
      if (ymd) {
        row[`${key}_iso`] = ymd;
        row[key] = ymd;
      }
      continue;
    }
    if (field.type === "L") {
      row[key] = ["t", "y", "1"].includes(trimmed.toLowerCase());
      continue;
    }
    if (field.type === "B") {
      const bin = buf.slice(recOff + field.pos, recOff + field.pos + field.flen);
      if (bin.length === 8 && !bin.every((b) => b === 0 || b === 0x20)) {
        const n = bin.readDoubleLE(0);
        row[key] = Number.isFinite(n) ? n : 0;
      } else {
        row[key] = 0;
      }
      continue;
    }
    if (field.type === "N" || field.type === "F") {
      if (!trimmed) {
        row[key] = 0;
      } else {
        const n = Number(trimmed.replace(",", "."));
        row[key] = Number.isFinite(n) ? n : trimmed;
      }
      continue;
    }
    row[key] = trimmed;
  }
  return row;
}

function readDbfRows(buf: Buffer, table = "", keyField?: string): DbfRow[] {
  const layout = parseDbfLayout(buf);
  const out: DbfRow[] = [];
  for (let i = 0; i < layout.nRecords; i++) {
    const recOff = layout.headerLen + i * layout.recordLen;
    if (buf[recOff] === 0x2a) continue;
    const row = readRowFromBuffer(buf, layout, recOff);
    if (table) row._style_table = table;
    out.push(row);
  }
  return out;
}

/** Resuelve la ruta del DBF probando subcarpeta dbf\ y raíz (como hace VFP). */
export function resolveDbfPath(styleRoot: string, table: string): string | null {
  const candidates = [
    path.join(styleRoot, "dbf", `${table}.dbf`),
    path.join(styleRoot, `${table}.dbf`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/** Índice de un DBF maestro por campo clave (en minúsculas, recortado). Cacheable por tick. */
export async function loadDbfIndexed(
  styleRoot: string,
  table: string,
  keyField?: string,
): Promise<Map<string, DbfRow>> {
  const dbfPath = resolveDbfPath(styleRoot, table);
  const index = new Map<string, DbfRow>();
  if (!dbfPath) return index;

  return withFsRetry(
    () => {
      const buf = fs.readFileSync(dbfPath);
      for (const row of readDbfRows(buf, table, keyField)) {
        const k = styleRowKey(table, row);
        if (!k || k === "0" || k === "0/0/0") continue;
        index.set(k, row);
      }
      return index;
    },
    { label: `read ${table}.dbf` },
  );
}

export function lookupDbfRow(
  index: Map<string, DbfRow>,
  table: string,
  idReg: string,
): DbfRow | null {
  const k = idReg.trim();
  if (!k) return null;
  if (index.has(k)) return index.get(k) ?? null;
  const nk = normalizeStyleKey(k);
  for (const [key, row] of index) {
    if (key === nk || key.endsWith(`/${nk}`)) return row;
  }
  return null;
}

/** Clave de mapeo Style invoice (ejefac/serie/numfac/codcli/empresa emisora). */
export function fiscalInvoiceMapKey(
  ejefac: string,
  serfac: string,
  numfac: string,
  codcli: string,
  billingCompanyId: string,
): string {
  const ser = serfac || "A";
  return `${ejefac}/${ser}/${numfac}/${codcli}/${billingCompanyId}`;
}

/** Ejercicios fiscales con facturas serie≠00 en faccab.dbf. */
export async function listDistinctFiscalEjefac(styleRoot: string): Promise<string[]> {
  const rows = await loadDbfFilteredRows(
    styleRoot,
    "faccab",
    (r) => dbfStr(r, "serfac") !== "00",
  );
  const years = new Set<string>();
  for (const r of rows) {
    const y = dbfStr(r, "ejefac");
    if (y) years.add(y);
  }
  return [...years].sort();
}

/**
 * Facturación mensual Style (IVA incl.): suma TOTFAC de faccab con ejefac=año y serfac≠'00'
 * (totfacres en VFP). Coincide con el informe de facturación del programa Style.
 */
export async function sumStyleBillingByMonth(
  styleRoot: string,
  ejefac = String(new Date().getFullYear()),
): Promise<Map<string, number>> {
  const rows = await loadDbfFilteredRows(styleRoot, "faccab", (r) => dbfStr(r, "ejefac") === ejefac);
  const out = new Map<string, number>();
  for (const r of rows) {
    if (dbfStr(r, "serfac") === "00") continue;
    const mes = dbfDateIso(r, "fecfac")?.slice(0, 7);
    if (!mes) continue;
    out.set(mes, (out.get(mes) ?? 0) + dbfNum(r, "totfac"));
  }
  return out;
}

/** Normaliza una clave Style numérica ignorando ceros a la izquierda (codcli 000123 == 123). */
export function normalizeStyleKey(key: string): string {
  const t = String(key ?? "").trim();
  if (/^\d+$/.test(t)) return t.replace(/^0+/, "") || "0";
  return t;
}

/** Clave única para huellas DBF (índice compuesto normalizado). */
export function dbfFingerprintKey(table: string, indexKey: string, row?: DbfRow): string {
  const raw = row ? styleRowKey(table, row) : indexKey;
  if (raw.includes("/")) {
    return raw.split("/").map((p) => normalizeStyleKey(p)).join("/");
  }
  return normalizeStyleKey(raw);
}

/** Identidad factura (ejefac/serie/numfac) para cruzar con entity_map. */
export function invoiceIdentityFromMapKey(styleKey: string): string | null {
  const parts = styleKey.split("/");
  if (parts.length < 3) return null;
  return parts.slice(0, 3).map((p) => normalizeStyleKey(p)).join("/");
}

export function dbfStr(row: DbfRow | null | undefined, field: string): string {
  if (!row) return "";
  const v = row[field.toLowerCase()];
  if (v == null) return "";
  // Registros DBF corruptos (null bytes) rompen Postgres con "unsupported Unicode escape sequence".
  return String(v).replace(/\0/g, "").replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
}

export function dbfNum(row: DbfRow | null | undefined, field: string): number {
  if (!row) return 0;
  const key = field.toLowerCase();
  const direct = row[key];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const s = dbfStr(row, field);
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function dbfBool(row: DbfRow | null | undefined, field: string): boolean {
  if (!row) return false;
  const v = row[field.toLowerCase()];
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return ["1", "t", "true", "y", "s", "si", "x"].includes(s);
}

/** Fecha calendario del campo D de VFP → yyyy-mm-dd (hora local, sin UTC). */
export function dbfDateFromJsDate(v: Date): string {
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, "0");
  const d = String(v.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Fecha DBF → ISO yyyy-mm-dd. Prioriza fecha_iso leída del buffer YYYYMMDD (como VFP). */
export function dbfDateIso(row: DbfRow | null | undefined, field: string): string | null {
  if (!row) return null;
  const f = field.toLowerCase();
  const isoKey = f === "fecha" ? "fecha_iso" : f === "fecnac" ? "fecnac_iso" : `${f}_iso`;
  const patched = row[isoKey];
  if (typeof patched === "string" && /^\d{4}-\d{2}-\d{2}$/.test(patched)) return patched;

  const v = row[f];
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return dbfDateFromJsDate(v);
  }
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{8}$/.test(s)) return ymdFromVfpDbfDateRaw(s);
  return null;
}

/** Lee filas cuya clave (p. ej. idplan) está en `keys` sin indexar el DBF entero en memoria. */
export function loadDbfRowsForKeySet(
  styleRoot: string,
  table: string,
  keyField: string,
  keys: Set<string>,
): Map<string, DbfRow> {
  const out = new Map<string, DbfRow>();
  if (!keys.size) return out;
  const dbfPath = resolveDbfPath(styleRoot, table);
  if (!dbfPath) return out;
  const buf = fs.readFileSync(dbfPath);
  const layout = parseDbfLayout(buf);
  const field = layout.fields.find((f) => f.name === keyField.toUpperCase());
  if (!field) return out;

  const tryRecord = (i: number): void => {
    const recOff = layout.headerLen + i * layout.recordLen;
    if (buf[recOff] === 0x2a) return;
    const rawKey = buf
      .slice(recOff + field.pos, recOff + field.pos + field.flen)
      .toString("ascii")
      .replace(/\0/g, "")
      .trim();
    const normKey = /^\d+$/.test(rawKey) ? rawKey.replace(/^0+/, "") || "0" : rawKey;
    if (!keys.has(normKey) || out.has(normKey)) return;
    out.set(normKey, readRowFromBuffer(buf, layout, recOff));
  };

  // idplans recientes suelen estar al final del DBF — recorrer hacia atrás y parar pronto.
  let remaining = keys.size;
  for (let i = layout.nRecords - 1; i >= 0 && remaining > 0; i--) {
    const before = out.size;
    tryRecord(i);
    if (out.size > before) remaining--;
  }
  if (remaining > 0) {
    for (let i = 0; i < layout.nRecords && remaining > 0; i++) {
      const before = out.size;
      tryRecord(i);
      if (out.size > before) remaining--;
    }
  }
  return out;
}

/** Filas de un DBF que cumplen un predicado (p. ej. líneas de alblin por numalb). */
export async function loadDbfFilteredRows(
  styleRoot: string,
  table: string,
  predicate: (row: DbfRow) => boolean,
): Promise<DbfRow[]> {
  const dbfPath = resolveDbfPath(styleRoot, table);
  if (!dbfPath) return [];

  return withFsRetry(
    () => {
      const buf = fs.readFileSync(dbfPath);
      const out: DbfRow[] = [];
      for (const row of readDbfRows(buf, table)) {
        if (predicate(row)) out.push(row);
      }
      return out;
    },
    { label: `read ${table}.dbf filtered` },
  );
}
