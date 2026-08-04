#!/usr/bin/env python3
"""HTTP mínimo para que service-health-monitor dispare suite-waha-recover.sh."""
from __future__ import annotations

import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get("WAHA_RECOVER_BIND", "0.0.0.0")
PORT = int(os.environ.get("WAHA_RECOVER_PORT", "3399"))
SECRET = os.environ.get("WAHA_HOST_RECOVERY_SECRET", "").strip()
SCRIPT = os.environ.get("WAHA_RECOVER_SCRIPT", "/usr/local/bin/suite-waha-recover.sh")
LOG = os.environ.get("WAHA_RECOVER_AGENT_LOG", "/var/log/suite-waha-recover-agent.log")

_busy = threading.Lock()


def _log(msg: str) -> None:
    from datetime import datetime, timezone

    line = f"{datetime.now(timezone.utc).isoformat()} {msg}\n"
    try:
        with open(LOG, "a", encoding="utf-8") as fh:
            fh.write(line)
    except OSError:
        pass


class Handler(BaseHTTPRequestHandler):
    server_version = "suite-waha-recover/1.0"

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        _log("%s - %s" % (self.address_string(), fmt % args))

    def _json(self, code: int, body: dict) -> None:
        raw = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _authorized(self) -> bool:
        if not SECRET:
            return False
        hdr = self.headers.get("X-Recover-Secret") or self.headers.get("x-recover-secret") or ""
        auth = self.headers.get("Authorization") or ""
        if hdr == SECRET:
            return True
        if auth.lower().startswith("bearer ") and auth[7:].strip() == SECRET:
            return True
        return False

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") in ("/health", "/ping"):
            self._json(200, {"ok": True, "service": "waha-recover"})
            return
        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0].rstrip("/")
        if path not in ("/recover", "/api/recover"):
            self._json(404, {"ok": False, "error": "not_found"})
            return
        if not self._authorized():
            self._json(401, {"ok": False, "error": "unauthorized"})
            return

        length = int(self.headers.get("Content-Length") or 0)
        raw_body = self.rfile.read(length) if length > 0 else b""

        if not _busy.acquire(blocking=False):
            self._json(409, {"ok": False, "error": "recovery_in_progress"})
            return

        force = False
        try:
            parsed = json.loads(raw_body.decode("utf-8") or "{}")
            force = bool(parsed.get("force"))
        except Exception:  # noqa: BLE001
            force = b'"force": true' in raw_body.lower() or b'"force":true' in raw_body.lower()
        cmd = [SCRIPT] + (["--force"] if force else [])

        def _run() -> None:
            try:
                _log(f"Running: {' '.join(cmd)}")
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=600,
                    check=False,
                )
                _log(
                    f"Finished exit={proc.returncode} stdout_tail={(proc.stdout or '')[-500:]!r}"
                )
            except Exception as exc:  # noqa: BLE001
                _log(f"ERROR: {exc}")
            finally:
                _busy.release()

        threading.Thread(target=_run, daemon=True).start()
        self._json(
            202,
            {
                "ok": True,
                "started": True,
                "message": "WAHA host recovery started (pull+recreate)",
            },
        )


def main() -> None:
    if not SECRET:
        raise SystemExit("WAHA_HOST_RECOVERY_SECRET vacío")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    _log(f"Listening on {HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
