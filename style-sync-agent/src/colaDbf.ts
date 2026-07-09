import fs from "node:fs";
import { parseDbfLayout, readRowFromBuffer, type DbfRow } from "./dbfSource.js";
import { withFsRetry } from "./fsRetry.js";

export type ColaDbfRow = DbfRow & {
  id: number;
  tabla: string;
  id_reg: string;
  accion: string;
  procesado?: boolean;
  creado?: Date | string | null;
};

type ColaReadCache = {
  recordCount: number;
  fileSize: number;
};

let readCache: ColaReadCache = { recordCount: 0, fileSize: 0 };

export function resetColaReadCache(recordCount = 0, fileSize = 0): void {
  readCache = { recordCount, fileSize };
}

function normalizeKeys(row: DbfRow): ColaDbfRow {
  const out: DbfRow = {};
  for (const k of Object.keys(row)) out[k.toLowerCase()] = row[k];
  return out as ColaDbfRow;
}

export type ReadColaFilter = {
  /** Solo filas con id > sinceId (cola plan2009 u otra tabla con cursor único). */
  sinceId?: number;
  /** Una sola tabla (p. ej. plan2009). */
  tabla?: string;
  /** Varias tablas (entidades maestras). */
  tablas?: Set<string>;
};

/**
 * Lee cola_sincro.dbf parseando solo registros nuevos desde el último tick.
 * En el primer arranque o si el fichero se recrea, escanea el histórico una vez.
 */
export async function readColaRows(colaPath: string, filter: ReadColaFilter = {}): Promise<ColaDbfRow[]> {
  return withFsRetry(
    () => {
      if (!fs.existsSync(colaPath)) return [];

      const stat = fs.statSync(colaPath);
      const buf = fs.readFileSync(colaPath);
      const layout = parseDbfLayout(buf);
      const nRecords = layout.nRecords;

      const fileRecreated =
        stat.size < readCache.fileSize || nRecords < readCache.recordCount;
      const startRec =
        !fileRecreated && readCache.recordCount > 0 && nRecords >= readCache.recordCount
          ? readCache.recordCount
          : 0;

      const rows: ColaDbfRow[] = [];
      const tablaFilter = filter.tabla?.trim().toLowerCase();
      const tablasFilter = filter.tablas;
      const sinceId = filter.sinceId ?? 0;

      for (let i = startRec; i < nRecords; i++) {
        const recOff = layout.headerLen + i * layout.recordLen;
        if (buf[recOff] === 0x2a) continue;
        const row = normalizeKeys(readRowFromBuffer(buf, layout, recOff));
        const id = Number(row.id);
        if (!Number.isFinite(id) || id <= sinceId) continue;

        const tabla = String(row.tabla ?? "").trim().toLowerCase();
        if (tablaFilter && tabla !== tablaFilter) continue;
        if (tablasFilter && !tablasFilter.has(tabla)) continue;

        rows.push(row);
      }

      readCache = { recordCount: nRecords, fileSize: stat.size };
      rows.sort((a, b) => Number(a.id) - Number(b.id));
      return rows;
    },
    { label: "read cola_sincro.dbf (tail)" },
  );
}
