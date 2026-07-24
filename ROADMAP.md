# Landing Page — Backlog & Growth Roadmap

The **backlog + forward plan** for `guardacompartilhada.com` (the marketing site): a
summary table of every landing item (`L-*`), the plan for what's next, and the full
per-item records. Companion to the app-side plan in
[`SharedParentalCustody/backlog/README.md`](../SharedParentalCustody/backlog/README.md).
The landing and the app funnel are **one funnel** (landing CTR feeds app signups), so
several items have **cross-repo prerequisites** — flagged per item. Each repo owns its
own items: `L-*` here, `F-/U-/T-/S-*` in the app.

The site is a hand-written static site on Cloudflare (no framework, no JS build). Its
SEO foundation is already strong (JSON-LD `SoftwareApplication`/`Organization`/`FAQPage`
+ per-article `Article`/`BreadcrumbList`, canonicals, `sitemap.xml`, `robots.txt`, and a
4-article blog cluster). The work below is **measurement, conversion, positioning and
distribution** — not the SEO base.

> **Status values:** `pending` · `in-progress` · `completed`
> IDs (`L-` + number) are stable and never reused.

## Summary table

All landing items and their status at a glance; full records are in the item detail below. IDs (`L-` + number) are stable and never reused. **On-site** items are code/content in this repo; **off-site** items are marketing/distribution activities, tracked here so they are not lost.

| ID | Title | Kind | Priority | Impact | Status |
|---|---|---|---|---|---|
| L-01 | Cookieless web analytics + CTA tracking (Umami) | on-site | `high` | `high` | `completed` |
| L-02 | Open Graph banner 1200×630 (+ icon-512 note) | on-site | `high` | `high` | `completed` |
| L-03 | Real product screenshots (hero slideshow + gallery) | on-site | `high` | `high` | `completed` |
| L-10 | Reposition around the immutable audit log ("à prova de disputa") | on-site | `high` | `high` | `completed` |
| L-06 | Soft social proof — founder note + photo + values badges | on-site | `medium` | `medium` | `completed` |
| L-09 | Content lead-magnet + e-mail capture (Worker + Resend) | on-site | `medium` | `medium` | `completed` |
| L-04 | Optimize blog images (WebP/AVIF + srcset) | on-site | `medium` | `medium` | `pending` |
| L-05 | Expand SEO content cluster + interactive tool | on-site | `medium` | `high` | `pending` |
| L-07 | Sitemap hygiene (drop noindex legal pages; lastmod) | on-site | `low` | `low` | `pending` |
| L-08 | Pricing section for the premium launch | on-site | `medium` | `high` | `pending` — gated by app **F-32/T-39** |
| L-11 | Community channels (co-parenting groups & forums) | off-site | `medium` | `medium` | `pending` — ongoing |
| L-12 | Lawyer / mediator referral partnerships (B2B2C) | off-site | `medium` | `high` | `pending` — ongoing |

## Roadmap — what's next

Six on-site items have shipped (L-01/L-02/L-03/L-06/L-09/L-10 — analytics, the OG banner, real screenshots, the "à prova de disputa" repositioning, the founder note, and the lead-magnet/newsletter). Remaining on-site work, in recommended order:

