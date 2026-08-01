"""Remove background + square crop for Ludo pawn sprites."""
from pathlib import Path
from rembg import remove
from PIL import Image

SRC = Path(
    r"C:\Users\TepIA\.cursor\projects\d-WEB-WEB-GAME\assets"
    r"\c__Users_TepIA_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"571259cdd28d60b3de751669f398f0ca_images_image-e1fb91b1-26b0-4b01-9af3-4526b9b50d31.png"
)
OUT = Path(r"d:\WEB\WEB GAME\client\public\ludo\pawns\clam-boy.png")
OUT.parent.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
cut = remove(img)

alpha = cut.split()[-1]
bbox = alpha.getbbox()
if bbox:
    pad = 12
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(cut.width, r + pad)
    b = min(cut.height, b + pad)
    cut = cut.crop((l, t, r, b))

side = max(cut.width, cut.height)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
ox = (side - cut.width) // 2
oy = side - cut.height  # bottom-align
square.paste(cut, (ox, oy), cut)

max_side = 512
if side > max_side:
    square = square.resize((max_side, max_side), Image.Resampling.LANCZOS)

square.save(OUT, "PNG", optimize=True)
print(f"saved {OUT} {square.size}")
