/**
 * Sube todas las fotos de Style (Fotografias) a Supabase Storage y rellena articles.foto_url.
 *
 * Requiere: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COMPANY_ID
 * Opcional: STYLE_PHOTOS_DIR (default C:\Style-Dunasoft\Fotografias)
 *
 * Uso:
 *   npx tsx src/scripts/upload-article-photos-once.ts
 *   npx tsx src/scripts/upload-article-photos-once.ts --dry-run
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  applyPhotoToSuiteArticle,
  resolveLocalPhotoFile,
  stylePhotosDir,
  uploadLocalPhotoToSupabase,
} from "../articlePhotos.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const companyId = process.env.COMPANY_ID;
const dryRun = process.argv.includes("--dry-run");

if (!supabaseUrl || !supabaseKey || !companyId) {
  console.error("Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o COMPANY_ID");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const photosDir = stylePhotosDir();

async function main() {
  console.log(`Subida masiva de fotos Style → Supabase`);
  console.log(`  company_id: ${companyId}`);
  console.log(`  photos_dir: ${photosDir}`);
  console.log(`  dry_run: ${dryRun}`);

  const { data, error } = await supabase
    .from("articles")
    .select("id, legacy_codart, legacy_photo_path, foto_url")
    .eq("company_id", companyId)
    .eq("estado", "activo")
    .not("legacy_codart", "is", null);

  if (error) throw error;

  let uploaded = 0;
  let skipped = 0;
  let missing = 0;

  for (const row of data ?? []) {
    const codart = String(row.legacy_codart ?? "").trim();
    const legacyPath = String(row.legacy_photo_path ?? "").trim();
    if (!codart || !legacyPath) {
      skipped++;
      continue;
    }

    const localPath = resolveLocalPhotoFile(photosDir, legacyPath);
    if (!localPath) {
      missing++;
      console.log(`  [sin fichero] ${codart} (${legacyPath})`);
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] ${codart} <- ${localPath}`);
      uploaded++;
      continue;
    }

    const fotoUrl = await uploadLocalPhotoToSupabase(supabase, companyId!, codart, localPath);
    await applyPhotoToSuiteArticle(supabase, companyId!, codart, fotoUrl, legacyPath.split(/[/\\]/).pop() ?? legacyPath);
    console.log(`  OK ${codart}`);
    uploaded++;
  }

  console.log(`Hecho: ${uploaded} subidas, ${skipped} sin legacy_photo_path, ${missing} sin fichero local`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
