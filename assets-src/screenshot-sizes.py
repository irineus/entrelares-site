#!/usr/bin/env python3
"""Smaller WebP variants of the app screenshots on both homes (L-44, 02/10/2026).

The screenshots in `public/img/screenshots/` (PT-BR) and `public/img/screenshots/en/`
(English) are 1080x1920 captures: a lossless PNG plus a WebP at quality 82. Every
`<picture>` on `public/index.html` and `public/en/index.html` used to name only the
1080 px WebP, yet the largest phone frame on the page is 290 px wide (268 px of screen)
and the gallery frame 210 px (194 px of screen). A phone at DPR 2 downloaded four times
the pixels it painted, five times over in the hero slideshow alone.

What this script writes, beside each capture, is the set the `srcset` on both homes
references:

    <name>-<width>.webp      for every width in WIDTHS

The 1080 px `<name>.webp` stays the largest candidate (a DPR 3 phone still wants it) and
the PNG stays the fallback `src`, both untouched. Each variant is a plain resize of the
PNG (never of the lossy WebP, so nothing is compressed twice), at the SAME quality the
1080 px WebP was made with — 82, measured on 02/10/2026: re-encoding the PNG at 82
reproduces the published file byte for byte.

Run from the repo root, with Pillow built with WebP:

    python assets-src/screenshot-sizes.py

Idempotent. Re-run after replacing a capture (the L-21 re-shoot), or the small variants
keep showing the old screen while the 1080 px one shows the new. Adding a width means
adding it HERE and in every screenshot `srcset` on both homes;
`test/perf.test.js` reads WIDTHS out of this file and fails when the HTML and the
generator disagree, or when the HTML names a file that is not on disk.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, features

ROOT = Path(__file__).resolve().parent.parent
DIRS = (ROOT / "public" / "img" / "screenshots", ROOT / "public" / "img" / "screenshots" / "en")

# 540 covers the hero/demo frame (268 px) at DPR 2 and the gallery frame (194 px) up to
# DPR 2.75; 720 covers the hero frame up to DPR 2.6. The 1080 px original covers the rest.
WIDTHS = (540, 720)
WEBP_OPTS = {"quality": 82, "method": 6}


def captures(folder: Path) -> list[Path]:
    """The lossless originals: every `<name>.png` in the folder."""
    return sorted(folder.glob("*.png"))


def main() -> int:
    if not features.check("webp"):
        print("Pillow here lacks WebP support — install a build that has it.")
        return 1

    print(f"{'variant':52} {'webp':>8}   (1080 px webp)")
    for folder in DIRS:
        for png in captures(folder):
            with Image.open(png) as src:
                base = src.convert("RGB")
            w, h = base.size
            for width in WIDTHS:
                im = base.resize((width, round(h * width / w)), Image.LANCZOS)
                out = folder / f"{png.stem}-{width}.webp"
                im.save(out, "WEBP", **WEBP_OPTS)
                full = folder / f"{png.stem}.webp"
                rel = out.relative_to(ROOT).as_posix()
                print(f"{rel:52} {out.stat().st_size // 1024:>6} K   ({full.stat().st_size // 1024} K)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
