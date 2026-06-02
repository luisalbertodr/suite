"""Extrae silueta provisional desde captura Lookin'Body → public/inbody/body-silhouette.png"""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
src = Path(
    r"C:\Users\OportoW11\.cursor\projects\c-Users-OportoW11-Suite-suite\assets"
    r"\c__Users_OportoW11_AppData_Roaming_Cursor_User_workspaceStorage_0bdc9ba974a003a60dfb6868287c9ae0_images__265BB600-1C74-4F1C-BBFA-6797BCA1FB73_-71d57e4b-5911-4a8b-93e6-bb30233ede0b.png"
)
out_dir = ROOT / "public" / "inbody"
out_dir.mkdir(parents=True, exist_ok=True)
out = out_dir / "body-silhouette.png"

if not src.exists():
    raise SystemExit(f"No se encuentra imagen fuente: {src}")

im = Image.open(src).convert("RGBA")
w, h = im.size
crop = im.crop((int(w * 0.54), int(h * 0.39), int(w * 0.74), int(h * 0.71)))
px = crop.load()
cw, ch = crop.size
for y in range(ch):
    for x in range(cw):
        r, g, b, a = px[x, y]
        if r > 195 and g > 170 and b < 200:
            px[x, y] = (0, 0, 0, 0)
crop.save(out)
print(f"OK → {out} ({cw}x{ch})")
