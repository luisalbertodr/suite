"""Actualiza progreso de legacy_import_runs desde scripts Python."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

try:
    import psycopg2
    from psycopg2.extras import Json, RealDictCursor
except ImportError:
    psycopg2 = None  # type: ignore


class RunTracker:
    def __init__(self, run_id: str | None, dsn: str | None = None):
        self.run_id = (run_id or "").strip() or None
        self.dsn = (dsn or os.environ.get("SUPABASE_DB_URL", "")).strip()
        self._conn = None

    @property
    def active(self) -> bool:
        return bool(self.run_id and self.dsn and psycopg2)

    def _connect(self):
        if not self.active:
            return None
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self.dsn)
            self._conn.autocommit = True
        return self._conn

    def _update(self, **fields: Any) -> None:
        if not self.active:
            return
        conn = self._connect()
        if not conn:
            return
        sets = []
        vals: list[Any] = []
        for key, val in fields.items():
            sets.append(f"{key} = %s")
            vals.append(val)
        vals.append(self.run_id)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE public.legacy_import_runs SET {', '.join(sets)} WHERE id = %s",
                vals,
            )

    def start(self) -> None:
        if not self.active:
            return
        self._update(
            status="running",
            started_at=datetime.now(timezone.utc),
            current_step="inicio",
        )

    def step(self, name: str, detail: str | None = None) -> None:
        if not self.active:
            return
        conn = self._connect()
        if not conn:
            return
        entry = {
            "step": name,
            "at": datetime.now(timezone.utc).isoformat(),
            "detail": detail,
        }
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.legacy_import_runs
                SET current_step = %s,
                    steps_log = COALESCE(steps_log, '[]'::jsonb) || %s::jsonb
                WHERE id = %s
                """,
                (name, Json([entry]), self.run_id),
            )

    def complete(self) -> None:
        if not self.active:
            return
        self._update(
            status="completed",
            current_step="completado",
            finished_at=datetime.now(timezone.utc),
            error_message=None,
        )

    def fail(self, message: str) -> None:
        if not self.active:
            return
        self._update(
            status="failed",
            finished_at=datetime.now(timezone.utc),
            error_message=message[:2000],
        )

    def load_run(self) -> dict | None:
        if not self.active:
            return None
        conn = self._connect()
        if not conn:
            return None
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM public.legacy_import_runs WHERE id = %s",
                (self.run_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def close(self) -> None:
        if self._conn and not self._conn.closed:
            self._conn.close()
