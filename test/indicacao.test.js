// F-82 — /i/<code>, the family-referral link the app shares (F-80).
//
// What this pins: the two roads carry the code exactly as the app reads it
// (web `?ref=` on /register; Play install referrer key `ref`), the code never
// reaches the analytics or a Referer, the page is nobody's search result, the
// preview sends testers to the QA app, and a malformed code is a plain 404.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import {
  INSTALL_CAMPAIGN, installReferrer, playListingUrl, referralCodeFromPath, webSignupUrl,
} from "../src/referral.js";

const CODE = "ABCDEFGH23";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

const PROD = {
  APP_ORIGIN: "https://web.entrelares.app",
  UMAMI_WEBSITE_ID: "8b182992-68ce-4f2e-abb9-e798c33e48d8",
  ASSETS: { fetch: async () => new Response("404 page", { status: 404 }) },
};
const PREVIEW = {
  APP_ORIGIN: "https://qa.entrelares.app",
  ASSETS: PROD.ASSETS,
};

const get = (path, env = PROD, ua = IPHONE_UA) =>
  worker.fetch(new Request(`https://entrelares.app${path}`, { headers: { "user-agent": ua } }), env, {});

test("the code is read from the path in the app's own alphabet, and nothing else is a code", () => {
  assert.equal(referralCodeFromPath(`/i/${CODE}`), CODE);
  assert.equal(referralCodeFromPath(`/i/${CODE}/`), CODE);
  assert.equal(referralCodeFromPath(`/i/${CODE.toLowerCase()}`), CODE);
  for (const bad of ["/i/", "/i/ABC", "/i/ABCDEFGH2O", "/i/ABCDEFGH231", "/i/ABCDEFGH23/x", "/x/ABCDEFGH23", "/i/%E0%A4%A"]) {
    assert.equal(referralCodeFromPath(bad), null, bad);
  }
});

test("the Play road carries the referrer the app parses (`ref`), encoded as Uri.https does", () => {
  assert.equal(installReferrer(CODE), `${INSTALL_CAMPAIGN}&ref=${CODE}`);
  const url = new URL(playListingUrl(CODE));
  assert.equal(url.origin + url.pathname, "https://play.google.com/store/apps/details");
  assert.equal(url.searchParams.get("id"), "com.entrelares.app");
  const referrer = new URLSearchParams(url.searchParams.get("referrer"));
  assert.equal(referrer.get("ref"), CODE);
  assert.equal(referrer.get("utm_medium"), "referral");
  assert.match(playListingUrl(CODE), /referrer=utm_source%3Dentrelares\.app%26utm_medium%3Dreferral%26utm_campaign%3Dfamily-referral%26ref%3DABCDEFGH23$/);
});

test("the web road is /register?ref=<code> — the only path the app reads the code from", () => {
  assert.equal(webSignupUrl("https://web.entrelares.app", CODE), `https://web.entrelares.app/register?ref=${CODE}`);
});

test("a valid link answers a page with both roads, Play first on Android", async () => {
  const android = await (await get(`/i/${CODE}`, PROD, ANDROID_UA)).text();
  const iphone = await (await get(`/i/${CODE}`, PROD, IPHONE_UA)).text();
  const firstBtn = (html) => /<a class="btn" href="([^"]+)"/.exec(html)[1].replaceAll("&amp;", "&");
  assert.equal(firstBtn(android), playListingUrl(CODE));
  assert.equal(firstBtn(iphone), `https://web.entrelares.app/register?ref=${CODE}`);
  for (const html of [android, iphone]) {
    assert.ok(html.includes(`https://web.entrelares.app/register?ref=${CODE}`));
    assert.ok(html.replaceAll("&amp;", "&").includes(playListingUrl(CODE)));
    assert.match(html, /href="\/termos#indicacao"/);
  }
});

test("the page is nobody's search result, is never cached and sends no Referer", async () => {
  const res = await get(`/i/${CODE}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  const html = await res.text();
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
});

test("the code never reaches Umami: no pageview, and every event leaves with the bare /i", async () => {
  const html = await (await get(`/i/${CODE}`)).text();
  const tag = /<script defer src="https:\/\/cloud\.umami\.is\/script\.js"[^>]*>/.exec(html)[0];
  assert.match(tag, /data-auto-track="false"/);
  assert.match(tag, /data-exclude-search="true"/);
  assert.match(tag, /data-exclude-hash="true"/);
  assert.match(html, /url: "\/i"/);
  assert.match(html, /indicacao-chegada/);
  // Declarative click tracking would send the page URL — the code is in it.
  assert.doesNotMatch(html, /data-umami-event/);
  const scripts = [...html.matchAll(/<script[\s\S]*?<\/script>/g)].map((m) => m[0]).join("\n");
  assert.ok(!scripts.includes(CODE), "the code must not appear in any script");
});

test("preview sends testers to the QA app and counts nothing", async () => {
  const html = await (await get(`/i/${CODE}`, PREVIEW)).text();
  assert.ok(html.includes(`https://qa.entrelares.app/register?ref=${CODE}`));
  assert.ok(!html.includes("https://web.entrelares.app"));
  assert.doesNotMatch(html, /cloud\.umami\.is/);
});

test("a malformed code is the site's 404 page, not a referral page", async () => {
  const res = await get("/i/nope");
  assert.equal(res.status, 404);
});

test("wrangler gives each environment its own app origin, and only production an Umami id", () => {
  const cfg = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(cfg, /"APP_ORIGIN": "https:\/\/web\.entrelares\.app"/);
  assert.match(cfg, /"APP_ORIGIN": "https:\/\/qa\.entrelares\.app"/);
  assert.equal((cfg.match(/"UMAMI_WEBSITE_ID"/g) ?? []).length, 1);
});

test("a referral link is never in the sitemap", () => {
  const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  assert.doesNotMatch(sitemap, /\/i\//);
});
