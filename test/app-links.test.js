// L-27 — every link that sends somebody to the app names a path the app SERVES.
//
// Until 14/09/2026 sixteen links across ten published files pointed at
// `web.entrelares.app/signup`, which the app has never served. Nothing 404s
// there and that is the whole problem: `app/web/_redirects` answers **200 with
// index.html** for any path (the SPA fallback), so the app boots and
// `RouteRules.redirect` decides — a signed-out visitor is sent to `/login` (the
// sign-in form, not the sign-up form the button promised) and a signed-in one
// lands on the T-64 not-found screen. Sixteen "Criar conta grátis" buttons, on
// the pages the whole acquisition plan points at, each costing the reader a
// step that this repo had no way to notice: no request fails, no test was
// watching, and the address looks right in the href.
//
// Same family as S-19 (the Play listing declared `web.entrelares.app/profile`,
// also not a route) and L-23 (the declared address was not the one that
// answers). The lesson those two share: an address we hand a third party — or
// a reader — is a claim about somebody else's system, and only that system
// decides whether it is true.
//
// THE LIST BELOW IS A MIRROR, and it is the same convention as
// `public/js/gerador-rotina.js` and its test: the routes live in the app repo
// (`packages/entrelares_core/lib/src/route_rules.dart` + the `GoRoute` paths in
// `app/lib/main.dart`), nothing here goes red when THEY move, and this suite
// exists to catch drift on THIS side — the side that has been wrong. Read from
// the app repo at 431e5b4, 14/09/2026.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_HOST = 'https://web.entrelares.app';

/**
 * Paths the app answers with a screen. `/` is the calendar (and the login for a
 * visitor with no session); `/register` is the one this site links from every
 * CTA. The nested `/family/*` pages are U-35's, and `/premium/retorno` is the
 * payment return — neither is linked from here today, but a future page may.
 *
 * Deliberately NOT in the list: anything with an `:id` segment, which no static
 * page can build honestly.
 */
const APP_ROUTES = new Set([
  '/',
  '/login',
  '/register',
  '/onboarding',
  '/reset-password',
  '/update-password',
  '/leaving',
  '/policy-update',
  '/premium/retorno',
  '/family',
  '/family/custom-roles',
  '/family/plan',
  '/family/admin-mode',
  '/family/delete',
  '/family/profile',
  '/notifications',
  '/reports',
]);

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// Both halves of what this site says to a reader: the published pages, and the
// three e-mails the Worker sends. The welcome e-mail's CTA was wrong in the
// same way and would not have been covered by a `public/`-only sweep.
const sources = [...walk(join(ROOT, 'public')), ...walk(join(ROOT, 'src'))]
  .filter((p) => /\.(html|js)$/.test(p))
  .map((p) => ({ file: p.slice(ROOT.length).replaceAll('\\', '/'), body: readFileSync(p, 'utf8') }));

/** Every `https://web.entrelares.app…` occurrence, with its path reduced to what the app routes on. */
const appLinks = sources.flatMap(({ file, body }) =>
  [...body.matchAll(/https:\/\/web\.entrelares\.app([^\s"'`<>)\]]*)/g)].map((m) => {
    const raw = m[1];
    // Query and fragment are the app's to read, not ours to route on; a bare
    // host with no slash is the root.
    const path = raw.split(/[?#]/)[0] || '/';
    return { file, url: APP_HOST + raw, path };
  }),
);

test('the sweep found the links (a broken regex would make the rule below pass over everything)', () => {
  assert.ok(
    appLinks.length >= 16,
    `expected the site's app links, found ${appLinks.length}`,
  );
});

test('every link to the app names a path the app serves', () => {
  const strays = appLinks.filter(({ path }) => !APP_ROUTES.has(path));
  assert.deepEqual(
    strays.map(({ file, url }) => `${file} → ${url}`),
    [],
    'these addresses do not reach a screen: the SPA fallback answers 200, the app boots and routes the reader somewhere else',
  );
});

test('no link still names /signup, the path that cost this card', () => {
  const legacy = appLinks.filter(({ path }) => path === '/signup');
  assert.deepEqual(legacy.map(({ file }) => file), []);
});

test('the CTA the three e-mails share is declared once, so the copies cannot drift', () => {
  const layout = readFileSync(join(ROOT, 'src/email-layout.js'), 'utf8');
  assert.match(layout, /APP_SIGNUP_URL = "https:\/\/web\.entrelares\.app\/register"/);

  // The welcome e-mail (HTML + plain text) and the sequence's step 3 all read
  // the constant. A literal in any of them is how the plain-text body kept
  // saying "app Guarda Compartilhada" for a month after the rebrand.
  const worker = readFileSync(join(ROOT, 'src/index.js'), 'utf8');
  assert.equal(
    (worker.match(/APP_SIGNUP_URL/g) ?? []).length,
    4,
    'expected the import plus the three call sites (welcome HTML, welcome text, sequence ctx)',
  );
});
