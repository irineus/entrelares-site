// Every BreadcrumbList on the site is one Google accepts (L-52, 28/11/2026).
//
// The generator's trail read Início › Ferramentas › Gerador, and "Ferramentas" had no `item`:
// there is no /ferramentas/ page to point at. Search Console flagged it on the live URL as
// "Missing field 'item'" (1 invalid item, so no breadcrumb rich result), and nothing here
// read the JSON-LD trails, so it had sat there since L-05. Google requires an `item` on every
// level but the last. This suite reads every page's BreadcrumbList and holds the rule:
//   - positions run 1..n in order;
//   - every level but the last carries an absolute https://entrelares.app URL;
//   - that URL answers a file in public/ (the same mapping the Worker serves).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(fileURLToPath(new URL('..', import.meta.url)), 'public');
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const pages = walk(PUBLIC)
  .filter((p) => p.endsWith('.html'))
  .map((p) => ({ file: p.slice(PUBLIC.length + 1).replaceAll('\\', '/'), html: readFileSync(p, 'utf8') }));

const trailsOf = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((m) => {
      const j = JSON.parse(m[1]);
      return [].concat(j['@graph'] ?? j);
    })
    .filter((n) => n['@type'] === 'BreadcrumbList');

const fileFor = (url) => {
  const path = new URL(url).pathname;
  const rel = path.endsWith('/') ? `${path.slice(1)}index.html` : `${path.slice(1)}.html`;
  return existsSync(join(PUBLIC, rel)) || existsSync(join(PUBLIC, path.slice(1)));
};

const withTrail = pages.filter((p) => trailsOf(p.html).length > 0);

test('the site has breadcrumb trails to check', () => {
  assert.ok(withTrail.length >= 20, `only ${withTrail.length} pages carry a BreadcrumbList`);
});

for (const { file, html } of withTrail) {
  test(`${file}: every breadcrumb level but the last links to a page that exists`, () => {
    for (const trail of trailsOf(html)) {
      const items = trail.itemListElement;
      assert.ok(items.length >= 2, 'a trail of one level says nothing');
      items.forEach((it, i) => {
        assert.equal(it.position, i + 1, `${it.name}: position out of order`);
        assert.ok(it.name, `level ${i + 1} has no name`);
        if (i === items.length - 1) return;
        assert.ok(it.item, `${it.name}: missing "item" — Google rejects the whole trail`);
        assert.match(it.item, /^https:\/\/entrelares\.app\//, `${it.name}: item must be an absolute entrelares.app URL`);
        assert.ok(fileFor(it.item), `${it.name}: ${it.item} answers no file in public/`);
      });
    }
  });
}
