# La planche à 390 px d'un mois mesuré par measure.ts : cartes dans l'ordre des dates, cinq par rangée.
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
src, dest = sys.argv[1], sys.argv[2]
rows = json.load(open(os.path.join(dest, "mesures.json")))["rows"]
W, H = 390, round(390 * 1350 / 1080)
cols, gap, label = 5, 16, 34
nrows = -(-len(rows) // cols)
sheet = Image.new("RGB", (cols * W + (cols + 1) * gap, nrows * (H + label) + (nrows + 1) * gap), "#EDEBE6")
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
except OSError:
    font = ImageFont.load_default()
for i, r in enumerate(rows):
    x = gap + (i % cols) * (W + gap); y = gap + (i // cols) * (H + label + gap)
    d.text((x, y), f"{r['n']}. {r['archetype']}" + (f" · {r['idiom']}" if r.get("idiom") else ""), fill="#222", font=font)
    d.text((x, y + 16), r.get("library") or "sans dessin", fill="#666", font=font)
    im = Image.open(os.path.join(src, f"{r['n']:02d}.png")).convert("RGB").resize((W, H), Image.LANCZOS)
    sheet.paste(im, (x, y + label))
sheet.save(os.path.join(dest, "planche-390.jpg"), quality=84)
print(sheet.size)
