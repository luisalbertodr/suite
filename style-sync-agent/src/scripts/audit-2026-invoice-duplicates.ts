import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const H = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4";
const SL = "816af484-92a0-4f65-a5a7-1c907aa4bb3d";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data: maps } = await sb
  .schema("dunasoft")
  .from("style_sync_entity_map")
  .select("style_key, suite_id")
  .eq("company_id", H)
  .eq("entity_type", "invoice")
  .like("style_key", "2026/%");

const mappedIds = new Set((maps ?? []).map((m) => m.suite_id));
const dupSuite = new Map<string, number>();
for (const m of maps ?? []) {
  dupSuite.set(m.suite_id, (dupSuite.get(m.suite_id) ?? 0) + 1);
}
const multi = [...dupSuite.entries()].filter(([, c]) => c > 1);
console.log("maps 2026/", maps?.length, "unique suite_ids", mappedIds.size, "multi-map", multi.length);

const { data: inv } = await sb
  .from("invoices")
  .select("id, number, total_amount, status, company_id, issue_date")
  .in("company_id", [H, SL])
  .gte("issue_date", "2026-01-01")
  .lte("issue_date", "2026-12-31")
  .neq("status", "cancelled")
  .ilike("notes", "%Factura Style sync%");

const mapped = (inv ?? []).filter((i) => mappedIds.has(i.id));
const orphan = (inv ?? []).filter((i) => !mappedIds.has(i.id));
console.log(
  "active style sync 2026: total",
  inv?.length,
  "mapped",
  mapped.length,
  "orphan",
  orphan.length,
);
console.log(
  "EUR mapped",
  mapped.reduce((s, i) => s + Number(i.total_amount), 0).toFixed(2),
  "orphan",
  orphan.reduce((s, i) => s + Number(i.total_amount), 0).toFixed(2),
);
