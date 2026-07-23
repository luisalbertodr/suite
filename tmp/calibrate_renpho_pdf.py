"""Downscale filled Renpho PDF page and crop sections for calibration."""
from __future__ import annotations

from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont

PDF = Path(r"c:\Users\Luis\Downloads\Informe RENPHO.pdf")
OUT = Path(r"c:\Users\Luis\Documents\Suite\suite\tmp")
TEMPLATE = Path(r"c:\Users\Luis\Documents\Suite\suite\public\morphoscan\morphoscan-report-template.png")
OUT.mkdir(parents=True, exist_ok=True)

doc = fitz.open(PDF)
page = doc[0]
# Match blank template height if close; prefer width 740
zoom = 740 / page.rect.width
pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
filled_path = OUT / "renpho-gemma-740.png"
pix.save(str(filled_path))
print("filled", pix.width, pix.height)

filled = Image.open(filled_path).convert("RGB")
# If height != 1024, also save a stretched version matching template exactly for overlay compare
tmpl = Image.open(TEMPLATE).convert("RGB")
print("template", tmpl.size)

filled_fit = filled.resize(tmpl.size, Image.Resampling.LANCZOS)
filled_fit.save(OUT / "renpho-gemma-740x1024.png")

# Side-by-side compare
side = Image.new("RGB", (tmpl.width * 2 + 10, tmpl.height), (255, 255, 255))
side.paste(tmpl, (0, 0))
side.paste(filled_fit, (tmpl.width + 10, 0))
side.save(OUT / "renpho-blank-vs-filled.png")

# Grid on filled
grid = filled_fit.copy()
draw = ImageDraw.Draw(grid)
for x in range(0, grid.width, 50):
    draw.line([(x, 0), (x, grid.height)], fill=(255, 0, 0, 128), width=1)
    draw.text((x + 2, 2), str(x), fill=(255, 0, 0))
for y in range(0, grid.height, 50):
    draw.line([(0, y), (grid.width, y)], fill=(255, 0, 0, 128), width=1)
    draw.text((2, y + 2), str(y), fill=(255, 0, 0))
grid.save(OUT / "renpho-gemma-grid.png")

crops = {
    "header": (0, 0, 740, 130),
    "comp": (0, 130, 450, 380),
    "midleft": (0, 360, 450, 640),
    "seg": (0, 520, 450, 920),
    "righttop": (450, 70, 740, 370),
    "rightmid": (450, 340, 740, 640),
    "rightbot": (450, 640, 740, 920),
    "imped": (0, 880, 740, 1024),
}
for name, (x1, y1, x2, y2) in crops.items():
    filled_fit.crop((x1, y1, x2, y2)).save(OUT / f"renpho-filled-{name}.png")
    print("crop", name)

# Diff: where filled has darker pixels than blank (likely data ink)
import numpy as np

a = np.asarray(tmpl).astype(np.int16)
b = np.asarray(filled_fit).astype(np.int16)
# ink in filled but not in template
diff = (a.mean(axis=2) - b.mean(axis=2))
mask = diff > 40  # darker in filled
# Find connected-ish horizontal bands of ink in known value columns
print("diff ink pixels", int(mask.sum()))

# Sample known composition measure column x=190-240 for row ink centers
def dark_row_centers(x1, x2, y1, y2, thr=40):
    col = mask[y1:y2, x1:x2].mean(axis=1)
    hits = [i + y1 for i, v in enumerate(col) if v > 0.05]
    if not hits:
        return []
    bands = []
    s = p = hits[0]
    for y in hits[1:]:
        if y - p <= 2:
            p = y
            continue
        bands.append((s + p) // 2)
        s = p = y
    bands.append((s + p) // 2)
    return bands

print("comp measure rows", dark_row_centers(160, 240, 160, 340))
print("comp range rows", dark_row_centers(250, 330, 160, 340))
print("comp eval rows", dark_row_centers(345, 420, 160, 340))
print("score area", dark_row_centers(480, 560, 120, 180))
print("goals", dark_row_centers(620, 720, 210, 320))
print("obesity eval", dark_row_centers(620, 720, 320, 480))
print("other", dark_row_centers(620, 720, 800, 1020))
print("imped 20", dark_row_centers(100, 420, 930, 960))
print("imped 100", dark_row_centers(100, 420, 960, 1000))
print("header", dark_row_centers(100, 720, 60, 90))

# Find bar marker blue-ish vertical lines in muscle/fat zone
def blue_marker_ys(y1, y2):
    region = b[y1:y2]
    # blue-ish and darker than neighbors horizontally
    blues = []
    for yi in range(region.shape[0]):
        row = region[yi]
        for xi in range(150, 420):
            r, g, bl = row[xi]
            if bl > r + 30 and bl > g + 10 and bl < 200 and r < 120:
                blues.append((xi, yi + y1))
    return blues[:20], len(blues)

pts, n = blue_marker_ys(400, 520)
print("blue markers musclefat count", n, "sample", pts[:10])
pts2, n2 = blue_marker_ys(540, 640)
print("blue markers obesity count", n2, "sample", pts2[:10])

print("done")