1. **L-05 — SEO content cluster + interactive tool.** Highest durable-acquisition impact: grow the 4-article cluster with high-intent long-tail and add a *"gerador de rotina de guarda"* (mirrors the app's rotation wizard) as a link magnet + intent capture — also the natural home for the L-09 lead magnet.
2. **L-04 — Blog image optimization** (WebP/AVIF + `srcset` on the article pages) for Core Web Vitals / SEO.
3. **L-07 — Sitemap hygiene** (drop the `noindex` legal pages from the sitemap; set a `lastmod` convention).
4. **L-08 — Pricing section** for the premium launch — **gated by the app's F-32/T-39**: it can only be written once the plan + price are decided, and ships lockstep with app billing (**T-39**) and its pricing copy.

**Off-site (ongoing, no strict order):** **L-11** community channels and **L-12** lawyer/mediator partnerships (pairs with the app's **F-33** court PDF) — marketing activities, not code changes. Landing arrivals from both are measured by L-01.

> **Cross-repo:** the app's forward plan lives in [`SharedParentalCustody/backlog/README.md`](../SharedParentalCustody/backlog/README.md). The landing and the app are **one funnel** and items reference each other (e.g. L-08 ↔ app **T-39** billing; L-03 → app **T-38** Play listing), but **each repo owns its own items** (`L-*` here, `F-/U-/T-/S-*` there).

---

## On-site items — detail

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
immutable history, and the 3-caregiver calendar) inside a phone frame — it pauses on hover/focus,
is swipeable, has dot navigation and honours `prefers-reduced-motion`. A **"Veja o app por
dentro"** gallery shows three more screens (other-parent day card, day editor, family/invite).
Every image ships as `<picture>` **WebP + PNG fallback** (WebP ~half the bytes); below-the-fold
shots lazy-load. The QA-build **"DEV" environment badge** was painted out of each capture
**in place** (the pill covered with its own local background — native height preserved so the
phone frame shows every screen whole, bottom nav included, with nothing cropped). Two screens are
kept out of the on-site set: **notifications** (its titles carry an inline `[Dev]` env prefix) and
the **per-parent summary** (its DEV pill straddles the yellow banner's edge + white, so no clean
in-place mask) — both recapture cleanly from prod later.

Captured at **DPR 3 → 1080×1920** (9:16), so the same assets are Play-listing-ready and render
crisp on retina; the earlier DPR-1 set was replaced.

**Files (done):** `public/img/screenshots/*.{png,webp}` (8 assets, 1080×1920); `index.html` (hero slideshow,
gallery section, slideshow styles + inline JS). **For T-38 (Play):** these 1080×1920 assets are
store-ready; to complete the set, recapture **notifications** + **per-parent summary** from prod
(no `[Dev]`/badge) so they can join the store listing too.

---

### L-10 — Reposition around the immutable audit log ("histórico à prova de disputa")

**Order 4** · `high` · `low` · `high` · **Status: `completed`** · **Cross-repo:** ↔ app **F-33** (the PDF report is this claim, made tangible)

The app's **immutable, append-only audit log** is a genuine legal-grade differentiator that
**no Brazilian competitor communicates**. Sharpen the hero/benefits copy around it —
*"histórico à prova de disputa"* — so the positioning matches the paid wedge (F-33 lawyer/court
PDF). Cheap copy/messaging change, high differentiation. Keep it honest (describe the immutable
history factually).

**Files:** `public/index.html` — hero subcopy + the "Benefícios" card on immutable history;
optionally a short "por que importa" block. Coordinate the wording with app F-33.

**Done:** `public/index.html` — hero subcopy now foregrounds the *"registro à prova de disputa"*
(histórico que não pode ser editado nem apagado); the immutable-history benefit card retitled
*"Histórico à prova de disputa"* with sharpened, honest body copy. Wording coordinated with app
**F-33** (v1.6.12), whose PDF report is literally the *"relatório à prova de disputa"*. Kept
factual — no legal-proof overclaim (the FAQ already frames court value honestly). The optional
"por que importa" block was not needed. Delivered alongside app F-33.

---

### L-06 — Soft social proof (beta count / founder note)

**Order 5** · `medium` · `low` · `medium` · **Status: `completed`**

The page has **no social proof** today — trust rests only on feature claims. Even soft proof
helps: a beta user count, a short founder note ("por que construí isso"), or the first real
testimonials once available. Keep it honest (no fabricated reviews).

**Done.** Added a **founder note** — an honest, first-person `#fundador` section (after
`#beneficios`) telling the real story behind the app (the founder's own shared-custody
experience: the instability after separation, the need to give a small child predictability,
the failed spreadsheet/generic-calendar attempts, building a private tool that grew, then
opening it to other families). Signed *"Irineu — Fundador e pai"* with a gradient-initial avatar
(name is already public as the controller in the privacy policy; photo can be added later). Below
it, a **values strip** of already-true trust signals (🇧🇷 feito no Brasil · 🔒 LGPD · 🚫 sem
anúncios/venda de dados · 📜 histórico à prova de disputa · 💙 essencial grátis). **No fabricated
numbers or reviews** — a beta count / real testimonials can be added later once there is honest
data. Styles are inline in `index.html` (index-specific); mobile-safe.

**Files:** `public/index.html` (new `#fundador` section + styles); `ROADMAP.md`.

---

### L-09 — Content lead-magnet + e-mail capture

**Order 6** · `medium` · `medium` · `medium` · **Status: `completed`** · **Cross-repo:** feeds app **F-32** premium waitlist; legal mirror in app Privacy (v1.6.21)

The app is live, so the primary CTA is signup — but a **soft e-mail capture** ("receba modelos
de rotina de guarda") builds a list for launch/premium announcements and captures visitors not
yet ready to sign up. Keep it optional and privacy-clean (single opt-in, no dark patterns; a
static form posting to a form endpoint or a Cloudflare Worker + the e-mail provider). The list
becomes the audience for the F-32 premium launch.

**Done.** Delivered as a Cloudflare **Worker + Resend** flow (no new subscription, reusing the
already-verified `guardacompartilhada.com` sending domain, sa-east-1):

- **Content guide (PDF)** — a 2-page branded PDF *"Modelos de rotina de guarda compartilhada"* (7/7,
  quinzenal, 2-2-3, 2-2-5-5 and residence + alternating weekends, each with a two-week visual
  strip, pros/cons, plus a holidays/vacation guide). Generated from `assets-src/modelos-rotina.html`
  via headless Chromium → `public/downloads/modelos-rotina-guarda-compartilhada.pdf` (both the
  output and the generator are versioned so it can be updated; the generator's `<title>` sets the
  PDF's `/Title`, so it opens with a proper name).
- **Capture endpoint** — `src/index.js` adds a single dynamic route, `POST /api/subscribe`, to the
  static Worker: it validates the e-mail (+ honeypot), registers the contact in **Resend** (the
  contacts show under *Audience* in the dashboard), and sends a **welcome e-mail** with the PDF
  link (single opt-in, with an unsubscribe line). Everything else is delegated to the `ASSETS`
  binding (404 handling preserved). `wrangler.jsonc` gains `main` + `vars`; `RESEND_API_KEY` is a
  **secret** — when absent (default on preview) the endpoint **dry-runs** (no side effects).
- **Opt-in UI** — a full section on `index.html` (`#materiais`, before the final CTA) and a compact
  block at the foot of all four blog articles, sharing `public/css/materiais.css` +
  `public/js/materiais.js` (progressive enhancement, `aria-live` status, Umami
  `materiais-baixar`/`materiais-inscricao` events). Mobile-safe down to 344 px. No user-visible
  artifact carries a "lead-magnet" name (files, section class `.materiais-box`, PDF title).
- **Legal** — new consent-based processing (art. 7º, I) disclosed in `privacidade.html` §3/§4/§7
  (Versão 1.4) and mirrored in the app's Privacy (v1.6.21) **without** forcing re-consent
  (transparency-only; `PolicyVersions.cs` unchanged). Legal review stays **S-15**.

- **Tests** — the endpoint's logic is covered by `test/subscribe.test.js` (Node's built-in runner,
  **zero deps**; `npm test`): method/payload guards, honeypot, e-mail validation, the no-key
  dry-run, the happy path (contact + welcome e-mail with the origin-tracked PDF link and payload
  shaping), a tolerated duplicate (409), and every provider-failure branch (contact 5xx → 502,
  e-mail failure → partial success). `.github/workflows/test.yml` gates every PR + push to
  `preview`/`main` before the deploy workflows.

**Manual steps (ops):** set the `RESEND_API_KEY` secret on the production worker (and optionally the
preview worker to test the live flow) — see the PR notes.

**Files:** `public/index.html`, `public/blog/*.html` (4), `public/css/materiais.css`,
`public/js/materiais.js`, `public/downloads/modelos-rotina-guarda-compartilhada.pdf`,
`assets-src/modelos-rotina.html`, `src/index.js`, `test/subscribe.test.js`, `package.json`,
`.github/workflows/test.yml`, `wrangler.jsonc`, `public/privacidade.html`; cross-repo: app
`Pages/Privacy.razor` + version bump.

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

**Soft precursor shipped (July 2026, with app F-37).** The app's first concrete freemium gate —
**F-37** (the 3rd+ caregiver is Premium) — landed with a *soft* landing touch (product-owner
decision: keep the "tudo grátis no lançamento" promise intact, no prices). The **Preços** note and
the **FAQ** (visible + JSON-LD) now give the coming premium a concrete shape — *incluir avós, babá e
outros cuidadores além do casal, e o relatório em PDF para advogados/Justiça* — while affirming the
essential couple-calendar stays free. The full free-vs-premium comparison table + price + checkout
CTA remain **L-08**, still gated by T-39 (billing).

---

## Off-site items — detail

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
