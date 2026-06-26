import {
  dbfBool,
  dbfDateIso,
  dbfNum,
  dbfStr,
  loadDbfFilteredRows,
  normalizeStyleKey,
  type DbfRow,
} from "./dbfSource.js";
import type { EntityEngineDeps, EntityHandler } from "./entitySync.js";

const DEL_ACTIONS = new Set(["DEL", "BAJA", "BOR", "BORRAR", "DELETE"]);

function isDelete(accion: string): boolean {
  return DEL_ACTIONS.has(accion.toUpperCase());
}

function syncVersionFrom(cola: { modif?: unknown }, src: DbfRow | null): number {
  const modif = dbfStr(src, "modif") || String(cola.modif ?? "").trim();
  if (/^\d+$/.test(modif)) return Number(modif);
  const n = Number(modif);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : Date.now();
}

function lineMatchesKey(row: DbfRow, field: string, key: string): boolean {
  const raw = dbfStr(row, field);
  if (!raw) return false;
  if (/^\d+$/.test(raw) && /^\d+$/.test(key)) {
    return normalizeStyleKey(raw) === normalizeStyleKey(key);
  }
  return raw === key.trim();
}

async function alblinJson(deps: EntityEngineDeps | undefined, numalb: string): Promise<string> {
  if (!deps) return "[]";
  const lines = await loadDbfFilteredRows(deps.styleRoot, "alblin", (row) =>
    lineMatchesKey(row, "numalb", numalb),
  );
  return JSON.stringify(
    lines.map((ln) => ({
      codart: dbfStr(ln, "codart"),
      desart: dbfStr(ln, "desart"),
      cantidad: dbfNum(ln, "cant") || dbfNum(ln, "cantidad") || 1,
      precio: dbfNum(ln, "preven") || dbfNum(ln, "precio"),
      total: dbfNum(ln, "subtot") || dbfNum(ln, "total"),
    })),
  );
}

async function faclinJson(
  deps: EntityEngineDeps | undefined,
  numfac: string,
  serie: string,
  ejefac?: string,
): Promise<string> {
  if (!deps) return "[]";
  const lines = await loadDbfFilteredRows(deps.styleRoot, "faclin", (row) => {
    if (!lineMatchesKey(row, "numfac", numfac)) return false;
    if (serie && dbfStr(row, "serfac") && dbfStr(row, "serfac") !== serie) return false;
    if (ejefac && dbfStr(row, "ejefac") && dbfStr(row, "ejefac") !== ejefac) return false;
    return true;
  });
  return JSON.stringify(
    lines.map((ln) => ({
      codart: dbfStr(ln, "codart"),
      desart: dbfStr(ln, "desart"),
      cantidad: dbfNum(ln, "cant") || 1,
      precio: dbfNum(ln, "preven"),
      subtot: dbfNum(ln, "subtot"),
      iva: dbfNum(ln, "subtot") * (dbfNum(ln, "taniva") / 100),
      total: dbfNum(ln, "subtot") * (1 + dbfNum(ln, "taniva") / 100),
    })),
  );
}

