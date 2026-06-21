"""Validación de coherencia InBody (paridad con src/lib/inbodyQuality.ts)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def body_fat_mass_range_kg(
    weight_kg: float | None,
    pbfm_min: float | None,
    pbfm_max: float | None,
) -> tuple[float | None, float | None]:
    if pbfm_min is None or pbfm_max is None:
        return pbfm_min, pbfm_max
    if (
        pbfm_min > pbfm_max
        and pbfm_min <= 80
        and pbfm_max <= 80
        and weight_kg is not None
        and weight_kg > 0
    ):
        lo_pct = min(pbfm_min, pbfm_max)
        hi_pct = max(pbfm_min, pbfm_max)
        return weight_kg * lo_pct / 100.0, weight_kg * hi_pct / 100.0
    if pbfm_min > pbfm_max:
        return pbfm_max, pbfm_min
    return pbfm_min, pbfm_max


def _has_impedance(impedance: dict[str, Any] | None) -> bool:
    if not impedance:
        return False
    for block in impedance.values():
        if not isinstance(block, dict):
            continue
        for v in block.values():
            if v is not None and float(v) > 0:
                return True
    return False


def assess_inbody_issues(row: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    w = row.get("weight_kg")
    if w is None or float(w) <= 0:
        issues.append("missing_core_fields")
        return issues

    w = float(w)
    pbf = row.get("pbf_pct")
    bfm = row.get("body_fat_kg")
    ffm = row.get("ffm_kg")
    impedance = row.get("impedance")

    if pbf is None and bfm is None:
        issues.append("missing_core_fields")

    if pbf is not None and 0 < float(pbf) < 8 and w >= 40:
        issues.append("pbf_too_low")
    if pbf is not None and float(pbf) > 60:
        issues.append("pbf_too_high")

    if bfm is not None and w >= 40 and float(bfm) / w < 0.06:
        issues.append("body_fat_ratio_low")

    if pbf is not None and bfm is not None and abs(float(pbf) - (float(bfm) / w) * 100) > 8:
        issues.append("pbf_bfm_mismatch")

    if ffm is not None and bfm is not None and abs(w - (float(ffm) + float(bfm))) > 4:
        issues.append("composition_sum_mismatch")

    if w >= 40 and pbf is not None and not _has_impedance(impedance if isinstance(impedance, dict) else None):
        issues.append("missing_impedance")

    return issues


CRITICAL = {
    "pbf_too_low",
    "pbf_too_high",
    "body_fat_ratio_low",
    "pbf_bfm_mismatch",
    "composition_sum_mismatch",
    "missing_core_fields",
}


def is_suspicious(issues: list[str]) -> bool:
    return any(i in CRITICAL for i in issues)


def _quality_score(row: dict[str, Any]) -> int:
    issues = assess_inbody_issues(row)
    if is_suspicious(issues):
        return -100
    score = 0
    pbf = row.get("pbf_pct")
    if pbf is not None and float(pbf) >= 8:
        score += 2
    if row.get("body_fat_kg") is not None:
        score += 1
    imp = row.get("impedance")
    if _has_impedance(imp if isinstance(imp, dict) else None):
        score += 1
    return score


def _derive_hint(row: dict[str, Any], issues: list[str]) -> dict[str, Any] | None:
    w = row.get("weight_kg")
    if w is None or float(w) <= 0:
        return None
    w = float(w)
    pbf = row.get("pbf_pct")
    bfm = row.get("body_fat_kg")

    if "pbf_bfm_mismatch" in issues and pbf is not None and 8 <= float(pbf) <= 60:
        return {
            "pbf_pct": float(pbf),
            "body_fat_kg": w * float(pbf) / 100.0,
            "weight_kg": w,
            "source": "pbf_derived",
        }
    if "pbf_bfm_mismatch" in issues and bfm is not None and float(bfm) / w >= 0.06:
        return {
            "pbf_pct": float(bfm) / w * 100.0,
            "body_fat_kg": float(bfm),
            "weight_kg": w,
            "source": "bfm_derived",
        }
    return None


def build_data_quality(
    row: dict[str, Any],
    siblings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    issues = assess_inbody_issues(row)
    suspicious = is_suspicious(issues)
    reference: dict[str, Any] | None = None

    if suspicious and siblings:
        target_t = row.get("measured_at")
        if isinstance(target_t, datetime):
            target_ts = target_t.timestamp()
        else:
            target_ts = datetime.fromisoformat(str(target_t).replace("Z", "+00:00")).timestamp()

        candidates = [
            s for s in siblings
            if s.get("id") != row.get("id") and _quality_score(s) >= 0
        ]
        if candidates:
            def dist(s: dict[str, Any]) -> float:
                mt = s.get("measured_at")
                if isinstance(mt, datetime):
                    ts = mt.timestamp()
                else:
                    ts = datetime.fromisoformat(str(mt).replace("Z", "+00:00")).timestamp()
                return abs(ts - target_ts)

            reference = min(candidates, key=dist)

    hint = _derive_hint(row, issues)
    if hint is None and reference:
        hint = {
            "pbf_pct": reference.get("pbf_pct"),
            "body_fat_kg": reference.get("body_fat_kg"),
            "weight_kg": reference.get("weight_kg"),
            "source": "reference_measurement",
        }

    return {
        "status": "suspicious" if suspicious else "ok",
        "needs_repeat": suspicious,
        "issues": issues,
        "hint": hint,
        "reference_measurement_id": reference.get("id") if reference else None,
        "reference_measured_at": (
            reference["measured_at"].isoformat()
            if reference and isinstance(reference.get("measured_at"), datetime)
            else (str(reference["measured_at"]) if reference else None)
        ),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
