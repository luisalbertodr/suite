/**
 * Mapeo teléfonos legacy CLIENTES (Dunasoft):
 * - tel1cli = teléfono de casa (posición 1).
 * - tel2cli = móvil / línea destino SMS.
 * Si el cliente no quiere SMS al móvil, el móvil puede guardarse en tel1 y los SMS siguen dirigiéndose a tel2.
 *
 * En `customers`: phone_home ← tel1, phone_mobile ← tel2, phone ← preferir móvil (tel2) si existe.
 */
export type LegacyClientePhones = {
  tel1cli?: string | null;
  tel2cli?: string | null;
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
