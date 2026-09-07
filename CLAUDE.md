# CLAUDE.md — Project context for Claude Code (landing page)

## Overview
**entrelares.app** — the static marketing/landing site for **Entrelares** (rebranded from
"Guarda Compartilhada" in F-54/L-22, Aug 2026 — promoted to production since, so both
`main` and `preview` carry the new brand), a shared-custody app. Hand-written static
HTML/CSS (no framework, no build step), served by a **Cloudflare Worker with static assets**
(`wrangler.jsonc`, `wrangler deploy`), deployed by GitHub Actions. The product itself
lives in the sibling repo **`entrelares-flutter`** (Flutter + Supabase) and runs on **both
channels**: the Play package `com.entrelares.app` and `web.entrelares.app`, the latter served
by the Cloudflare Pages project `entrelares-web`. **The Blazor client that used to live in
`entrelares-app` was shut down and that repo ARCHIVED on 25/08/2026** (app items T-53/T-56);
nothing is deployed from it and nothing there needs to be read to work here. The pre-rebrand hosts are permanent 301s since the F-54 promotion-A
cutover (12/08/2026), which also flipped the e-mail SENDER to `materiais@entrelares.app` —
the Resend Free plan verifies ONE domain, so the old one had to be deleted before the new
one could exist.

## Environments (mirrors the app's dev/prod split)
| Env | Worker | Domain | Branch → deploy | Analytics | Indexing |
|---|---|---|---|---|---|
| **Production** | `entrelares-site` (F-54 — worker names are immutable, so this is a NEW worker; the domains moved at the 12/08/2026 promotion and `guardacompartilhada-site` is now domain-less, pending deletion in the cleanup) | entrelares.app | `main` → `.github/workflows/deploy.yml` | Umami | normal |
| **Preview** | `entrelares-site-preview` (same transition) | preview.entrelares.app | `preview` → `.github/workflows/deploy-preview.yml` | **none** (stripped at deploy) | **noindex** (robots deny + not attached to sitemap) |

- **Preview is a stable staging site** — review landing changes live before promoting to
  production. Flow: feature branch → merge to `preview` (auto-deploys the preview worker) →
  eyeball at preview.entrelares.app → **on the user's explicit demand only**, promote
  `preview`→`main` (production). `main` stays the single production source of truth (Cloudflare
  deploys from it). See the Working agreement below for the review/authorization gates.
- The preview build **strips the Umami loader from every `public/**/*.html` and overwrites
  `robots.txt` to deny all** — both applied to the CI checkout only, never committed, so the
  source and production stay unchanged. No stats, no consent surface, no SEO duplication.
- The preview worker's custom domain is attached **once** in the Cloudflare dashboard (Workers
  & Pages → `entrelares-site-preview` → Settings → Domains & Routes → Add custom
  domain → `preview.entrelares.app`); it is intentionally NOT declared in
  `wrangler.jsonc`, so the CI `CLOUDFLARE_API_TOKEN` needs no zone/DNS scope (same as prod).

## Two published languages (L-16, Aug 2026)
The site is published in **PT-BR at `/` and English at `/en/`**. No build step and no templating
layer, so **`public/en/index.html` is a SIBLING FILE of `public/index.html`, not a render of it** —
the design system (the whole inline `<style>` block) and the slideshow script are **duplicated on
purpose**. A change that belongs in both has to be made twice; both files carry a comment saying
so. That is the item's standing cost, accepted over introducing a generator to a site whose virtue
is that it deploys exactly what is in the repo.
- **`hreflang` is reciprocal on both pages**, canonical per language, **`x-default` → the PT-BR
  home**. This is the one way a second language can *hurt*: the PT-BR pages already rank, and
  duplicate content without correct annotation is a real SEO risk. Any new page that gains a
  language sibling gains the tags in the same delivery.
- **No language detection** — a visible `PT | EN` switch, nothing else. No `Accept-Language`
  redirect (breaks crawlers, traps a Brazilian on an English laptop), no suggestion banner. The
  switch lives **outside `.nav-links`**, which is `display:none` below 820 px — inside it, mobile
  would have no way across. Verified at 344 px.
- **Not translated, deliberately:** the blog cluster (it targets Brazilian search intent), the
  legal pages (see the cross-repo section below — the PT-BR text is the binding one and `/en/`
  says so), and the L-09 materials opt-in (the PDF, the Worker's welcome e-mail and
  `js/materiais.js` are PT-BR, so `/en/` omits the section rather than deliver Portuguese material).
- **Prices stay `R$ 5,49` / `R$ 54,90` in Brazilian format in BOTH languages** — the checkout
  charges in reais and cannot honour a converted figure. Same call the app's U-13 made; `/en/`
  states it plainly instead of hiding it.
