import { loadDbfFilteredRows, dbfStr, dbfDateIso } from "./dist/dbfSource.js";

for (const month of ["2026-06", "2026-07"]) {
  const rows = await loadDbfFilteredRows("/mnt/style", "faccab", (r) => {
    if (dbfStr(r, "ejefac") !== "2026") return false;
    if (dbfStr(r, "serfac") === "00") return false;
    return dbfDateIso(r, "fecfac")?.startsWith(month);
  });
  console.log(month, "facturas", rows.length);
}
