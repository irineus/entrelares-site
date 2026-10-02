#!/usr/bin/env node
// L-44 — after a PRODUCTION deploy, tell IndexNow which pages changed.
//
//   node tool/indexnow.mjs <sitemap of this deploy> [sitemap that was live before it]
//
// IndexNow (indexnow.org) is a ping protocol shared by Bing, Yandex, Seznam, Naver and
// others: one POST to api.indexnow.org reaches all of them. Bing's index also feeds
// DuckDuckGo, which is where L-29 saw `web.entrelares.app` competing for the brand.
// **Google does not use IndexNow** — for Google the sitemap (Search Console, property
// `sc-domain:entrelares.app`) stays the only channel, and this step changes nothing there.
//
// The key is PUBLIC by design: the protocol proves we own the host by serving
// `https://entrelares.app/<key>.txt` with the key as its body, so anybody can read it.
// It is committed (`public/<key>.txt`) and is not a secret; there is nothing to rotate in
// a console. `test/indexnow.test.js` pins that the file exists and says the same key.
//
// Which URLs: the sitemap is the list of indexable pages, and each `<lastmod>` is the date
// that page's content last changed (rule 2 of the sitemap's header). The deploy fetches the
// sitemap that was LIVE before `wrangler deploy` and passes it as the second argument; a
// page is submitted when it is new or its `lastmod` moved. Without that file (first run,
// network hiccup) every sitemap URL is submitted — IndexNow tolerates it, the cap is 10 000.
// A deploy that changed no page's content submits nothing.
//
// Best-effort, never a gate: any failure (network, 4xx, 5xx) is a warning in the run
// summary and the script still exits 0. The workflow step is `continue-on-error` too, so a
// bug in this file cannot turn a successful deploy red.

import { appendFile, readFile } from "node:fs/promises";

export const INDEXNOW_KEY = "35c229ab5a2746a65c52d271b2b448bd";
export const HOST = "entrelares.app";
export const ORIGIN = `https://${HOST}`;
export const KEY_LOCATION = `${ORIGIN}/${INDEXNOW_KEY}.txt`;
export const ENDPOINT = "https://api.indexnow.org/indexnow";
export const MAX_URLS = 10000;

/** `[{ loc, lastmod }]` of every `<url>` in a sitemap — `lastmod` is null when absent. */
export function parseSitemap(xml) {
  return [...String(xml).matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap(([, body]) => {
    const loc = body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
    if (!loc) return [];
    const lastmod = body.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1] ?? null;
    return [{ loc, lastmod }];
  });
}

/**
 * The URLs worth submitting: those of [current] that are new or whose `lastmod` differs
 * from [previous]. A missing or empty [previous] means "unknown" — every URL goes. Only
 * addresses on our own host are kept (IndexNow answers 422 to a list that mixes hosts).
 */
export function urlsToSubmit(current, previous = null) {
  const before = new Map((previous ?? []).map((u) => [u.loc, u.lastmod]));
  const known = before.size > 0;
  return current
    .filter((u) => u.loc.startsWith(`${ORIGIN}/`))
    .filter((u) => !known || !before.has(u.loc) || before.get(u.loc) !== u.lastmod)
    .map((u) => u.loc)
    .slice(0, MAX_URLS);
}

/** The JSON body api.indexnow.org expects. */
export function payload(urlList) {
  return { host: HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList };
}

// `::warning::` is a workflow command: on stdout it becomes a yellow annotation on the run;
// in the step summary (markdown) it would print literally, so it turns into a sign there.
async function summary(line) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, line.replace(/^::warning::/, "⚠️ ") + "\n");
  }
}

/**
 * POSTs [urlList] and reports the HTTP status. Never throws: 200 (received) and 202
 * (received, key validation pending) are success; anything else is logged as a warning.
 * Returns the status, or null when nothing was sent / the request itself failed.
 */
export async function submit(urlList, { fetchImpl = fetch, log = summary, timeoutMs = 15000 } = {}) {
  if (urlList.length === 0) {
    await log("L-44 IndexNow: nenhuma página mudou de conteúdo neste deploy — nada enviado.");
    return null;
  }
  let res;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload(urlList)),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    await log(`::warning::L-44 IndexNow: a requisição falhou (${error.message}) — o deploy segue; o sitemap continua valendo.`);
    return null;
  }
  if (res.status === 200 || res.status === 202) {
    await log(`L-44 IndexNow: HTTP ${res.status} — ${urlList.length} URL(s) enviada(s): ${urlList.join(" ")}`);
  } else {
    let body = "";
    try { body = (await res.text()).slice(0, 300); } catch { /* the status is what matters */ }
    await log(`::warning::L-44 IndexNow: HTTP ${res.status} ${body} — o deploy segue; o sitemap continua valendo.`);
  }
  return res.status;
}

async function readSitemap(path) {
  if (!path) return null;
  try {
    return parseSitemap(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

// Run only when invoked as a script — the tests import the functions above.
if (process.argv[1]?.endsWith("indexnow.mjs")) {
  const [currentPath = "public/sitemap.xml", previousPath] = process.argv.slice(2);
  try {
    const current = await readSitemap(currentPath);
    if (!current?.length) {
      await summary(`::warning::L-44 IndexNow: ${currentPath} não tem nenhuma <loc> — nada enviado.`);
    } else {
      const previous = await readSitemap(previousPath);
      if (!previous?.length) await summary("L-44 IndexNow: sem o sitemap anterior — envio todas as URLs do sitemap.");
      await submit(urlsToSubmit(current, previous));
    }
  } catch (error) {
    await summary(`::warning::L-44 IndexNow: erro inesperado (${error.message}) — o deploy segue.`);
  }
}
