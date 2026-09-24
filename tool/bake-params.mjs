#!/usr/bin/env node
// L-34 — deploy time: bake the app's live parameters into the pages.
//
//   node tool/bake-params.mjs <public-settings URL> [public dir]
//
// Runs in deploy.yml / deploy-preview.yml right before `wrangler deploy`, on
// the CI checkout only (nothing is committed back). It rewrites every page that
// carries the `entrelares-params` meta with the same rules the Worker applies at
// serve time (`rewriteHtml`, src/params.js), so a page served WITHOUT the Worker
// — a cache, a crawler's copy, a Worker outage — already says what the app says
// at deploy time.
//
// A deploy is never blocked by the app's backend: if the feed does not answer,
// the committed values ship as they are and the run summary says so. The script
// exits 0 in that case on purpose.

import { readdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchFeed, rewriteHtml } from "../src/params.js";

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

async function summary(line) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, line + "\n");
}

export async function bake(url, dir, { fetchImpl = fetch, log = summary } = {}) {
  let values;
  try {
    ({ values } = await fetchFeed(url, { fetchImpl, timeoutMs: 10000 }));
  } catch (error) {
    await log(`⚠️ L-34: o feed de parâmetros não respondeu (${error.message}) — o deploy segue com os valores do repositório.`);
    return { changed: [], values: null };
  }
  const changed = [];
  for await (const file of htmlFiles(dir)) {
    const html = await readFile(file, "utf8");
    const out = rewriteHtml(html, values);
    if (out !== html) {
      await writeFile(file, out);
      changed.push(file);
    }
  }
  const shown = Object.entries(values).map(([k, v]) => `${k}=${v}`).join(", ");
  await log(`L-34: parâmetros gravados (${shown}); ${changed.length} página(s) mudaram em relação ao repositório.`);
  return { changed, values };
}

// Run only when invoked as a script — the tests import `bake`.
if (process.argv[1]?.endsWith("bake-params.mjs")) {
  const [url, dir = "public"] = process.argv.slice(2);
  if (!url) {
    console.error("uso: node tool/bake-params.mjs <URL do public-settings> [pasta public]");
    process.exit(2);
  }
  await bake(url, dir);
}
