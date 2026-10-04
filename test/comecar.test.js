// L-46 — /comecar/meta and /comecar/busca, the pages the first real-cohort ads land on.
//
// What this pins: the call to action per device and per source hands the source on
// exactly as the app reads it (app T-101: the Play install referrer's `utm_source`,
// the web sign-up's `?src=` / `&cmp=`), the campaign token is the app's shape, the
// pages are nobody's search result, no click id reaches the analytics, the preview
// sends testers to the QA app, the route is in run_worker_first in BOTH envs, and
// the page types no price.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import worker from "../src/index.js";
import {
  CAMPAIGN_RE, SOURCES, campaignFrom, comecarSegmentFromPath, deviceOf, installReferrerFor,
  playUrlFor, webSignupUrlFor,
} from "../src/comecar.js";

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129 Safari/537.36";

const PROD = {
  APP_ORIGIN: "https://web.entrelares.app",
  UMAMI_WEBSITE_ID: "8b182992-68ce-4f2e-abb9-e798c33e48d8",
  ASSETS: { fetch: async () => new Response("404 page", { status: 404 }) },
};
const PREVIEW = { APP_ORIGIN: "https://qa.entrelares.app", ASSETS: PROD.ASSETS };

const get = async (path, ua, env = PROD) => {
  const res = await worker.fetch(new Request(`https://entrelares.app${path}`, { headers: { "user-agent": ua } }), env, {});
  return { res, html: await res.text() };
};
const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

test("the two paths are the two source words of the app, and nothing else is a page", () => {
  assert.deepEqual({ ...SOURCES }, { meta: "meta", busca: "google_search" });
  assert.equal(comecarSegmentFromPath("/comecar/meta"), "meta");
  assert.equal(comecarSegmentFromPath("/comecar/busca/"), "busca");
  for (const bad of ["/comecar/", "/comecar/google", "/comecar/Meta", "/comecar/meta/x", "/x/meta"]) {
    assert.equal(comecarSegmentFromPath(bad), null, bad);
  }
});

test("the campaign token has the app's shape, from utm_campaign or cmp", () => {
  assert.equal(CAMPAIGN_RE.source, "^[a-z0-9][a-z0-9_-]{0,39}$", "AcquisitionRules.campaignToken / the migration CHECK");
  assert.equal(campaignFrom(new URLSearchParams("utm_campaign=Primeira-Turma")), "primeira-turma");
  assert.equal(campaignFrom(new URLSearchParams("cmp=t1")), "t1");
  for (const bad of ["utm_campaign=has%20space", "utm_campaign=a@b", "utm_campaign=-x", ""]) {
    assert.equal(campaignFrom(new URLSearchParams(bad)), null, bad);
  }
});

test("the Play referrer and the web link carry the source as the app reads them", () => {
  assert.equal(installReferrerFor("meta", "t1"), "utm_source=meta&utm_medium=paid&utm_campaign=t1");
  assert.equal(installReferrerFor("google_search", null), "utm_source=google_search&utm_medium=paid");
  assert.equal(playUrlFor("meta", "t1"),
    "https://play.google.com/store/apps/details?id=com.entrelares.app" +
    "&referrer=utm_source%3Dmeta%26utm_medium%3Dpaid%26utm_campaign%3Dt1");
  assert.equal(webSignupUrlFor("https://web.entrelares.app", "meta", "t1"), "https://web.entrelares.app/register?src=meta&cmp=t1");
  assert.equal(webSignupUrlFor(undefined, "google_search", null), "https://web.entrelares.app/register?src=google_search");
});

test("the device decides the first call to action", () => {
  assert.equal(deviceOf(ANDROID_UA), "android");
  assert.equal(deviceOf(IPHONE_UA), "ios");
  assert.equal(deviceOf(DESKTOP_UA), "desktop");
  assert.equal(deviceOf(""), "desktop");
});

