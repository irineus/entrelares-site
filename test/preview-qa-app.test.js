// T-79 (app repo, 22/09/2026) — the PREVIEW site sends its readers to the QA
// app, and ONLY the preview does.
//
// `qa.entrelares.app` is the app's `main` built against the DEV database. The
// preview's app links are rewritten to it at deploy time, in the ephemeral CI
// checkout, the same way the preview already strips analytics and blocks
// indexing — so a landing change is tested end to end, sign-up included,
// without creating an account in the product. The failure on each side is
// silent: a preview linking production turns every test click into a real
// account; a production page linking QA sends real visitors to a test
// database. Both look like a working link.
//
// The host is a MIRROR of the app repo's `Env.dev.webOrigin`; nothing here goes
// red when that one moves — this suite catches drift on THIS side.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const QA_APP = 'https://qa.entrelares.app';
const PROD_APP = 'https://web.entrelares.app';

const workflow = (name) =>
  readFileSync(join(ROOT, '.github', 'workflows', name), 'utf8');

/** The workflow without its comments — a comment may quote what the code does. */
const code = (source) =>
  source
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

test('the preview deploy rewrites the app links to the QA app, before deploying', () => {
  const yaml = code(workflow('deploy-preview.yml'));
  const rewrite = yaml.indexOf(
    "sed -i 's#https://web\\.entrelares\\.app#https://qa.entrelares.app#g'",
  );
  const deploy = yaml.indexOf('command: deploy --env preview');
  assert.ok(rewrite > -1, 'the preview must point its app links at the QA app');
  assert.ok(deploy > -1, 'the preview still deploys');
  assert.ok(rewrite < deploy, 'the rewrite has to happen BEFORE the upload');
});

test('the rewrite refuses to run blind, and refuses leftovers', () => {
  const yaml = code(workflow('deploy-preview.yml'));
  assert.match(yaml, /\[ "\$before" -gt 0 \]/,
    'a rewrite that matched nothing means the links changed shape');
  assert.match(yaml, /if grep -rl 'https:\/\/web\\\.entrelares\\\.app' public; then/,
    'a production link left on the preview crosses a tester into production');
});

test('production never links the QA app', () => {
  assert.ok(!workflow('deploy.yml').includes('qa.entrelares.app'),
    'the production deploy must not rewrite anything toward QA');
  for (const path of files(join(ROOT, 'public'))) {
    if (!/\.(html|js|json|xml|txt)$/.test(path)) continue;
    assert.ok(!readFileSync(path, 'utf8').includes(QA_APP),
      `${path} names the QA app — the source is production's; only the preview deploy rewrites`);
  }
});

test('there is something to rewrite', () => {
  // The CTAs of the landing ARE the thing being tested on the preview. If this
  // count ever reaches zero the deploy step fails anyway — this says so in the
  // cheap lane, on the PR, instead of on the push to `preview`.
  let count = 0;
  for (const path of files(join(ROOT, 'public'))) {
    if (!path.endsWith('.html')) continue;
    count += readFileSync(path, 'utf8').split(PROD_APP).length - 1;
  }
  assert.ok(count > 0, 'no page links the app any more');
});
