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
