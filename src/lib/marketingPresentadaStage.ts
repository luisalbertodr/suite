/** Etapa CRM/TuPartner: clientes presentados con éxito → valor = facturación. */
const normalizeStageName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const isPresentadaExitoStageName = (name: string | null | undefined): boolean => {
  if (!name?.trim()) return false;
  const n = normalizeStageName(name);
  return n.includes('presentada') && n.includes('exito');
};
