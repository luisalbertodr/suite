/** Quita marcas de combinación sin `\p{M}` (Safari antiguo falla con unicode properties). */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Letras básicas + latín extendido sin `\p{L}`. */
const LETTERS = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g;

export function stripCombiningMarks(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "");
}

export function countLetters(value: string): number {
  return (value.match(LETTERS) || []).length;
}
