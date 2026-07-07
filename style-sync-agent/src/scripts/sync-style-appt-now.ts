/** Busca cita reciente en plan2009 tail y aplica RPC si falta en Suite. */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readDbfTailRows } from "./lib/readDbfTail.js";
import { dbfStr, dbfDateIso } from "../dbfSource.js";
import { serviciosJsonToLegacy } from "../servicios.js";

dotenv.config();

const companyId = process.env.COMPANY_ID!;
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const root = process.env.STYLE_ROOT!;

async function main() {
  const rows = readDbfTailRows(root, "plan2009", 2000);
  const hits = rows.filter((r) => {
    const txt = dbfStr(r, "texto").toLowerCase();
    const hor = dbfStr(r, "horini");
    const fecha = dbfDateIso(r, "fecha") ?? String(r.fecha ?? "").slice(0, 10);
    return txt.includes("style") || (fecha.includes("2026-07-06") && hor.startsWith("10:4"));
  });

  console.log("coincidencias plan2009 tail:", hits.length);
  for (const row of hits) {
    const idplan = dbfStr(row, "idplan");
    const fecha = dbfDateIso(row, "fecha");
    console.log({ idplan, fecha, horini: dbfStr(row, "horini"), texto: dbfStr(row, "texto"), nomcli: dbfStr(row, "nomcli") });

    const { data: existing } = await supabase
      .schema("dunasoft")
      .from("plan2009")
      .select("idplan, texto, horini")
      .eq("idplan", Number(idplan))
      .maybeSingle();
    console.log("  en postgres:", existing ?? "NO");

    const { error } = await supabase.rpc("style_reservas_apply_from_style", {
      p_company_id: companyId,
      p_accion: "UPDATE",
      p_idplan: Number(idplan),
      p_codemp: dbfStr(row, "codemp"),
      p_codcli: dbfStr(row, "codcli"),
      p_fecha: fecha,
      p_horini: dbfStr(row, "horini"),
      p_horfin: dbfStr(row, "horfin"),
      p_texto: dbfStr(row, "texto"),
      p_codrec: dbfStr(row, "codrec"),
      p_nomcli: dbfStr(row, "nomcli"),
      p_tel1cli: dbfStr(row, "tel1cli"),
      p_facturado: false,
      p_servicios: serviciosJsonToLegacy("[]"),
      p_colfon: Number(dbfStr(row, "colfon") || 0),
      p_collet: Number(dbfStr(row, "collet") || 0),
      p_style_modified_at: null,
    });
    if (error) console.error("  RPC error:", error.message);
    else console.log("  RPC OK");
  }
}

main().catch(console.error);
