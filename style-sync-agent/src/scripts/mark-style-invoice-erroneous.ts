/**
 * Marca una factura Style como errónea: cancela en Suite, elimina mapeo y registra exclusión.
 * Uso: npx tsx src/scripts/mark-style-invoice-erroneous.ts A 950 [motivo]
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";

const serie = process.argv[2] ?? "A";
const numfac = process.argv[3] ?? "";
const reason = process.argv.slice(4).join(" ") || "Factura errónea — excluida de sync y facturación";

if (!numfac || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !COMPANY_ID) {
  console.error("Uso: mark-style-invoice-erroneous.ts <serie> <numfac> [motivo]");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main(): Promise<void> {
  const { data: maps, error: mapErr } = await supabase
    .schema("dunasoft")
    .from("style_sync_entity_map")
    .select("style_key, suite_id")
    .eq("company_id", COMPANY_ID)
    .eq("entity_type", "invoice")
    .like("style_key", `${serie}/${numfac}/%`);
  if (mapErr) throw mapErr;

  const number = `${serie}-${numfac}`;
  let invoiceId = maps?.[0]?.suite_id ?? null;

  if (!invoiceId) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id")
      .eq("company_id", COMPANY_ID)
      .eq("number", number)
      .maybeSingle();
    invoiceId = inv?.id ?? null;
  }

  for (const m of maps ?? []) {
    const { error } = await supabase
      .schema("dunasoft")
      .from("style_sync_billing_exclusions")
      .upsert(
        { company_id: COMPANY_ID, style_key: m.style_key, reason },
        { onConflict: "company_id,style_key" },
      );
    if (error && !String(error.message).includes("does not exist")) throw error;

    const { error: delErr } = await supabase
      .schema("dunasoft")
      .from("style_sync_entity_map")
      .delete()
      .eq("company_id", COMPANY_ID)
      .eq("entity_type", "invoice")
      .eq("style_key", m.style_key);
    if (delErr) throw delErr;
    console.log(`  exclusión + mapeo eliminado: ${m.style_key}`);
  }

  if (!maps?.length) {
    const fallbackKey = `${serie}/${numfac}/0`;
    const { error } = await supabase
      .schema("dunasoft")
      .from("style_sync_billing_exclusions")
      .upsert(
        { company_id: COMPANY_ID, style_key: fallbackKey, reason },
        { onConflict: "company_id,style_key" },
      );
    if (error && !String(error.message).includes("does not exist")) throw error;
    console.log(`  exclusión registrada: ${fallbackKey}`);
  }

  if (invoiceId) {
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "cancelled",
        notes: `Style sync errónea — ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);
    if (error) throw error;
    console.log(`  factura cancelada: ${number} (${invoiceId})`);
  } else {
    console.log(`  sin factura Suite para ${number}`);
  }

  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