- **One Umami `website-id` for both** — the URL rides on every pageview and event, so `/en/` is
  already separable; a second website would mean the paid tier.
- **`public/404.html` is bilingual and single**: Cloudflare's `not_found_handling: "404-page"`
  serves ONE file for the whole site, and a visitor who mistyped a URL has no language we can
  trust. `noindex`, and never in the sitemap.
- **Promotion gate — CLEARED (10/08/2026).** `/en/` tells the reader the app is available in
  English, which was true only on the app's `dev` when L-16 shipped. The app's **U-13 reached
  production in `v1.8.0`** (07/08) and prod is at **`v1.8.1`** — verified on the live login screen,
  which switches to "Sign in / Shared Custody Calendar". `/en/` was promoted to production in the
  same pass. The gate is kept here as the pattern, not as a live warning: **a page that describes
  the app must not be promoted ahead of the app**, which is the S-15 rule applied to marketing copy.
  What did NOT travel with it is the screenshot re-shoot — the phone frames on `/en/` still show
  the PT-BR captures, now tracked as **L-21**.

## Language conventions
- **UI / legal copy: PT-BR** (and the English mirror at `/en/`, per the section above). File
  names/titles and commit bodies' technical terms: English is fine.
- **Commit messages: PT-BR**, conventional-commit style (`feat(...)`, `fix(...)`, `docs(...)`).
- The `Backlog: <ID>` commit trailer was **dropped on 07/09/2026 (app T-63)**, together with its
  only reader — the mirror generator. Naming the item in the commit body stays useful for a human
  reading `git log`; nothing machine-reads it any more. Same convention as `entrelares-flutter`,
  because the board is shared.

## Working agreement — branches, review, deploy (settled July 2026, mirrors the app)
- **Per item:** analysis + gap questions BEFORE any code; once decisions are locked, implement,
  commit and push to the session's work branch, then **report everything done**.
- **One fresh branch per item**, always created from the current **`preview`** (the integration /
  QA branch, the landing's equivalent of the app's `dev`); never reuse a merged branch (squash
  merges orphan its commits — realign onto current `preview` first).
- **`preview` (QA) merge needs the user's explicit OK — never automatic.** After the OK: PR +
  squash-merge to `preview` → the preview worker auto-deploys → the user reviews live at
  **preview.entrelares.app**.
- **Production (`main`) is deploy-on-demand ONLY.** Promote `preview`→`main` (production)
  **solely when the user explicitly asks** — never automatically, never bundled with a preview
  merge, never on my own initiative. `main` stays the single production source of truth.
- **Never commit directly to `preview` or `main`.**

## Roadmap — the CARD is the record (changed 07/09/2026, app T-63)

