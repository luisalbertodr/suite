"""
Parseo de fecha de nacimiento Dunasoft (fecnac) → yyyy-MM-dd.
Misma lógica que src/lib/birthDateParse.ts
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any

EN_MONTH = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}


def _to_ymd(year: int, month: int, day: int) -> str | None:
    if year < 1900 or year > 2100:
        return None
    try:
        d = date(year, month, day)
    except ValueError:
        return None
    return d.isoformat()


def parse_fecnac_to_ymd(raw: Any) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, date):
        return raw.isoformat()
    s = str(raw).strip()
    if not s:
        return None

    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        y, m, d = map(int, s[:10].split("-"))
        return _to_ymd(y, m, d)

    digits = re.sub(r"\D", "", s)
    if len(digits) == 8:
        y1, m1, d1 = int(digits[:4]), int(digits[4:6]), int(digits[6:8])
        if 1900 <= y1 <= 2100:
            ok = _to_ymd(y1, m1, d1)
            if ok:
                return ok
        d2, m2, y2 = int(digits[:2]), int(digits[2:4]), int(digits[4:8])
        return _to_ymd(y2, m2, d2)

    m = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$", s)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:
            year += 1900 if year >= 30 else 2000
        return _to_ymd(year, month, day)

    return None
