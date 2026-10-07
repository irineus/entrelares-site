// Phase 0 of the landing redesign (07/10/2026): one token file, two self-hosted fonts.
//
// L-51 (07/10/2026): Newsreader replaced Fraunces — its descending f and curly j read as crooked on
// the owner's phone, and no axis in the served subset removes them.
// There is no build step, so each page carries its own <style> with a copy of the tokens;
// /css/brand.css is linked AFTER that block and its :root wins. A page that forgets the link,
// or links it before its own CSS, silently renders the old slate/indigo palette — which is the
// defect this suite exists to catch. It also pins that the fonts the CSS names are on disk
// (a typo is a 404 the browser swallows by falling back to Georgia), that no page reaches for
// Google Fonts (privacy: the site talks to no third party but Umami), and that the two homes
// no longer use emoji as icons (the app banned them in U-31; each OS drew them differently).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const pages = walk(PUBLIC)
  .filter((p) => p.endsWith('.html'))
  .map((p) => ({ file: p.slice(PUBLIC.length + 1).replaceAll('\\', '/'), html: readFileSync(p, 'utf8') }));
const brand = readFileSync(join(PUBLIC, 'css', 'brand.css'), 'utf8');

test('every page links /css/brand.css once, after its inline <style> and inside <head>', () => {
  for (const { file, html } of pages) {
    const head = html.slice(0, html.indexOf('</head>'));
    const links = [...head.matchAll(/<link rel="stylesheet" href="\/css\/brand\.css" \/>/g)];
    assert.equal(links.length, 1, `${file}: exactly one brand.css link in <head>`);
    const lastStyle = head.lastIndexOf('</style>');
    assert.ok(lastStyle === -1 || lastStyle < links[0].index, `${file}: brand.css must come after the page's own <style>`);
    assert.equal((html.match(/\/css\/brand\.css/g) ?? []).length, 1, `${file}: brand.css is linked once`);
  }
});

test('the fonts brand.css names are on disk, preloaded by every page, and never fetched from a third party', () => {
  const urls = [...brand.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual(urls, ['/fonts/newsreader-latin.woff2', '/fonts/inter-latin.woff2']);
  for (const u of urls) {
    assert.ok(existsSync(join(PUBLIC, u)), `${u} is on disk`);
    assert.ok(existsSync(join(PUBLIC, 'fonts', u.includes('newsreader') ? 'LICENSE-Newsreader.txt' : 'LICENSE-Inter.txt')), 'the OFL licence ships beside the font');
  }
  for (const { file, html } of pages) {
    for (const u of urls) {
      assert.ok(html.includes(`<link rel="preload" href="${u}" as="font" type="font/woff2" crossorigin />`), `${file}: preloads ${u}`);
    }
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html), `${file}: no Google Fonts request`);
  }
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(brand), 'brand.css is self-hosted');
});

test('brand.css defines the tokens the pages rely on, in both colour schemes', () => {
  const light = brand.match(/:root \{([\s\S]*?)\n\}/)[1];
  const dark = brand.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\}/)[1];
  for (const t of ['--bg', '--card', '--bg-tint', '--line', '--ink', '--muted', '--indigo', '--indigo-deep', '--pink', '--deep', '--ink-rgb', '--brand-rgb']) {
    assert.ok(light.includes(`${t}:`), `light scheme defines ${t}`);
    assert.ok(dark.includes(`${t}:`), `dark scheme defines ${t}`);
  }
  assert.ok(light.includes('--font-display:') && light.includes('--font-body:'), 'the two font tokens exist');
  assert.ok(/color-scheme:\s*light dark/.test(light), 'form controls and scrollbars follow the scheme');
});

test('the old palette does not survive as a literal inside any page CSS, except in the page\'s own :root fallback', () => {
  // Each page keeps `:root { --ink: #1e293b; … }` on purpose: it is what renders if brand.css
  // ever fails to load. Everywhere else a slate/indigo literal means a rule brand.css cannot reach.
  const stale = /#(4f46e5|3730a3|db2777|1e293b|64748b|f8fafc|eef2ff|e2e8f0|03173d)\b/i;
  for (const { file, html } of pages) {
    for (const m of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      const hit = m[1].replace(/:root\s*\{[^}]*\}/g, '').match(stale);
      assert.equal(hit, null, `${file}: ${hit?.[0]} is a token now, not a literal`);
    }
    assert.ok(!/<meta name="theme-color" content="#03173d"/.test(html), `${file}: theme-color follows the scheme`);
  }
  assert.equal(readFileSync(join(PUBLIC, 'css', 'materiais.css'), 'utf8').match(stale), null, 'materiais.css uses the tokens');
});

// Phase 1 (07/10/2026): the homes are generated from one template with the copy injected, and
// the first English build shipped `'Dad's home'` inside a script — a syntax error that killed the
// hero calendar, the tabs and the mobile menu at once, with every structural test green. A browser
// reports it only in the console, so this lane parses every inline script the way the browser would.
test('every inline script on every page parses', () => {
  for (const { file, html } of pages) {
    for (const m of html.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)) {
      // L-50: the hero calendar is a <script type="module"> importing the generator's engine;
      // Function() has no module scope, so the import lines are dropped before parsing the rest.
      const body = m[1].replace(/^\s*import\s[\s\S]*?;\n/gm, "");
      assert.doesNotThrow(() => new Function(body), `${file}: an inline <script> does not parse`);
    }
  }
});

test('no emoji stands in for an icon in the two homes', () => {
  // Pictographs and the flags block; the check marks the CSS draws (✓ ✕) are typography, not icons.
  const emoji = /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2B50}\u{2705}]/u;
  for (const home of ['index.html', 'en/index.html']) {
    const html = readFileSync(join(PUBLIC, home), 'utf8');
    const hit = html.match(emoji);
    assert.equal(hit, null, `${home}: ${hit?.[0]} should be an SVG icon`);
  }
});
