"""Marca un legacy_import_run colgado en running como failed."""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from legacy_import_run_tracker import RunTracker


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

    print(f"Estado actual: {run.get('status')}  paso: {run.get('current_step')}")
    tracker.mark_failed("Marcado failed manualmente (run colgado en running)")
    print("OK → failed. Ahora: python scripts/legacy_import_worker.py --run-id", args.run_id)


if __name__ == "__main__":
    main()
