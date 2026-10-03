// The same top menu on every page (owner, 03/10/2026).
//
// #151 made the home's header fit on one line; every other page still carried an older
// four-item menu in its own order, with no language switch — so the menu changed as the
// reader moved around the site. There is no build step and no template here: each page
// carries its own copy of the header markup and CSS, so the only thing that keeps the
// copies equal is this suite. It reads the files the way the server maps them (zero
// dependencies, node:test + node:fs, same lane as the others).
//
// What it pins, for every page whose <header> has a .nav-links:
//   - the ordered LABELS (and the .nav-opt / .nav-opt2 classes that decide which items
//     leave first at medium widths) equal the reference for that page's language — the
//     home keeps its own in-page anchors and its "Instalar"; the other PT pages say
//     "Rotinas" in that slot and link back to the home's sections;
//   - every href resolves: an extensionless path to a file on disk, an anchor to an id
//     that exists on the page it points at;
//   - the PT | EN switch exists, outside .nav-links (hidden below 820px), and pairs each
//     page with its sibling when it has one;
//   - the CTA pill reads like the home's;
//   - the header CSS carries the one-line rules (nowrap, 1200px nav, both breakpoints).

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
const byFile = Object.fromEntries(pages.map((p) => [p.file, p.html]));

const headerOf = (html) => html.match(/<header>([\s\S]*?)<\/header>/)?.[1] ?? null;
const navOf = (header) => header.match(/<nav class="nav-links"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? null;
const withMenu = pages.filter((p) => {
  const h = headerOf(p.html);
  return h && navOf(h) !== null;
});

// [label, class] — the class is what decides which items leave first (1180px, then 980px).
const PT_HOME = [
  ['Como funciona', ''], ['Simulador', 'nav-opt'], ['Por quê', 'nav-opt2'], ['Benefícios', 'nav-opt'],
  ['Instalar', 'nav-opt'], ['Preços', ''], ['Dúvidas', 'nav-opt2'], ['Blog', ''],
];
const PT_INTERNAL = PT_HOME.map(([l, c]) => [l === 'Instalar' ? 'Rotinas' : l, c]);
const EN = [
  ['How it works', ''], ['Why', 'nav-opt2'], ['Features', 'nav-opt'], ['Install', 'nav-opt'],
  ['Pricing', ''], ['FAQ', 'nav-opt2'],
];
const PT_INTERNAL_HREFS = [
  '/#como-funciona', '/ferramentas/gerador-de-rotina-de-guarda', '/#porque', '/#beneficios',
  '/rotinas/', '/#precos', '/#faq', '/blog/',
];
const EN_ABS_HREFS = ['/en/#how-it-works', '/en/#why', '/en/#features', '/en/#install', '/en/#pricing', '/en/#faq'];

const isEn = (file) => file.startsWith('en/');
const isHome = (file) => file === 'index.html' || file === 'en/index.html';
const referenceFor = (file) => (isEn(file) ? EN : file === 'index.html' ? PT_HOME : PT_INTERNAL);

const linksOf = (nav) =>
  [...nav.matchAll(/<a\s([^>]*)>([^<]*)<\/a>/g)].map((m) => ({
    attrs: m[1],
    label: m[2].trim(),
    href: m[1].match(/href="([^"]*)"/)?.[1],
    cls: m[1].match(/class="([^"]*)"/)?.[1] ?? '',
    current: /aria-current="page"/.test(m[1]),
  }));

const fileFor = (path) => {
  const rel = path.endsWith('/') ? `${path.slice(1)}index.html` : `${path.slice(1)}.html`;
  return existsSync(join(PUBLIC, rel)) ? rel : null;
};
const hasId = (html, id) => new RegExp(`\\sid="${id}"`).test(html);

test('every page with a header menu is accounted for, and the pages without one are the known few', () => {
  // 404 (one file for the whole site, bilingual), the two bilingual single pages whose header
  // is the brand alone (relatorio, exclusao-de-conta) and the two legal pages, which have no
  // header at all. A NEW page lands with the menu, or lands on this list with a reason.
  const without = pages.filter((p) => !withMenu.includes(p)).map((p) => p.file).sort();
  assert.deepEqual(without, ['404.html', 'exclusao-de-conta.html', 'privacidade.html', 'relatorio.html', 'termos.html']);
  assert.ok(withMenu.length >= 24, `only ${withMenu.length} pages carry the menu`);
});