/** Style→Suite: clientes.dbf → public.customers (Fase 1). */
const clientesHandler: EntityHandler = {
  entityType: "customer",
  tabla: "clientes",
  source: { table: "clientes", keyField: "codcli" },
  rpc: "style_clientes_apply_from_style",
  buildArgs(companyId, cola, src) {
    const codcli = normalizeStyleKey(cola.id_reg);
    if (!codcli || codcli === "0") return null;
    const accion = isDelete(cola.accion) ? "DELETE" : "UPSERT";
    if (accion === "UPSERT" && !src) return null;
    return {
      p_company_id: companyId,
      p_accion: accion,
      p_codcli: cola.id_reg.trim(),
      p_nomcli: dbfStr(src, "nomcli"),
      p_ape1: dbfStr(src, "ape1cli"),
      p_tel1: dbfStr(src, "tel1cli"),
      p_tel2: dbfStr(src, "tel2cli"),
      p_email: dbfStr(src, "email"),
      p_dni: dbfStr(src, "dnicli"),
      p_dir: dbfStr(src, "dircli"),
      p_codpos: dbfStr(src, "codposcli"),
      p_pob: dbfStr(src, "pobcli"),
      p_pro: dbfStr(src, "procli"),
      p_pais: dbfStr(src, "pais"),
      p_percon: dbfStr(src, "percon"),
      p_obs: dbfStr(src, "obscli"),
      p_fecnac: dbfDateIso(src, "fecnac"),
      p_obsoleto: dbfBool(src, "obsoleto"),
      p_sync_version: syncVersionFrom(cola, src),
    };
  },
  toInboundJson(row) {
    const p = row.payload ?? {};
    return {
      entity_type: "customer",
      operation: row.operation,
      codcli: String(row.style_key ?? p["codcli"] ?? ""),
      nomcli: String(p["nomcli"] ?? ""),
      ape1cli: String(p["ape1cli"] ?? ""),
      tel1cli: String(p["tel1cli"] ?? ""),
      tel2cli: String(p["tel2cli"] ?? ""),
      email: String(p["email"] ?? ""),
      dnicli: String(p["dnicli"] ?? ""),
      dircli: String(p["dircli"] ?? ""),
      codposcli: String(p["codposcli"] ?? ""),
      pobcli: String(p["pobcli"] ?? ""),
      procli: String(p["procli"] ?? ""),
      pais: String(p["pais"] ?? ""),
      percon: String(p["percon"] ?? ""),
      obscli: String(p["obscli"] ?? ""),
      fecnac: String(p["fecnac"] ?? ""),
      obsoleto: p["obsoleto"] ? "SI" : "NO",
      sync_version: p["sync_version"] ?? 0,
    };
  },
};

/** Style→Suite: articulos.dbf → public.articles (Fase 2). */
const articulosHandler: EntityHandler = {
  entityType: "article",
  tabla: "articulos",
  source: { table: "articulos", keyField: "codart" },
  rpc: "style_articulos_apply_from_style",
  buildArgs(companyId, cola, src) {
    const codart = cola.id_reg.trim();
    if (!codart) return null;
    const accion = isDelete(cola.accion) ? "DELETE" : "UPSERT";
    if (accion === "UPSERT" && !src) return null;
    return {
      p_company_id: companyId,
      p_accion: accion,
      p_codart: codart,
      p_desart: dbfStr(src, "desart"),
      p_familia1: dbfStr(src, "familia1"),
      p_tipart: dbfStr(src, "tipart"),
      p_coste: dbfNum(src, "coste"),
      p_pvpa: dbfNum(src, "pvpa"),
      p_stock: dbfNum(src, "stock"),
      p_iva: dbfNum(src, "ivaart"),
      p_tiempo: dbfNum(src, "tiempo"),
      p_obsoleto: dbfBool(src, "obsoleto"),
      p_foto: dbfStr(src, "foto"),
      p_sync_version: syncVersionFrom(cola, src),
    };
  },
};

/** Style→Suite: bonoscli.dbf → public.bonos (Fase 3). */
const bonosHandler: EntityHandler = {
  entityType: "bono",
  tabla: "bonoscli",
  source: { table: "bonoscli", keyField: "codboncli" },
  rpc: "style_bonos_apply_from_style",
  buildArgs(companyId, cola, src) {
    const codboncli = cola.id_reg.trim();
    if (!codboncli) return null;
    const accion = isDelete(cola.accion) ? "DELETE" : "UPSERT";
    if (accion === "UPSERT" && !src) return null;
    return {
      p_company_id: companyId,
      p_accion: accion,
      p_codboncli: codboncli,
      p_codcli: dbfStr(src, "codcli"),
      p_codbon: dbfStr(src, "codbon"),
      p_desbon: dbfStr(src, "desbon"),
      p_sesiones: dbfNum(src, "sesiones"),
      p_consumidas: dbfNum(src, "consumi") || dbfNum(src, "consumidas"),
      p_importe: dbfNum(src, "importe"),
      p_fecha: dbfDateIso(src, "fecha"),
      p_fecaducidad: dbfDateIso(src, "fecadu") || dbfDateIso(src, "fecaducidad"),
      p_obsoleto: dbfBool(src, "obsoleto"),
      p_sync_version: syncVersionFrom(cola, src),
    };
  },
};

