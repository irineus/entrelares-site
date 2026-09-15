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
