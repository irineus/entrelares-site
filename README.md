# guardacompartilhada-site

The marketing/landing site for **Guarda Compartilhada** — a shared-custody PWA. Served at
**guardacompartilhada.com**; the application itself lives in the sibling repo
[`SharedParentalCustody`](../SharedParentalCustody) and is served at
`app.guardacompartilhada.com`.

Hand-written static HTML/CSS (no framework, no build step) served by a **Cloudflare Worker
with static assets**. The site is *almost* fully static — `src/index.js` adds **one** dynamic
route (`POST /api/subscribe`) for the lead-magnet / newsletter opt-in; everything else is
served from `public/`.

- **Planning:** [`ROADMAP.md`](ROADMAP.md) — the landing backlog + forward plan (`L-*` items).
- **Agent context:** [`CLAUDE.md`](CLAUDE.md) — conventions, environments, deploy flow, gotchas.

---

## Table of contents
- [Overview](#overview)
- [Structure](#structure)
- [Environments](#environments)
- [Deploy](#deploy)
- [Worker endpoint — materials / newsletter (L-09)](#worker-endpoint--materials--newsletter-l-09)
- [Testing](#testing)
- [Analytics (L-01)](#analytics-l-01)
- [Legal pages — cross-repo sync](#legal-pages--cross-repo-sync)
- [First-time Cloudflare setup](#first-time-cloudflare-setup)
- [Pending before public launch](#pending-before-public-launch)

---

## Overview

The landing's job is **acquisition and conversion**: it explains the product, funnels visitors
to the app's sign-up, and captures e-mails from visitors not yet ready to sign up. It shares a
funnel with the app (landing CTR → app signups), so several items coordinate cross-repo (see
`ROADMAP.md`). The SEO foundation is strong out of the box — JSON-LD
(`SoftwareApplication`/`Organization`/`FAQPage` + per-article `Article`/`BreadcrumbList`),
canonicals, `sitemap.xml`, `robots.txt`, and a 4-article blog cluster.

Only `public/` is uploaded as site assets — **never widen `assets.directory` to the repo root**,
or `.git/`, `src/`, `assets-src/` and these docs would be published too. (`ROADMAP.md`,
`README.md` and `CLAUDE.md` live at the repo root precisely so they are never served.)

## Structure

```
guardacompartilhada-site/
├── public/                     # the ONLY directory uploaded as site assets
│   ├── index.html              # landing page: hero slideshow, how-it-works, benefits,
│   │                           #   founder note (L-06), #materiais opt-in (L-09), pricing, FAQ
│   ├── privacidade.html        # Privacy Policy / LGPD  (kept in sync with the app — see below)
│   ├── termos.html             # Terms of Use            (kept in sync with the app)
│   ├── robots.txt / sitemap.xml# SEO plumbing
│   ├── og-cover.png            # 1200×630 Open Graph banner (L-02)
│   ├── favicon.png · icon-192.png · icon-512.png  # copies of the app's PWA icons — keep in sync
│   ├── css/materiais.css       # styles for the L-09 opt-in (shared by index + blog)
│   ├── js/materiais.js         # L-09 opt-in handler (posts to /api/subscribe)
│   ├── downloads/
│   │   └── modelos-rotina-guarda-compartilhada.pdf  # L-09 lead magnet (generated, versioned)
│   ├── img/
│   │   ├── screenshots/        # L-03 real product screenshots (WebP + PNG)
│   │   └── founder.webp/.jpg   # L-06 founder photo
│   └── blog/                   # 4-article SEO cluster (+ index, img/) with the L-09 opt-in block
├── src/
│   └── index.js                # Cloudflare Worker entrypoint: serves ASSETS + POST /api/subscribe
├── test/
│   └── subscribe.test.js       # Worker unit tests (node:test, zero deps — `npm test`)
├── assets-src/
│   └── modelos-rotina.html     # generator for the lead-magnet PDF (headless Chromium; NOT served)
├── wrangler.jsonc              # Workers config (main + assets + vars; two envs)
├── package.json                # `type: module` + `test` script (no runtime deps; NOT served)
├── .github/workflows/
│   ├── deploy.yml              # push to `main`    → production worker
│   ├── deploy-preview.yml      # push to `preview` → preview worker (analytics stripped, noindex)
│   └── test.yml                # PR + push → runs the Worker tests (gates the merge)
├── ROADMAP.md · README.md · CLAUDE.md   # repo-root docs (never served)
```

## Environments

Mirrors the app's dev/prod split.

| Env | Worker | Domain | Branch → deploy | Analytics | Indexing |
|---|---|---|---|---|---|
| **Production** | `guardacompartilhada-site` | guardacompartilhada.com | `main` → `deploy.yml` | Umami | normal |
| **Preview** | `guardacompartilhada-site-preview` | preview.guardacompartilhada.com | `preview` → `deploy-preview.yml` | **none** (stripped at deploy) | **noindex** (robots deny) |

**Preview is a stable staging site** — review landing changes live before promoting to production.
Flow: feature branch → merge to **`preview`** (auto-deploys the preview worker) → eyeball at
`preview.guardacompartilhada.com` → **only on explicit demand**, promote `preview`→`main`
(production). The preview build strips the Umami loader from every `public/**/*.html` and overwrites
`robots.txt` to deny all — applied to the CI checkout only, so source and production stay unchanged.

## Deploy

GitHub Actions runs `wrangler deploy` (production) / `wrangler deploy --env preview` (preview)
using the committed `wrangler.jsonc`. Manual runs are available via each workflow's **Run
workflow** button. Deploys need **Wrangler 4.x** (pinned in both workflows) — 3.x cannot deploy a
Worker that has a `main` entrypoint. The CI `CLOUDFLARE_API_TOKEN` needs only **Workers
Scripts:Edit** (vars ship with the script; the Worker secret is set out-of-band — see below).

> **Trigger caveat:** GitHub can drop the `on: push` event for a merge performed via the API
> (e.g. a squash-merge that returned a 5xx). If a merge to `preview`/`main` does not auto-deploy,
> re-run the workflow manually (**Run workflow** / `workflow_dispatch`). Confirm the deploy ran
> before assuming a change is live.

## Worker endpoint — materials / newsletter (L-09)

`src/index.js` serves the `ASSETS` binding for everything and adds one dynamic route,
**`POST /api/subscribe`**, for the opt-in (`public/js/materiais.js` posts to it). The Worker
registers the e-mail **as a contact in Resend** (they appear under **Audience** in the Resend
dashboard — there is no separately-named segment) and sends a **welcome e-mail** with the
*Modelos de rotina* PDF (`public/downloads/…`, generated from `assets-src/modelos-rotina.html`
via headless Chromium; the PDF's `/Title` is set from the generator's `<title>` so it opens with
a proper name).

- **Secret:** `RESEND_API_KEY` (Resend full-access) is set **per worker** via `wrangler secret put`
  or the Cloudflare dashboard — **never committed**. **When the secret is absent the endpoint
  dry-runs** (no e-mail, no contact) — the intended default on **preview**. In production the
  worker only gains the `main` script (and therefore the ability to hold Variables/Secrets) once
  `main` receives the L-09 code, so **add the secret right after the first production promotion**
  that carries it.
- Non-secret config lives in `wrangler.jsonc` `vars`: `RESEND_SEGMENT_ID`, `FROM_EMAIL`, `REPLY_TO`.
- Umami events: `materiais-baixar` (button click) and `materiais-inscricao` (success). No
  user-visible artifact carries a "lead-magnet" name (files are `materiais.*`, the section class is
  `.materiais-box`, the PDF title is set); internal `.lm-*` style hooks stay.

## Testing

The static assets need no build, but the Worker endpoint (`src/index.js`) carries real logic
— validation, honeypot, dry-run, provider-error handling, partial-success reporting — so it has
a unit suite. **Zero dependencies:** Node's built-in test runner over `test/*.test.js`, with the
global `fetch` stubbed to assert the Resend request shape without any network call.

```
npm test          # === node --test  (requires Node 18+; CI uses 22)
```

`.github/workflows/test.yml` runs it on every PR and on pushes to `preview`/`main`, so a
regression in the subscribe endpoint **blocks the merge before** the deploy workflows run. The
suite covers: method/payload guards (204/405/413/400), the honeypot short-circuit, e-mail
validation, the no-key **dry-run**, the happy path (contact + welcome e-mail, payload shaping,
origin-tracked PDF link), a tolerated duplicate (409), and every provider-failure branch
(contact 5xx → 502, e-mail failure → partial success). Pure static/HTML changes don't touch it.

## Analytics (L-01)

**Umami cookieless** — the `cloud.umami.is/script.js` tag on every page records pageviews; CTA
clicks carry `data-umami-event` (e.g. `cta-signup`). No cookies, no PII, no consent banner. Same
provider as the app (separate accounts — the free tier allows one website per account, so the
landing and app have distinct `website-id`s). The landing's `data-website-id` is live in every
page and disclosed in `privacidade.html`. (Switched from Plausible to avoid its subscription.)

## Legal pages — cross-repo sync

`public/privacidade.html` + `public/termos.html` are the **same legal documents for the same
product** as the app's `Pages/Privacy.razor` (`/privacy`) + `Pages/Terms.razor` (`/terms`). They
**must stay in sync**: any change to policy/terms **content** on one side is mirrored in the other
**in the same delivery** (mirror the *substance*, not line-for-line — the two differ in section
numbering). Bump the "Última atualização" date + the landing "Versão N.N" label on both for a
material change; the app additionally bumps `Helpers/PolicyVersions.cs` (demonstrable consent).
**Since S-15 (July 2026) the two sides are ALIGNED** — the old "landing is the more up-to-date
source of truth" no longer holds; treat them as equals and change both together. The external
legal review (app item **S-15**) is **done**: three rounds of legal opinion, 19 findings, all
implemented across app v1.6.34–1.6.39 and mirrored here.

## First-time Cloudflare setup

1. **API token** — Cloudflare Dashboard → *My Profile → API Tokens → Create Token* → template
   **"Edit Cloudflare Workers"** (scoped to this account). Add it as the GitHub repo secret
   `CLOUDFLARE_API_TOKEN` (*Settings → Secrets and variables → Actions*). If the Worker is also
   git-connected in the dashboard, disable that build connection so pushes don't double-deploy.
2. **DNS** — add `guardacompartilhada.com` under Cloudflare *DNS* and point the registrar's
   nameservers at Cloudflare.
3. **Custom domains** — in each Worker's *Settings → Domains & Routes*, add the domain
   (`guardacompartilhada.com` on production; `preview.guardacompartilhada.com` on the preview
   worker — attached **once** in the dashboard, intentionally not in `wrangler.jsonc`, so the CI
   token needs no zone/DNS scope). TLS is automatic.
4. **www → apex redirect** — `_redirects` cannot do cross-host redirects on Workers static assets
   (Pages-only). Use a dashboard **Redirect Rule**: when hostname equals
   `www.guardacompartilhada.com` → 301 to
   `concat("https://guardacompartilhada.com", http.request.uri.path)`, preserve query string.
   (Requires a proxied `www` DNS record.)
5. **Worker secret** — `wrangler secret put RESEND_API_KEY` (or the dashboard) on the production
   worker for the L-09 endpoint (see above).

## Pending before public launch

- [x] ~~**Legal review** of `termos.html` + `privacidade.html`~~ — done (app item **S-15**, July 2026):
      all 19 findings implemented. Here that meant A-2/A-3/B-1/B-2/B-3/C-1/C-3/C-5 in the two legal
      pages, **C-7** (the "à prova de disputa" promise removed from `index.html`) and **C-6** (the
      opt-in evidence log in KV, plus the §3 correction it forced).
- [ ] **`icon-512.png` recompression** (L-02 micro-follow-up — 396 KB; no image optimiser available
      in-environment, deferred).
- [ ] **Remaining on-site roadmap:** L-05 (SEO content + interactive tool), L-04 (blog image
      optimization), L-07 (sitemap hygiene), L-08 (pricing — gated by app F-32/T-39). See
      [`ROADMAP.md`](ROADMAP.md).
- [x] Analytics (L-01), Open Graph banner (L-02), real screenshots (L-03), audit-log repositioning
      (L-10), founder note (L-06), lead-magnet/newsletter (L-09) — shipped.
