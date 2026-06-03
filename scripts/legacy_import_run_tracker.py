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

    def _reset_connection(self) -> None:
        if self._conn and not self._conn.closed:
            try:
                self._conn.close()
            except Exception:
                pass
        self._conn = None

    def _update(self, **fields: Any) -> None:
        if not self.active:
            return
        for attempt in range(2):
            try:
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
                return
            except Exception:
                self._reset_connection()
                if attempt == 1:
                    raise

    def start(self, *, resume: bool = False) -> None:
        if not self.active:
            return
        fields: dict[str, Any] = {
            "status": "running",
            "current_step": "reanudando" if resume else "inicio",
            "error_message": None,
        }
        if not resume:
            fields["started_at"] = datetime.now(timezone.utc)
        self._update(**fields)

    def step_start(self, name: str, detail: str | None = None) -> None:
        if not self.active:
            return
        self._append_log(name, detail, status="started")
        self._update(current_step=detail or name)

    def set_progress(self, index: int, total: int, label: str) -> None:
        if not self.active or total <= 0:
            return
        pct = int(100 * index / total)
        self._update(current_step=f"{index}/{total} ({pct}%) {label}"[:500])

    def step_done(self, name: str, detail: str | None = None) -> None:
        if not self.active:
            return
        self._append_log(name, detail, status="done")

    def _append_log(self, name: str, detail: str | None, status: str) -> None:
        conn = self._connect()
        if not conn:
            return
        entry = {
            "step": name,
            "at": datetime.now(timezone.utc).isoformat(),
            "detail": detail,
            "status": status,
        }
        for attempt in range(2):
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE public.legacy_import_runs
                        SET steps_log = COALESCE(steps_log, '[]'::jsonb) || %s::jsonb
                        WHERE id = %s
                        """,
                        (Json([entry]), self.run_id),
                    )
                return
            except Exception:
                self._reset_connection()
                conn = self._connect()
                if attempt == 1:
                    raise

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
        try:
            self._update(
                status="failed",
                finished_at=datetime.now(timezone.utc),
                error_message=message[:2000],
            )
        except Exception:
            pass

    def load_run(self) -> dict | None:
        if not self.active:
            return None
        self._reset_connection()
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

    def get_completed_steps(self) -> set[str]:
        run = self.load_run()
        if not run:
            return set()

        log = [e for e in (run.get("steps_log") or []) if isinstance(e, dict)]
        if not log:
            return set()

        if any(e.get("status") == "done" for e in log):
            return {str(e["step"]) for e in log if e.get("status") == "done" and e.get("step")}

        # Formato antiguo: una entrada al iniciar cada paso
        names = [str(e["step"]) for e in log if e.get("step")]
        status = str(run.get("status") or "")
        if status == "failed" and len(names) >= 1:
            return set(names[:-1])
        if status == "completed":
            return set(names)
        return set(names[:-1]) if len(names) > 1 else set()

    def get_last_step_at(self) -> datetime | None:
        run = self.load_run()
        if not run:
            return None
        log = [e for e in (run.get("steps_log") or []) if isinstance(e, dict)]
        if not log:
            return None
        last = log[-1].get("at")
        if not last:
            return None
        try:
            return datetime.fromisoformat(str(last).replace("Z", "+00:00"))
        except Exception:
            return None

    def is_stale_running(self, stale_minutes: int = 15) -> bool:
        run = self.load_run()
        if not run or str(run.get("status")) != "running":
            return False
        ref = self.get_last_step_at()
        if ref is None and run.get("started_at"):
            try:
                ref = run["started_at"]
                if hasattr(ref, "tzinfo") and ref.tzinfo is None:
                    ref = ref.replace(tzinfo=timezone.utc)
            except Exception:
                ref = None
        if ref is None:
            return True
        if hasattr(ref, "timestamp"):
            age = datetime.now(timezone.utc) - ref
        else:
            return True
        return age.total_seconds() > stale_minutes * 60

    def mark_failed(self, message: str = "Interrumpido manualmente") -> None:
        self.fail(message)

    def close(self) -> None:
        self._reset_connection()

    # compat
    def step(self, name: str, detail: str | None = None) -> None:
        self.step_start(name, detail)