- **The board is the record of every item.** Database *"Backlog"* under
  [Entrelares — Backlog & Roadmap](https://app.notion.com/p/3ae2f3f4b9b28169acd9e642ad4760aa),
  data source `109b1b02-5b6b-48ef-b3b6-990374a3d10f`, reached through the **Notion MCP connector**.
  It is **shared with the app repo** — `L-*` rows carry `Repo = landing`. There is **no mirror and
  no generator** any more: `notion_mirror.py` was deleted, and the `entrelares-app` checkout it used
  to require is not needed by anything. **Read and write the card directly.**
- **Read the Decisões vigentes page before deciding anything**:
  Notion page `3d42f3f4-b9b2-819d-b0d8-c845b7aa1ae5`, sections 1 to 6. It holds the product's
  standing decisions and **wins over any document in either repository**.
- **If the connector is not enabled in a session, say so instead of guessing the status** —
  `ROADMAP.md` carries no status summary and no pending records.
- **The queue** is `Fase` + `Ordem`, interleaved with the app's items in the same groups — that
  integrated order is the whole point:
  ```
  query_data_sources → mode "sql", data_source_urls
    ["collection://109b1b02-5b6b-48ef-b3b6-990374a3d10f"]
  SELECT "userDefined:ID", "Item", "Status", "Fase", "Ordem", "Notas", url
  FROM "collection://109b1b02-5b6b-48ef-b3b6-990374a3d10f"
  WHERE "Repo" = 'landing' AND "Status" IN ('pending','in-progress')
  ORDER BY CAST(substr("Fase", 1, 2) AS INTEGER), "Ordem"
  ```
  The column is `"userDefined:ID"`, never `ID`, and a column alias does not work in `WHERE` —
  repeat the full name or the query silently returns nothing.
- **On close, in the SAME delivery:** `Status = completed`, `Conclusão` = today, `Tamanho`/`Tipo`
  if still empty, the `CONCLUÍDO <data>:` line at the top of `Notas` (read the current value first —
  `update_properties` overwrites the whole field), and any extensive result as a **sub-page of the
  card**. **`Fase` is not cleared** — it says which group delivered the item. **Nothing moves in
  `ROADMAP.md`**, which is now history: the delivered items' records plus the plan's rationale.
- **Creating an item = creating a card**, with `Fase`, `Ordem`, `Tipo`, `Tamanho` and an
  `Origem:` line in `Notas`. Never a record in markdown.
- Frozen since T-63, as history rather than fields to fill: `Esforço gasto (h)`,
  `Esforço estimado (h)`, `Link`, `Início`.

## Worker endpoint — materials / newsletter (L-09)
The site is no longer purely static: `src/index.js` is the Worker entrypoint (`main` in
`wrangler.jsonc`). It serves the `ASSETS` binding for everything and adds ONE dynamic route,
**`POST /api/subscribe`**, for the opt-in (`public/js/materiais.js` posts to it). The Worker
registers the e-mail **as a contact in Resend** (the `RESEND_SEGMENT_ID` var — the contacts
appear under **Audience** in the Resend dashboard; there is no separately-named segment) and
sends a **welcome e-mail** with the *Modelos de rotina* PDF (`public/downloads/…`, generated from
`assets-src/modelos-rotina.html` via headless Chromium — the PDF's `/Title` is set from the
generator's `<title>`, so it opens with a proper name, never a file/tool name).
- **Secret:** `RESEND_API_KEY` (Resend full-access) is set per-worker via `wrangler secret put` /
  the Cloudflare dashboard — **never committed**. When absent the endpoint **dry-runs** (no
  e-mail, no contact) — that is the intended default on the **preview** worker, so preview shows
  the success UI without real sends unless you add the secret there too. Non-secret config
  (`RESEND_SEGMENT_ID`, `FROM_EMAIL`, `REPLY_TO`) lives in `wrangler.jsonc` `vars`.
- Deploys need Wrangler **4.x** (already pinned in both workflows) — 3.x can't deploy a Worker
  with a `main` entrypoint. The CI `CLOUDFLARE_API_TOKEN` needs only Workers Scripts:Edit (vars
  ship with the script; the secret is set out-of-band), same scope as before.
- **KV binding `OPTIN_LOG` (S-15/C-6)** — the opt-in evidence log. The legal review accepted
  plain opt-in as the consent mechanism for the newsletter **only on condition that a log of
  date, time and IP is kept**, so `logOptIn()` writes one key per submission
  (`optin:<email>:<iso>`, never one per e-mail — a re-subscribe is a second act of consent and
  must not overwrite the first) with **no expiration**: proof of consent has to outlive the
  contact it justifies. Written **before** the Resend calls and **also in dry-run**, because the
  consent happened at submission regardless of whether an e-mail went out. Best-effort: a KV
  outage logs and continues rather than refusing the material. One namespace **per environment**
  (prod `guardacompartilhada-optin-log`, preview `…-preview` — the NAMES keep the old brand on
  purpose: the ids are what `wrangler.jsonc` binds, and renaming would fork the evidence log),
  declared in `wrangler.jsonc`, so preview submissions never mix into the production evidence. Disclosed in `privacidade.html` §3.
- Umami events: `materiais-baixar` (button click) and `materiais-inscricao` (success).
- Neutral naming: no user-visible artifact says "lead-magnet" (files are `materiais.css`/`materiais.js`,
  the section class is `.materiais-box`, the PDF title is set). Internal `.lm-*` style hooks stay.
- **Tests:** `src/index.js` exports its pure helpers (`isHoneypot`/`normalizeEmail`/`isValidEmail`)
  and `handleSubscribe`; `test/subscribe.test.js` covers them with Node's built-in runner (**zero
  deps** — `npm test` / `node --test`, global `fetch` stubbed). The same lane runs
  `test/gerador-rotina.test.js` (L-05): the routine generator's pure rules. `.github/workflows/test.yml` gates
  every PR + push to `preview`/`main` **before** the deploy workflows. Keep the suite green when
  touching the endpoint; static/HTML-only changes don't affect it.

## Legal pages (Privacy & Terms) — cross-repo sync (MUST)
**These two files are the ONLY copy of the legal text.** There is no longer a second one to
mirror: the app has no `/privacy` route of its own (lote 4 decision) and links straight here —
`entrelares-flutter/apps/entrelares_app/lib/deep_link_urls.dart` points at `/privacidade` and
`/termos`. The old instruction to sync `Pages/Privacy.razor` / `Pages/Terms.razor` in
`entrelares-app` is dead with that repo.

**The cross-repo obligation did not go away, it changed shape.** A **material** change is still
one delivery spanning both repos, but what the app side carries is the CONSENT MACHINERY, not
prose — all four, or the gate breaks:
1. `PolicyVersions.current` in `entrelares-flutter/packages/entrelares_core/lib/src/policy_versions.dart`;
2. `PolicyVersions.enforceFrom` = **the date the text becomes VISIBLE to users, plus 15 days**.
   Visible means the PRODUCTION publish — and this repo is deploy-on-demand, so that is the
   `preview`→`main` promotion, never the merge to `preview`;
3. the matching `policy.current_version` **and** `policy.enforce_from` rows in `app_settings`, via
   migration. **Miss this one and the RPC refuses every accept in production**: users are told to
   update an app that is already current, and nobody gets through;
4. an entry in `changeSummary` **and** `changeSummaryEn`, which the acceptance screen renders.

**A NON-material edit must NOT bump the version** — it would drag the whole user base through a
blocking screen for nothing. Only the "Última atualização" date (and the "Versão N.N" label) moves.

**Since S-15 (July 2026) the two sides are ALIGNED** — the old "landing is the more up-to-date
source of truth" no longer holds. The external legal review (app
item S-15) is **done**: 19 findings, all implemented.

