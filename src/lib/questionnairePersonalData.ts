import type { QuestionnaireCustomerRow } from '@/lib/questionnaireTypes';

/** Snapshot al abrir el cuestionario (answers). */
export const PERSONAL_DATA_SNAPSHOT_KEY = '__personal_data_snapshot';
/** Cambios detectados al enviar (answers). */
export const PERSONAL_DATA_CHANGES_KEY = '__personal_data_changes';

export type PersonalDataChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export const PERSONAL_DATA_FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  tax_id: 'DNI',
  email: 'Email',
  phone_mobile: 'Teléfono',
  address_street: 'Dirección',
  address_city: 'Ciudad',
  address_postal_code: 'C.P.',
  birth_date: 'Fecha de nacimiento',
  occupation: 'Ocupación',
};

const TRACKED_FIELDS = Object.keys(PERSONAL_DATA_FIELD_LABELS);

function norm(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function normDate(value: unknown): string {
  const s = norm(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normPhone(value: unknown): string {
  return norm(value).replace(/\D/g, '');
}

function comparableValue(field: string, value: unknown): string {
  if (field === 'birth_date') return normDate(value);
  if (field === 'phone_mobile') return normPhone(value);
  return norm(value).toLowerCase();
}

export function buildPersonalDataSnapshot(
  customer: Pick<
    QuestionnaireCustomerRow,
    | 'name'
    | 'tax_id'
    | 'email'
    | 'phone'
    | 'phone_mobile'
    | 'address_street'
    | 'address_city'
    | 'address_postal_code'
    | 'birth_date'
    | 'occupation'
  >,
): Record<string, string> {
  return {
    name: norm(customer.name),
    tax_id: norm(customer.tax_id),
    email: norm(customer.email),
    phone_mobile: norm(customer.phone_mobile || customer.phone),
    address_street: norm(customer.address_street),
    address_city: norm(customer.address_city),
    address_postal_code: norm(customer.address_postal_code),
    birth_date: normDate(customer.birth_date),
    occupation: norm(customer.occupation),
  };
}

export function buildPersonalDataFromPatch(
  patch: Record<string, unknown>,
): Record<string, string> {
  return {
    name: norm(patch.name),
    tax_id: norm(patch.tax_id),
    email: norm(patch.email),
    phone_mobile: norm(patch.phone_mobile),
    address_street: norm(patch.address_street),
    address_city: norm(patch.address_city),
    address_postal_code: norm(patch.address_postal_code),
    birth_date: normDate(patch.birth_date),
    occupation: norm(patch.occupation),
  };
}

export function detectPersonalDataChanges(
  snapshot: Record<string, string> | null | undefined,
  submitted: Record<string, unknown>,
): PersonalDataChange[] {
  if (!snapshot || !Object.keys(snapshot).length) return [];

  const current = buildPersonalDataFromPatch(submitted);
  const changes: PersonalDataChange[] = [];

  for (const field of TRACKED_FIELDS) {
    const before = snapshot[field] ?? '';
    const after = current[field] ?? '';
    if (comparableValue(field, before) === comparableValue(field, after)) continue;
    if (!before && !after) continue;
    changes.push({
      field,
      label: PERSONAL_DATA_FIELD_LABELS[field] ?? field,
      before: before || '—',
      after: after || '—',
    });
  }

  return changes;
}

export function getPersonalDataChangesFromAnswers(
  answers: Record<string, unknown> | null | undefined,
): PersonalDataChange[] {
  const raw = answers?.[PERSONAL_DATA_CHANGES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is PersonalDataChange =>
      item != null &&
      typeof item === 'object' &&
      typeof (item as PersonalDataChange).field === 'string' &&
      typeof (item as PersonalDataChange).label === 'string',
  );
}

export function formatPersonalDataChangesSummary(changes: PersonalDataChange[]): string {
  if (!changes.length) return '';
  return changes.map((c) => c.label).join(', ');
}
