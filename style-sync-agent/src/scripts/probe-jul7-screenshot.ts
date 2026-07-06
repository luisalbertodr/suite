import "dotenv/config";
import { dbfDateIso, dbfStr, loadDbfFilteredRows } from "../dbfSource.js";

const root = process.argv[2] ?? "Z:\\Style-Dunasoft";

const rows = await loadDbfFilteredRows(root, "plan2009", (r) => {
  const f = dbfDateIso(r, "fecha");
  return !!f && f.startsWith("2026-07") && dbfStr(r, "horini") === "15:30";
});

console.log("jul 2026 @ 15:30 count", rows.length);
for (const r of rows) {
  console.log(dbfDateIso(r, "fecha"), dbfStr(r, "codemp"), dbfStr(r, "nomcli").slice(0, 40));
}

const fernanda = await loadDbfFilteredRows(
  root,
  "plan2009",
  (r) =>
    dbfStr(r, "nomcli").toLowerCase().includes("fernanda") &&
    dbfStr(r, "horini") === "11:00" &&
    (dbfDateIso(r, "fecha") ?? "").startsWith("2026-07"),
);
console.log("\nFernanda 11:00 jul:", fernanda.length);
for (const r of fernanda) {
  console.log(dbfDateIso(r, "fecha"), dbfStr(r, "codemp"), dbfStr(r, "nomcli"));
}
