import { loadDbfIndexed, dbfStr, lookupDbfRow } from "./dist/dbfSource.js";

const idx = await loadDbfIndexed("/mnt/style", "clientes", "codcli");
for (const cod of ["8201", "008201", "8196", "008196"]) {
  const row = lookupDbfRow(idx, "clientes", cod);
  if (!row) continue;
  console.log(cod, {
    codcli: dbfStr(row, "codcli"),
    nom: dbfStr(row, "nomcli"),
    tel: dbfStr(row, "tel1cli"),
    dni: dbfStr(row, "dnicli"),
  });
}
