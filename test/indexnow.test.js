// L-44 — IndexNow on the production deploy (tool/indexnow.mjs).
//
// What can go wrong silently here, and what each test below pins:
//   · the key the script sends and the key file the site serves drift apart → IndexNow
//     answers 403 on every deploy, as a warning nobody reads;
//   · the URL list names the `.html` form or another host → 422, or a crawler is pointed
//     at a 307 (the L-23 lesson);
//   · a failure of the ping turns a good deploy red, or the step leaks into the preview.
// Zero dependencies — node:test + node:fs, same lane as the Worker tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENDPOINT, HOST, INDEXNOW_KEY, KEY_LOCATION, parseSitemap, payload, submit, urlsToSubmit,
} from '../tool/indexnow.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const sitemapXml = readFileSync(join(PUBLIC, 'sitemap.xml'), 'utf8');
const sitemap = parseSitemap(sitemapXml);
const keyFile = join(PUBLIC, `${INDEXNOW_KEY}.txt`);

test('the key is 32 hex characters and its file serves exactly that key', () => {
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/);
  assert.ok(existsSync(keyFile), `public/${INDEXNOW_KEY}.txt is missing — IndexNow would answer 403`);
  assert.equal(readFileSync(keyFile, 'utf8'), INDEXNOW_KEY, 'the file body is the key, nothing else (no newline)');
  assert.equal(KEY_LOCATION, `https://entrelares.app/${INDEXNOW_KEY}.txt`);
});

test('the key file is served as a plain asset: not in the sitemap, no redirect, no Worker in front', () => {
  assert.ok(!sitemapXml.includes(INDEXNOW_KEY), 'the key file is not a page — keep it out of the sitemap');
  assert.ok(!existsSync(join(PUBLIC, '_redirects')) ||
    !readFileSync(join(PUBLIC, '_redirects'), 'utf8').split('\n').some((l) => /^\/(\*|[0-9a-f]{32}\.txt)\s/.test(l.trim())),
    'a _redirects rule would bounce the key file');
  const wrangler = readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8');
  assert.ok(!wrangler.includes(INDEXNOW_KEY), 'the key file needs no Worker route');
  assert.ok(!/"run_worker_first"\s*:\s*true/.test(wrangler), 'run_worker_first: true would route the key file through the Worker');
});

test('from the real sitemap, the URL list is every page, extensionless, on entrelares.app only', () => {
  const urls = urlsToSubmit(sitemap);
  assert.ok(urls.length >= 10, `expected the sitemap's pages, found ${urls.length}`);
  assert.equal(urls.length, sitemap.length);
  for (const url of urls) {
    assert.ok(url.startsWith('https://entrelares.app/'), `${url} is not on ${HOST}`);
    assert.ok(!url.endsWith('.html'), `${url} answers 307 — the sitemap must list the extensionless form`);
    assert.ok(!url.includes(INDEXNOW_KEY), 'the key file is never submitted as a page');
  }
  assert.deepEqual(payload(urls), {
    host: 'entrelares.app', key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList: urls,
  });
});

test('against the previously live sitemap, only new pages and moved lastmods are submitted', () => {
  const previous = [
    { loc: 'https://entrelares.app/', lastmod: '2026-09-28' },
    { loc: 'https://entrelares.app/blog/', lastmod: '2026-09-01' },
    { loc: 'https://entrelares.app/advogados', lastmod: '2026-09-28' },
  ];
  const current = [
    { loc: 'https://entrelares.app/', lastmod: '2026-09-28' }, // unchanged → skipped
    { loc: 'https://entrelares.app/blog/', lastmod: '2026-10-02' }, // moved → sent
    { loc: 'https://entrelares.app/rotinas/', lastmod: '2026-10-02' }, // new → sent
    { loc: 'https://preview.entrelares.app/x', lastmod: '2026-10-02' }, // other host → never
  ];
  assert.deepEqual(urlsToSubmit(current, previous), [
    'https://entrelares.app/blog/', 'https://entrelares.app/rotinas/',
  ]);
  assert.deepEqual(urlsToSubmit(current.slice(0, 1), previous), [], 'nothing changed → nothing sent');
  assert.equal(urlsToSubmit(current, []).length, 3, 'an unknown baseline sends every own-host URL');
});

test('parseSitemap reads loc and lastmod and tolerates a <url> without lastmod', () => {
  const xml = '<urlset><url><loc>https://entrelares.app/a</loc><lastmod>2026-10-02</lastmod></url>' +
    '<url><loc> https://entrelares.app/b </loc></url></urlset>';
  assert.deepEqual(parseSitemap(xml), [
    { loc: 'https://entrelares.app/a', lastmod: '2026-10-02' },
    { loc: 'https://entrelares.app/b', lastmod: null },
  ]);
});

test('submit POSTs the JSON body and treats 200/202 as success', async () => {
  const calls = [];
  const lines = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response('', { status: 202 }); };
  const status = await submit(['https://entrelares.app/'], { fetchImpl, log: async (l) => lines.push(l) });
  assert.equal(status, 202);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENDPOINT);
  assert.equal(calls[0].init.method, 'POST');
  assert.match(calls[0].init.headers['content-type'], /^application\/json/);
  assert.deepEqual(JSON.parse(calls[0].init.body), payload(['https://entrelares.app/']));
  assert.ok(!lines.some((l) => l.startsWith('::warning::')));
});

test('submit never throws: an HTTP error or a network failure is a warning, and an empty list sends nothing', async () => {
  const lines = [];
  const log = async (l) => lines.push(l);
  assert.equal(await submit(['https://entrelares.app/'], { fetchImpl: async () => new Response('bad key', { status: 403 }), log }), 403);
  assert.match(lines.at(-1), /^::warning::.*HTTP 403/);
  assert.equal(await submit(['https://entrelares.app/'], { fetchImpl: async () => { throw new Error('offline'); }, log }), null);
  assert.match(lines.at(-1), /^::warning::.*offline/);
  let called = false;
  assert.equal(await submit([], { fetchImpl: async () => { called = true; }, log }), null);
  assert.equal(called, false, 'no page changed → no request at all');
});

test('the ping runs on the PRODUCTION deploy only, after the deploy, and can never fail it', () => {
  const prod = readFileSync(join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
  const preview = readFileSync(join(ROOT, '.github', 'workflows', 'deploy-preview.yml'), 'utf8');
  const deployAt = prod.indexOf('uses: cloudflare/wrangler-action');
  const pingAt = prod.indexOf('node tool/indexnow.mjs');
  assert.ok(deployAt > 0 && pingAt > deployAt, 'the IndexNow step comes after the wrangler deploy');
  const pingStep = prod.slice(prod.lastIndexOf('- name:', pingAt), pingAt);
  assert.match(pingStep, /continue-on-error: true/, 'a failed ping must not turn the deploy red');
  assert.ok(prod.indexOf('sitemap-live.xml') < deployAt, 'the baseline sitemap is fetched BEFORE the deploy replaces it');
  assert.ok(!/indexnow/i.test(preview), 'the preview (noindex) never pings IndexNow');
});
