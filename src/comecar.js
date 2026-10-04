// L-46 — `/comecar/meta` and `/comecar/busca`: where the first real-cohort ads land.
//
// The campaign (L-31, owner 04/10/2026) buys the first real families with no pixel,
// so the ADDRESS is the source (the L-13 rule: a channel is measurable only through
// its own path) and the call to action hands the source on to the app, which records
// it ONCE on the new family (app item T-101, `families.acquisition_source`):
//   · Android → the Play listing, with the install `referrer` carrying
//     `utm_source=<source>` (+ `utm_campaign`) — the app reads it back through the
//     Play Install Referrer API (`AcquisitionRules.fromInstallReferrer`);
//   · iPhone → the web sign-up with `?src=<source>` (+ `&cmp=`) and the L-19 guide
//     (`/#instalar`) to keep the web app on the Home Screen;
//   · a computer → the web sign-up with `?src=`.
// The Google app campaign does NOT come here: it sends the reader straight to the
// Play listing, and Google Ads auto-tagging (`gclid`) is what the app reads.
//
// ONE TEMPLATE, TWO PATHS. The page differs only in its source word; every sentence
// is the same, so the two channels are compared on the ad, not on the page.
//
// NOT A SEARCH RESULT: `noindex` (meta AND header), no canonical, outside the
// sitemap (a Worker route has no file for the sitemap to list) — its arrivals are
// the measurement of the ads alone. No pixel. Umami (production only) counts the
// pageview with the query and the fragment EXCLUDED (an ad click appends `gclid` /
// `fbclid`, click ids that have no business in our analytics), plus one event per
// call to action (`comecar-play`, `comecar-web`) with the source as a property.
//
// EVERY SENTENCE IS A CLAIM ABOUT THE APP (S-15), checked on 04/10/2026 against
// entrelares-app: the day's responsible on the Hoje card (calendar_screen.dart), the
// swap asked and answered in the app with the answer recorded (swap_requests +
// the append-only activity_logs, §2 of the Decisões vigentes), the free plan with no
// end date, the verifiable PDF as PREMIUM (the T-97 capture carries the badge, and the
// caption says so). No price is typed (L-34), no competitor, no side taken.
//
// MIRRORS, read from entrelares-app (T-101, 04/10/2026) — nothing here fails when
// THEY move, so a change there is a change here in the same delivery:
//   · `SOURCES` values      ← AcquisitionRules.meta / googleSearch;
//   · `?src=` / `&cmp=`     ← AcquisitionRules.sourceQueryKey / campaignQueryKey;
//   · `CAMPAIGN_RE`         ← AcquisitionRules.campaignToken (the migration's CHECK);
//   · the Play URL          ← PlayInstallRules.listingUri (the referrer value is
//     URL-encoded, so `=` and `&` travel as %3D and %26).

import { PLAY_PACKAGE } from "./referral.js";

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Path segment → the app's source word (`families.acquisition_source`). */
export const SOURCES = Object.freeze({ meta: "meta", busca: "google_search" });

export const CAMPAIGN_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const DEFAULT_APP_ORIGIN = "https://web.entrelares.app";

/** `meta` / `busca` for `/comecar/<segment>` (with or without a trailing slash), else null. */
export function comecarSegmentFromPath(pathname) {
  const m = /^\/comecar\/([a-z]+)\/?$/.exec(pathname);
  return m && Object.hasOwn(SOURCES, m[1]) ? m[1] : null;
}

/** The campaign token an ad URL carries (`utm_campaign` or `cmp`), shaped, or null. */
export function campaignFrom(searchParams) {
  const raw = (searchParams.get("utm_campaign") ?? searchParams.get("cmp") ?? "").trim().toLowerCase();
  return CAMPAIGN_RE.test(raw) ? raw : null;
}

/** The Play `referrer` value: what the Install Referrer API hands the installed app. */
export function installReferrerFor(source, campaign) {
  return `utm_source=${source}&utm_medium=paid` + (campaign ? `&utm_campaign=${campaign}` : "");
}

