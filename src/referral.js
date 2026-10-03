// F-82 — `/i/<code>`: the door of the family referral (F-80, in entrelares-app).
//
// The app hands each family a link `https://entrelares.app/i/<code>`
// (`ReferralRules.shareLink`) and reads the code back on two roads only:
//   · the WEB sign-up, from `?ref=<code>` on `/register` (`ReferralRules.codeFromUri`,
//     read once at boot, kept in memory, sent in the signUp metadata);
//   · ANDROID, from the Play Install Referrer, key `ref` only
//     (`ReferralRules.codeFromInstallReferrer`) — the `utm_*` beside it is for
//     the Play Console acquisition report and is never read by the app.
// This page is the hinge between the two: it tells the reader what the link is
// and offers both roads, the Play one first on an Android phone.
//
// THE CODE IS A CAPABILITY OF SOMEBODY ELSE'S FAMILY, so it goes nowhere it is
// not needed:
//   · `noindex` (meta AND header) and `cache-control: no-store` — a referral
//     link is nobody's search result, and no shared cache keeps one;
//   · `Referrer-Policy: no-referrer` — the click to Play or to the app does not
//     carry this path (and the code in it) as the Referer;
//   · Umami (production only) runs with `data-auto-track="false"`: no pageview,
//     whose payload would carry this path; the arrival and the two clicks are
//     EVENTS whose `url` is overwritten with the bare `/i` before they leave
//     (the L-30 rule: user input in a URL never reaches the analytics).
//
// MIRRORS, read from entrelares-app at 14e1c6f (03/10/2026) — nothing here
// fails when THEY move, so a change there is a change here in the same delivery:
//   · `REFERRAL_CODE_RE`  ← ReferralRules.alphabet + length (10);
//   · `INSTALL_CAMPAIGN`  ← ReferralRules.installCampaign;
//   · `installReferrer()` ← ReferralRules.installReferrer (`<campaign>&ref=<code>`);
//   · the Play URL        ← PlayInstallRules.listingUri (Uri.https encodes the
//     referrer value, so `=` and `&` travel as %3D and %26).
//
// The address of the app comes from `env.APP_ORIGIN` (wrangler.jsonc): the
// preview worker sends testers to qa.entrelares.app, production to
// web.entrelares.app. The preview deploy rewrites the app host only inside
// `public/**/*.html`, so a URL built here has to be told which one it is.

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const REFERRAL_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
export const INSTALL_CAMPAIGN =
  "utm_source=entrelares.app&utm_medium=referral&utm_campaign=family-referral";
export const PLAY_PACKAGE = "com.entrelares.app";
const DEFAULT_APP_ORIGIN = "https://web.entrelares.app";

/** The code in `/i/<code>` (or `/i/<code>/`), or null when the path is not a referral link. */
export function referralCodeFromPath(pathname) {
  const m = /^\/i\/([^/]+)\/?$/.exec(pathname);
  if (!m) return null;
  let raw;
  try {
    raw = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  const code = raw.trim().toUpperCase();
  return REFERRAL_CODE_RE.test(code) ? code : null;
}

export function installReferrer(code) {
  return `${INSTALL_CAMPAIGN}&ref=${code}`;
}

export function playListingUrl(code) {
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}` +
    `&referrer=${encodeURIComponent(installReferrer(code))}`;
}

export function webSignupUrl(origin, code) {
  return `${origin || DEFAULT_APP_ORIGIN}/register?ref=${code}`;
}

export function isAndroid(userAgent) {
  return /Android/i.test(userAgent || "");
}

/** GET `/i/<code>` — the page. Anything that is not a well-formed code is the caller's 404. */
export function handleReferral(request, env, code) {
  const play = playListingUrl(code);
  const web = webSignupUrl(env?.APP_ORIGIN, code);
  const android = isAndroid(request.headers.get("user-agent"));

  const playLink = (cls, label) =>
    `<a class="${cls}" href="${escapeHtml(play)}" rel="noopener" data-ev="indicacao-play">${label}</a>`;
  const webLink = (cls, label) =>
    `<a class="${cls}" href="${escapeHtml(web)}" rel="noopener" data-ev="indicacao-web">${label}</a>`;

  const actions = android
    ? `${playLink("btn", "Baixar no Google Play")}
    <p class="alt">Prefere o navegador? ${webLink("", "Crie a conta na versão web")}.</p>`
    : `${webLink("btn", "Criar a conta grátis")}
    <p class="alt">Usa Android? ${playLink("", "Baixe o app no Google Play")}.</p>`;

  const umamiId = env?.UMAMI_WEBSITE_ID;
  const analytics = umamiId
    ? `<script defer src="https://cloud.umami.is/script.js" data-website-id="${escapeHtml(umamiId)}" data-auto-track="false" data-exclude-search="true" data-exclude-hash="true"></script>
<script>
(function () {
  // No pageview: its payload would carry this path, and the path carries the code.
  function send(name) {
    try {
      if (window.umami) window.umami.track(function (p) { return Object.assign({}, p, { url: "/i", title: "Convite", name: name }); });
    } catch (e) {}
  }
  function arrive() { send("indicacao-chegada"); }
  if (window.umami) arrive(); else window.addEventListener("load", arrive);
  document.querySelectorAll("[data-ev]").forEach(function (a) {
    a.addEventListener("click", function () { send(a.getAttribute("data-ev")); });
  });
})();
</script>`
    : "";

  const body = `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>Convite para o Entrelares</title>
<link rel="icon" type="image/png" href="/favicon.png?v=6">
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#eef2ff; font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#1e293b; }
  main { max-width:34rem; margin:0 auto; padding:48px 20px; }
  .card { background:#fff; border:1px solid #e6e8ef; border-radius:16px; padding:28px 26px; }
  h1 { margin:0 0 14px; font-size:22px; line-height:1.3; }
  p { margin:0 0 14px; color:#475569; }
  .fine { font-size:13px; color:#64748b; }
  a { color:#4f46e5; }
  .btn { display:block; margin:6px 0 16px; padding:13px 24px; text-align:center; font-weight:700; color:#fff; background:#4f46e5; border-radius:10px; text-decoration:none; }
  .alt { font-size:15px; }
  .brand { text-align:center; margin-bottom:18px; font-weight:700; color:#03173d; }
</style>
${analytics}
</head><body><main>
  <div class="brand"><a href="/" style="color:inherit;text-decoration:none;">Entrelares</a></div>
  <div class="card">
    <h1>Você recebeu um convite para o Entrelares</h1>
    <p>Uma família que já usa o Entrelares indicou o app para você: o calendário da guarda compartilhada, com as trocas de dias combinadas e registradas, num lugar só da família. O plano Gratuito não tem prazo para acabar.</p>
    ${actions}
    <p class="fine">O convite vale para quem cria uma família nova no Entrelares a partir dele. Se a sua família assinar o Premium e o primeiro pagamento não for estornado no prazo das regras, a família que indicou ganha um mês de Premium; para você, nada muda no preço nem no plano. Regras na seção <a href="/termos#indicacao">Indicação de famílias</a> dos Termos de Uso; o que registramos está na <a href="/privacidade">Política de Privacidade</a>.</p>
  </div>
</main></body></html>`;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "referrer-policy": "no-referrer",
    },
  });
}
