/** Company ID por defecto para scripts Node de importación legacy. */
export const DEFAULT_COMPANY_ID = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4";

export function getCompanyId() {
  return (
    process.env.LEGACY_COMPANY_ID?.trim() ||
    process.env.PROMOTE_COMPANY_ID?.trim() ||
    process.env.COMPANY_ID?.trim() ||
    DEFAULT_COMPANY_ID
  );
}