for (const { file, html } of withMenu) {
  const header = headerOf(html);
  const nav = navOf(header);
  const links = linksOf(nav);

  test(`${file}: the menu has the reference items, in order, with the same priority classes`, () => {
    assert.deepEqual(
      links.map((l) => [l.label, l.cls]),
      referenceFor(file),
    );
    if (!isHome(file)) {
      assert.deepEqual(links.map((l) => l.href), isEn(file) ? EN_ABS_HREFS : PT_INTERNAL_HREFS);
    }
  });

  test(`${file}: every menu link resolves`, () => {
    for (const { href, label } of links) {
      assert.ok(href, `${label} has no href`);
      assert.doesNotMatch(href, /\.html/, `${label}: the site never names the .html form (L-23)`);
      if (href.startsWith('#')) {
        assert.ok(hasId(html, href.slice(1)), `${label}: #${href.slice(1)} is not on ${file}`);
        continue;
      }
      const [path, anchor] = href.split('#');
      const target = fileFor(path);
      assert.ok(target, `${label}: ${path} answers nothing`);
      if (anchor) assert.ok(hasId(byFile[target], anchor), `${label}: #${anchor} is not on ${target}`);
    }
  });

  test(`${file}: the current page's own item is marked, and only that one`, () => {
    const expected = file.startsWith('blog/') ? 'Blog'
      : file.startsWith('rotinas/') ? 'Rotinas'
      : file === 'ferramentas/gerador-de-rotina-de-guarda.html' ? 'Simulador'
      : null;
    assert.deepEqual(links.filter((l) => l.current).map((l) => l.label), expected ? [expected] : []);
  });

  test(`${file}: the PT | EN switch is in the header, outside .nav-links, paired with the sibling`, () => {
    assert.doesNotMatch(nav, /lang-switch/);
    const sw = header.match(/<div class="lang-switch" role="group" aria-label="([^"]+)">([\s\S]*?)<\/div>/);
    assert.ok(sw, 'no .lang-switch in the header');
    const [, aria, body] = sw;
    const other = body.match(/<a href="([^"]+)" hreflang="([^"]+)"/);
    assert.ok(other, 'the switch has no link to the other language');
    const pairs = {
      'index.html': '/en/',
      'para-toda-familia.html': '/en/for-every-family',
      'en/index.html': '/',
      'en/for-every-family.html': '/para-toda-familia',
    };
    if (isEn(file)) {
      assert.equal(aria, 'Language');
      assert.match(body, /<span class="lang-on" aria-current="true">EN<\/span>/);
      assert.equal(other[2], 'pt-BR');
    } else {
      assert.equal(aria, 'Idioma');
      assert.match(body, /<span class="lang-on" aria-current="true">PT<\/span>/);
      assert.equal(other[2], 'en');
    }
    // A page with a language sibling links to IT (and declares it in hreflang); every other
    // PT page sends the reader to the English home — the blog, tools and legal pages are
    // PT-only on purpose (L-16).
    const expected = pairs[file] ?? '/en/';
    assert.equal(other[1], expected);
    if (pairs[file]) {
      assert.ok(fileFor(expected), `${expected} answers nothing`);
      assert.match(html, new RegExp(`<link rel="alternate" hreflang="${other[2]}" href="https://entrelares\\.app${expected.replaceAll('/', '\\/')}"`));
    } else {
      assert.match(body, /title="English version — home"/);
    }
  });

  test(`${file}: the CTA pill reads like the home's`, () => {
    const cta = header.match(/<a class="btn btn-primary"([^>]*)>([\s\S]*?)<\/a>/);
    assert.ok(cta, 'no CTA pill in the header');
    assert.match(cta[1], /href="https:\/\/web\.entrelares\.app"/);
    assert.equal(
      cta[2],
      isEn(file)
        ? '<span class="cta-full">Open the app</span><span class="cta-short">Open</span>'
        : '<span class="cta-full">Entrar no app</span><span class="cta-short">Entrar</span>',
    );
    // The analytics series is not this suite's to change: the two homes' header pill has
    // always counted as `cta-signup`, every other page's header pill never sent an event.
    // Unifying the menu moved neither — pinned so a copy-paste of the home's tag does not
    // silently start feeding the cta-signup baseline from forty-odd article headers.
    const event = cta[1].match(/data-umami-event="([^"]+)"/)?.[1] ?? null;
    assert.equal(event, isHome(file) ? 'cta-signup' : null);
  });

  test(`${file}: the header sits on the content width, links centred on one line, both breakpoints`, () => {
    const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('').replace(/\s+/g, '');
    // The header is the page's own content grid (owner, 03/10/2026): brand and CTA line up
    // with the content's left and right edges, so the nav wrap is the plain 1060px `.wrap`
    // and nothing widens or narrows it for the header alone.
    assert.match(header, /^\s*<div class="wrap nav">/);
    assert.ok(css.includes('.wrap{max-width:1060px;margin:0auto;padding:020px;}'), '.wrap is not the 1060px content width');
    assert.doesNotMatch(css, /\.wrap\.nav\{|\.nav\.wrap\{|header\.wrap\{/, 'the header wrap must not have its own width');
    for (const rule of [
      '.nav{display:flex;align-items:center;gap:12px;height:64px;}',
      '.nav-links{display:flex;flex:1;justify-content:center;align-items:center;gap:16px;margin:012px;}',
      '.nav-linksa{color:var(--muted);text-decoration:none;font-size:14.5px;font-weight:500;}',
      '.brand,.nav.btn,.nav-linksa{white-space:nowrap;}',
      '.brand,.nav.btn{flex-shrink:0;}',
      '@media(max-width:1180px){.nav-links.nav-opt{display:none;}}',
      '@media(max-width:980px){.nav-links.nav-opt2{display:none;}}',
      '.lang-switch{display:inline-flex;',
      '.lang-switch.lang-on{background:var(--bg-tint);color:var(--indigo);}',
      '.lang-switch{margin-left:auto;}',
      '.cta-full{display:none;}',
      '@media(max-width:420px){.brand{font-size:0;gap:0;}',
    ]) {
      assert.ok(css.includes(rule), `missing: ${rule}`);
    }
    if (!isHome(file)) assert.ok(css.includes('.nav-linksa[aria-current="page"]{color:var(--ink);font-weight:600;}'));
  });
}
