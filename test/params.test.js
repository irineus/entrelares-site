// L-34 — the landing shows the product's live parameters.
//
// Three things are pinned here: the formatting (both languages, the app's own
// free-months rule), the rewriting (idempotent on every committed page, a
// change reaches the card, the FAQ and the JSON-LD, flags flip both variants of
// a sentence), and the drift guard — a hand-typed price or month count outside
// a marked element breaks the build, so the site cannot quietly go back to
// saying a number the app no longer charges.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

import {
  annualFreeMonths, formatBrl, formatPrice, readBaked, renderParam, rewriteHtml, substituteJsonLd,
} from "../src/params.js";
import { getLiveParams, paramHandlers, serveWithParams, FRESH_MS } from "../src/serve-params.js";
import { bake } from "../tool/bake-params.mjs";

const PUBLIC = new URL("../public/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (p) => readFileSync(join(PUBLIC, p), "utf8");

async function htmlFiles(dir = PUBLIC) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const PARAM_PAGES = [
  "index.html",
  "en/index.html",
  "blog/como-funciona-guarda-compartilhada.html",
  "blog/como-montar-calendario-guarda-compartilhada.html",
  "blog/modelos-de-rotina-guarda-compartilhada.html",
  "ferramentas/gerador-de-rotina-de-guarda.html",
];
const LEGAL = ["termos.html", "privacidade.html", "exclusao-de-conta.html"];

// ── Formatting ────────────────────────────────────────────────────────────────

test("prices read in Brazilian format in both languages; JSON-LD uses a dot", () => {
  assert.equal(formatBrl(549), "R$ 5,49");
  assert.equal(formatBrl(5490), "R$ 54,90");
  assert.equal(formatBrl(99900), "R$ 999,00");
  assert.equal(formatPrice(549), "5.49");
});

test("the free-months badge follows the app's own rule (U-46 examples)", () => {
  // The same fixtures as entrelares_core billing_rules_test.
  assert.equal(annualFreeMonths(549, 5490), 2);
  assert.equal(annualFreeMonths(100, 1100), 1);
  assert.equal(annualFreeMonths(549, 5000), 0);
  assert.equal(annualFreeMonths(100, 1200), 0);
  assert.equal(annualFreeMonths(100, 1300), 0);
  assert.equal(annualFreeMonths(0, 1300), 0);
});

test("months and the badge speak each language, the singular included", () => {
  const v = { calendar_months_free: "1", "billing.price_monthly_cents": "100", "billing.price_annual_cents": "1100" };
  assert.equal(renderParam("calendar_months_free", "months", "pt", v), "1 mês");
  assert.equal(renderParam("calendar_months_free", "months", "en", v), "1 month");
  assert.equal(renderParam("x", "free_months", "pt", v, " — "), " — 1 mês grátis");
  assert.equal(renderParam("x", "free_months", "en", v), "1 month free");
  // Nothing given away → no badge (null = hidden), never a rounded one.
  assert.equal(renderParam("x", "free_months", "pt", { ...v, "billing.price_annual_cents": "1150" }), null);
  // Unknown or non-numeric value → leave the baked text alone (undefined).
  assert.equal(renderParam("calendar_months_free", "months", "pt", {}), undefined);
  assert.equal(renderParam("calendar_months_free", "months", "pt", { calendar_months_free: "seis" }), undefined);
});

// ── Rewriting ─────────────────────────────────────────────────────────────────

test("baking today's values reproduces every committed page byte for byte", () => {
  for (const page of PARAM_PAGES) {
    const html = read(page);
    const baked = readBaked(html);
    assert.ok(baked, `${page} carries the entrelares-params meta`);
    assert.equal(rewriteHtml(html, baked.values), html, page);
  }
});

test("a console edit reaches the card, the FAQ and the JSON-LD — and comes back", () => {
  const html = read("index.html");
  const today = readBaked(html).values;
  const live = { ...today, "billing.price_monthly_cents": "600", "billing.price_annual_cents": "6000", calendar_months_premium: "30" };
  const out = rewriteHtml(html, live);

  assert.ok(!out.includes("R$ 5,49"), "no trace of the old monthly price");
  assert.ok(!out.includes("R$ 54,90"), "no trace of the old annual price");
  assert.equal(out.match(/R\$ 6,00/g).length >= 3, true, "card, FAQ and JSON-LD FAQ");
  assert.match(out, /"price": "6\.00"/);
  assert.match(out, /30 meses/);
  // 6000 = 10 × 600: the badge still gives two months.
  assert.match(out, /— 2 meses grátis<\/span>/);
  for (const m of out.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    JSON.parse(m[1]);
  }
  assert.equal(rewriteHtml(out, today), html, "setting it back restores the page");
});

test("an annual price that is no whole number of months hides the badge", () => {
  const html = read("en/index.html");
  const out = rewriteHtml(html, { ...readBaked(html).values, "billing.price_annual_cents": "5000" });
  assert.match(out, /data-format="free_months" data-prefix=" — " hidden>/);
  assert.match(out, /data-format="free_months" data-prefix=", with " hidden>/);
});

test("a flag flips BOTH variants of a sentence, in both languages", () => {
  for (const page of ["index.html", "en/index.html"]) {
    const html = read(page);
    const off = rewriteHtml(html, { ...readBaked(html).values, "landing.play_badge": "false" });
    assert.ok(!/data-param-show="landing\.play_badge"(?![^>]*hidden)[^>]*>/.test(off), `${page}: a Play block stayed visible`);
    assert.ok(!/data-param-hide="landing\.play_badge"[^>]*hidden/.test(off), `${page}: an alternative stayed hidden`);
  }
  const html = read("index.html");
  const noBadge = rewriteHtml(html, { ...readBaked(html).values, "landing.launch_free_badge": "false" });
  assert.match(noBadge, /data-param-show="landing\.launch_free_badge" hidden>Grátis no lançamento/);
});

test("a key the feed does not carry keeps its baked text", () => {
  const html = read("index.html");
  const withoutMeta = (h) => h.replace(/<meta name="entrelares-params"[^>]*>/, "");
  assert.equal(withoutMeta(rewriteHtml(html, { "some.other": "1" })), withoutMeta(html));
});

test("JSON-LD: a form two keys share is left as baked, never guessed", () => {
  const baked = { "billing.price_monthly_cents": "500", "billing.price_annual_cents": "500" };
  const live = { "billing.price_monthly_cents": "600", "billing.price_annual_cents": "6000" };
  const text = '{"t": "R$ 5,00"}';
  assert.equal(substituteJsonLd(text, Object.keys(baked), "pt", baked, live), text);
});

// ── Scope ─────────────────────────────────────────────────────────────────────

test("legal pages carry no parameter at all (S-15: one copy, one version)", () => {
  for (const page of LEGAL) {
    const html = read(page);
    assert.ok(!/data-param|entrelares-params/.test(html), page);
  }
});

test("every page that takes a parameter is a run_worker_first route, and only those", async () => {
  const cfg = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  const { assets, env } = JSON.parse(cfg);
  const withMeta = [];
  for (const file of await htmlFiles()) {
    if (readBaked(await readFile(file, "utf8"))) withMeta.push(relative(PUBLIC, file).replace(/\\/g, "/"));
  }
  assert.deepEqual(withMeta.sort(), [...PARAM_PAGES].sort());
  const routeOf = (p) =>
    p === "index.html" ? "/" : p === "en/index.html" ? "/en/" : "/" + p.replace(/\.html$/, "");
  for (const routes of [assets.run_worker_first, env.preview.assets.run_worker_first]) {
    for (const page of withMeta) assert.ok(routes.includes(routeOf(page)), `${page} → ${routeOf(page)}`);
    assert.ok(routes.includes("/en"), "the /en redirect source too");
  }
  assert.match(JSON.stringify(env.preview), /buroanotfjcgvbfmacuh/, "preview reads the DEV feed");
  assert.match(cfg, /"PARAMS_URL": "https:\/\/jptqbwfziyzlhlmoekzu/, "production reads the PROD feed");
});

test("drift guard: no hand-typed price or month count outside a marked element", async () => {
  // The Play prices are Google's (set in the Play Console), not a parameter —
  // they stay manual and are named here on purpose; R$ 0 is the free plan.
  const allowed = new Set(["R$ 0", "R$ 5,99", "R$ 59,90"]);
  for (const file of await htmlFiles()) {
    const page = relative(PUBLIC, file).replace(/\\/g, "/");
    if (LEGAL.includes(page)) continue;
    const stripped = (await readFile(file, "utf8"))
      .replace(/<([a-z0-9]+)\s[^>]*data-param="[^"]*"[^>]*>[^<]*<\/\1>/g, "")
      .replace(/<script type="application\/ld\+json" data-param-jsonld="[^"]*">[\s\S]*?<\/script>/g, "");
    for (const m of stripped.matchAll(/R\$\s?\d+(?:,\d{2})?/g)) {
      assert.ok(allowed.has(m[0]), `${page}: hand-typed price "${m[0]}"`);
    }
    if (PARAM_PAGES.includes(page)) {
      const months = stripped.match(/\b\d+ (meses|months)\b/);
      assert.equal(months, null, `${page}: hand-typed "${months?.[0]}"`);
      assert.ok(!/"price": "(?!0")/.test(stripped), `${page}: a JSON-LD price outside a marked block`);
    }
  }
});

// ── Serve time ────────────────────────────────────────────────────────────────

function fakeCache() {
  const store = new Map();
  return {
    store,
    async match(req) {
      const r = store.get(req.url);
      return r ? r.clone() : undefined;
    },
    async put(req, res) {
      store.set(req.url, res);
    },
  };
}
const feed = (values) => async () => new Response(JSON.stringify({ values }), { status: 200 });
const env = { PARAMS_URL: "https://x.supabase.co/functions/v1/public-settings" };

test("the feed is cached for five minutes, then refreshed", async () => {
  const cache = fakeCache();
  let calls = 0;
  const fetchImpl = async () => { calls++; return feed({ a: String(calls) })(); };
  assert.deepEqual(await getLiveParams(env, null, { cache, fetchImpl, now: 0 }), { a: "1" });
  assert.deepEqual(await getLiveParams(env, null, { cache, fetchImpl, now: FRESH_MS - 1 }), { a: "1" });
  assert.equal(calls, 1);
  assert.deepEqual(await getLiveParams(env, null, { cache, fetchImpl, now: FRESH_MS + 1 }), { a: "2" });
});

test("a feed that fails serves the old copy, and with none the baked page", async () => {
  const cache = fakeCache();
  await getLiveParams(env, null, { cache, fetchImpl: feed({ a: "1" }), now: 0 });
  const down = async () => { throw new Error("down"); };
  assert.deepEqual(await getLiveParams(env, null, { cache, fetchImpl: down, now: FRESH_MS * 10 }), { a: "1" });
  assert.equal(await getLiveParams(env, null, { cache: fakeCache(), fetchImpl: down, now: 0 }), null);
  assert.equal(await getLiveParams({}, null, { cache: fakeCache(), fetchImpl: feed({}) }), null);
});

test("serve: non-HTML, non-200 and feed-down responses pass through untouched", async () => {
  const assets = (body, type, status = 200) => ({
    ASSETS: { fetch: async () => new Response(body, { status, headers: { "content-type": type } }) },
  });
  const deps = { cache: fakeCache(), fetchImpl: feed({ a: "1" }), HTMLRewriter: class { on() { throw new Error("must not rewrite"); } } };
  const req = new Request("https://entrelares.app/img/x.png");
  assert.equal(await (await serveWithParams(req, { ...env, ...assets("png", "image/png") }, null, deps)).text(), "png");
  const html = new Request("https://entrelares.app/");
  assert.equal((await serveWithParams(html, { ...env, ...assets("x", "text/html", 404) }, null, deps)).status, 404);
  const downDeps = { ...deps, fetchImpl: async () => { throw new Error("down"); } };
  assert.equal(await (await serveWithParams(html, { ...env, ...assets("<p>ok</p>", "text/html") }, null, downDeps)).text(), "<p>ok</p>");
});

test("serve: the HTMLRewriter handlers apply the same rules as the bake", () => {
  const live = { "billing.price_monthly_cents": "600", "landing.play_badge": "false" };
  const handlers = Object.fromEntries(paramHandlers(live));
  const el = (attrs) => ({
    attrs: { ...attrs },
    content: null,
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = v; },
    removeAttribute(k) { delete this.attrs[k]; },
    setInnerContent(t) { this.content = t; },
  });

  const meta = el({ name: "entrelares-params", "data-lang": "pt", content: '{"billing.price_monthly_cents":"549","landing.play_badge":"true"}' });
  handlers['meta[name="entrelares-params"]'].element(meta);
  assert.equal(meta.attrs.content, '{"billing.price_monthly_cents":"600","landing.play_badge":"false"}');

  const price = el({ "data-param": "billing.price_monthly_cents", "data-format": "brl" });
  handlers["[data-param]"].element(price);
  assert.equal(price.content, "R$ 6,00");

  const show = el({ "data-param-show": "landing.play_badge" });
  handlers["[data-param-show]"].element(show);
  assert.equal(show.attrs.hidden, "");
  const hide = el({ "data-param-hide": "landing.play_badge", hidden: "" });
  handlers["[data-param-hide]"].element(hide);
  assert.equal("hidden" in hide.attrs, false);

  const jl = handlers['script[type="application/ld+json"][data-param-jsonld]'];
  jl.element(el({ "data-param-jsonld": "billing.price_monthly_cents" }));
  const out = [];
  jl.text({ text: '{"price": "5.', lastInTextNode: false, remove() {}, replace() {} });
  jl.text({ text: '49"}', lastInTextNode: true, remove() {}, replace(t) { out.push(t); } });
  assert.deepEqual(out, ['{"price": "6.00"}']);
});

// ── Deploy time ───────────────────────────────────────────────────────────────

test("the bake writes the feed into a copy of the site, and a dead feed changes nothing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "l34-"));
  await cp(PUBLIC, dir, { recursive: true });
  const logs = [];
  const log = async (l) => { logs.push(l); };

  const today = readBaked(read("index.html")).values;
  const same = await bake("https://x", dir, { fetchImpl: feed(today), log });
  assert.deepEqual(same.changed, [], "today's values change nothing");

  const moved = await bake("https://x", dir, { fetchImpl: feed({ ...today, "billing.price_monthly_cents": "600" }), log });
  assert.ok(moved.changed.some((f) => f.endsWith("index.html")));
  assert.match(await readFile(join(dir, "index.html"), "utf8"), /R\$ 6,00/);

  const dead = await bake("https://x", dir, { fetchImpl: async () => { throw new Error("down"); }, log });
  assert.equal(dead.values, null);
  assert.match(logs.at(-1), /não respondeu/);
});
