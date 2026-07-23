# Landing Page — Growth & Conversion Roadmap

Roadmap for `guardacompartilhada.com` (the marketing site), ordered by **execution
sequence**. Companion to the app-side priority track in
`SharedParentalCustody/backlog/README.md` → **Phase 6 — Growth, Analytics &
Monetization**. The landing and the app funnel are **one funnel** (landing CTR feeds
app signups), so several items have **cross-repo prerequisites** — flagged per item.

The site is a hand-written static site on Cloudflare (no framework, no JS build). Its
SEO foundation is already strong (JSON-LD `SoftwareApplication`/`Organization`/`FAQPage`
+ per-article `Article`/`BreadcrumbList`, canonicals, `sitemap.xml`, `robots.txt`, and a
4-article blog cluster). The work below is **measurement, conversion, positioning and
distribution** — not the SEO base.

> **Status values:** `pending` · `in-progress` · `completed`
> IDs (`L-` + number) are stable and never reused.

## Part A — On-site work (code / content), by execution order

| Order | ID | Title | Priority | Complexity | Impact | Cross-repo link |
|---|---|---|---|---|---|---|
| 1 | L-01 | Cookieless web analytics + CTA tracking | `high` | `low` | `high` | ↔ app **T-37** (same funnel) |
| 2 | L-02 | Fix Open Graph image (1200×630) + compress icon-512 | `high` | `low` | `high` | → feeds app **T-38** store imagery |
| 3 | L-03 | Real product screenshots (replace CSS mockup) | `high` | `low` | `high` | → **required by app T-38** (Play listing assets) |
| 4 | L-10 | Reposition around the immutable audit log ("prova de disputa") | `high` | `low` | `high` | ↔ app **F-33** (the PDF report embodies the claim) |
| 5 | L-06 | Soft social proof (beta count / founder note) | `medium` | `low` | `medium` | — |
| 6 | L-09 | Content lead-magnet + e-mail capture ("receba modelos de rotina") | `medium` | `medium` | `medium` | → feeds app **F-32** premium waitlist |
| 7 | L-04 | Optimize blog images (WebP/AVIF + srcset) | `medium` | `low` | `medium` | — |
| 8 | L-05 | Expand SEO content cluster + interactive tool | `medium` | `medium` | `high` | mirrors app rotation wizard |
| 9 | L-07 | Sitemap hygiene (drop noindex legal pages; lastmod) | `low` | `low` | `low` | — |
| 10 | L-08 | Update pricing section for premium launch | `medium` | `low` | `high` | ← **gated by app F-32 / T-39** |

**Rationale for the order:** measure first (L-01), then the highest-impact
conversion/sharing/positioning fixes that are also cheap and that *unblock the app's Play
listing* (L-02 preview, L-03 screenshots → app T-38; L-10 sharpens the core
differentiator). Trust and list-building follow (L-06, L-09). Performance (L-04) and
content growth (L-05) next. Sitemap hygiene (L-07) is minor cleanup. Pricing (L-08) comes
**last** — it can only be written once the app's plan and price are decided (F-32 / T-39).

## Part B — Off-site distribution (non-code, ongoing)

These are **marketing/distribution activities, not code changes** — captured here so they
are not lost; they feed the top of the same funnel (L-01 measures their landing arrivals).
No strict order; run continuously.

| ID | Title | Priority | Impact | Cross-repo link |
|---|---|---|---|---|
| L-11 | Community channels (separated-parents / co-parenting groups & forums) | `medium` | `medium` | → drives signups to the app |
| L-12 | Lawyer / mediator referral partnerships (B2B2C) | `medium` | `high` | → high-intent signups; pairs with app **F-33** (court PDF) |

---

## Part A — item detail

### L-01 — Cookieless web analytics + CTA tracking

**Order 1** · `high` · `low` · `high` · **Status: `completed`** (Umami live on the landing; app side ships with T-37 to prod) · **Cross-repo:** coordinated with app **T-37**

**Decision (with app T-37): Umami cookieless** (switched from Plausible to avoid its
subscription; same cookieless/no-PII posture; PostHog reconsidered for later
experimentation). Added the Umami `cloud.umami.is/script.js` tag to every page
(`index.html`, the two legal pages and all blog pages) — cookieless, no PII → **no LGPD
consent banner**. It records pageviews, and the "Criar conta grátis" / "Entrar no app"
CTAs carry `data-umami-event="cta-signup"` so their clicks are tracked. The landing
privacy policy (§7/§9) discloses the cookieless analytics (Versão 1.3).

