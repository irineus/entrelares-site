// L-36 — the lawyer and mediator kit: /advogados and its one-page handout.
//
// The page is INDEXED (professionals search for it) and the handout's QR opens
// /advogados#folheto. Both roads land on the same pageview, so the paper one is told
// apart the L-30 way: the Umami tag excludes the fragment and the arrival is an EVENT.
// Zero dependencies — node:test + node:fs, same lane as the rest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const PAGE = read("public/advogados.html").toString("utf8");
const HANDOUT_SRC = read("assets-src/folheto-advogados.html").toString("utf8");
const PDF = read("public/downloads/folheto-entrelares-advogados.pdf");
const SITEMAP = read("public/sitemap.xml").toString("utf8");

test("/advogados is indexed and in the sitemap, extensionless (L-23)", () => {
  assert.ok(!/<meta[^>]+noindex/i.test(PAGE), "the page must stay indexable");
  assert.match(SITEMAP, /<loc>https:\/\/entrelares\.app\/advogados<\/loc>/);
  assert.match(PAGE, /<link rel="canonical" href="https:\/\/entrelares\.app\/advogados" \/>/);
});

test("the Umami tag excludes the fragment, so #folheto never reaches the pageview", () => {
  const tag = PAGE.match(/<script[^>]+cloud\.umami\.is\/script\.js[^>]*>/);
  assert.ok(tag, "the page has the Umami tag");
  assert.match(tag[0], /data-exclude-hash="true"/);
});

test("a handout arrival is counted as its own event, and only from #folheto", () => {
  assert.match(PAGE, /location\.hash !== "#folheto"\) return/);
  assert.match(PAGE, /umami\.track\("advogados-folheto-chegada"\)/);
  assert.match(PAGE, /id="folheto"/, "the QR lands on the handout box");
});

test("the handout's QR points at /advogados#folheto", () => {
  assert.match(HANDOUT_SRC, /encodes https:\/\/entrelares\.app\/advogados#folheto/);
  assert.match(HANDOUT_SRC, /<div class="qr"><svg /, "the QR is inline, no library at render time");
  assert.match(PAGE, /href="\/downloads\/folheto-entrelares-advogados\.pdf"/);
});

test("the handout is a PDF of exactly ONE page", () => {
  assert.equal(PDF.subarray(0, 5).toString("latin1"), "%PDF-");
  const pages = PDF.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? [];
  assert.equal(pages.length, 1);
});

test("both say plainly: not legal advice, takes no side", () => {
  for (const html of [PAGE, HANDOUT_SRC]) {
    assert.match(html, /não é aconselhamento jurídico e não toma partido/);
  }
});

test("contact is the company address, with no price and no swap window in hours", () => {
  for (const html of [PAGE, HANDOUT_SRC]) {
    assert.match(html, /contato@entrelares\.app/);
    assert.doesNotMatch(html, /R\$/, "no price (the store price is Play's)");
    assert.doesNotMatch(html, /\d+\s*h(oras)?\b/, "the auto-approval deadline is the reminder's (F-60)");
  }
});
