// L-23 — every address the site publishes about itself is the one that answers 200.
//
// Cloudflare's static assets (`html_handling: "auto-trailing-slash"`) serve a page WITHOUT
// its extension: `/privacidade` is the 200 and `/privacidade.html` answers a **307** — a
// TEMPORARY redirect, which tells a crawler the bouncing address is still the real one. Until
// 14/09/2026 eight of the sitemap's twelve <loc> entries bounced, and the same eight pages
// declared the bouncing form as their own `canonical`: canonical → 307 → a page whose
// canonical points back. Nothing went red, because nothing serves the site in this lane.
// This suite reads the files the way the server maps them. Zero dependencies — node:test +
// node:fs, same lane as the Worker tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const ORIGIN = 'https://entrelares.app';

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const pages = walk(PUBLIC)
  .filter((p) => p.endsWith('.html'))
  .map((p) => ({ file: p.slice(PUBLIC.length + 1).replaceAll('\\', '/'), html: readFileSync(p, 'utf8') }));

const sitemap = readFileSync(join(PUBLIC, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

// The file the assets binding serves for an extensionless path: `/x/` → x/index.html,
// `/x` → x.html. Returns null when nothing on disk answers.
const fileFor = (path) => {
  const rel = path.endsWith('/') ? `${path.slice(1)}index.html` : `${path.slice(1)}.html`;
  return existsSync(join(PUBLIC, rel)) ? rel : null;
};

test('the sitemap is not empty (a broken regex would make every rule below pass)', () => {
  assert.ok(locs.length >= 10, `expected the sitemap's pages, found ${locs.length} <loc>`);
});

// L-29 — the sitemap has to be XML a strict parser accepts, and nothing here parsed it.
// From 06/08 to 15/09/2026 the explanatory comment at the top quoted a git command with
// double-hyphen flags; `--` is illegal inside an XML comment, the parser stopped there, and
// Google read the rest (the comment quoted a meta, a link and a head tag) as HTML: Search
// Console said "Sitemap is HTML", 0 discovered pages, for the whole life of the blog cluster.
// Every regex test in this file passed over it, because a regex does not care. No XML
// dependency exists in this lane, so the check is the well-formedness rules this file can
// actually break: the declaration first, legal comments, and one balanced tree of the six
// sitemap elements.
test('the sitemap is well-formed XML (a regex reading it proves nothing about that)', () => {
  assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
    'the XML declaration must be the very first bytes (no BOM, no blank line)');

  for (const [, body] of sitemap.matchAll(/<!--([\s\S]*?)-->/g)) {
    assert.ok(!body.includes('--'), 'two hyphens in a row are illegal inside an XML comment');
    assert.ok(!body.endsWith('-'), 'a comment may not end in a hyphen before its closing -->');
    assert.ok(!/[<>]/.test(body),
      'no angle brackets in a comment: if it ever breaks, the quoted tags are what makes Google read HTML');
  }

  const tree = sitemap.replace(/^<\?xml[^?]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!tree.includes('<!--') && !tree.includes('-->'), 'an unterminated comment');
  const allowed = new Set(['urlset', 'url', 'loc', 'lastmod', 'changefreq', 'priority']);
  const stack = [];
  for (const [tag, close, name] of tree.matchAll(/<(\/?)([^\s>/]+)[^>]*>/g)) {
    assert.ok(allowed.has(name), `unexpected markup ${tag} — a sitemap holds only its six elements`);
    if (close) assert.equal(stack.pop(), name, `${tag} closes an element that is not open`);
    else stack.push(name);
  }
  assert.deepEqual(stack, [], `unclosed: ${stack.join(', ')}`);
  assert.match(tree.trim(), /^<urlset [^>]*>[\s\S]*<\/urlset>$/, 'one <urlset> root and nothing around it');
});

test('no <loc> names the .html form, and every one maps to a page on disk', () => {
  for (const loc of locs) {
    assert.ok(loc.startsWith(`${ORIGIN}/`), `${loc} is not on ${ORIGIN}`);
    assert.ok(!loc.endsWith('.html'), `${loc} answers 307 — list the form without .html`);
    assert.ok(fileFor(loc.slice(ORIGIN.length)), `${loc} has no file under public/`);
  }
});

test("each sitemap page declares its <loc> as canonical, og:url and JSON-LD address", () => {
  for (const loc of locs) {
    const file = fileFor(loc.slice(ORIGIN.length));
    if (!file) continue; // reported by the test above, with the address in the message
    const { html } = pages.find((p) => p.file === file);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    assert.ok(canonical, `${file} has no canonical`);
    assert.equal(canonical[1], loc, `${file}: canonical and sitemap must name the same address`);
    const og = html.match(/<meta property="og:url" content="([^"]+)"/);
    if (og) assert.equal(og[1], loc, `${file}: og:url`);
    for (const m of html.matchAll(/"mainEntityOfPage": "([^"]+)"/g)) {
      assert.equal(m[1], loc, `${file}: JSON-LD mainEntityOfPage`);
    }
  }
});