Same Umami provider as the app (T-37), in a separate account (the free tier allows one website
per account). The landing's `data-website-id` is **set and live** in every page — collecting as
soon as Cloudflare Pages redeploys `main`.

**Files (done):** all `public/**/*.html` (script tag), `public/privacidade.html` (§9 disclosure).

---

### L-02 — Fix Open Graph image (1200×630) + compress icon-512

**Order 2** · `high` · `low` · `high` · **Status: `done` (banner)** · **Cross-repo:** the banner feeds app **T-38**

The home OG image was a **512×512 square** (`icon-512.png`), so WhatsApp/social previews
rendered poorly. Created a proper **1200×630** branded banner (`public/og-cover.png`) — navy
brand gradient + wordmark + the hero hook ("De quem é o dia hoje?") + feature chips — rendered
from an HTML card via headless Chromium. `index.html` `og:image`/`twitter:image` now point to
it with `1200×630` dimensions (`twitter:card` was already `summary_large_image`). The banner
doubles as Play-listing imagery for app T-38. Blog articles already use their own 1600×1067 OG
images, and the legal pages are `noindex` — so only the home needed the banner.

**Done:** `public/og-cover.png` + `index.html` meta. **Micro-follow-up:** recompress
`icon-512.png` (396 KB — used as favicon/apple-touch/JSON-LD logo); no image optimiser is
available in this environment (no ImageMagick/pngquant/sharp/PIL), so deferred.

---

### L-03 — Real product screenshots (replace CSS mockup)

**Order 3** · `high` · `low` · `high` · **Status: `done`** · **Cross-repo:** the assets feed app **T-38** (Play listing screenshots)

The hero's CSS/HTML phone mockup is replaced by an **auto-rotating slideshow of real screenshots**
(Today card + calendar, swap approval, rotation wizard with a grandmother in the cycle, the
immutable history, the per-parent summary) inside a phone frame — it pauses on hover/focus, is
swipeable, has dot navigation and honours `prefers-reduced-motion`. A new **"Veja o app por
dentro"** gallery shows three more screens (3-caregiver calendar, day editor, family/invite).
Every image ships as `<picture>` **WebP + PNG fallback** (WebP ~half the bytes); below-the-fold
shots lazy-load. The QA-build **"DEV" environment badge** was painted out of each capture
**in place** (the pill covered with its own local background — native height preserved so the
phone frame shows every screen whole, bottom nav included, with nothing cropped). The
notifications screen was dropped from the set because its notification titles carry an inline
`[Dev]` environment prefix that can't be masked cleanly (recapture from prod later).

Captured at ~412×915 (DPR 1) — sharp enough for the landing at the sizes shown; **re-capture at
DPR 3 for the Play listing (app T-38)**.

**Files (done):** `public/img/screenshots/*.{png,webp}` (11 assets); `index.html` (hero slideshow,
gallery section, slideshow styles + inline JS). **Micro-follow-up:** DPR-3 recaptures for T-38.

---

### L-10 — Reposition around the immutable audit log ("histórico à prova de disputa")

**Order 4** · `high` · `low` · `high` · **Cross-repo:** ↔ app **F-33** (the PDF report is this claim, made tangible)

The app's **immutable, append-only audit log** is a genuine legal-grade differentiator that
**no Brazilian competitor communicates**. Sharpen the hero/benefits copy around it —
*"histórico à prova de disputa"* — so the positioning matches the paid wedge (F-33 lawyer/court
PDF). Cheap copy/messaging change, high differentiation. Keep it honest (describe the immutable
history factually).

**Files:** `public/index.html` — hero subcopy + the "Benefícios" card on immutable history;
optionally a short "por que importa" block. Coordinate the wording with app F-33.

---

### L-06 — Soft social proof (beta count / founder note)

**Order 5** · `medium` · `low` · `medium`

The page has **no social proof** today — trust rests only on feature claims. Even soft proof
helps: a beta user count, a short founder note ("por que construí isso"), or the first real
testimonials once available. Keep it honest (no fabricated reviews).

