import {
  dbfBool,
  dbfDateIso,
  dbfNum,
  dbfStr,
  loadDbfFilteredRows,
  normalizeStyleKey,
  styleRowKey,
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

async function faclinJson(deps: EntityEngineDeps | undefined, src: DbfRow): Promise<string> {
  if (!deps) return "[]";
  const ejefac = dbfStr(src, "ejefac");
  const serfac = dbfStr(src, "serfac") || dbfStr(src, "serie");
  const numfac = dbfStr(src, "numfac");
  const lines = await loadDbfFilteredRows(deps.styleRoot, "faclin", (row) => {
    if (dbfStr(row, "ejefac") !== ejefac) return false;
    if (dbfStr(row, "serfac") !== serfac) return false;
    return lineMatchesKey(row, "numfac", numfac);
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
      p_altura: (() => {
        const n = dbfNum(src, "altura");
        return n >= 100 && n <= 230 ? Math.round(n) : null;
      })(),
    };
  },
  toInboundJson(row) {
    const p = row.payload ?? {};
    const alturaRaw = p["altura"];
    const alturaNum =
      typeof alturaRaw === "number"
        ? alturaRaw
        : typeof alturaRaw === "string" && alturaRaw.trim()
          ? Number(alturaRaw)
          : null;
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
      altura: Number.isFinite(alturaNum) && (alturaNum as number) >= 100 && (alturaNum as number) <= 230
        ? Math.round(alturaNum as number)
        : "",
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
  toInboundJson(row) {
    const p = row.payload ?? {};
    return {
      entity_type: "article",
      operation: row.operation,
      codart: String(row.style_key ?? p["codart"] ?? ""),
      desart: String(p["desart"] ?? ""),
      familia1: String(p["familia1"] ?? ""),
      pvpa: p["pvpa"] ?? 0,
      coste: p["coste"] ?? 0,
      stock: p["stock"] ?? 0,
      iva: p["iva"] ?? 21,
      obsoleto: p["obsoleto"] ?? "NO",
      sync_version: p["sync_version"] ?? 0,
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
      p_fecaducidad: dbfDateIso(src, "fecven") || dbfDateIso(src, "fecadu") || dbfDateIso(src, "fecaducidad"),
      p_obsoleto: dbfBool(src, "obsoleto"),
      p_sync_version: syncVersionFrom(cola, src),
    };
  },
  toInboundJson(row) {
    const p = row.payload ?? {};
    return {
      entity_type: "bono",
      operation: row.operation,
      codboncli: String(row.style_key ?? p["codboncli"] ?? ""),
      codcli: String(p["codcli"] ?? ""),
      desbon: String(p["desbon"] ?? ""),
      sesiones: p["sesiones"] ?? 0,
      consumidas: p["consumidas"] ?? 0,
      obsoleto: p["obsoleto"] ?? "NO",
      sync_version: p["sync_version"] ?? 0,
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
  toInboundJson(row) {
    const p = row.payload ?? {};
    let lineas: unknown = p["lineas"];
    if (typeof lineas === "string") {
      try {
        lineas = JSON.parse(lineas);
      } catch {
        lineas = [];
      }
    }
    return {
      entity_type: "sale",
      operation: row.operation,
      codcli: String(p["codcli"] ?? ""),
      fecha: String(p["fecha"] ?? ""),
      total: p["total"] ?? 0,
      lineas: lineas ?? [],
      sync_version: p["sync_version"] ?? 0,
    };
  },
};

/** Style→Suite: faccab.dbf → public.invoices (Fase 5). */
const facturasHandler: EntityHandler = {
  entityType: "invoice",
  tabla: "faccab",
  source: { table: "faccab", keyField: "ejefac" },
  rpc: "style_facturas_apply_from_style",
  async buildArgs(companyId, cola, src, deps) {
    if (!src) return null;
    const numfac = dbfStr(src, "numfac");
    if (!numfac) return null;
    const accion = isDelete(cola.accion) ? "DELETE" : "UPSERT";
    const serie = dbfStr(src, "serie") || dbfStr(src, "serfac");
    return {
      p_company_id: companyId,
      p_accion: accion,
      p_numfac: numfac,
      p_serie: serie,
      p_codcli: dbfStr(src, "codcli"),
      p_fecha: dbfDateIso(src, "fecfac"),
      p_baseimp: dbfNum(src, "totimpbas") || dbfNum(src, "baseimp"),
      p_iva: dbfNum(src, "totimpiva") || dbfNum(src, "iva"),
      p_total: dbfNum(src, "totfac") || dbfNum(src, "total"),
      p_lineas: await faclinJson(deps, src),
      p_sync_version: syncVersionFrom(cola, src),
      p_ejefac: dbfStr(src, "ejefac"),
    };
  },
  toInboundJson(row) {
    const p = row.payload ?? {};
    let lineas: unknown = p["lineas"];
    if (typeof lineas === "string") {
      try {
        lineas = JSON.parse(lineas);
      } catch {
        lineas = [];
      }
    }
    return {
      entity_type: "invoice",
      operation: row.operation,
      numfac: String(p["numfac"] ?? row.style_key ?? ""),
      codcli: String(p["codcli"] ?? ""),
      fecha: String(p["fecha"] ?? ""),
      baseimp: p["baseimp"] ?? 0,
      iva: p["iva"] ?? 0,
      total: p["total"] ?? 0,
      lineas: lineas ?? [],
      sync_version: p["sync_version"] ?? 0,
    };
  },
};

/** Style→Suite: recursos.dbf → public.recursos */
const recursosHandler: EntityHandler = {
  entityType: "recurso",
  tabla: "recursos",
  source: { table: "recursos", keyField: "codrec" },
  rpc: "style_recursos_apply_from_style",
  buildArgs(companyId, cola, src) {
    const codrec = cola.id_reg.trim();
    if (!codrec || codrec === "0") return null;
    const accion = isDelete(cola.accion) ? "DELETE" : "UPSERT";
    if (accion === "UPSERT" && !src) return null;
    return {
      p_company_id: companyId,
      p_accion: accion,
      p_codrec: codrec,
      p_desrec: dbfStr(src, "desrec"),
      p_obsoleto: dbfBool(src, "obsoleto"),
      p_colorpf: Number(dbfStr(src, "colorpf") || 0),
      p_colorpl: Number(dbfStr(src, "colorpl") || 0),
      p_sync_version: syncVersionFrom(cola, src),
    };
  },
  toInboundJson(row) {
    const p = row.payload ?? {};
    return {
      entity_type: "recurso",
      operation: row.operation,
      codrec: String(row.style_key ?? p["codrec"] ?? ""),
      desrec: String(p["desrec"] ?? ""),
      obsoleto: p["obsoleto"] ? "SI" : "NO",
      colorpf: p["colorpf"] ?? 0,
      colorpl: p["colorpl"] ?? 0,
      sync_version: p["sync_version"] ?? 0,
    };
  },
};

async function aggregateCieentsal(
  deps: EntityEngineDeps | undefined,
  numcie: string,
  feccie: string | null,
): Promise<{ cashE: number; cardE: number }> {
  if (!deps) return { cashE: 0, cardE: 0 };
  const lines = await loadDbfFilteredRows(deps.styleRoot, "cieentsal", (row) => {
    const rowCie = normalizeStyleKey(dbfStr(row, "numcie"));
    if (rowCie && rowCie === normalizeStyleKey(numcie)) return true;
    if (!rowCie && feccie) return dbfDateIso(row, "fecdoc") === feccie;
    return false;
  });
  let cashE = 0;
  let cardE = 0;
  for (const ln of lines) {
    if (dbfStr(ln, "tipdoc").toUpperCase() !== "E") continue;
    const imp = dbfNum(ln, "impdoc");
    const pay = dbfStr(ln, "forpag").toUpperCase();
    if (pay.includes("EFECT")) cashE += imp;
    else if (pay.includes("TARJ")) cardE += imp;
  }
  return { cashE, cardE };
}

/** Style→Suite: ciecab.dbf → public.cash_register_sessions (Fase 6). */
const cajaHandler: EntityHandler = {
  entityType: "cash_session",
  tabla: "ciecab",
  source: { table: "ciecab", keyField: "numcie" },
  rpc: "style_caja_apply_from_style",
  async buildArgs(companyId, cola, src, deps) {
    const numcie = cola.id_reg.trim();
    if (!numcie) return null;
    const accion = isDelete(cola.accion) ? "DELETE" : "UPSERT";
    if (accion === "UPSERT" && !src) return null;
    const fecha = dbfDateIso(src, "feccie") || dbfDateIso(src, "fecha");
    const impcie = dbfNum(src, "impcie");
    const agg = await aggregateCieentsal(deps, numcie, fecha);
    const legacyCash = dbfNum(src, "efectivo") || dbfNum(src, "efec");
    const legacyCard = dbfNum(src, "tarjeta") || dbfNum(src, "tarj");
    const legacyTotal = dbfNum(src, "total") || dbfNum(src, "totalcie");
    const card = agg.cardE || legacyCard;
    const cash = impcie || legacyCash || agg.cashE;
    const total = impcie || legacyTotal || cash + card;
    return {
      p_company_id: companyId,
      p_accion: accion,
      p_numcie: numcie,
      p_fecha: fecha,
      p_efectivo: cash,
      p_tarjeta: card,
      p_total: total,
      p_sync_version: syncVersionFrom(cola, src),
    };
  },
  toInboundJson(row) {
    const p = row.payload ?? {};
    return {
      entity_type: "cash_session",
      operation: row.operation,
      numcie: String(row.style_key ?? p["numcie"] ?? ""),
      fecha: String(p["fecha"] ?? ""),
      efectivo: p["efectivo"] ?? 0,
      tarjeta: p["tarjeta"] ?? 0,
      total: p["total"] ?? 0,
      sync_version: p["sync_version"] ?? 0,
    };
  },
};

export const ENTITY_HANDLERS: EntityHandler[] = [
  clientesHandler,
  articulosHandler,
  bonosHandler,
  ventasHandler,
  facturasHandler,
  recursosHandler,
  cajaHandler,
];