test('no page links to, or names, the bouncing .html form of a page', () => {
  const bouncing = /(?:href="|content="|": ")(?:https:\/\/entrelares\.app)?[^"#?]*\.html/g;
  for (const { file, html } of pages) {
    const hits = [...html.matchAll(bouncing)].map((m) => m[0]);
    assert.deepEqual(hits, [], `${file} still points at a .html address (a 307 per click)`);
  }
});

test('every internal page link resolves to a file — the extensionless rewrite broke nothing', () => {
  // Assets keep their extension (css, images, pdf…); only extensionless paths are pages.
  const link = /href="(\/[^"#?]*)[^"]*"/g;
  for (const { file, html } of pages) {
    for (const [, path] of html.matchAll(link)) {
      if (path.startsWith('//') || /\.[a-z0-9]+$/i.test(path) || path.startsWith('/api/')) continue;
      assert.ok(fileFor(path), `${file} links to ${path}, which no file under public/ serves`);
    }
  }
});

// L-39 — "Para toda família" is an INDEXED page with an English twin: both are in the
// sitemap, both answer extensionless (a file on disk), and they name each other through
// reciprocal hreflang with x-default on the PT-BR page, the L-16 pattern.
test('L-39: /para-toda-familia and /en/for-every-family are listed, served and paired', () => {
  const pair = { pt: '/para-toda-familia', en: '/en/for-every-family' };
  for (const path of Object.values(pair)) {
    assert.ok(locs.includes(`${ORIGIN}${path}`), `${path} is missing from the sitemap`);
    assert.ok(fileFor(path), `${path} has no file on disk`);
  }
  for (const path of Object.values(pair)) {
    const html = readFileSync(join(PUBLIC, fileFor(path)), 'utf8');
    assert.ok(!/<meta[^>]+noindex/i.test(html), `${path} must stay indexable`);
    assert.match(html, new RegExp(`hreflang="pt-BR" href="${ORIGIN}${pair.pt}"`));
    assert.match(html, new RegExp(`hreflang="en" href="${ORIGIN}${pair.en}"`));
    assert.match(html, new RegExp(`hreflang="x-default" href="${ORIGIN}${pair.pt}"`));
  }
});

// L-40 — the neutral checklist is an indexed article: listed, served extensionless, and
// linked from the blog index. Its answers box names no other app — only questions above it.
test('L-40: the "como escolher" article is listed, served and linked from the blog', () => {
  const path = '/blog/como-escolher-app-guarda-compartilhada';
  assert.ok(locs.includes(`${ORIGIN}${path}`), `${path} is missing from the sitemap`);
  assert.ok(fileFor(path), `${path} has no file on disk`);
  const html = readFileSync(join(PUBLIC, fileFor(path)), 'utf8');
  assert.ok(!/<meta[^>]+noindex/i.test(html), 'the article must stay indexable');
  assert.match(html, /id="respostas-entrelares"/, 'our answers sit in their own box');
  const blogIndex = readFileSync(join(PUBLIC, 'blog', 'index.html'), 'utf8');
  assert.match(blogIndex, new RegExp(`href="${path}"`));
});

// L-42 — the three holiday articles (Natal e Ano-Novo, férias escolares, como combinar)
// are indexed, served extensionless, linked from the blog index, cross-linked to each
// other, and reached from the two older guides that talk about feriados e férias.
test('L-42: the holiday articles are listed, served and linked', () => {
  const paths = [
    '/blog/natal-e-ano-novo-guarda-compartilhada',
    '/blog/ferias-escolares-guarda-compartilhada',
    '/blog/como-combinar-festas-com-o-outro-responsavel',
  ];
  const read = (path) => readFileSync(join(PUBLIC, fileFor(path)), 'utf8');
  const blogIndex = readFileSync(join(PUBLIC, 'blog', 'index.html'), 'utf8');
  for (const path of paths) {
    assert.ok(locs.includes(`${ORIGIN}${path}`), `${path} is missing from the sitemap`);
    assert.ok(fileFor(path), `${path} has no file on disk`);
    const html = read(path);
    assert.ok(!/<meta[^>]+noindex/i.test(html), `${path} must stay indexable`);
    assert.match(blogIndex, new RegExp(`href="${path}"`), `${path} is not on the blog index`);
    for (const other of paths.filter((p) => p !== path)) {
      assert.match(html, new RegExp(`href="${other}"`), `${path} does not link to ${other}`);
    }
  }
  for (const older of ['/blog/como-montar-calendario-guarda-compartilhada', '/blog/modelos-de-rotina-guarda-compartilhada']) {
    const html = read(older);
    assert.match(html, new RegExp(`href="${paths[0]}"`), `${older} does not link to the Natal article`);
    assert.match(html, new RegExp(`href="${paths[1]}"`), `${older} does not link to the férias article`);
  }
  // The product claims of the "como combinar" article live in their own box, the L-40 shape.
  assert.match(read(paths[2]), /id="como-o-entrelares-ajuda"/);
});

// L-43 — the routine pages (/rotinas/<id>) and their index are indexed, served
// extensionless, and reached from the routine guide, the generator and the blog index.
test('L-43: the routine pages are listed, served and linked', () => {
  const index = '/rotinas/';
  const paths = ['2-2-3', '5-2-2-5', '1-1', '3-4-4-3', 'fins-de-semana-alternados'].map((id) => `/rotinas/${id}`);
  const read = (path) => readFileSync(join(PUBLIC, fileFor(path)), 'utf8');
  for (const path of [index, ...paths]) {
    assert.ok(locs.includes(`${ORIGIN}${path}`), `${path} is missing from the sitemap`);
    assert.ok(fileFor(path), `${path} has no file on disk`);
    assert.ok(!/<meta[^>]+noindex/i.test(read(path)), `${path} must stay indexable`);
  }
  const indexHtml = read(index);
  const guide = read('/blog/modelos-de-rotina-guarda-compartilhada');
  for (const path of paths) {
    assert.match(indexHtml, new RegExp(`href="${path}"`), `the /rotinas/ index does not list ${path}`);
    assert.match(guide, new RegExp(`href="${path}"`), `the routine guide does not link to ${path}`);
    const html = read(path);
    assert.match(html, /href="\/rotinas\/"/, `${path} does not link back to the index`);
    assert.match(html, /href="\/blog\/modelos-de-rotina-guarda-compartilhada"/, `${path} does not link to the guide`);
    assert.match(html, /href="\/blog\/rotina-7-7-vs-14-14"/, `${path} does not link to the 7/7 x 14/14 post`);
  }
  assert.match(guide, /href="\/rotinas\/"/);
  assert.match(read('/blog/'), /href="\/rotinas\/"/, 'the blog index does not list the routines');
  const gerador = read('/ferramentas/gerador-de-rotina-de-guarda');
  for (const path of ['/rotinas/2-2-3', '/rotinas/5-2-2-5', '/rotinas/']) {
    assert.match(gerador, new RegExp(`href="${path}"`), `the generator does not link to ${path}`);
  }
});
