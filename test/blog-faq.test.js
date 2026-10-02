// L-42 — structured data says only what the page shows.
//
// A FAQPage block is a promise to the search engine that the same questions and answers
// are VISIBLE on the page; a block that drifts from the visible text (an answer edited in
// one place and not the other) is exactly the mismatch Google's guidelines call out, and
// nothing in a browser shows it. The three holiday articles were the first blog posts to
// carry one, written as plain <h3>/<p> pairs inside `<section class="faq">` so the two
// copies can be compared word for word. The same suite parses every JSON-LD block the
// site publishes: a stray comma in hand-written JSON is a block the crawler drops in
// silence. Zero dependencies — node:test + node:fs, same lane as the Worker tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

const jsonLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

const text = (fragment) => fragment.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('every JSON-LD block on the site parses', () => {
  let blocks = 0;
  for (const { file, html } of pages) {
    for (const body of jsonLd(html)) {
      blocks += 1;
      assert.doesNotThrow(() => JSON.parse(body), `${file}: a JSON-LD block is not valid JSON`);
    }
  }
  assert.ok(blocks >= 20, `expected the site's JSON-LD blocks, found ${blocks}`);
});

const faqPages = pages
  // L-43: the routine pages under /rotinas/ carry the same visible FAQ + FAQPage pair.
  .filter(({ file }) => file.startsWith('blog/') || file.startsWith('rotinas/'))
  .map((p) => ({ ...p, faq: jsonLd(p.html).map((b) => JSON.parse(b)).find((d) => d['@type'] === 'FAQPage') }))
  .filter((p) => p.faq);

test('the holiday articles carry a FAQPage (a broken filter would make the rule below pass over nothing)', () => {
  for (const slug of [
    'natal-e-ano-novo-guarda-compartilhada',
    'ferias-escolares-guarda-compartilhada',
    'como-combinar-festas-com-o-outro-responsavel',
  ]) {
    assert.ok(faqPages.some(({ file }) => file === `blog/${slug}.html`), `${slug} has no FAQPage block`);
  }
});

test('the routine pages carry a FAQPage too (L-43)', () => {
  for (const slug of ['2-2-3', '5-2-2-5', '1-1', '3-4-4-3', 'fins-de-semana-alternados']) {
    assert.ok(faqPages.some(({ file }) => file === `rotinas/${slug}.html`), `${slug} has no FAQPage block`);
  }
});

test("a blog FAQPage block matches the page's visible FAQ, question by question", () => {
  for (const { file, html, faq } of faqPages) {
    const section = html.match(/<section class="faq"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(section, `${file}: the FAQ the JSON-LD describes is not on the page`);
    const visible = [...section.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => ({
      q: text(m[1]),
      a: text(m[2]),
    }));
    const declared = faq.mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text }));
    assert.ok(declared.length >= 3 && declared.length <= 5, `${file}: three to five questions`);
    assert.deepEqual(visible, declared, `${file}: visible FAQ and FAQPage differ`);
  }
});
