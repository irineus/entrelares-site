// L-30 — /relatorio, the address the app's PDF report prints (F-63).
// The page exists to MEASURE that channel, so what matters is pinned here: it is served
// at the extensionless path, it stays out of the index and out of the sitemap (organic
// search would mix into the pageview it exists to count), and its CTA names a route the
// app actually serves. Zero dependencies, same lane as the rest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const url = (p) => new URL(`../public/${p}`, import.meta.url);

test("/relatorio has a file the assets binding serves without the extension", () => {
  assert.ok(existsSync(url("relatorio.html")), "public/relatorio.html is missing — the PDF's link would fall to the 404");
});

const html = existsSync(url("relatorio.html")) ? readFileSync(url("relatorio.html"), "utf8") : "";
const sitemap = readFileSync(url("sitemap.xml"), "utf8");

test("the page is noindex, carries no canonical, and the sitemap does not list it", () => {
  assert.match(html, /<meta name="robots" content="noindex" \/>/);
  assert.doesNotMatch(html, /rel="canonical"/, "a canonical on a noindex page asks for the opposite");
  assert.doesNotMatch(sitemap, /\/relatorio</);
});

test("the page is bilingual and single — the PDF prints this one address in both languages", () => {
  assert.match(html, /<section class="lang-block" lang="pt-BR" id="pt">/);
  assert.match(html, /<section class="lang-block" lang="en" id="en">/);
  // Each block names the PDF title the reader is holding, in that block's language —
  // the catalog strings pdf.doc.title of entrelares-app (strings_pt_br.dart / strings_en.dart).
  assert.match(html, /Relatório de Guarda Compartilhada/);
  assert.match(html, /Shared Custody Report/);
});

test("both CTAs open the app's sign-up and say they came from the report", () => {
  const ctas = [...html.matchAll(/<a[^>]+data-umami-event="cta-signup"[^>]*>/g)].map((m) => m[0]);
  assert.equal(ctas.length, 2);
  for (const a of ctas) {
    assert.match(a, /href="https:\/\/web\.entrelares\.app\/register"/);
    assert.match(a, /data-umami-event-origem="relatorio"/);
  }
});

test("the page describes the F-64 verification — and never calls it a signature", () => {
  // Since F-64 (entrelares-app #273/#274, published with S-22) a PDF generated with
  // verification carries a QR code: a public page, a summary without names and the
  // file's SHA-256 compared on the checker's device. The page says so, and still says
  // the report is not a digital signature — nothing in the app signs it.
  assert.match(html, /QR code/);
  assert.match(html, /o PDF não é enviado a nós/);
  assert.match(html, /the PDF is never sent to us/);
  assert.match(html, /não é assinatura digital/);
  assert.match(html, /is not a digital signature/);
  assert.doesNotMatch(html, /não tem assinatura digital nem código de verificação/);
});
