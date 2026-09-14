#!/usr/bin/env python3
"""Responsive variants of the blog article images (L-04, 13/09/2026).

The four 1600 px JPEG masters in `public/blog/img/` are NOT touched: each one is the
`og:image`, the `twitter:image` and the JSON-LD `image` of its article, and social
scrapers want a JPEG at a URL that never moves. What this script writes, beside each
master, is the set the `<picture>` in `public/blog/*.html` references:

    <name>-<width>.avif · .webp · .jpg      for every width in WIDTHS

Every variant is a CENTRE CROP TO 16:9 first, then a resize. That is the crop the article
CSS already applies (`.post-img img { aspect-ratio: 16/9; object-fit: cover }`), so what
is served is exactly what is shown — and the one portrait master (1600×2400) stops
shipping the 60 % of its pixels the browser discarded anyway.

Run from the repo root, with Pillow >= 11 built with AVIF and WebP (12.3.0 verified):

    python assets-src/blog-images.py

Idempotent — re-run after replacing a master. Adding a width means adding it HERE and in
the four articles' `srcset`; `test/blog-images.test.js` reads WIDTHS out of this file and
fails when the HTML and the generator disagree, or when the HTML names a file that is not
on disk.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, features

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "public" / "blog" / "img"

# Rendered width is min(100vw - 40px, 680px) (article max-width 720 px, 20 px padding):
# 480 covers a phone at DPR 1, 720/1080 a phone at DPR 2-3, 1440 the 680 px column at DPR 2.
WIDTHS = (480, 720, 1080, 1440)
ASPECT = (16, 9)

# Quality settings measured on the four masters on 13/09/2026 — see the PR for the table.
JPEG_OPTS = {"quality": 78, "optimize": True, "progressive": True}
WEBP_OPTS = {"quality": 78, "method": 6}
AVIF_OPTS = {"quality": 60, "speed": 4}


def masters() -> list[Path]:
    """The originals: bare `<name>.jpg`, never a `<name>-<width>.jpg` this script wrote."""
    return sorted(
        p for p in IMG_DIR.glob("*.jpg") if not p.stem.rsplit("-", 1)[-1].isdigit()
    )


def crop_16_9(im: Image.Image) -> Image.Image:
    """Centre crop to ASPECT — the same crop as CSS `object-fit: cover` at 50 % 50 %."""
    w, h = im.size
    target_h = w * ASPECT[1] // ASPECT[0]
    if target_h <= h:
        top = (h - target_h) // 2
        return im.crop((0, top, w, top + target_h))
    target_w = h * ASPECT[0] // ASPECT[1]
    left = (w - target_w) // 2
    return im.crop((left, 0, left + target_w, h))


def main() -> int:
    if not (features.check("avif") and features.check("webp")):
        print("Pillow here lacks AVIF or WebP support — install a build that has both.")
        return 1

    rows: list[tuple[str, int, int, int, int]] = []
    for master in masters():
        with Image.open(master) as src:
            base = crop_16_9(src.convert("RGB"))
        if base.width < max(WIDTHS):
            print(f"{master.name}: master is {base.width} px wide, below {max(WIDTHS)}")
            return 1
        for width in WIDTHS:
            im = base.resize((width, width * ASPECT[1] // ASPECT[0]), Image.LANCZOS)
            stem = f"{master.stem}-{width}"
            jpg, webp, avif = (IMG_DIR / f"{stem}.{ext}" for ext in ("jpg", "webp", "avif"))
            im.save(jpg, "JPEG", **JPEG_OPTS)
            im.save(webp, "WEBP", **WEBP_OPTS)
            im.save(avif, "AVIF", **AVIF_OPTS)
            rows.append((stem, jpg.stat().st_size, webp.stat().st_size, avif.stat().st_size,
                         master.stat().st_size))

    print(f"{'variant':38} {'jpg':>8} {'webp':>8} {'avif':>8}   (master)")
    for stem, j, w, a, m in rows:
        print(f"{stem:38} {j // 1024:>6} K {w // 1024:>6} K {a // 1024:>6} K   ({m // 1024} K)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
