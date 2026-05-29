"""
Ejecuta un pipeline legacy_import_runs encolado desde la UI.

Uso:
  python scripts/legacy_import_worker.py --run-id <uuid>
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from legacy_import_run_tracker import RunTracker
from legacy_company import get_company_id


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", required=True)
    args = ap.parse_args()

    tracker = RunTracker(args.run_id)
    run = tracker.load_run()
    if not run:
        sys.exit(f"Run no encontrado: {args.run_id}")

    if run.get("status") not in {"queued", "failed"}:
        print(f"Run en estado {run.get('status')}; omitiendo.")
        return

    mode = run.get("mode") or "refresh"
    options = run.get("options") or {}
    company_id = str(run.get("company_id") or get_company_id())

    tracker.start()
    try:
        import legacy_import_pipeline as pipeline

        pipeline.execute_pipeline(
            mode=mode,
            dry_run=False,
            skip_master=bool(options.get("skipMaster")),
            clean_import=bool(options.get("cleanImport")),
            include_fallback=bool(options.get("includeFallback")),
            company_id=company_id,
            tracker=tracker,
        )
        tracker.complete()
        print("Worker completado.")
    except SystemExit as exc:
        tracker.fail(str(exc))
        raise
    except Exception as exc:
        tracker.fail(str(exc))
        raise
    finally:
        tracker.close()


if __name__ == "__main__":
    main()
