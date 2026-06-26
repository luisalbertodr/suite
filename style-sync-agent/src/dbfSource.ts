import fs from "node:fs";
import path from "node:path";
import { Dbf } from "dbf-reader";
import { withFsRetry } from "./fsRetry.js";

/**
 * Lectura de DBFs maestros de Style (clientes, articulos, ...) para enriquecer
 * las notificaciones de cola_sincro. La cola transporta solo (tabla, id_reg, accion);
 * el registro completo se lee del DBF origen, evitando el límite de 254 chars de la cola.
 */

export type DbfRow = Record<string, unknown>;

function normalizeKeys(row: DbfRow): DbfRow {
  const out: DbfRow = {};
  for (const k of Object.keys(row)) out[k.toLowerCase()] = row[k];
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
  keyField: string,
): Promise<Map<string, DbfRow>> {
  const dbfPath = resolveDbfPath(styleRoot, table);
  const index = new Map<string, DbfRow>();
  if (!dbfPath) return index;

  return withFsRetry(
    () => {
      const buf = fs.readFileSync(dbfPath);
      const dt = Dbf.read(buf as unknown as Buffer);
      const key = keyField.toLowerCase();
      for (const raw of dt.rows as unknown as DbfRow[]) {
        if (!raw) continue;
        const row = normalizeKeys(raw);
        const k = String(row[key] ?? "").trim();
        if (!k) continue;
        index.set(normalizeStyleKey(k), row);
      }
      return index;
    },
    { label: `read ${table}.dbf` },
  );
}

/** Normaliza una clave Style numérica ignorando ceros a la izquierda (codcli 000123 == 123). */
export function normalizeStyleKey(key: string): string {
  const t = String(key ?? "").trim();
  if (/^\d+$/.test(t)) return t.replace(/^0+/, "") || "0";
  return t;
}

export function dbfStr(row: DbfRow | null | undefined, field: string): string {
  if (!row) return "";
  const v = row[field.toLowerCase()];
  if (v == null) return "";
  return String(v).trim();
}

export function dbfNum(row: DbfRow | null | undefined, field: string): number {
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

/** Fecha DBF (Date o cadena) → ISO yyyy-mm-dd o null. */
export function dbfDateIso(row: DbfRow | null | undefined, field: string): string | null {
  if (!row) return null;
  const v = row[field.toLowerCase()];
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return null;
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
      const dt = Dbf.read(buf as unknown as Buffer);
      const out: DbfRow[] = [];
      for (const raw of dt.rows as unknown as DbfRow[]) {
        if (!raw) continue;
        const row = normalizeKeys(raw);
        if (predicate(row)) out.push(row);
      }
      return out;
    },
    { label: `read ${table}.dbf filtered` },
  );
}
