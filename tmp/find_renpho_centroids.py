"""Find ink centroids in filled Renpho (fitted to blank 740x1024) for calibration."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(r"c:\Users\Luis\Documents\Suite\suite\tmp")
tmpl = np.asarray(Image.open(OUT.parent / "public/morphoscan/morphoscan-report-template.png").convert("RGB")).astype(np.int16)
filled = np.asarray(Image.open(OUT / "renpho-gemma-740x1024.png").convert("RGB")).astype(np.int16)
assert tmpl.shape == filled.shape, (tmpl.shape, filled.shape)

# Darker in filled than blank => data ink (and some anti-alias)
diff = tmpl.mean(axis=2) - filled.mean(axis=2)
ink = diff > 35

# Also blue bar fill (Renpho bars are blue, may not be darker than blank white if blank has no bar)
blue = (
    (filled[:, :, 2] > filled[:, :, 0] + 25)
    & (filled[:, :, 2] > filled[:, :, 1] + 10)
    & (filled[:, :, 2] < 220)
    & (filled[:, :, 0] < 160)
)


def centroids_in_box(mask, x1, x2, y1, y2, min_pix=8):
    """Return list of (cx, cy, n) for contiguous y-bands with ink in x range."""
    sub = mask[y1:y2, x1:x2]
    row = sub.any(axis=1)
    ys = np.where(row)[0]
    if len(ys) == 0:
        return []
    bands = []
    s = p = int(ys[0])
    for y in ys[1:]:
        y = int(y)
        if y - p <= 2:
            p = y
            continue
        bands.append((s, p))
        s = p = y
    bands.append((s, p))
    out = []
    for a, b in bands:
        patch = sub[a : b + 1]
        if patch.sum() < min_pix:
            continue
        yy, xx = np.where(patch)
        cx = float(xx.mean()) + x1
        cy = float(yy.mean()) + y1 + a
        out.append((round(cx, 1), round(cy, 1), int(patch.sum())))
    return out


def print_box(name, x1, x2, y1, y2, mask=ink, min_pix=8):
    pts = centroids_in_box(mask, x1, x2, y1, y2, min_pix=min_pix)
    print(f"{name}: {pts}")


print_box("header values", 90, 720, 65, 88, min_pix=4)
print_box("comp measure", 155, 245, 165, 335, min_pix=15)
print_box("comp range", 250, 335, 165, 335, min_pix=10)
print_box("comp eval", 345, 425, 165, 335, min_pix=10)
print_box("score digit", 490, 560, 130, 175, min_pix=20)
print_box("goals values", 620, 730, 220, 330, min_pix=8)
print_box("obesity numbers", 470, 560, 320, 470, min_pix=10)
print_box("other values", 620, 735, 800, 1010, min_pix=6)
print_box("imped values", 100, 430, 930, 1000, min_pix=5)
print_box("seg fat left", 20, 220, 620, 850, min_pix=10)
print_box("seg lean right", 240, 440, 620, 850, min_pix=10)

# Blue bar right-edge tips (value near tip)
print("\nBlue bar rows (muscle/fat + obesity):")
for y0 in range(390, 640, 2):
    row = blue[y0, 150:420]
    if row.sum() < 8:
        continue
    xs = np.where(row)[0]
    # contiguous run
    if xs[-1] - xs[0] < 10:
        continue
    # only print if this looks like a bar band (many blue px)
    if row.sum() > 25:
        tip = int(xs[-1]) + 150
        midy = y0
        print(f"  bar y~{midy} tip_x={tip} width={int(xs[-1]-xs[0])} n={int(row.sum())}")

# Body type blue/red dot
dot = (
    ((filled[:, :, 0] > 150) & (filled[:, :, 1] < 100) & (filled[:, :, 2] < 100))  # red
    | ((filled[:, :, 2] > 150) & (filled[:, :, 0] < 100) & (filled[:, :, 1] < 120))  # blue
)
ys, xs = np.where(dot[520:780, 480:720])
if len(xs):
    print("body type dots sample", list(zip((xs + 480)[:15], (ys + 520)[:15])))
    print("body type centroid", round(xs.mean() + 480, 1), round(ys.mean() + 520, 1), "n", len(xs))
