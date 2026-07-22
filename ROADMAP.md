# Landing Page — Growth & Conversion Roadmap — PROPOSAL

> **Status: proposal awaiting owner sign-off.** Companion to the app-side track in
> `SharedParentalCustody/backlog/go-to-market.md`. The landing (this repo) and the
> app funnel are **one funnel** — landing CTR feeds app signups, so `L-01`
> (analytics here) and `T-37` (app analytics) are coordinated.
>
> The site is a hand-written static site on Cloudflare (no framework, no JS, no
> build step). It already has genuinely strong SEO: JSON-LD (`SoftwareApplication`,
> `Organization`, `FAQPage`, per-article `Article`/`BreadcrumbList`), canonicals,
> `sitemap.xml`, `robots.txt`, and a 4-article blog cluster targeting
> "guarda compartilhada" long-tail keywords. The gaps below are conversion,
> measurement, and social/preview polish — not the SEO foundation.

## Summary (proposed)

| ID | Title | Priority | Complexity | Impact |
|---|---|---|---|---|
| L-01 | Cookieless web analytics + CTA tracking | `high` | `low` | `high` |
| L-02 | Fix Open Graph image (1200×630) + compress icon-512 | `high` | `low` | `high` |
| L-03 | Real product screenshots (replace CSS mockup) | `high` | `low` | `high` |
| L-04 | Optimize blog images (WebP/AVIF + srcset) | `medium` | `low` | `medium` |
| L-05 | Expand SEO content cluster + interactive tool | `medium` | `medium` | `high` |
| L-06 | Soft social proof (beta count / founder note) | `medium` | `low` | `medium` |
| L-07 | Sitemap hygiene (drop noindex legal pages; lastmod) | `low` | `low` | `low` |

---

### L-01 — Cookieless web analytics + CTA tracking

**Priority** `high` · **Complexity** `low` · **Impact** `high`

Add **cookieless** analytics (Cloudflare Web Analytics — already on Cloudflare —
or Plausible/Umami). Because it sets no cookies and collects no PII, it needs
**no LGPD consent banner**. Track landing pageviews and, critically, the
**click-through on every "Criar conta grátis" / "Entrar no app" CTA** to
`app.guardacompartilhada.com`. This is the top of the funnel that pairs with the
app-side funnel (`T-37`) — today the whole thing is unmeasured.

**Files:** `public/index.html` (+ blog pages) — one analytics snippet; if Cloudflare
Web Analytics, enable in the dashboard (zero code) and add outbound-link events.

---

### L-02 — Fix Open Graph image (1200×630) + compress icon-512

**Priority** `high` · **Complexity** `low` · **Impact** `high`

The current OG image is a **512×512 square** (`icon-512.png`, 396 KB), so link
previews on **WhatsApp** — the #1 sharing channel for this Brazilian audience —
render poorly. Create a proper **1200×630** social banner and point
`og:image` / `twitter:image` at it. Also compress `icon-512.png` (396 KB is heavy
for an icon).

**Files:** `public/` new `og-cover.png` (1200×630); `og:image`/`twitter:image` in
`index.html` (+ per-article OG in `public/blog/*.html`); recompress `icon-512.png`.

---

### L-03 — Real product screenshots (replace CSS mockup)

**Priority** `high` · **Complexity** `low` · **Impact** `high`

The hero uses a **CSS/HTML phone mockup**, not real UI (README flags this). Real
screenshots of the Today card, calendar, and swap workflow build trust and help
image SEO. Reuse the same screenshots for the Play listing (app-side `T-38`).

**Files:** `public/img/` new screenshots (WebP + PNG fallback); hero + benefits
sections in `index.html`.

---

### L-04 — Optimize blog images (WebP/AVIF + srcset)

**Priority** `medium` · **Complexity** `low` · **Impact** `medium`

Blog JPEGs are 1600px, 200–330 KB each, no responsive `srcset`, no next-gen
format. The landing home page itself is image-light (fast LCP), so this is scoped
to the **article pages** — improves their Core Web Vitals and SEO.

**Files:** `public/blog/img/*` → add WebP/AVIF; `<picture>`/`srcset` in
`public/blog/*.html`.

---

### L-05 — Expand SEO content cluster + interactive tool

**Priority** `medium` · **Complexity** `medium` · **Impact** `high`

Grow the existing 4-article cluster with high-intent long-tail: *"modelo de acordo
de guarda compartilhada"*, *"guarda compartilhada e pensão"*, *"rotina 7/7 vs
14/14"*. Add **one interactive tool** — a *"gerador/calculadora de rotina de
guarda"* — as a link magnet and intent capture that funnels into the app signup
(mirrors the app's rotation wizard). Cheapest durable acquisition channel in BR.

**Files:** new `public/blog/*.html` articles (+ sitemap entries + internal links);
a new `public/ferramentas/` tool page (static + tiny JS, staying framework-free).

---

### L-06 — Soft social proof (beta count / founder note)

**Priority** `medium` · **Complexity** `low` · **Impact** `medium`

The page has **no social proof** today — trust rests only on feature claims. Even
soft proof helps: a beta user count, a short founder note ("por que construí
isso"), or the first real testimonials once available. Keep it honest (no
fabricated reviews).

**Files:** new section in `public/index.html` (near "Por quê" or before the final CTA).

---

### L-07 — Sitemap hygiene

**Priority** `low` · **Complexity** `low` · **Impact** `low`

Minor: the legal pages are correctly `noindex` but still listed in `sitemap.xml`
(mild inconsistency); `lastmod` is hardcoded and will go stale. Drop the noindex
pages from the sitemap and set a simple lastmod convention (or generate it in the
deploy Action).

**Files:** `public/sitemap.xml`; optionally `.github/workflows/deploy.yml`.
