# guardacompartilhada-site

Static marketing/landing site for **Guarda Compartilhada** (guardacompartilhada.com).
Pure HTML/CSS, no build step, no framework — every page is self-contained.

The app itself lives in a separate repository (`SharedParentalCustody`) and is
served at `app.guardacompartilhada.com`.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Landing page: hero, how it works, benefits, install guide, pricing, FAQ |
| `termos.html` | Terms of Use (**draft — needs legal review before public launch**) |
| `privacidade.html` | Privacy Policy / LGPD (**draft — needs legal review before public launch**) |
| `_redirects` | Cloudflare Pages rule: www → apex 301 |
| `robots.txt` / `sitemap.xml` | SEO plumbing |

Icons (`favicon.png`, `icon-192.png`, `icon-512.png`) are copies of the app's
PWA icons — keep them in sync if the app branding changes.

## Deploy — Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
   and select this repository.
2. Build settings: framework preset **None**, build command **(empty)**,
   output directory **/** (root). Every push to `main` deploys automatically.
3. **Custom domains**: add `guardacompartilhada.com` and `www.guardacompartilhada.com`
   (requires the domain's DNS to be on Cloudflare — add the site under
   **DNS** first and point the registrar's nameservers at Cloudflare).
   TLS certificates are issued automatically. The `_redirects` file folds
   `www` into the apex.

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
- [ ] Analytics (optional): add Plausible/Umami snippet to `index.html`.
- [ ] Open Graph image: `icon-512.png` works but a 1200×630 banner renders
      better on WhatsApp/social previews.
