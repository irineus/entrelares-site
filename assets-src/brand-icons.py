#!/usr/bin/env python3
"""T-57 — derive the site icons from the Entrelares brand mark.

THE MARK (U-29, 26/08/2026): a calendar card whose day cells draw the two
interlocked houses — the blue house and the amber house wear the calendar's own
day colours, the cells where they interlace are the rose `#E11D48`, each house
keeps a card-coloured "door" (an empty day), and the today ring sits on a shared
day. Background: the brand indigo `#4F46E5`. Every colour is a token from the
app's `lib/theme/tokens.dart` — the icon is the calendar screen, abstracted.

**This script is NOT the source of the mark.** The geometry lives in the app
repo, in `entrelares-flutter/store/brand-icons.py`, which draws it from data and
also writes `store/brand-calendario.svg` as the vector artifact. What lives here
is ONE master rendered by that script — `assets-src/brand-marca.png`, 1024²
full-bleed — plus the resizing below. **To change the art: edit the app repo's
script, re-run it, re-render this master from it, then run this file.** Never
edit a PNG by hand, and never re-draw the geometry here: two drawings of one
mark is how two repos drift.

Replaced the F-54 clay derivation on 28/08/2026. The AI-generated masters
(`brand-emblema.png`, `brand-emblema-flat.png`) had no vector source and were
deleted with this change; the app repo's copies went in the same delivery. The
old script needed a FLAT variant for the 96 px favicon, because at small sizes
the 3D render turned to mush — the mark is flat geometry now, so one master
serves every size.

Usage (needs Pillow):  python3 assets-src/brand-icons.py

Outputs:  public/favicon.png (96)   public/icon-192.png   public/icon-512.png

The OG banners are separate: `assets-src/og-cover.html` and `og-cover-en.html`,
rendered with headless Chrome. Their brand-row icon is the RENDERED
`public/icon-192.png`, so run THIS file FIRST — the banner then cannot show a
different mark from the one the site serves.
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "assets-src" / "brand-marca.png"

mark = Image.open(MASTER).convert("RGB")

for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (96, "favicon.png")):
    mark.resize((size, size), Image.LANCZOS).save(ROOT / "public" / name,
                                                  optimize=True)
    print("ok", name)

print("\nSubir o ?v= dos <link>/<meta> em public/*.html na MESMA entrega —")
print("sem isso o navegador continua servindo a marca antiga do cache.")
