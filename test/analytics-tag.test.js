// Every page the landing serves carries the Umami tag — once, with the landing's site id.
//
// Why a sitewide guard (04/11/2026): the redesign (#166, 07/10/2026) rebuilt the end of the
// homes' <head> (tool/build.mjs, BRAND_TAIL) without the L-01 tag, and /instalar + /en/install
// were born without it. The pages still carried data-umami-event attributes, so nothing looked
// wrong in the source — the home simply vanished from the dashboard for four weeks (15 visitors
// site-wide in 16/10–04/11, none on "/"), in the middle of the first paid campaign (L-31).
// The per-page tests only looked at the pages that had a reason to be special.
// Zero dependencies — node:test + node:fs, same lane as the rest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const SITE_ID = "8b182992-68ce-4f2e-abb9-e798c33e48d8";
const TAG = /<script[^>]+src="https:\/\/cloud\.umami\.is\/script\.js"[^>]*>/g;

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(p);
    return e.name.endsWith(".html") ? [p] : [];
  });
}

const PAGES = htmlFiles(PUBLIC).map((p) => ({
  name: relative(PUBLIC, p).replace(/\\/g, "/"),
  html: readFileSync(p, "utf8"),
}));

test("the walk finds the pages, including both homes and both install guides", () => {
  const names = PAGES.map((p) => p.name);
  for (const must of ["index.html", "en/index.html", "instalar.html", "en/install.html"]) {
    assert.ok(names.includes(must), `${must} not found under public/`);
  }
});

test("every page carries exactly one Umami tag, in the <head>, with the landing's site id", () => {
  for (const { name, html } of PAGES) {
    const tags = html.match(TAG) ?? [];
    assert.equal(tags.length, 1, `${name}: expected one Umami tag, found ${tags.length}`);
    assert.match(tags[0], new RegExp(`data-website-id="${SITE_ID}"`), `${name}: wrong site id`);
    const head = html.slice(0, html.indexOf("</head>"));
    assert.ok(head.includes(tags[0]), `${name}: the Umami tag is not inside <head>`);
  }
});
