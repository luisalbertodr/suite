import { loadDbfIndexed, dbfNum, dbfDateIso } from "../dist/dbfSource.js";
import { ENTITY_HANDLERS } from "../dist/handlers.js";

const root = "\\\\192.168.99.16\\c$\\Style-Dunasoft";
const handler = ENTITY_HANDLERS.find((h) => h.tabla === "ciecab");
const idx = await loadDbfIndexed(root, "ciecab", "numcie");
const deps = { styleRoot: root, companyId: "", supabase: null, log: () => {} };

for (const num of ["4505", "4504", "4503", "4502", "4501"]) {
  const row = idx.get(num);
  if (!row) {
    console.log(num, "NOT FOUND");
    continue;
  }
  const args = await handler.buildArgs(
    "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4",
    { id: 0, tabla: "ciecab", id_reg: num, accion: "UPD" },
    row,
    deps,
  );
  console.log(num, dbfDateIso(row, "feccie"), args);
}
