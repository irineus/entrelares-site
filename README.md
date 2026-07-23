# guardacompartilhada-site

Static marketing/landing site for **Guarda Compartilhada** (guardacompartilhada.com).
Pure HTML/CSS, no build step, no framework — every page is self-contained.

The app itself lives in a separate repository (`SharedParentalCustody`) and is
served at `app.guardacompartilhada.com`.

## Structure

| File | Purpose |
|---|---|
| `public/index.html` | Landing page: hero, how it works, benefits, install guide, pricing, FAQ |
| `public/termos.html` | Terms of Use (**draft — needs legal review before public launch**) |
| `public/privacidade.html` | Privacy Policy / LGPD (**draft — needs legal review before public launch**) |
| `public/robots.txt` / `public/sitemap.xml` | SEO plumbing |
| `wrangler.jsonc` | Cloudflare Workers static-assets config (`assets.directory = ./public`) |

Only `public/` is uploaded as site assets — never widen `assets.directory`
to the repo root, or `.git/` and this README get published too.

Icons (`favicon.png`, `icon-192.png`, `icon-512.png`) are copies of the app's
PWA icons — keep them in sync if the app branding changes.

## Deploy — GitHub Actions → Cloudflare Workers

Every push to `main` runs `.github/workflows/deploy.yml`, which executes
`wrangler deploy` using the committed `wrangler.jsonc` (assets from
`public/`, account pinned via `account_id`). Manual runs are available via
the workflow's **Run workflow** button.

One-time setup:

1. Cloudflare Dashboard → **My Profile → API Tokens → Create Token** →
   template **"Edit Cloudflare Workers"** (scope it to this account).
2. GitHub repo → **Settings → Secrets and variables → Actions** → new
   repository secret `CLOUDFLARE_API_TOKEN` with that token.
3. If the Worker is also git-connected in the Cloudflare dashboard, disable
   that build connection (Worker → Settings → Build) so pushes don't trigger
   two competing deploys.

1. **DNS**: add `guardacompartilhada.com` under Cloudflare **DNS** and point
   the registrar's nameservers at Cloudflare.
2. **Custom domain**: in the Worker's **Settings → Domains & Routes**, add
   `guardacompartilhada.com`. TLS certificates are issued automatically.
3. **www → apex redirect**: `_redirects` cannot do cross-host redirects on
   Workers static assets (that is a Pages-only feature). Use a dashboard
   Redirect Rule instead: **Rules → Redirect Rules → Create** — When hostname
   equals `www.guardacompartilhada.com` → dynamic redirect to
   `concat("https://guardacompartilhada.com", http.request.uri.path)`,
   status 301, "preserve query string" on. (Requires a DNS record for `www`,
   e.g. a proxied CNAME to the apex.)

## Pending before public launch

- [ ] App URL: all CTAs point to `https://app.guardacompartilhada.com` —
      create that DNS record / migrate the app domain, or update the links.
- [ ] `contato@guardacompartilhada.com` mailbox (footer + legal pages) —
      e.g. Cloudflare Email Routing (free) forwarding to a personal inbox.
- [ ] Legal review of `termos.html` and `privacidade.html`; fill in the
      controller identification in section 8 of the privacy policy, then
      remove the yellow "Rascunho" banners.
- [ ] Replace the CSS phone mockup with real app screenshots when available
      (swap the `.phone` block in `index.html`).
- [x] Analytics (L-01): Umami cookieless snippet on every page + `data-umami-event` on
      the CTAs, with the live landing `data-website-id`. Collecting once `main` redeploys.
- [ ] Open Graph image: `icon-512.png` works but a 1200×630 banner renders
      better on WhatsApp/social previews.