**The S-15 lesson: check every sentence against the CODE before publishing it.** Applying that to
counsel's own approved wording caught two claims this repo would otherwise have shipped as false —
the app's B-3 e-mail warning (which had no implementation) and this repo's §3 "apenas o e-mail",
written while the C-6 opt-in log also stores date, time and IP. Legal text is a claim ABOUT the
system; an unverified claim is a liability no matter who drafted it.

## Analytics
- **Umami cookieless** (L-01): the `cloud.umami.is/script.js` tag on every page records pageviews;
  CTA clicks are tracked via `data-umami-event="cta-signup"` on the app links — no cookies, no PII, no
  consent banner. Same Umami provider as the app (T-37) — separate Umami accounts (the free tier allows
  one website per account), so the landing and app have distinct `website-id`s. The landing's
  `data-website-id` is live in every page. Disclosed in `privacidade.html` §7/§9. (Switched from
  Plausible to avoid its subscription; PostHog reconsidered for later experimentation.)

## Gotchas
- `ROADMAP.md`, `README.md` and `CLAUDE.md` live at the repo root and are **not** under `public/`,
  so they are never served — safe to edit without touching the published site.
- **`sitemap.xml` carries its own rules in a header comment (L-07)** — only indexable pages belong
  in it (the `noindex` legal pages were listed for months, and the 404 must never be), and
  `lastmod` is the date THAT page changed, set by hand in the delivery that changes it
  (`git log -1 --format=%ad --date=short -- <file>`). Never bump it globally: a sitemap claiming
  every page changed today teaches the crawler to ignore the field.
- **Generated images have generators in `assets-src/`, and the command lives in the file** — the
  lead-magnet PDF (`modelos-rotina.html`), the two OG banners (`og-cover.html` /
  `og-cover-en.html`, headless Chrome at 1200×630) and the three icons (`brand-icons.py`).
  Re-render when the copy they show changes; a banner whose text no longer matches the page is
  worse than no banner.
- **The brand mark is NOT drawn in this repo.** Its geometry lives in the app repo
  (`entrelares-flutter/store/brand-icons.py`, U-29); what lives here is one rendered master,
  `assets-src/brand-marca.png`, plus the resizing. To change the art: edit the app repo's script,
  re-render the master from it, run `brand-icons.py`, re-render both banners (their plaque is the
  master and their brand-row icon is the rendered `icon-192.png`), and **bump the `?v=` on every
  `<link>`/`<meta>` that points at them** — without that the browser keeps serving the old mark
  from cache. Two drawings of one mark is how the two repos drift (T-57, 28/08/2026).
- **`public/js/gerador-rotina.js` is a MIRROR of the app's rotation-wizard presets** (L-05) —
  `entrelares-flutter/packages/entrelares_core/lib/src/wizard_rules.dart`, `wizardPresetBlocks`.
  The tool's whole promise is that the preview equals what the app generates after signup, so a
  preset change in the app repo must land here in the same delivery. `test/gerador-rotina.test.js`
  hardcodes the expansion tables on purpose: it fails when THIS side drifts, but nothing fails
  when the APP side moves — the sync is a convention, like the legal pages.
- The deploy Action needs the `CLOUDFLARE_API_TOKEN` secret; it publishes `./public` (static
  assets) plus the Worker script (`src/index.js`) — `wrangler deploy` ships both.