for (const [segment, source] of Object.entries(SOURCES)) {
  test(`/comecar/${segment}: Android leads with the Play listing, the web as the alternative`, async () => {
    const { res, html } = await get(`/comecar/${segment}?utm_campaign=primeira-turma&gclid=abc`, ANDROID_UA);
    assert.equal(res.status, 200);
    const links = hrefs(html);
    const play = playUrlFor(source, "primeira-turma");
    const web = `https://web.entrelares.app/register?src=${source}&cmp=primeira-turma`;
    assert.ok(links.indexOf(play) >= 0 && links.indexOf(web) > links.indexOf(play), links.join("\n"));
    assert.match(html, /class="btn" href="https:\/\/play\.google\.com/);
    assert.ok(!html.includes("gclid"), "the ad's click id is not echoed anywhere");
  });

  test(`/comecar/${segment}: iPhone leads with the web sign-up and the L-19 guide`, async () => {
    const { html } = await get(`/comecar/${segment}`, IPHONE_UA);
    const links = hrefs(html);
    assert.ok(links.includes(`https://web.entrelares.app/register?src=${source}`));
    assert.ok(links.includes("/#instalar"), "the Home Screen guide (L-19)");
    assert.ok(!links.some((h) => h.startsWith("https://play.google.com")), "no Play link on an iPhone");
    assert.match(html, /class="btn" href="https:\/\/web\.entrelares\.app\/register\?src=/);
  });

  test(`/comecar/${segment}: a computer leads with the web sign-up, Play as the alternative`, async () => {
    const { html } = await get(`/comecar/${segment}`, DESKTOP_UA);
    const links = hrefs(html);
    assert.ok(links.indexOf(`https://web.entrelares.app/register?src=${source}`) >= 0);
    assert.ok(links.indexOf(playUrlFor(source, null)) > links.indexOf(`https://web.entrelares.app/register?src=${source}`));
  });
}

test("nobody's search result, no pixel, no click id in the analytics", async () => {
  const { res, html } = await get("/comecar/meta", DESKTOP_UA);
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(res.headers.get("vary"), /user-agent/i, "the page differs by device");
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(!/rel="canonical"/.test(html));
  // Umami only — with the query and the fragment excluded (gclid / fbclid).
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ["https://cloud.umami.is/script.js"]);
  assert.match(html, /data-exclude-search="true"/);
  assert.match(html, /data-exclude-hash="true"/);
  assert.ok(!/facebook|fbq|googletagmanager|gtag\(/i.test(html), "no pixel");
  // One event per call to action, the path segment as its property.
  assert.match(html, /data-umami-event="comecar-web" data-umami-event-origem="meta"/);
  assert.match(html, /data-umami-event="comecar-play" data-umami-event-origem="meta"/);
});

test("the sitemap does not list the ad pages", () => {
  const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  assert.ok(!sitemap.includes("/comecar"), "the arrivals are the ads' measurement alone");
});

test("the preview sends testers to the QA app and counts nothing", async () => {
  const { html } = await get("/comecar/busca", DESKTOP_UA, PREVIEW);
  assert.ok(hrefs(html).includes("https://qa.entrelares.app/register?src=google_search"));
  assert.ok(!html.includes("cloud.umami.is"));
});

test("an unknown segment is the plain 404", async () => {
  const { res } = await get("/comecar/tiktok", DESKTOP_UA);
  assert.equal(res.status, 404);
});

test("no price is typed, the Premium capture says Premium, and every capture is on disk", async () => {
  const { html } = await get("/comecar/meta", DESKTOP_UA);
  assert.ok(!/R\$/.test(html), "prices come from the live feed (L-34), never typed here");
  assert.match(html, /No Premium: o relatório em PDF verificável/);
  assert.match(html, /Comece grátis/);
  for (const m of html.matchAll(/\/img\/comecar\/([a-z-]+-\d+\.webp)/g)) {
    assert.ok(existsSync(new URL(`../public/img/comecar/${m[1]}`, import.meta.url)), m[1]);
  }
  // Neutral tone (T-102/L-46 decision): never "ex", never a side.
  const text = html.replace(/<[^>]+>/g, " ");
  assert.ok(!/\bex\b|\bex-/i.test(text), "never 'ex'");
});

test("the route is in run_worker_first in BOTH envs", () => {
  const cfg = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  const { assets, env } = JSON.parse(cfg);
  for (const [name, a] of [["production", assets], ["preview", env.preview.assets]]) {
    assert.ok(a.run_worker_first.includes("/comecar/*"), `${name} lacks /comecar/*`);
  }
});
