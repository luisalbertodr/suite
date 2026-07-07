import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { sumStyleBillingByMonth } from "../dbfSource.js";

const H = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const style = await sumStyleBillingByMonth(process.env.STYLE_ROOT!, "2026");
const { data, error } = await sb.rpc("dashboard_billing_monthly", {
  p_company_id: H,
  p_year: 2026,
});
if (error) throw error;

let rpcSum = 0;
let styleSum = 0;
for (const r of data ?? []) {
  const key = `2026-${String(r.month_num).padStart(2, "0")}`;
  const st = style.get(key) ?? 0;
  rpcSum += Number(r.total);
  styleSum += st;
  console.log(key, "Style", st.toFixed(2), "RPC", Number(r.total).toFixed(2));
}
console.log("TOTAL Style", styleSum.toFixed(2), "RPC", rpcSum.toFixed(2));
