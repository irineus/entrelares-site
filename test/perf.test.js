// L-44 — the home pages' screenshot images stay cheap.
//
// Both homes show the app's 1080x1920 captures in phone frames 268 px (hero, demo) and
// 194 px (gallery) wide. Until 02/10/2026 each <picture> named only the 1080 px WebP, so a
// phone at DPR 2 downloaded four times the pixels it painted, five times over in the hero
// slideshow (Lighthouse, mobile: ~290 KiB of "properly size images"). The smaller variants
// come from assets-src/screenshot-sizes.py; a typo in a srcset is a 404 the browser
// swallows silently by falling back, which is why this suite exists. Zero dependencies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const HOMES = ['index.html', 'en/index.html'];

const generatorWidths = (() => {
  const src = readFileSync(join(ROOT, 'assets-src', 'screenshot-sizes.py'), 'utf8');
  const m = src.match(/^WIDTHS = \(([^)]*)\)/m);
  assert.ok(m, 'assets-src/screenshot-sizes.py must declare `WIDTHS = (...)` at column 0');
  return m[1].split(',').map((s) => Number(s.trim())).filter(Boolean);
})();

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const shotPictures = (html) =>
  [...html.matchAll(/<picture>([\s\S]*?)<\/picture>/g)].map((m) => m[1]).filter((p) => p.includes('img/screenshots/'));

test('every screenshot <source> offers the generator widths plus the 1080 px original, all on disk', () => {
  for (const home of HOMES) {
    const html = readFileSync(join(PUBLIC, home), 'utf8');
    const pics = shotPictures(html);
    assert.ok(pics.length >= 10, `${home}: expected the ten screenshot pictures, found ${pics.length}`);
    for (const pic of pics) {
      const source = pic.match(/<source[^>]*>/)[0];
      assert.equal(attr(source, 'type'), 'image/webp');
      assert.ok(attr(source, 'sizes'), `${home}: a srcset with w descriptors needs sizes, or the browser assumes 100vw`);
      const entries = attr(source, 'srcset').split(',').map((c) => c.trim().split(/\s+/));
      assert.deepEqual(entries.map(([, d]) => Number(d.replace(/w$/, ''))), [...generatorWidths, 1080],
        `${home}: widths match WIDTHS in screenshot-sizes.py, then the original`);
      const base = entries.at(-1)[0].replace(/\.webp$/, '');
      for (const [url, d] of entries) {
        const w = Number(d.replace(/w$/, ''));
        assert.equal(url, w === 1080 ? `${base}.webp` : `${base}-${w}.webp`, `${home}: ${url} is the ${w} px file`);
        const file = join(PUBLIC, url.replace(/^\//, ''));
        assert.ok(existsSync(file), `${home}: ${url} is not on disk — run assets-src/screenshot-sizes.py`);
      }
      const img = pic.match(/<img[^>]*>/)[0];
      assert.equal(attr(img, 'src'), `${base}.png`, `${home}: the PNG stays the fallback src`);
      assert.equal(attr(img, 'width'), '1080');
      assert.equal(attr(img, 'height'), '1920');
    }
  }
});

test('only the first hero capture loads eagerly, at high priority; every other screenshot is lazy', () => {
  for (const home of HOMES) {
    const html = readFileSync(join(PUBLIC, home), 'utf8');
    const imgs = shotPictures(html).map((p) => p.match(/<img[^>]*>/)[0]);
    const [first, ...rest] = imgs;
    assert.equal(attr(first, 'loading'), 'eager', `${home}: the hero's first capture is visible at load`);
    assert.equal(attr(first, 'fetchpriority'), 'high', `${home}: the LCP candidate on a wide screen`);
    for (const img of rest) {
      assert.equal(attr(img, 'loading'), 'lazy', `${home}: ${attr(img, 'src')} should be lazy`);
      assert.equal(attr(img, 'fetchpriority'), undefined, `${home}: only one image may ask for high priority`);
    }
    assert.equal((html.match(/fetchpriority="high"/g) ?? []).length, 1, `${home}: one high-priority image per page`);
  }
});
