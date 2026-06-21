/**
 * Convierte servicios JSON (cola) al formato texto legacy del RPC Postgres.
 * JSON: [{"servicio":"corte","hora":"10:00"}]
 * Legacy: "corte1000\r" (codart+hora por línea)
 */
export function serviciosJsonToLegacy(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (!t.startsWith("[")) return t;
  try {
    const arr = JSON.parse(t) as Array<{ servicio?: string; hora?: string; precio?: number }>;
    return arr
      .map((item) => {
        const cod = String(item.servicio ?? "").trim();
        const hora = String(item.hora ?? "").trim();
        if (!cod) return "";
        return cod + hora;
      })
      .filter(Boolean)
      .join("\r");
  } catch {
    return t;
  }
}

export function resolveVersion(row: {
  version?: number | string;
  style_modified_at?: string;
  modificado?: string;
}): number {
  const v = Number(row.version ?? 0);
  if (Number.isFinite(v) && v > 0) return v;
  const mod = String(row.modificado ?? row.style_modified_at ?? "");
  const epoch = Number(mod);
  if (Number.isFinite(epoch) && epoch > 0) return epoch;
  return 0;
}
