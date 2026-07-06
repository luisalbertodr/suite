import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfIndexed, lookupDbfRow } from "../dbfSource.js";

const root = process.env.STYLE_ROOT ?? "C:\\Duna\\Style-Suite-Test";
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["112222", "112223", "110425", "111315"];

const idx = await loadDbfIndexed(root, "plan2009");
console.log("root:", root);
for (const id of ids) {
  const r = lookupDbfRow(idx, "plan2009", id);
  if (!r) {
    console.log(id, "NOT FOUND");
    continue;
  }
  console.log(
    id,
    dbfDateIso(r, "fecha"),
    dbfStr(r, "horini"),
    "emp=" + dbfStr(r, "codemp"),
    dbfStr(r, "nomcli").slice(0, 45),
  );
}
