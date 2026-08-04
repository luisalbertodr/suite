import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dniMatchKeys,
  dniNumericKey,
  extractInbodyDni,
  dedupeInbodyMeasurements,
  isMorphoScanMeasurement,
  normalizeInbodyMeasurement,
  normInbodyUserId,
  type InbodyMeasurement,
} from '@/lib/inbodyMeasurements';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

/** Clave de persona (DNI/NIE), no IDs de báscula tipo SCALE+MAC. */
function looksLikePersonDocumentKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return /^\d{7,8}$/.test(key) || /^[XYZ]\d{7}$/i.test(key);
}

/** IDs del puente BLE / MorphoScan (no son DNI LookInBody). */
function isScaleBridgeUserId(userId: string | null | undefined): boolean {
  const s = normInbodyUserId(userId);
  return /^SCALE[0-9A-F]{12}$/i.test(s) || /^SCALE-/i.test(s);
}

function measurementBelongsToCustomer(
  row: InbodyMeasurement,
  customerId: string,
  taxId: string | null | undefined,
): boolean {
  const customerDni = taxId?.trim() ? dniNumericKey(taxId) : null;
  const measureDni = dniNumericKey(extractInbodyDni(row.inbody_user_id));

  if (row.customer_id === customerId) {
    // MorphoScan usa inbody_user_id=SCALEMAC. dniNumericKey() no es null para ese
    // string y el cruce DNI lo descartaba aunque customer_id ya coincidiera.
    if (
      isMorphoScanMeasurement(row) ||
      isScaleBridgeUserId(row.inbody_user_id) ||
      !customerDni ||
      !looksLikePersonDocumentKey(measureDni)
    ) {
      return true;
    }
    return customerDni === measureDni;
  }

  if (!taxId?.trim()) return false;
  const keys = new Set(dniMatchKeys(taxId));
  return keys.has(normInbodyUserId(extractInbodyDni(row.inbody_user_id)));
}

export function useInbodyMeasurements(
  customerId: string | undefined,
  taxId: string | null | undefined,
  /** Empresa del cliente (customers.company_id); evita filtrar por la sesión activa si difiere. */
  customerCompanyId?: string | null,
) {
  const { companyId: sessionCompanyId } = useCompanyFilter();
  const companyId = customerCompanyId || sessionCompanyId;
  const taxKeys = taxId ? dniMatchKeys(taxId) : [];

  return useQuery({
    queryKey: ['inbody_measurements', companyId, customerId, taxKeys.join('|')],
    enabled: Boolean(companyId && customerId),
    queryFn: async (): Promise<InbodyMeasurement[]> => {
      if (!companyId || !customerId) return [];

      const orParts = [`customer_id.eq.${customerId}`];
      for (const key of taxKeys) {
        orParts.push(`inbody_user_id.eq.${key}`);
      }

      const { data, error } = await (supabase as any)
        .from('inbody_measurements')
        .select('*')
        .eq('company_id', companyId)
        .or(orParts.join(','))
        .order('measured_at', { ascending: false });

      if (error) throw error;

      const seen = new Set<string>();
      const raw: InbodyMeasurement[] = [];
      for (const row of (data || []) as InbodyMeasurement[]) {
        if (!measurementBelongsToCustomer(row, customerId, taxId)) continue;
        const key = `${row.inbody_user_id}|${row.measured_at}`;
        if (seen.has(key)) continue;
        seen.add(key);
        raw.push(normalizeInbodyMeasurement(row));
      }
      return dedupeInbodyMeasurements(raw);
    },
  });
}
