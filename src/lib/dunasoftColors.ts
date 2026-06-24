/** Convierte color numerico Visual FoxPro (BGR) a #RRGGBB. */
export function vfpColorToHex(value: number | string | null | undefined): string | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  const r = n & 0xff;
  const g = (n >> 8) & 0xff;
  const b = (n >> 16) & 0xff;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const EMPLOYEE_BG_CLASSES = [
  'bg-sky-100 dark:bg-sky-950/50 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-100',
  'bg-violet-100 dark:bg-violet-950/50 border-violet-300 dark:border-violet-700 text-violet-900 dark:text-violet-100',
  'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100',
  'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100',
  'bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100',
  'bg-cyan-100 dark:bg-cyan-950/50 border-cyan-300 dark:border-cyan-700 text-cyan-900 dark:text-cyan-100',
  'bg-orange-100 dark:bg-orange-950/50 border-orange-300 dark:border-orange-700 text-orange-900 dark:text-orange-100',
  'bg-indigo-100 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100',
];

export function employeeTailwindColor(codemp: string, colorpf?: number | null): string {
  const hex = vfpColorToHex(colorpf);
  if (hex) {
    return 'border-2 border-border/80 bg-muted/60 text-foreground dark:bg-muted/40';
  }
  const code = codemp.trim();
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) hash = (hash + code.charCodeAt(i) * (i + 1)) % EMPLOYEE_BG_CLASSES.length;
  return EMPLOYEE_BG_CLASSES[hash] ?? EMPLOYEE_BG_CLASSES[0]!;
}

export function employeeInlineStyle(
  colorpf?: number | null,
  colorpl?: number | null
): { backgroundColor?: string; color?: string; borderColor?: string } | undefined {
  const bg = vfpColorToHex(colorpf);
  const fg = vfpColorToHex(colorpl);
  if (!bg && !fg) return undefined;
  return {
    backgroundColor: bg ? `${bg}33` : undefined,
    color: fg ?? undefined,
    borderColor: bg ?? undefined,
  };
}