**Files:** new section in `public/index.html` (near "Por quê" or before the final CTA).

---

### L-09 — Content lead-magnet + e-mail capture

**Order 6** · `medium` · `medium` · `medium` · **Cross-repo:** feeds app **F-32** premium waitlist

The app is live, so the primary CTA is signup — but a **soft e-mail capture** ("receba modelos
de rotina de guarda") builds a list for launch/premium announcements and captures visitors not
yet ready to sign up. Keep it optional and privacy-clean (single opt-in, no dark patterns; a
static form posting to a form endpoint or a Cloudflare Worker + the e-mail provider). The list
becomes the audience for the F-32 premium launch.

**Files:** a lead-magnet asset (e.g. a PDF of rotation templates); an opt-in form block in
`public/index.html` and/or the blog; a tiny Worker/form endpoint (staying framework-free).

---

### L-04 — Optimize blog images (WebP/AVIF + srcset)

**Order 7** · `medium` · `low` · `medium`

Blog JPEGs are 1600px, 200–330 KB each, no responsive `srcset`, no next-gen format. The landing
home page is image-light (fast LCP), so this is scoped to the **article pages** — improves their
Core Web Vitals and SEO.

**Files:** `public/blog/img/*` → add WebP/AVIF; `<picture>`/`srcset` in `public/blog/*.html`.

---

### L-05 — Expand SEO content cluster + interactive tool

**Order 8** · `medium` · `medium` · `high` · mirrors the app's rotation wizard

Grow the existing 4-article cluster with high-intent long-tail: *"modelo de acordo de guarda
compartilhada"*, *"guarda compartilhada e pensão"*, *"rotina 7/7 vs 14/14"*. Add **one
interactive tool** — a *"gerador/calculadora de rotina de guarda"* — as a link magnet and intent
capture that funnels into the app signup (mirrors the app's rotation wizard). Cheapest durable
acquisition channel in BR; also a natural home for the L-09 lead magnet.

**Files:** new `public/blog/*.html` articles (+ sitemap entries + internal links); a new
`public/ferramentas/` tool page (static + tiny JS).

---

### L-07 — Sitemap hygiene

**Order 9** · `low` · `low` · `low`

Minor: the legal pages are correctly `noindex` but still listed in `sitemap.xml`; `lastmod` is
hardcoded and will go stale. Drop the noindex pages from the sitemap and set a lastmod convention
(or generate it in the deploy Action).

**Files:** `public/sitemap.xml`; optionally `.github/workflows/deploy.yml`.

---

### L-08 — Update pricing section for premium launch

**Order 10 (last)** · `medium` · `low` · `high` · **Cross-repo:** gated by app **F-32** (tiering) and **T-39** (billing)

The landing already has a **Preços** section (currently a single "R$ 0/mês — Lançamento" card).
When the app introduces the paid tier, this section must present the real free-vs-premium
comparison, the price, and a checkout/"assine no site" CTA. **Comes last** — it can only be
written once the app's plan and price are decided; keep the free tier honest and prominent
(essentials stay free forever, per the app track's guiding principles).

**Files:** `public/index.html` "Preços" section (free/premium comparison + CTA); coordinate copy
with the app's F-32/T-39 plan definition.

---

## Part B — item detail (non-code / ongoing)

### L-11 — Community channels

`medium` · `medium` · **non-code, ongoing** · → drives signups to the app

Build presence where the audience already is: separated-parents and co-parenting groups and
forums (Facebook groups, Reddit-equivalents, parenting communities). Share the blog content and
the interactive tool (L-05) rather than hard-selling. Landing arrivals are measured by L-01.

**Not a repo change** — a marketing activity tracked here so it is not lost.

---

### L-12 — Lawyer / mediator referral partnerships (B2B2C)

`medium` · `high` · **non-code, ongoing** · → high-intent signups; pairs with app **F-33**

Family lawyers and mediators advise exactly the people who need this product. Build a referral
relationship ("recommend this to your clients"), possibly with a simple co-branded one-pager. The
app's court/lawyer PDF report (F-33) is the natural hook — it makes their job easier, so the
partnership is mutually useful. Highest-intent acquisition channel available.

**Not a repo change** — a partnership/distribution activity tracked here so it is not lost.
