#!/usr/bin/env python3
"""Cataloga consentimientos/cuestionarios/seguimientos desde Z:\\datos y genera migración SQL."""

from __future__ import annotations

import json
import re
import unicodedata
import zipfile
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(r"Z:\datos\CONSENTIMIENTOS- CUESTIONARIOS")
OUT_MANIFEST = ROOT / "tmp" / "clinical_documents_manifest.json"
OUT_SQL = ROOT / "supabase" / "migrations" / "20260616180000_clinical_documents_catalog.sql"

SKIP_EXT = {".lnk", ".xlsx", ".jpg"}
TEXT_EXT = {".pdf", ".doc", ".docx", ".odt", ".rtf"}


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s.lower()).strip("_")
    return s[:80] or "doc"


def normalize_key(name: str) -> str:
    n = name.lower()
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode("ascii")
    for token in [
        "consentimiento", "consent", "informado", "cuestionario", "questionnaire",
        "seguimiento", "hoja", "ficha", "diagnostico", "diagnóstico", "modelo",
        "const", "nuevo", "modificado", "logo", "compressed", "meso", "doc", "pdf",
        "odt", "rtf", "docx", "2024", "2025", "2026", "2018", "2021", "2022", "2023",
        "2016", "2019", "2015", "2014", "2013", "2017", "2020", "1", "01",
    ]:
        n = re.sub(rf"\b{re.escape(token)}\b", " ", n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def extract_pdf(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def extract_docx(path: Path) -> str:
    from docx import Document

    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def extract_odt(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("content.xml").decode("utf-8", errors="ignore")
    xml = re.sub(r"<text:line-break/>", "\n", xml)
    xml = re.sub(r"<text:s[^>]*/>", " ", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract_rtf(path: Path) -> str:
    from striprtf.striprtf import rtf_to_text

    return rtf_to_text(path.read_text(encoding="utf-8", errors="ignore"))


def extract_doc_binary(path: Path) -> str:
    data = path.read_bytes()
    chunks: list[str] = []
    i = 0
    while i < len(data) - 1:
        if 0x20 <= data[i] < 0x7F and data[i + 1] == 0:
            chars: list[str] = []
            while i < len(data) - 1 and data[i + 1] == 0 and 0x20 <= data[i] < 0x7F:
                chars.append(chr(data[i]))
                i += 2
            if len(chars) >= 24:
                chunks.append("".join(chars))
        i += 1
    return "\n".join(chunks)


def extract_text(path: Path) -> str:
    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            return extract_pdf(path)
        if ext == ".docx":
            return extract_docx(path)
        if ext == ".odt":
            return extract_odt(path)
        if ext == ".rtf":
            return extract_rtf(path)
        if ext == ".doc":
            return extract_doc_binary(path)
    except Exception as exc:  # noqa: BLE001
        return f"[No se pudo extraer texto automáticamente: {exc}]"
    return ""


def classify(path: Path, rel: str, name: str) -> dict:
    lower = name.lower()
    rel_lower = rel.lower()
    document_kind = "consent"
    tracking_family = None
    requires_measurements = False
    linked_tracking_codigo = None
    category = "estetica"

    if "consentimientos medicina" in rel_lower.replace("\\", "/"):
        category = "medicina"
        document_kind = "consent"

    if any(k in lower for k in ["cuestionario", "questionnaire", "diagnostico", "diagnóstico", "diagn"]):
        document_kind = "questionnaire"
    elif any(k in lower for k in ["seguimiento", "hoja de seguimiento", "ficha seguimiento"]):
        document_kind = "tracking"
    elif any(k in lower for k in ["ley de proteccion", "protección de datos", "imagenes", "imágenes", "datos personales"]):
        document_kind = "admin"
    elif "consent" in lower or "consentimiento" in lower or lower.startswith("ci-"):
        document_kind = "consent"

    depilacion_keys = [
        "laser", "ipl", "fotodepilacion", "fotodepilación", "depilacion", "depilación",
        "electrica", "eléctrica", "fotoestimulacion", "fotoestimulación",
    ]
    aesthetic_keys = [
        "indiba", "lpg", "lipomassage", "presoterapia", "microneedling", "peeling",
        "cosmelan", "drenaje", "facial", "corporal", "fotorrejuvenecimiento",
        "micropigment", "meso", "hialuron", "toxina", "skydermic", "neaivia", "lesiones",
        "implantes", "hidroxiapatita",
    ]

    if document_kind == "tracking":
        if any(k in lower for k in depilacion_keys):
            tracking_family = "depilacion"
        else:
            tracking_family = "aesthetic"
        requires_measurements = tracking_family == "aesthetic" and "micropigment" not in lower
    elif document_kind == "consent":
        if any(k in lower for k in depilacion_keys):
            linked_tracking_codigo = "tracking_depilacion"
        elif any(k in lower for k in aesthetic_keys):
            linked_tracking_codigo = "tracking_aesthetic"
            requires_measurements = any(k in lower for k in ["lpg", "corporal", "lipomassage", "indiba"])

    if document_kind == "questionnaire" and any(k in lower for k in depilacion_keys):
        linked_tracking_codigo = "tracking_depilacion"
    elif document_kind == "questionnaire" and any(k in lower for k in ["facial", "corporal", "dieta"]):
        linked_tracking_codigo = "tracking_aesthetic"

    return {
        "document_kind": document_kind,
        "tracking_family": tracking_family,
        "requires_measurements": requires_measurements,
        "linked_tracking_codigo": linked_tracking_codigo,
        "category": category,
    }


def guess_keywords(name: str, meta: dict) -> str:
    lower = name.lower()
    tokens = []
    for word in re.split(r"[^a-zA-Z0-9áéíóúñ]+", lower):
        if len(word) >= 3:
            tokens.append(word)
    if meta["tracking_family"] == "depilacion":
        tokens.extend(["laser", "ipl", "depilacion", "electrica"])
    if "indiba" in lower:
        tokens.extend(["indiba", "radiofrecuencia"])
    if "lpg" in lower:
        tokens.extend(["lpg", "endermologie"])
    if "cosmelan" in lower:
        tokens.append("cosmelan")
    if meta["category"] == "medicina":
        tokens.extend(["medicina", "medico"])
    return ",".join(dict.fromkeys(tokens))[:500]


def guess_tipo(name: str, meta: dict) -> str:
    if meta["document_kind"] == "tracking":
        return "Seguimiento por sesiones"
    if meta["document_kind"] == "questionnaire":
        return "Cuestionario / diagnóstico"
    if meta["document_kind"] == "admin":
        return "Administrativo / LOPD"
    if meta["category"] == "medicina":
        return "Medicina estética"
    if meta["tracking_family"] == "depilacion" or meta["linked_tracking_codigo"] == "tracking_depilacion":
        return "Depilación"
    return "Tratamiento estético"


def guess_titulo(name: str) -> str:
    base = Path(name).stem
    base = re.sub(r"\(\d+\)", "", base).strip()
    base = re.sub(r"\s+", " ", base)
    return base[:180]


@dataclass
class DocEntry:
    path: str
    rel_path: str
    filename: str
    slug: str
    dedupe_key: str
    modified_at: str
    size: int
    document_kind: str
    tracking_family: str | None
    requires_measurements: bool
    linked_tracking_codigo: str | None
    category: str
    codigo: str
    tipo: str
    titulo: str
    keywords: str
    orden: int
    contenido: str = ""
    skipped: bool = False
    skip_reason: str | None = None


def collect_files() -> list[Path]:
    files: list[Path] = []
    for path in SOURCE_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() in SKIP_EXT:
            continue
        if path.suffix.lower() not in TEXT_EXT:
            continue
        files.append(path)
    return files


def dedupe(entries: list[DocEntry]) -> list[DocEntry]:
    by_key: dict[str, DocEntry] = {}
    for entry in entries:
        prev = by_key.get(entry.dedupe_key)
        if not prev:
            by_key[entry.dedupe_key] = entry
            continue
        if entry.modified_at > prev.modified_at:
            prev.skipped = True
            prev.skip_reason = f"Duplicado más antiguo que {entry.filename}"
            by_key[entry.dedupe_key] = entry
        else:
            entry.skipped = True
            entry.skip_reason = f"Duplicado más antiguo que {prev.filename}"
    return list(by_key.values())


def sql_dollar_tag(codigo: str) -> str:
    tag = re.sub(r"[^a-zA-Z0-9_]", "_", codigo)
    if not tag or not tag[0].isalpha():
        tag = f"d_{tag}"
    return f"${tag}$"


def sql_quote(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def sql_bool(value: bool) -> str:
    return "true" if value else "false"


def main() -> None:
    raw_entries: list[DocEntry] = []
    for idx, path in enumerate(sorted(collect_files(), key=lambda p: p.stat().st_mtime)):
        rel = str(path.relative_to(SOURCE_ROOT))
        name = path.name
        meta = classify(path, rel, name)
        stat = path.stat()
        modified = datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds")
        slug = slugify(name)
        dedupe_key = normalize_key(name)
        if meta["document_kind"] == "tracking":
            dedupe_key = f"tracking:{meta['tracking_family']}:{dedupe_key}"
        codigo = slug
        entry = DocEntry(
            path=str(path),
            rel_path=rel,
            filename=name,
            slug=slug,
            dedupe_key=dedupe_key,
            modified_at=modified,
            size=stat.st_size,
            codigo=codigo,
            tipo=guess_tipo(name, meta),
            titulo=guess_titulo(name),
            keywords=guess_keywords(name, meta),
            orden=idx,
            contenido="",
            **meta,
        )
        raw_entries.append(entry)

    # Manual dedupe: prefer newest within semantic group (partial match on normalized key)
    group_patterns = [
        ("cosmelan", ["cosmelan"]),
        ("indiba_consent", ["indiba"]),
        ("laser_ipl_q", ["laser o ipl", "laser ipl"]),
        ("facial_corporal_q", ["facialcorporal", "facial corporal"]),
        ("microneedling", ["microneedling"]),
        ("micropigmentacion", ["micropigment"]),
        ("lltd_tfbd", ["lltd", "tfbd"]),
    ]
    for _label, patterns in group_patterns:
        group = [
            e for e in raw_entries
            if any(p in normalize_key(e.filename) for p in patterns)
        ]
        if len(group) <= 1:
            continue
        winner = max(group, key=lambda e: e.modified_at)
        for entry in group:
            if entry is not winner:
                entry.skipped = True
                entry.skip_reason = f"Grupo duplicado; preferido {winner.filename}"

    entries = dedupe(raw_entries)
    active = [e for e in entries if not e.skipped]

    # Skip already seeded indiba in previous migration - update instead via ON CONFLICT
    for entry in active:
        text = extract_text(Path(entry.path))
        text = re.sub(r"\r\n?", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if len(text) < 120:
            text = (
                f"{entry.titulo}\n\n"
                f"[Documento importado desde {entry.filename}. "
                "Revise el contenido en Configuración → Consentimientos si la extracción automática fue incompleta.]"
            )
        entry.contenido = text[:120000]

    # Ensure canonical tracking templates exist even if deduped
    tracking_templates = [
        DocEntry(
            path="",
            rel_path="",
            filename="SEGUIMIENTO FOTODEPILACION.doc",
            slug="tracking_depilacion",
            dedupe_key="tracking:depilacion:canonical",
            modified_at=datetime.now().isoformat(timespec="seconds"),
            size=0,
            document_kind="tracking",
            tracking_family="depilacion",
            requires_measurements=False,
            linked_tracking_codigo=None,
            category="estetica",
            codigo="tracking_depilacion",
            tipo="Seguimiento por sesiones",
            titulo="Seguimiento depilación (láser / IPL / eléctrica)",
            keywords="laser,ipl,depilacion,electrica,fotodepilacion,session",
            orden=1,
            contenido=(
                "Plantilla de seguimiento cronológico por sesiones para depilación (láser, IPL y depilación eléctrica).\n\n"
                "Cada sesión queda registrada en el historial del tratamiento con fecha, zona, parámetros y observaciones."
            ),
        ),
        DocEntry(
            path="",
            rel_path="",
            filename="HOJA DE SEGUIMIENTO.doc",
            slug="tracking_aesthetic",
            dedupe_key="tracking:aesthetic:canonical",
            modified_at=datetime.now().isoformat(timespec="seconds"),
            size=0,
            document_kind="tracking",
            tracking_family="aesthetic",
            requires_measurements=True,
            linked_tracking_codigo=None,
            category="estetica",
            codigo="tracking_aesthetic",
            tipo="Seguimiento por sesiones",
            titulo="Seguimiento tratamientos (facial / corporal / INDIBA / LPG…)",
            keywords="facial,corporal,indiba,lpg,radiofrecuencia,lpg,session",
            orden=2,
            contenido=(
                "Plantilla de seguimiento cronológico por sesiones para tratamientos estéticos "
                "(facial, corporal, radiofrecuencia INDIBA, LPG, presoterapia, etc.).\n\n"
                "Incluye referencia de medidas corporales según sexo del cliente."
            ),
        ),
    ]
    existing_codes = {e.codigo for e in active}
    for tpl in tracking_templates:
        if tpl.codigo not in existing_codes:
            active.append(tpl)

    manifest = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source_root": str(SOURCE_ROOT),
        "total_files": len(raw_entries),
        "active": len(active),
        "skipped": len(raw_entries) - len(active),
        "entries": [asdict(e) for e in sorted(raw_entries, key=lambda x: x.filename.lower())],
    }
    OUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    OUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "-- Catálogo documental clínico: consentimientos, cuestionarios, seguimientos y medicina.",
        "",
        "ALTER TABLE public.consentimiento_plantillas",
        "  ADD COLUMN IF NOT EXISTS document_kind TEXT NOT NULL DEFAULT 'consent',",
        "  ADD COLUMN IF NOT EXISTS tracking_family TEXT,",
        "  ADD COLUMN IF NOT EXISTS requires_measurements BOOLEAN NOT NULL DEFAULT false,",
        "  ADD COLUMN IF NOT EXISTS linked_tracking_codigo TEXT,",
        "  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'estetica',",
        "  ADD COLUMN IF NOT EXISTS measurement_assets JSONB,",
        "  ADD COLUMN IF NOT EXISTS source_filename TEXT,",
        "  ADD COLUMN IF NOT EXISTS source_modified_at TIMESTAMPTZ;",
        "",
        "ALTER TABLE public.historial_clinico",
        "  ADD COLUMN IF NOT EXISTS tracking_family TEXT,",
        "  ADD COLUMN IF NOT EXISTS plantilla_codigo TEXT,",
        "  ADD COLUMN IF NOT EXISTS consentimiento_id UUID REFERENCES public.consentimientos(id) ON DELETE SET NULL;",
        "",
        "ALTER TABLE public.historial_clinico_revisiones",
        "  ADD COLUMN IF NOT EXISTS session_data JSONB NOT NULL DEFAULT '{}'::jsonb;",
        "",
        "CREATE INDEX IF NOT EXISTS idx_historial_clinico_tracking",
        "  ON public.historial_clinico (customer_id, tracking_family, fecha DESC);",
        "",
        "-- Plantillas canónicas de seguimiento (medidas adjuntas en frontend /clinical/*)",
        "",
    ]

    measurement_assets = json.dumps(
        {"male": "/clinical/medidas-hombre.jpg", "female": "/clinical/medidas-mujer.docx"},
        ensure_ascii=False,
    )

    for entry in sorted(active, key=lambda e: (e.document_kind, e.titulo.lower())):
        assets = "NULL"
        if entry.requires_measurements or entry.codigo == "tracking_aesthetic":
            assets = f"{sql_quote(measurement_assets)}::jsonb"
        tag = sql_dollar_tag(entry.codigo)
        insert = f"""
INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version,
  document_kind, tracking_family, requires_measurements, linked_tracking_codigo,
  category, measurement_assets, source_filename, source_modified_at
)
SELECT
  c.id,
  {sql_quote(entry.codigo)},
  {sql_quote(entry.tipo)},
  {sql_quote(entry.titulo)},
  {tag}{entry.contenido}{tag},
  {sql_quote(entry.keywords)},
  {entry.orden},
  true,
  1,
  {sql_quote(entry.document_kind)},
  {sql_quote(entry.tracking_family)},
  {sql_bool(entry.requires_measurements)},
  {sql_quote(entry.linked_tracking_codigo)},
  {sql_quote(entry.category)},
  {assets},
  {sql_quote(entry.filename or None)},
  {sql_quote(entry.modified_at)}::timestamptz
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = {sql_quote(entry.codigo)}
);
""".strip()
        lines.append(insert)
        lines.append("")

    # Update existing indiba with new metadata
    lines.append("""
UPDATE public.consentimiento_plantillas
SET
  document_kind = 'consent',
  linked_tracking_codigo = 'tracking_aesthetic',
  requires_measurements = true,
  category = 'estetica',
  measurement_assets = '{"male":"/clinical/medidas-hombre.jpg","female":"/clinical/medidas-mujer.docx"}'::jsonb
WHERE codigo = 'indiba_deep_beauty_2024';
""".strip())

    OUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Manifest: {OUT_MANIFEST} ({len(raw_entries)} files, {len(active)} active)")
    print(f"SQL: {OUT_SQL} ({OUT_SQL.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
