"""Recorta siluetas masculina/femenina y convierte fondo blanco a transparente."""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    r"C:\Users\OportoW11\.cursor\projects\c-Users-OportoW11-Suite-suite\assets"
    r"\c__Users_OportoW11_AppData_Roaming_Cursor_User_workspaceStorage_0bdc9ba974a003a60dfb6868287c9ae0_images__69557989-1B4D-4A24-87EC-3C2D7AEEBFAF_-1bb92931-68a7-466c-867a-7790155a17b0.png"
)
OUT_DIR = ROOT / "public" / "inbody"


def white_to_alpha(im: Image.Image, threshold: int = 240) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (0, 0, 0, 255)
    return im


def trim(im: Image.Image, pad: int = 8) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop(
        (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))
    )


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"No se encuentra imagen fuente: {SRC}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    mid = w // 2

    male = trim(white_to_alpha(im.crop((0, 0, mid, h))))
    female = trim(white_to_alpha(im.crop((mid, 0, w, h))))

    male_path = OUT_DIR / "body-silhouette-male.png"
    female_path = OUT_DIR / "body-silhouette-female.png"
    male.save(male_path)
    female.save(female_path)
    print(f"OK male  -> {male_path} ({male.size[0]}x{male.size[1]})")
    print(f"OK female -> {female_path} ({female.size[0]}x{female.size[1]})")


if __name__ == "__main__":
    main()
