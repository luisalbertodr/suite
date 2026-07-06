import { loadDbfIndexed, dbfDateIso, dbfNum, dbfStr } from "./dist/dbfSource.js";

const REF: Record<string, number> = {
  "2026-03": 16229.69,
  "2026-04": 24894.65,
  "2026-05": 26789.02,
  "2026-06": 23156.55,
  "2026-07": 4104,
};

const fac = await loadDbfIndexed("C:/Duna/Style-Suite-Test", "faccab", "numfac");
const rows = [...fac.values()];

function sum(
  mes: string,
  pred: (r: (typeof rows)[0]) => boolean,
): { total: number; n: number } {
  let total = 0;
  let n = 0;
  for (const r of rows) {
    if (dbfDateIso(r, "fecfac")?.slice(0, 7) !== mes) continue;
    if (!pred(r)) continue;
    total += dbfNum(r, "totfac");
    n++;
  }
  return { total: Math.round(total * 100) / 100, n };
}

// Style billing rule discovered: serfac != '00' (totfacres) for fiscal; July adds partial 00
function styleBilling(mes: string): number {
  const non00 = sum(mes, (r) => dbfStr(r, "serfac") !== "00");
  const s00 = sum(mes, (r) => dbfStr(r, "serfac") === "00");
  if (mes >= "2026-05") return non00.total; // May+ matches serie A exactly
  if (mes === "2026-07") return non00.total + 75; // 4029+75=4104 per user
  // Mar-Apr: try non00 + fraction of 00
  return non00.total + s00.total;
}

console.log("Testing billing rules vs REF:\n");
for (const mes of Object.keys(REF)) {
  const non00 = sum(mes, (r) => dbfStr(r, "serfac") !== "00");
  const s00 = sum(mes, (r) => dbfStr(r, "serfac") === "00");
  const s00pos = sum(mes, (r) => dbfStr(r, "serfac") === "00" && dbfNum(r, "totfac") > 0);
  const all = sum(mes, () => true);
  console.log(mes, "REF", REF[mes]);
  console.log("  non00 (A...):", non00.total, "delta", Math.round((non00.total - REF[mes]) * 100) / 100);
  console.log("  00 only:", s00.total);
  console.log("  all:", all.total);
  // Mar/Apr hypothesis: non00 + 00 for months before A dominates
  const hybrid = non00.total + (mes < "2026-05" ? s00.total : 0);
  console.log("  non00+00:", Math.round(hybrid * 100) / 100, "delta", Math.round((hybrid - REF[mes]) * 100) / 100);
}

// July: find 75€ subset in 00
const july00 = rows
  .filter((r) => dbfDateIso(r, "fecfac")?.startsWith("2026-07") && dbfStr(r, "serfac") === "00")
  .map((r) => ({ num: dbfStr(r, "numfac"), v: dbfNum(r, "totfac") }));
console.log("\nJuly 00 tickets:", july00.length, "sum", july00.reduce((a, b) => a + b.v, 0));

// March gap analysis
const marGap = REF["2026-03"] - sum("2026-03", (r) => dbfStr(r, "serfac") === "00").total;
console.log("\nMarch gap vs 00:", marGap);
const feb00 = sum("2026-02", (r) => dbfStr(r, "serfac") === "00").total;
console.log("Feb 00:", feb00, "Feb+Mar 00:", feb00 + sum("2026-03", (r) => dbfStr(r, "serfac") === "00").total);
