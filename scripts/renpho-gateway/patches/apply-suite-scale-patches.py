"""Aplica parches Suite (Pesar / Pesar+ + idle/active) en el gateway."""
from __future__ import annotations

import pathlib
import runpy

if __name__ == "__main__":
    script = pathlib.Path(__file__).resolve().parent / "apply-gateway-ble-fixes.py"
    runpy.run_path(str(script), run_name="__main__")
