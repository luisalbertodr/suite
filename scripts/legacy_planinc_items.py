"""
Utilidades compartidas: ítems de cita desde legacy.planart y texto PLANART en planinc.
"""
from __future__ import annotations

import json
import re
from typing import Any

PLANART_SEGMENT_RE = re.compile(
    r"\[\s*\d{1,2}:\d{2}\s*\]\s*([A-Za-z0-9._-]+)\s*[-–—]\s*([^[\]]+)",
    re.IGNORECASE,
)


def parse_codart_lines_from_planart_text(text: str) -> list[tuple[str, str]]:
    """Extrae (codart, descripción) de texto PLANART Dunasoft."""
    raw = str(text or "").strip()
    if not raw:
        return []

    found: list[tuple[str, str]] = []
    for match in PLANART_SEGMENT_RE.finditer(raw):
        cod = match.group(1).strip()
        des = re.sub(r"\s+", " ", match.group(2).strip())
        if cod:
            found.append((cod, des or cod))

    if not found:
        simple = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*(.+)$", raw)
        if simple:
            found.append((simple.group(1).strip(), simple.group(2).strip()))

    deduped: list[tuple[str, str]] = []
    seen: set[str] = set()
    for cod, des in found:
        key = cod.upper()
        if key in seen:
            continue
        seen.add(key)
        deduped.append((cod, des))
    return deduped


def collect_planart_rows_for_group(
    group: list[dict],
    planart_by_idplan: dict[str, list[dict]],
) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    rows: list[dict] = []
    for seg in group:
        idp = str(seg.get("idplan") or "").strip()
        if not idp:
            continue
        for pa in planart_by_idplan.get(idp, []):
            cod = str(pa.get("codart") or "").strip()
            key = (idp, cod)
            if not cod or key in seen:
                continue
            seen.add(key)
            rows.append(pa)
    return rows


def collect_planart_rows_from_group_text(
    group: list[dict],
    planart_by_idplan: dict[str, list[dict]],
) -> list[dict]:
    """Filas planart de tabla; si no hay, sintetiza desde planart/planartx del planinc."""
    rows = collect_planart_rows_for_group(group, planart_by_idplan)
    if rows:
        return rows

    seen_cod: set[str] = set()
    pseudo: list[dict] = []
    for seg in group:
        for field in ("planart_txt", "planart_raw"):
            txt = str(seg.get(field) or "").strip()
            if not txt:
                continue
            for cod, des in parse_codart_lines_from_planart_text(txt):
                key = cod.upper()
                if key in seen_cod:
                    continue
                seen_cod.add(key)
                pseudo.append({"codart": cod, "hora": None, "artcom": des})
    return pseudo


def parse_codart_lines_from_sale_notes(notes: str | None) -> list[tuple[str, str]]:
    if not notes:
        return []
    try:
        data = json.loads(notes)
    except json.JSONDecodeError:
        return []
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return []
    found: list[tuple[str, str]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        name = str(it.get("name") or "").strip()
        if not name:
            continue
        parsed = parse_codart_lines_from_planart_text(name)
        if parsed:
            found.extend(parsed)
        else:
            simple = re.match(r"^([A-Za-z0-9._-]+)\s*[-–—]\s*(.+)$", name)
            if simple:
                found.append((simple.group(1).strip(), simple.group(2).strip()))
    deduped: list[tuple[str, str]] = []
    seen: set[str] = set()
    for cod, des in found:
        key = cod.upper()
        if key in seen:
            continue
        seen.add(key)
        deduped.append((cod, des))
    return deduped


def pseudo_planart_from_codart_lines(lines: list[tuple[str, str]]) -> list[dict]:
    return [{"codart": cod, "hora": None, "artcom": des} for cod, des in lines]


def templates_need_repair(current_items: list[dict], new_templates: list[dict]) -> bool:
    if not new_templates:
        return False
    if not current_items:
        return True

    cur_has_article = any(it.get("article_id") for it in current_items)
    new_has_article = any(t.get("article_id") for t in new_templates)
    if new_has_article and not cur_has_article:
        return True

    generic_labels = {"servicio", "cita importada", "artículo"}
    cur_generic = all(
        str(it.get("label") or "").strip().lower() in generic_labels
        or not str(it.get("label") or "").strip()
        for it in current_items
    )
    if cur_generic and new_has_article:
        return True

    new_labels = {str(t.get("label") or "").strip().lower() for t in new_templates}
    cur_labels = {str(it.get("label") or "").strip().lower() for it in current_items}
    if new_labels != cur_labels and new_has_article:
        return True

    return False


def item_templates_signature(templates: list[dict]) -> tuple:
    sig: list[tuple] = []
    for t in templates:
        sig.append(
            (
                str(t.get("kind") or ""),
                str(t.get("label") or ""),
                int(t.get("duration_minutes") or 0),
                str(t.get("article_id") or ""),
                float(t.get("unit_price") or 0),
            )
        )
    return tuple(sig)
