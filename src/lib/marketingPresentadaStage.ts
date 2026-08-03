/** Etapa CRM: presentados / presentada (con o sin «éxito») → valor = facturación. */
const normalizeStageName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Detecta la columna de presentación exitosa del embudo.
 * Acepta «Presentada», «Presentado», «Presentados», «Presentada con éxito», etc.
 * Excluye «No presentada» / «No presentado».
 */
export const isPresentadaExitoStageName = (name: string | null | undefined): boolean => {
  if (!name?.trim()) return false;
  const n = normalizeStageName(name);
  if (/(^|[^a-z])no\s+presentad/.test(n)) return false;
  // presentad + o/a + s opcional (presentada, presentado, presentadas, presentados)
  return /presentad[oa]s?/.test(n);
};
