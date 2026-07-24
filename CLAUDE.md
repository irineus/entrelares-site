# CLAUDE.md — Project context for Claude Code (landing page)

## Overview
**guardacompartilhada.com** — the static marketing/landing site for **Guarda Compartilhada**,
a shared-custody PWA. Hand-written static HTML/CSS (no framework, no build step), served by a
**Cloudflare Worker with static assets** (`wrangler.jsonc`, `wrangler deploy`), deployed by
GitHub Actions. The application itself lives in the sibling repo **`SharedParentalCustody`**
(Blazor WASM + Supabase), served at `app.guardacompartilhada.com`.

## Environments (mirrors the app's dev/prod split)
| Env | Worker | Domain | Branch → deploy | Analytics | Indexing |
|---|---|---|---|---|---|
| **Production** | `guardacompartilhada-site` | guardacompartilhada.com | `main` → `.github/workflows/deploy.yml` | Umami | normal |
| **Preview** | `guardacompartilhada-site-preview` | preview.guardacompartilhada.com | `preview` → `.github/workflows/deploy-preview.yml` | **none** (stripped at deploy) | **noindex** (robots deny + not attached to sitemap) |

- **Preview is a stable staging site** — review landing changes live before promoting to
  production. Flow: feature branch → merge to `preview` (auto-deploys the preview worker) →
  eyeball at preview.guardacompartilhada.com → **on the user's explicit demand only**, promote
  `preview`→`main` (production). `main` stays the single production source of truth (Cloudflare
  deploys from it). See the Working agreement below for the review/authorization gates.
- The preview build **strips the Umami loader from every `public/**/*.html` and overwrites
  `robots.txt` to deny all** — both applied to the CI checkout only, never committed, so the
  source and production stay unchanged. No stats, no consent surface, no SEO duplication.
- The preview worker's custom domain is attached **once** in the Cloudflare dashboard (Workers
  & Pages → `guardacompartilhada-site-preview` → Settings → Domains & Routes → Add custom
  domain → `preview.guardacompartilhada.com`); it is intentionally NOT declared in
  `wrangler.jsonc`, so the CI `CLOUDFLARE_API_TOKEN` needs no zone/DNS scope (same as prod).

## Language conventions
- **UI / legal copy: PT-BR.** File names/titles and commit bodies' technical terms: English is fine.
- **Commit messages: PT-BR**, conventional-commit style (`feat(...)`, `fix(...)`, `docs(...)`).

## Working agreement — branches, review, deploy (settled July 2026, mirrors the app)
- **Per item:** analysis + gap questions BEFORE any code; once decisions are locked, implement,
  commit and push to the session's work branch, then **report everything done**.
- **One fresh branch per item**, always created from the current **`preview`** (the integration /
  QA branch, the landing's equivalent of the app's `dev`); never reuse a merged branch (squash
  merges orphan its commits — realign onto current `preview` first).
- **`preview` (QA) merge needs the user's explicit OK — never automatic.** After the OK: PR +
  squash-merge to `preview` → the preview worker auto-deploys → the user reviews live at
  **preview.guardacompartilhada.com**.
- **Production (`main`) is deploy-on-demand ONLY.** Promote `preview`→`main` (production)
  **solely when the user explicitly asks** — never automatically, never bundled with a preview
  merge, never on my own initiative. `main` stays the single production source of truth.
- **Never commit directly to `preview` or `main`.**

## Roadmap
- `ROADMAP.md` — the growth/conversion roadmap (L-01…L-12), companion to the app's Phase 6
  (Growth, Analytics & Monetization) in `SharedParentalCustody/backlog/README.md`. Cross-repo
  prerequisites are noted per item.

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
- Umami events: `materiais-baixar` (button click) and `materiais-inscricao` (success).
- Neutral naming: no user-visible artifact says "lead-magnet" (files are `materiais.css`/`materiais.js`,
  the section class is `.materiais-box`, the PDF title is set). Internal `.lm-*` style hooks stay.
- **Tests:** `src/index.js` exports its pure helpers (`isHoneypot`/`normalizeEmail`/`isValidEmail`)
  and `handleSubscribe`; `test/subscribe.test.js` covers them with Node's built-in runner (**zero
  deps** — `npm test` / `node --test`, global `fetch` stubbed). `.github/workflows/test.yml` gates
  every PR + push to `preview`/`main` **before** the deploy workflows. Keep the suite green when
  touching the endpoint; static/HTML-only changes don't affect it.

## Legal pages (Privacy & Terms) — cross-repo sync (MUST)
`public/privacidade.html` + `public/termos.html` are the **same legal documents for the same
product** as the app's `Pages/Privacy.razor` (`/privacy`) + `Pages/Terms.razor` (`/terms`) in the
`SharedParentalCustody` repo. They **must stay in sync**: any change to policy/terms **content**
here must be mirrored in the app repo **in the same delivery**, and vice-versa. The two documents
differ in structure/section numbering — mirror the **substance**, not line-for-line. Bump the
"Última atualização" date (and the landing "Versão N.N" label) on both sides for material changes;
the app additionally bumps `Helpers/PolicyVersions.cs` (S-13 demonstrable consent). **These landing
pages are currently the more up-to-date source of truth.** Legal review is tracked as app item S-15.

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
- The deploy Action needs the `CLOUDFLARE_API_TOKEN` secret; it publishes only `./public`.
