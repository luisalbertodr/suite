import dotenv from "dotenv";
import { readDbfTailRows } from "./lib/readDbfTail.js";
import { dbfStr, dbfDateIso } from "../dbfSource.js";

dotenv.config();
const root = process.env.STYLE_ROOT!;

for (const table of ["plantmp", "plan2009", "cola_sincro"]) {
  const rows = readDbfTailRows(root, table, table === "plan2009" ? 3000 : 100);
  console.log(`\n=== ${table} tail ${rows.length} ===`);
  const hits = rows.filter((r) => {
    const txt = `${dbfStr(r, "texto")} ${dbfStr(r, "textox")} ${dbfStr(r, "nomcli")}`.toLowerCase();
    const hor = dbfStr(r, "horini") || dbfStr(r, "horinix");
    const fecha = dbfDateIso(r, "fecha") || dbfDateIso(r, "fechax") || String(r.fecha ?? r.fechax ?? "");
    return txt.includes("style") || (String(fecha).includes("20260706") && hor.startsWith("10:4"));
  });
  for (const r of hits.slice(-10)) {
    console.log(JSON.stringify(r));
  }
  if (!hits.length) {
    const last = rows.slice(-3);
    console.log("last rows sample:", last.map((r) => ({ idplan: r.idplan, id: r.id, accion: r.accion, tabla: r.tabla, fecha: r.fecha, horini: r.horini, texto: r.texto, nomcli: r.nomcli })));
  }
}