/** Style→Suite: albcab.dbf → public.sales (Fase 4). */
const ventasHandler: EntityHandler = {
  entityType: "sale",
  tabla: "albcab",
  source: { table: "albcab", keyField: "numalb" },
  rpc: "style_ventas_apply_from_style",
  async buildArgs(companyId, cola, src, deps) {
    const numalb = cola.id_reg.trim();
    if (!numalb) return null;
    const accion = isDelete(cola.accion) ? "DELETE" : "UPSERT";
    if (accion === "UPSERT" && !src) return null;
    return {
      p_company_id: companyId,
      p_accion: accion,
      p_numalb: numalb,
      p_serie: dbfStr(src, "serie") || dbfStr(src, "seralb"),
      p_codcli: dbfStr(src, "codcli"),
      p_fecha: dbfDateIso(src, "fecha"),
      p_total: dbfNum(src, "total") || dbfNum(src, "totalalb"),
      p_lineas: await alblinJson(deps, numalb),
      p_sync_version: syncVersionFrom(cola, src),
    };
  },
};

/** Style→Suite: faccab.dbf → public.invoices (Fase 5). */
const facturasHandler: EntityHandler = {
  entityType: "invoice",
  tabla: "faccab",
  source: { table: "faccab", keyField: "numfac" },
  rpc: "style_facturas_apply_from_style",
  async buildArgs(companyId, cola, src, deps) {
    const numfac = cola.id_reg.trim();
    if (!numfac) return null;
    const accion = isDelete(cola.accion) ? "DELETE" : "UPSERT";
    if (accion === "UPSERT" && !src) return null;
    const serie = dbfStr(src, "serie") || dbfStr(src, "serfac");
    return {
      p_company_id: companyId,
      p_accion: accion,
      p_numfac: numfac,
      p_serie: serie,
      p_codcli: dbfStr(src, "codcli"),
      p_fecha: dbfDateIso(src, "fecha") || dbfDateIso(src, "fecfac"),
      p_baseimp: dbfNum(src, "baseimp") || dbfNum(src, "totimpbas"),
      p_iva: dbfNum(src, "iva") || dbfNum(src, "totimpiva"),
      p_total: dbfNum(src, "total") || dbfNum(src, "totfac"),
      p_lineas: await faclinJson(deps, numfac, serie, dbfStr(src, "ejefac")),
      p_sync_version: syncVersionFrom(cola, src),
    };
  },
};

/** Style→Suite: ciecab.dbf → public.cash_register_sessions (Fase 6). */
const cajaHandler: EntityHandler = {
  entityType: "cash_session",
  tabla: "ciecab",
  source: { table: "ciecab", keyField: "numcie" },
  rpc: "style_caja_apply_from_style",
  buildArgs(companyId, cola, src) {
    const numcie = cola.id_reg.trim();
    if (!numcie) return null;
    const accion = isDelete(cola.accion) ? "DELETE" : "UPSERT";
    if (accion === "UPSERT" && !src) return null;
    return {
      p_company_id: companyId,
      p_accion: accion,
      p_numcie: numcie,
      p_fecha: dbfDateIso(src, "fecha"),
      p_efectivo: dbfNum(src, "efectivo") || dbfNum(src, "efec"),
      p_tarjeta: dbfNum(src, "tarjeta") || dbfNum(src, "tarj"),
      p_total: dbfNum(src, "total") || dbfNum(src, "totalcie"),
      p_sync_version: syncVersionFrom(cola, src),
    };
  },
};

export const ENTITY_HANDLERS: EntityHandler[] = [
  clientesHandler,
  articulosHandler,
  bonosHandler,
  ventasHandler,
  facturasHandler,
  cajaHandler,
];
