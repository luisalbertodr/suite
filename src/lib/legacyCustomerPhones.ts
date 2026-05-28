/**
 * Mapeo teléfonos legacy CLIENTES (Dunasoft):
 * - tel1cli → phone_home: fijo, o móvil si el cliente no desea SMS/campañas al móvil.
 * - tel2cli → phone_mobile: móvil principal (línea destino SMS).
 * - phone: COALESCE(tel2, tel1) — contacto principal para llamadas/WhatsApp.
 */
export type LegacyClientePhones = {
  tel1cli?: string | null;
  tel2cli?: string | null;
};

export type CustomerPhoneFields = {
  phone?: string | null;
  phone_mobile?: string | null;
  phone_home?: string | null;
};

export function mapLegacyClientePhonesToCustomerFields(row: LegacyClientePhones): {
  phone_home: string | null;
  phone_mobile: string | null;
  phone: string | null;
} {
  const t1 = (row.tel1cli ?? '').trim();
  const t2 = (row.tel2cli ?? '').trim();
  const phone_home = t1 || null;
  const phone_mobile = t2 || null;
  const phone = t2 || t1 || null;
  return { phone_home, phone_mobile, phone };
}

/** Teléfono principal para llamar / WhatsApp (móvil Dunasoft tel. 2). */
export function primaryCustomerPhone(c: CustomerPhoneFields): string | null {
  for (const v of [c.phone_mobile, c.phone, c.phone_home]) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return null;
}

/**
 * Etiquetas para UI: «Móvil …» (tel. 2) y «Tel. 1 …» (fijo o alt. sin SMS).
 * Omite duplicados si tel1 y tel2 son iguales.
 */
export function formatCustomerPhoneLabels(c: CustomerPhoneFields): string[] {
  const t2 = String(c.phone_mobile ?? '').trim();
  const t1 = String(c.phone_home ?? '').trim();
  const out: string[] = [];
  if (t2) out.push(`Móvil ${t2}`);
  if (t1 && t1 !== t2) out.push(`Tel. 1 ${t1}`);
  else if (t1 && !t2) out.push(`Tel. ${t1}`);
  return out;
}

export function formatCustomerPhonesInline(c: CustomerPhoneFields): string {
  return formatCustomerPhoneLabels(c).join(' · ');
}
