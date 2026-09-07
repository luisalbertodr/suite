/**
 * Mapeo teléfonos legacy CLIENTES (Dunasoft / Style):
 * - tel2cli → phone_mobile: móvil (destino SMS/publicidad).
 * - tel1cli → phone_home: fijo; o móvil SOLO si tel2 vacío (cliente no quiere SMS).
 * - Si tel1 y tel2 son el mismo número, tel1 es duplicado erróneo → no mapear a phone_home.
 * - phone: COALESCE(tel2, tel1) — contacto principal llamadas/WhatsApp.
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

function phoneLast9(value: string | null | undefined): string {
  const d = String(value ?? '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : d;
}

export function mapLegacyClientePhonesToCustomerFields(row: LegacyClientePhones): {
  phone_home: string | null;
  phone_mobile: string | null;
  phone: string | null;
} {
  const t1 = (row.tel1cli ?? '').trim() || null;
  const t2 = (row.tel2cli ?? '').trim() || null;
  const phone_mobile = t2;
  const n1 = phoneLast9(t1);
  const n2 = phoneLast9(t2);
  // Mismo número en ambos campos → no guardar como "fijo" (evita reescritura Suite→Style)
  const phone_home = t1 && n1 && n2 && n1 === n2 ? null : t1;
  const phone = phone_mobile || phone_home || null;
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
