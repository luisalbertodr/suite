/**
 * Siembra huellas faccab/ciecab desde DBF actual (sin re-aplicar RPC).
 * Deja el poll en modo incremental: solo cambios nuevos.
 */
import { createHash } from "node:crypto";
import {
  loadDbfIndexed,
  dbfStr,
  dbfFingerprintKey,
  type DbfRow,
} from "../dbfSource.js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const FINGERPRINT_FIELDS: Record<string, string[]> = {
  faccab: ["serie", "serfac", "codcli", "fecha", "fecfac", "totfac", "totimpbas"],
  ciecab: ["feccie", "impcie", "horcie", "cerrado"],
};

function rowFingerprint(row: DbfRow, fields: string[]): string {
  const parts = fields.map((f) => `${f}=${dbfStr(row, f)}`);
  return createHash("sha256").update(parts.join("\x1e")).digest("hex").slice(0, 40);
}

const STYLE_ROOT = process.env.STYLE_ROOT ?? "/mnt/style";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seedTabla(tabla: string, keyField: string): Promise<void> {
  const fields = FINGERPRINT_FIELDS[tabla];
  const index = await loadDbfIndexed(STYLE_ROOT, tabla, keyField);
  const byKey = new Map<string, string>();
  for (const [key, row] of index) {
    const mapKey = dbfFingerprintKey(tabla, key, row);
    byKey.set(mapKey, rowFingerprint(row, fields));
  }
  const entries = [...byKey.entries()].map(([style_key, fingerprint]) => ({ style_key, fingerprint }));
  console.log(`${tabla}: ${entries.length} huellas`);

  const { error: delErr } = await supabase
    .schema("dunasoft")
    .from("style_sync_dbf_fingerprint")
    .delete()
    .eq("company_id", COMPANY_ID)
    .eq("tabla", tabla);
  if (delErr) throw delErr;

  const chunk = 200;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk).map((e) => ({
      company_id: COMPANY_ID,
      tabla,
      style_key: e.style_key,
      fingerprint: e.fingerprint,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .schema("dunasoft")
      .from("style_sync_dbf_fingerprint")
      .upsert(slice, { onConflict: "company_id,tabla,style_key" });
    if (error) throw error;
    if (i === 0 || (i + chunk) % 5000 === 0) {
      console.log(`  ${Math.min(i + chunk, entries.length)}/${entries.length}`);
    }
  }

  const { error: curErr } = await supabase
    .schema("dunasoft")
    .from("style_sync_cursor")
    .update({ dbf_baseline_seeded: true, last_error: null, updated_at: new Date().toISOString() })
    .eq("company_id", COMPANY_ID)
    .eq("tabla", tabla);
  if (curErr) throw curErr;
  console.log(`${tabla}: baseline seeded OK`);
}

async function main() {
  await seedTabla("faccab", "ejefac");
  await seedTabla("ciecab", "numcie");

  const { error } = await supabase
    .schema("dunasoft")
    .from("style_sync_billing_checkpoints")
    .upsert(
      {
        company_id: COMPANY_ID,
        checkpoint_key: "resync_faccab_2026",
        details: { note: "baseline seeded; incremental poll only", at: new Date().toISOString() },
      },
      { onConflict: "company_id,checkpoint_key" },
    );
  if (error) throw error;
  console.log("Checkpoint resync_faccab_2026 registrado");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
