/**
 * One-shot: fuerza un poll plan2009 (detecta cambios Style→Suite).
 * Uso: npx tsx src/scripts/run-plan2009-poll-once.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pollPlan2009FromDbf } from "../plan2009Poll.js";

const STYLE_ROOT = process.env.STYLE_ROOT ?? "";
const COMPANY_ID = process.env.COMPANY_ID ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BATCH = Number(process.env.PLAN2009_BATCH ?? "100");

if (!STYLE_ROOT || !COMPANY_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan env STYLE_ROOT/COMPANY_ID/SUPABASE_*");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

await pollPlan2009FromDbf(
  { supabase, companyId: COMPANY_ID, styleRoot: STYLE_ROOT, log },
  BATCH,
);
log("poll once done");
