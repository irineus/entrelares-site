#!/usr/bin/env python3
"""F-54 — derive the site icons from the official Entrelares brand artwork.

Two masters, both AI-generated and approved by the owner (no vector source — ask
for a new generation to change the art, then re-run this script):

- assets-src/brand-emblema.png (1024x1024, TEXT-FREE): the 3D emblem — two
  interlocked house-rings (sage fabric + terracotta wood) bleeding over a white
  squircle plaque, children lighting a flame at the junction, embossed houses.
  Used for icon-192/icon-512 (full frame, already centred with margin).
- assets-src/brand-emblema-flat.png (1380x752): the flat/"vector-style" rendition
  of the same emblem. Used ONLY for favicon.png (96): at small sizes the flat
  linework stays crisp where the 3D render turns to mush. The plaque sits at
  (388,38)-(1005,658); the favicon is the 640x640 crop (376,28)-(1016,668).

Usage (needs Pillow):  python3 assets-src/brand-icons.py

Outputs:  public/favicon.png (96)   public/icon-192.png   public/icon-512.png

The app repo carries its own copy of the masters and of this script
(store/brand-emblema*.png + store/brand-icons.py, which also builds the maskable
variants) — regenerate BOTH repos when the artwork changes.
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FLAT_CROP = (376, 28, 1016, 668)  # 640x640 square centred on the flat plaque

emblem = Image.open(ROOT / "assets-src" / "brand-emblema.png").convert("RGB")
flat = Image.open(ROOT / "assets-src" / "brand-emblema-flat.png").convert("RGB")

for size, name in ((192, "icon-192.png"), (512, "icon-512.png")):
    emblem.resize((size, size), Image.LANCZOS).save(ROOT / "public" / name, optimize=True)
    print("ok", name)

flat.crop(FLAT_CROP).resize((96, 96), Image.LANCZOS).save(
    ROOT / "public" / "favicon.png", optimize=True)
print("ok favicon.png")
