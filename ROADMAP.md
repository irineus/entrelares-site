# Landing Page — Growth & Conversion Roadmap

Roadmap for `guardacompartilhada.com` (the marketing site), ordered by **execution
sequence**. Companion to the app-side priority track in
`SharedParentalCustody/backlog/README.md` → **Phase 6 — Growth, Analytics &
Monetization**. The landing and the app funnel are **one funnel** (landing CTR feeds
app signups), so several items have **cross-repo prerequisites** — flagged per item.

The site is a hand-written static site on Cloudflare (no framework, no JS build). Its
SEO foundation is already strong (JSON-LD `SoftwareApplication`/`Organization`/`FAQPage`
+ per-article `Article`/`BreadcrumbList`, canonicals, `sitemap.xml`, `robots.txt`, and a
4-article blog cluster). The work below is **measurement, conversion, and preview
polish** — not the SEO base.

> **Status values:** `pending` · `in-progress` · `completed`
> IDs (`L-` + number) are stable and never reused.

## Execution order & summary

| Order | ID | Title | Priority | Complexity | Impact | Cross-repo link |
|---|---|---|---|---|---|---|
| 1 | L-01 | Cookieless web analytics + CTA tracking | `high` | `low` | `high` | ↔ app **T-37** (same funnel) |
| 2 | L-02 | Fix Open Graph image (1200×630) + compress icon-512 | `high` | `low` | `high` | → feeds app **T-38** store imagery |
| 3 | L-03 | Real product screenshots (replace CSS mockup) | `high` | `low` | `high` | → **required by app T-38** (Play listing assets) |
| 4 | L-06 | Soft social proof (beta count / founder note) | `medium` | `low` | `medium` | — |
| 5 | L-04 | Optimize blog images (WebP/AVIF + srcset) | `medium` | `low` | `medium` | — |
| 6 | L-05 | Expand SEO content cluster + interactive tool | `medium` | `medium` | `high` | mirrors app rotation wizard |
| 7 | L-07 | Sitemap hygiene (drop noindex legal pages; lastmod) | `low` | `low` | `low` | — |
| 8 | L-08 | Update pricing section for premium launch | `medium` | `low` | `high` | ← **gated by app F-32 / T-39** |

**Rationale for the order:** measure first (L-01), then the two highest-impact
conversion/sharing fixes that are also cheap and that *unblock the app's Play listing*
(L-02 social preview, L-03 real screenshots feed app T-38). Social proof (L-06) is a
low-effort trust lift. Performance (L-04) and content growth (L-05) follow. Sitemap
hygiene (L-07) is minor cleanup. Pricing (L-08) comes **last** because it can only be
written once the app's plan and price are decided (F-32 tiering / T-39 billing).

---

### L-01 — Cookieless web analytics + CTA tracking

**Order 1** · `high` · `low` · `high` · **Cross-repo:** coordinated with app **T-37**

Add **cookieless** analytics (Cloudflare Web Analytics — already on Cloudflare — or
Plausible/Umami). No cookies, no PII → **no LGPD consent banner**. Track landing
pageviews and, critically, the **click-through on every "Criar conta grátis" / "Entrar
no app" CTA** to `app.guardacompartilhada.com`. This is the top of the funnel that pairs
with the app-side funnel (T-37) — today the whole thing is unmeasured, so it must come
first.

**Files:** `public/index.html` (+ blog pages) — one analytics snippet; if Cloudflare Web
Analytics, enable in the dashboard (zero code) + outbound-link events.

---

### L-02 — Fix Open Graph image (1200×630) + compress icon-512

**Order 2** · `high` · `low` · `high` · **Cross-repo:** the banner + assets feed app **T-38** (store listing)

The current OG image is a **512×512 square** (`icon-512.png`, 396 KB), so link previews on
**WhatsApp** — the #1 sharing channel for this Brazilian audience — render poorly. Create a
proper **1200×630** social banner and point `og:image` / `twitter:image` at it. Compress
`icon-512.png` (396 KB is heavy for an icon). The banner/screenshots double as Play-listing
imagery for app T-38.

**Files:** `public/` new `og-cover.png` (1200×630); `og:image`/`twitter:image` in
`index.html` (+ per-article OG in `public/blog/*.html`); recompress `icon-512.png`.

---

### L-03 — Real product screenshots (replace CSS mockup)

**Order 3** · `high` · `low` · `high` · **Cross-repo:** **required by app T-38** (Play listing screenshots)

The hero uses a **CSS/HTML phone mockup**, not real UI (README flags this). Real screenshots
of the Today card, calendar, and swap workflow build trust and help image SEO. Capture them at
Play-listing resolutions so the **same assets serve app T-38** — this is why L-03 precedes the
store work in the app track.

**Files:** `public/img/` new screenshots (WebP + PNG fallback); hero + benefits sections in
`index.html`.

---

### L-04 — Optimize blog images (WebP/AVIF + srcset)

**Order 5** · `medium` · `low` · `medium`

Blog JPEGs are 1600px, 200–330 KB each, no responsive `srcset`, no next-gen format. The
landing home page is image-light (fast LCP), so this is scoped to the **article pages** —
improves their Core Web Vitals and SEO.

**Files:** `public/blog/img/*` → add WebP/AVIF; `<picture>`/`srcset` in `public/blog/*.html`.

---

### L-05 — Expand SEO content cluster + interactive tool

**Order 6** · `medium` · `medium` · `high` · mirrors the app's rotation wizard

Grow the existing 4-article cluster with high-intent long-tail: *"modelo de acordo de guarda
compartilhada"*, *"guarda compartilhada e pensão"*, *"rotina 7/7 vs 14/14"*. Add **one
interactive tool** — a *"gerador/calculadora de rotina de guarda"* — as a link magnet and
intent capture that funnels into the app signup (mirrors the app's rotation wizard). Cheapest
durable acquisition channel in BR.

**Files:** new `public/blog/*.html` articles (+ sitemap entries + internal links); a new
`public/ferramentas/` tool page (static + tiny JS, staying framework-free).

---

### L-06 — Soft social proof (beta count / founder note)

**Order 4** · `medium` · `low` · `medium`

The page has **no social proof** today — trust rests only on feature claims. Even soft proof
helps: a beta user count, a short founder note ("por que construí isso"), or the first real
testimonials once available. Keep it honest (no fabricated reviews). Low effort, so it slots in
early right after the visual fixes.

**Files:** new section in `public/index.html` (near "Por quê" or before the final CTA).

---

### L-07 — Sitemap hygiene

**Order 7** · `low` · `low` · `low`

Minor: the legal pages are correctly `noindex` but still listed in `sitemap.xml` (mild
inconsistency); `lastmod` is hardcoded and will go stale. Drop the noindex pages from the
sitemap and set a simple lastmod convention (or generate it in the deploy Action).

**Files:** `public/sitemap.xml`; optionally `.github/workflows/deploy.yml`.

---

### L-08 — Update pricing section for premium launch

**Order 8 (last)** · `medium` · `low` · `high` · **Cross-repo:** gated by app **F-32** (tiering) and **T-39** (billing)

The landing already has a **Preços** section (currently a single "R$ 0/mês — Lançamento" card
with a note about a future premium plan). When the app introduces the paid tier, this section
must present the real free-vs-premium comparison, the price, and a checkout/"assine no site"
CTA. **Comes last** because it can only be written once the app's plan and price are decided —
keep the free tier honest and prominent (essentials stay free forever, per the app track's
guiding principles).

**Files:** `public/index.html` "Preços" section (free/premium comparison + CTA); coordinate
copy with the app's F-32/T-39 plan definition.
