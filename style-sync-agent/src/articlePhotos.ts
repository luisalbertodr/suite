import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "article-photos";
const DEFAULT_PHOTOS_DIR = "C:\\Style-Dunasoft\\Fotografias";

const IMAGE_EXTENSIONS = [".bmp", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".BMP", ".JPG", ".JPEG", ".PNG"];

export function stylePhotosDir(): string {
  return process.env.STYLE_PHOTOS_DIR ?? DEFAULT_PHOTOS_DIR;
}

export function legacyBasename(legacyPath: string): string {
  const normalized = legacyPath.trim().replace(/\\/g, "/");
  return path.basename(normalized);
}

export function resolveLocalPhotoFile(photosDir: string, legacyPath: string): string | null {
  const name = legacyBasename(legacyPath);
  if (!name) return null;

  const direct = path.join(photosDir, name);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

  const stem = path.parse(name).name;
  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = path.join(photosDir, `${stem}${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export function storageObjectPath(companyId: string, codart: string, ext: string): string {
  const safeCodart = codart.replace(/[^A-Za-z0-9_-]/g, "_");
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  return `${companyId}/${safeCodart}${safeExt}`;
}

function contentTypeForExt(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === ".bmp") return "image/bmp";
  if (lower === ".png") return "image/png";
  if (lower === ".gif") return "image/gif";
  if (lower === ".webp") return "image/webp";
  return "image/jpeg";
}

export async function uploadLocalPhotoToSupabase(
  supabase: SupabaseClient,
  companyId: string,
  codart: string,
  localPath: string,
): Promise<string> {
  const ext = path.extname(localPath) || ".jpg";
  const objectPath = storageObjectPath(companyId, codart, ext);
  const buffer = fs.readFileSync(localPath);

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
    upsert: true,
    contentType: contentTypeForExt(ext),
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function applyPhotoToSuiteArticle(
  supabase: SupabaseClient,
  companyId: string,
  codart: string,
  fotoUrl: string,
  legacyPhotoPath: string,
): Promise<void> {
  const { error } = await supabase.schema("dunasoft").rpc("style_article_photo_apply", {
    p_company_id: companyId,
    p_legacy_codart: codart,
    p_foto_url: fotoUrl,
    p_legacy_photo_path: legacyPhotoPath,
  });
  if (error) throw new Error(error.message);
}

/** Style → Suite: sube fichero local a Storage y actualiza foto_url. */
export async function syncStylePhotoToSuite(
  supabase: SupabaseClient,
  companyId: string,
  codart: string,
  legacyPhotoPath: string,
  log: (msg: string) => void,
): Promise<void> {
  const trimmed = legacyPhotoPath.trim();
  if (!trimmed || !codart.trim()) return;

  const localPath = resolveLocalPhotoFile(stylePhotosDir(), trimmed);
  if (!localPath) {
    log(`article photo: sin fichero local ${codart} (${trimmed})`);
    return;
  }

  const fotoUrl = await uploadLocalPhotoToSupabase(supabase, companyId, codart, localPath);
  await applyPhotoToSuiteArticle(supabase, companyId, codart, fotoUrl, legacyBasename(trimmed));
  log(`article photo Style→Suite: ${codart} -> ${legacyBasename(trimmed)}`);
}

async function downloadUrlToFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download ${url}: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
}

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname);
    if (ext) return ext;
  } catch {
    /* ignore */
  }
  return ".jpg";
}

/** Suite → Style: descarga foto_url a Fotografias y devuelve nombre para articulos.foto. */
export async function prepareStylePhotoFromPayload(
  payload: Record<string, unknown>,
  log: (msg: string) => void,
): Promise<string> {
  const fotoUrl = String(payload["foto_url"] ?? "").trim();
  if (!fotoUrl) {
    return String(payload["foto"] ?? "").trim();
  }

  const codart = String(payload["codart"] ?? "").trim();
  const legacyFoto = String(payload["foto"] ?? "").trim();
  const photosDir = stylePhotosDir();
  fs.mkdirSync(photosDir, { recursive: true });

  let targetName = legacyFoto ? legacyBasename(legacyFoto) : "";
  if (!targetName) {
    const ext = extFromUrl(fotoUrl);
    targetName = codart ? `${codart.replace(/[^A-Za-z0-9_-]/g, "_")}${ext}` : `suite_${Date.now()}${ext}`;
  }

  const destPath = path.join(photosDir, targetName);
  try {
    await downloadUrlToFile(fotoUrl, destPath);
    log(`article photo Suite→Style: ${codart || targetName} -> ${targetName}`);
    return targetName;
  } catch (err) {
    log(`article photo download error: ${err instanceof Error ? err.message : String(err)}`);
    return legacyFoto ? legacyBasename(legacyFoto) : "";
  }
}
