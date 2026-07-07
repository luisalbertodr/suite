import { dbfStr, dbfDateIso, loadDbfIndexed } from "../dbfSource.js";

const ROOT = process.env.STYLE_ROOT ?? "\\\\192.168.99.16\\c$\\Style-Dunasoft";
const ids = new Set(["112220", "112221", "112222", "112223"]);

const index = await loadDbfIndexed(ROOT, "plan2009", "idplan");
for (const [key, row] of index) {
  const norm = key.replace(/^0+/, "") || "0";
  if (!ids.has(norm)) continue;
  console.log(
    norm,
    dbfDateIso(row, "fecha"),
    dbfStr(row, "horini"),
    dbfStr(row, "horfin"),
    dbfStr(row, "codemp"),
    dbfStr(row, "nomcli"),
  );
}