export function playUrlFor(source, campaign) {
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}` +
    `&referrer=${encodeURIComponent(installReferrerFor(source, campaign))}`;
}

export function webSignupUrlFor(origin, source, campaign) {
  return `${origin || DEFAULT_APP_ORIGIN}/register?src=${source}` + (campaign ? `&cmp=${campaign}` : "");
}

/** `android` | `ios` | `desktop` — an iPad that says "Macintosh" reads as a computer (the web door either way). */
export function deviceOf(userAgent) {
  const ua = userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "desktop";
}

const SHOTS = [
  { file: "calendario", alt: "Tela do calendário do Entrelares: o mês com o responsável de cada dia e, no topo, quem está com as crianças hoje e a próxima troca.",
    caption: "O mês num olhar, e quem está com as crianças hoje." },
  { file: "troca", alt: "Tela de um pedido de troca de dia no Entrelares, com a mensagem de quem pediu e os botões Aprovar e Recusar.",
    caption: "A troca de dia é pedida e respondida no app." },
  { file: "relatorio-premium", alt: "Tela do relatório em PDF verificável do Entrelares, um recurso do plano Premium.",
    caption: "No Premium: o relatório em PDF verificável." },
];

function shot({ file, alt, caption }) {
  return `<figure>
      <picture>
        <source type="image/webp" srcset="/img/comecar/${file}-540.webp 540w, /img/comecar/${file}-720.webp 720w" sizes="(max-width: 700px) 70vw, 220px">
        <img src="/img/comecar/${file}-540.webp" width="540" height="960" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
      </picture>
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>`;
}

/** GET `/comecar/<segment>` — the page. */
export function handleComecar(request, env, segment) {
  const url = new URL(request.url);
  const source = SOURCES[segment];
  const campaign = campaignFrom(url.searchParams);
  const play = playUrlFor(source, campaign);
  const web = webSignupUrlFor(env?.APP_ORIGIN, source, campaign);
  const device = deviceOf(request.headers.get("user-agent"));

  const link = (href, cls, event, label) =>
    `<a class="${cls}" href="${escapeHtml(href)}" rel="noopener" data-umami-event="${event}" data-umami-event-origem="${segment}">${label}</a>`;
  const playLink = (cls, label) => link(play, cls, "comecar-play", label);
  const webLink = (cls, label) => link(web, cls, "comecar-web", label);

  const actions = {
    android: `${playLink("btn", "Comece grátis no Google Play")}
      <p class="alt">Prefere o navegador? ${webLink("", "Crie a conta na versão web")}.</p>`,
    ios: `${webLink("btn", "Comece grátis")}
      <p class="alt">No iPhone, o Entrelares funciona no navegador e pode ficar na Tela de Início como um app — <a href="/#instalar">veja como</a>.</p>`,
    desktop: `${webLink("btn", "Comece grátis")}
      <p class="alt">Usa Android? ${playLink("", "Baixe o app no Google Play")}.</p>`,
  }[device];

  const umamiId = env?.UMAMI_WEBSITE_ID;
  const analytics = umamiId
    ? `<script defer src="https://cloud.umami.is/script.js" data-website-id="${escapeHtml(umamiId)}" data-exclude-search="true" data-exclude-hash="true"></script>`
    : "";

  const body = `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Entrelares — o calendário da guarda compartilhada</title>
<meta name="description" content="Quem está com a criança hoje, as trocas de dia pedidas e respondidas no app e o histórico registrado. Comece grátis.">
<link rel="icon" type="image/png" href="/favicon.png?v=6">
<meta name="theme-color" content="#03173d">
<style>
  :root { color-scheme: light; --ink:#1e293b; --muted:#475569; --indigo:#4f46e5; --line:#e2e8f0; }
  * { box-sizing:border-box; }
  body { margin:0; background:#eef2ff; font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--ink); }
  main { max-width:56rem; margin:0 auto; padding:32px 20px 56px; }
  .brand { display:flex; align-items:center; gap:10px; font-weight:700; color:#03173d; text-decoration:none; margin-bottom:28px; }
  .brand img { width:32px; height:32px; border-radius:8px; }
  .hero { max-width:36rem; }
  h1 { margin:0 0 12px; font-size:clamp(26px,6vw,34px); line-height:1.2; letter-spacing:-0.02em; }
  .lead { margin:0 0 22px; color:var(--muted); font-size:17px; }
  .btn { display:block; max-width:22rem; margin:4px 0 14px; padding:14px 24px; text-align:center; font-weight:700; color:#fff; background:var(--indigo); border-radius:10px; text-decoration:none; }
  .btn:focus-visible, a:focus-visible { outline:2px solid var(--indigo); outline-offset:3px; }
  .alt { margin:0 0 8px; font-size:15px; color:var(--muted); }
  a { color:var(--indigo); }
  ul.benefits { list-style:none; padding:0; margin:32px 0; display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(15rem,1fr)); }
  ul.benefits li { background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px 20px; color:var(--muted); font-size:15px; }
  ul.benefits strong { display:block; color:var(--ink); font-size:16px; margin-bottom:4px; }
  .shots { display:grid; gap:20px; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); justify-items:center; margin:8px 0 28px; }
  figure { margin:0; max-width:240px; text-align:center; }
  figure img { width:100%; height:auto; border-radius:14px; display:block; }
  figcaption { font-size:14px; color:var(--muted); margin-top:8px; }
  .free { background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px 20px; color:var(--muted); font-size:15px; }
  footer { margin-top:28px; font-size:13px; color:#64748b; }
</style>
${analytics}
</head><body><main>
  <a class="brand" href="/"><img src="/icon-192.png?v=6" alt="" width="32" height="32">Entrelares</a>
  <div class="hero">
    <h1>Quem está com a criança hoje, sem precisar perguntar</h1>
    <p class="lead">O calendário da guarda compartilhada da família: os responsáveis veem o mesmo mês, pedem e respondem as trocas de dia no app, e cada mudança fica registrada.</p>
    ${actions}
  </div>
  <ul class="benefits">
    <li><strong>O mês de todos, num lugar só</strong>Cada dia mostra com quem as crianças estão e, nos dias de troca de casa, o horário. A tela inicial diz quem é o responsável hoje e quando é a próxima troca.</li>
    <li><strong>Trocas de dia pedidas no app</strong>Quem precisa trocar um dia faz o pedido com uma mensagem; o outro responsável aprova ou recusa pelo app.</li>
    <li><strong>Um histórico que ninguém edita</strong>Cada alteração do calendário fica registrada com data, hora e autor, e ninguém da família pode editar esse histórico.</li>
  </ul>
  <div class="shots">
    ${SHOTS.map(shot).join("\n    ")}
  </div>
  <p class="free"><strong>Comece grátis.</strong> O essencial é gratuito e o plano Gratuito não tem prazo para acabar; o Premium é opcional. Funciona no Android, pelo Google Play, e em qualquer navegador, inclusive no iPhone.</p>
  <footer>Entrelares · <a href="/privacidade">Política de Privacidade</a> · <a href="/termos">Termos de Uso</a></footer>
</main></body></html>`;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "vary": "user-agent",
      "x-robots-tag": "noindex",
    },
  });
}
