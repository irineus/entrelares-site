# CLAUDE.md — Project context for Claude Code (landing page)

## Overview
**guardacompartilhada.com** — the static marketing/landing site for **Guarda Compartilhada**,
a shared-custody PWA. Hand-written static HTML/CSS (no framework, no build step), hosted on
**Cloudflare Pages** (`wrangler.jsonc`), deployed by GitHub Actions on push to `main`. The
application itself lives in the sibling repo **`SharedParentalCustody`** (Blazor WASM + Supabase),
served at `app.guardacompartilhada.com`.

## Language conventions
- **UI / legal copy: PT-BR.** File names/titles and commit bodies' technical terms: English is fine.
- **Commit messages: PT-BR**, conventional-commit style (`feat(...)`, `fix(...)`, `docs(...)`).

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
- **Plausible cookieless** (L-01): the `script.outbound-links.js` tag on every page records
  pageviews + outbound CTA clicks — no cookies, no PII, no consent banner. Same Plausible account as
  the app (T-37) → one funnel across both sites. Requires `guardacompartilhada.com` registered in the
  Plausible dashboard for data to appear. Disclosed in `privacidade.html` §9.

## Gotchas
- `ROADMAP.md`, `README.md` and `CLAUDE.md` live at the repo root and are **not** under `public/`,
  so they are never served — safe to edit without touching the published site.
- The deploy Action needs the `CLOUDFLARE_API_TOKEN` secret; it publishes only `./public`.
