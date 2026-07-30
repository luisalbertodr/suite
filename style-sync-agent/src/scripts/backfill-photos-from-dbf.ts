/**
 * Rellena legacy_photo_path desde articulos.dbf en vivo (Style) y sube fotos a Supabase.
 * Uso: npx tsx src/scripts/backfill-photos-from-dbf.ts [--dry-run]
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { loadDbfIndexed, dbfStr } from "../dbfSource.js";
import {
  applyPhotoToSuiteArticle,
  resolveLocalPhotoFile,
  stylePhotosDir,
  uploadLocalPhotoToSupabase,
} from "../articlePhotos.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const companyId = process.env.COMPANY_ID;
const styleRoot = process.env.STYLE_ROOT ?? "C:\\Style-Dunasoft";
const dryRun = process.argv.includes("--dry-run");

if (!supabaseUrl || !supabaseKey || !companyId) {
  console.error("Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o COMPANY_ID");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const photosDir = stylePhotosDir();

function legacyBasename(p: string): string {
  return p.trim().replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? p.trim();
}

async function main() {
  console.log(`Backfill fotos desde articulos.dbf`);
  console.log(`  style_root: ${styleRoot}`);
  console.log(`  photos_dir: ${photosDir}`);
  console.log(`  dry_run: ${dryRun}`);

  const index = await loadDbfIndexed(styleRoot, "articulos", "codart");
  let pathsUpdated = 0;
  let uploaded = 0;
  let missingFile = 0;
  let noFoto = 0;

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, legacy_codart, legacy_photo_path, foto_url")
    .eq("company_id", companyId)
    .eq("estado", "activo")
    .not("legacy_codart", "is", null);

  if (error) throw error;

  for (const article of articles ?? []) {
    const codart = String(article.legacy_codart ?? "").trim();
    if (!codart) continue;

    const row = index.get(codart) ?? index.get(codart.replace(/^0+/, "") || "0");
    if (!row) continue;

    const foto = dbfStr(row, "foto").trim();
    if (!foto) {
      noFoto++;
      continue;
    }

    const needsPath = article.legacy_photo_path !== foto;
    const localPath = resolveLocalPhotoFile(photosDir, foto);
    const needsUpload = Boolean(localPath) && !article.foto_url;

    if (!needsPath && !needsUpload) continue;

    if (dryRun) {
      if (needsPath) console.log(`  [path] ${codart} -> ${foto}`);
      if (needsUpload && localPath) console.log(`  [upload] ${codart} <- ${localPath}`);
      if (needsUpload && !localPath) missingFile++;
      pathsUpdated += needsPath ? 1 : 0;
      uploaded += needsUpload && localPath ? 1 : 0;
      continue;
    }

    if (needsPath) {
      const { error: updErr } = await supabase
        .from("articles")
        .update({ legacy_photo_path: foto, updated_at: new Date().toISOString() })
        .eq("id", article.id);
      if (updErr) throw updErr;
      pathsUpdated++;
    }

    if (needsUpload && localPath) {
      const fotoUrl = await uploadLocalPhotoToSupabase(supabase, companyId, codart, localPath);
      await applyPhotoToSuiteArticle(supabase, companyId, codart, fotoUrl, legacyBasename(foto));
      uploaded++;
    } else if (needsUpload && !localPath) {
      missingFile++;
    }
  }

  console.log(
    `Hecho: paths=${pathsUpdated} subidas=${uploaded} sin_foto_dbf=${noFoto} sin_fichero=${missingFile}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
