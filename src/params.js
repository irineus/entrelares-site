// L-34 — the landing shows the product's live parameters.
//
// WHY. Until this item every price, plan limit and launch flag on entrelares.app
// was hand-typed HTML, twice (PT and /en/) plus the JSON-LD search engines read,
// and a console edit in the app (T-80) would leave the site selling a different
// product than the app. The values now come from the app's public feed (T-81,
// `public-settings`, anonymous by design — the whitelist is a column there).
//
// TWO LAYERS, ONE SET OF RULES (owner, 23/09/2026):
//   · serve time — the Worker rewrites the marked elements with HTMLRewriter,
//     values cached for 5 minutes (src/index.js → serveWithParams);
//   · deploy time — tool/bake-params.mjs writes the same values into the files
//     before `wrangler deploy`, with the string walker below.
// No scheduled re-bake and no repository_dispatch from the app repo: the serve
// layer already follows the console, and the bake only keeps the committed
// fallback honest. The page is correct WITHOUT the Worker — the baked value is
// real HTML — so a feed outage can never break or delay it.
//
// MARKUP CONTRACT (the only way a page takes a parameter):
//   <meta name="entrelares-params" data-lang="pt" content='{"<key>":"<value>"}'>
//       the values baked into THIS file — first in <head>, before any JSON-LD;
//   <span data-param="<key>" data-format="<format>">baked text</span>
//       text only, no child elements (the string walker relies on it);
//   <el data-param-show="<flag>"> / <el data-param-hide="<flag>">
//       a block kept or hidden (the `hidden` attribute, never removed, so both
//       variants of a sentence stay in the file and a bake can flip back);
//   <script type="application/ld+json" data-param-jsonld="<key> <key>…">
//       the baked text of those keys is replaced by the live one.
// Legal pages (termos, privacidade, exclusao-de-conta) never carry any of it:
// legal text is one copy, versioned by the S-15 flow.

export const META_NAME = "entrelares-params";

// ── Formatting — one module for both layers and both languages ──────────────

/** "R$ 5,49" — Brazilian format in BOTH languages (the checkout charges reais). */
export function formatBrl(cents) {
  return "R$ " + (Number(cents) / 100).toFixed(2).replace(".", ",");
}

/** "5.49" — the JSON-LD `price`, dot decimal whatever the language. */
export function formatPrice(cents) {
  return (Number(cents) / 100).toFixed(2);
}

function counted(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The app's rule (U-46, `annualFreeMonths` in entrelares_core billing_rules):
 * how many months the annual cycle gives away against twelve monthly charges.
 * Zero when the annual price is not a whole number of monthly charges, or buys
 * nothing back — an approximate saving is not a badge.
 */
export function annualFreeMonths(monthlyCents, annualCents) {
  const m = Number(monthlyCents);
  const a = Number(annualCents);
  if (!(m > 0) || !(a > 0)) return 0;
  if (a % m !== 0) return 0;
  const charged = a / m;
  return charged >= 12 ? 0 : 12 - charged;
}

/**
 * The text a marked element shows for [values], or null when it must be
 * hidden (a derived badge worth nothing) or cannot be computed (a missing or
 * non-numeric value — the caller then leaves the baked text alone).
 */
export function renderParam(key, format, lang, values, prefix = "") {
  const raw = values?.[key];
  if (format === "free_months") {
    const n = annualFreeMonths(values?.["billing.price_monthly_cents"], values?.["billing.price_annual_cents"]);
    if (n === 0) return null;
    return prefix + (lang === "en" ? counted(n, "month free", "months free") : counted(n, "mês grátis", "meses grátis"));
  }
  if (raw === undefined || raw === null || raw === "" || !/^-?\d+$/.test(String(raw))) return undefined;
  const n = Number(raw);
  switch (format) {
    case "brl":
      return prefix + formatBrl(n);
    case "price":
      return prefix + formatPrice(n);
    case "months":
      return prefix + (lang === "en" ? counted(n, "month", "months") : counted(n, "mês", "meses"));
    case "int":
      return prefix + String(n);
    default:
      return undefined;
  }
}

/** A flag is on only when the feed says exactly "true". */
export function isOn(values, key) {
  return String(values?.[key]) === "true";
}

/** Whether a show/hide block is hidden for [values]; undefined when the flag is unknown. */
export function blockHidden(kind, key, values) {
  if (!values || !(key in values)) return undefined;
  const on = isOn(values, key);
  return kind === "show" ? !on : on;
}

// ── JSON-LD — the baked text of each declared key becomes the live one ─────

/** The strings a key takes inside JSON-LD, per language. */
function jsonLdForms(key, lang, values) {
  const n = values?.[key];
  if (n === undefined || !/^-?\d+$/.test(String(n))) return [];
  if (key.startsWith("billing.price_")) return [formatBrl(n), `"price": "${formatPrice(n)}"`];
  if (key.startsWith("calendar_months_")) return [renderParam(key, "months", lang, values)];
  return [];
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces, in a JSON-LD text, every baked form of [keys] by its live form.
 * Two phases through sentinels, so one key's new text can never be taken for
 * another key's old one; a form two keys share (monthly = annual, say) is
 * AMBIGUOUS and left as baked rather than guessed. Returns the input untouched
 * when nothing changes.
 */
export function substituteJsonLd(text, keys, lang, baked, live) {
  const pairs = [];
  const owners = new Map();
  for (const key of keys) {
    const from = jsonLdForms(key, lang, baked);
    const to = jsonLdForms(key, lang, live);
    if (from.length === 0 || from.length !== to.length) continue;
    from.forEach((f, i) => {
      owners.set(f, owners.has(f) ? null : key);
      pairs.push({ key, from: f, to: to[i] });
    });
  }
  let out = text;
  const usable = pairs.filter((p) => owners.get(p.from) === p.key && p.from !== p.to);
  usable.forEach((p, i) => {
    out = out.replace(new RegExp(escapeRe(p.from) + "(?!\\d)", "g"), `\u0000${i}\u0000`);
  });
  usable.forEach((p, i) => {
    out = out.split(`\u0000${i}\u0000`).join(p.to);
  });
  return out;
}

// ── The string walker — the deploy-time bake, and the reference the Worker's
//    HTMLRewriter handlers mirror ───────────────────────────────────────────

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};

/** The values baked into a page, or null when it takes no parameter. */
export function readBaked(html) {
  const m = html.match(new RegExp(`<meta name="${META_NAME}" data-lang="(\\w+)" content='([^']*)'`));
  if (!m) return null;
  try {
    return { lang: m[1], values: JSON.parse(m[2]) };
  } catch {
    return null;
  }
}

/** The meta tag as written for [lang] and [values] (stable key order). */
export function metaTag(lang, values) {
  const sorted = Object.fromEntries(Object.keys(values).sort().map((k) => [k, String(values[k])]));
  return `<meta name="${META_NAME}" data-lang="${lang}" content='${JSON.stringify(sorted).replace(/'/g, "&#39;")}' />`;
}

function toggleHidden(openTag, hidden) {
  const has = /\shidden(?=[\s>/])/.test(openTag);
  if (hidden && !has) return openTag.replace(/\s*(\/?)>$/, " hidden$1>");
  if (!hidden && has) return openTag.replace(/\shidden(?=[\s>/])/, "");
  return openTag;
}

/**
 * Rewrites a page for [live]. Pages without the meta are returned as they
 * are; keys the feed does not carry keep their baked text. Idempotent.
 */
export function rewriteHtml(html, live) {
  const baked = readBaked(html);
  if (!baked || !live) return html;
  const { lang } = baked;
  const merged = { ...baked.values };
  for (const [k, v] of Object.entries(live)) merged[k] = String(v);

  let out = html.replace(
    new RegExp(`<meta name="${META_NAME}" data-lang="\\w+" content='[^']*'\\s*/?>`),
    metaTag(lang, merged),
  );

  // Marked text elements: <tag … data-param="k" …>text</tag>
  out = out.replace(/<([a-z0-9]+)(\s(?:[^>]*?\s)?data-param="([^"]+)"[^>]*)>([^<]*)<\/\1>/g, (all, tag, attrs, key, text) => {
    const format = attr(attrs, "data-format");
    const prefix = attr(attrs, "data-prefix") ?? "";
    const rendered = renderParam(key, format, lang, merged, prefix);
    if (rendered === undefined) return all;
    const open = toggleHidden(`<${tag}${attrs}>`, rendered === null);
    return `${open}${rendered === null ? escapeHtml(text) : escapeHtml(rendered)}</${tag}>`;
  });

  // Show/hide blocks: only the opening tag changes.
  out = out.replace(/<[a-z0-9]+(?:\s[^>]*)?\sdata-param-(show|hide)="([^"]+)"[^>]*>/g, (open, kind, key) => {
    const hidden = blockHidden(kind, key, merged);
    return hidden === undefined ? open : toggleHidden(open, hidden);
  });

  // JSON-LD blocks that declare keys.
  out = out.replace(
    /(<script type="application\/ld\+json" data-param-jsonld="([^"]*)">)([\s\S]*?)(<\/script>)/g,
    (all, open, keys, body, close) =>
      open + substituteJsonLd(body, keys.split(/\s+/).filter(Boolean), lang, baked.values, merged) + close,
  );

  return out;
}

// ── The feed ────────────────────────────────────────────────────────────────

/**
 * Reads the T-81 feed. Resolves to `{ values }` or throws; [timeoutMs] bounds
 * the wait so a slow backend never holds a page.
 */
export async function fetchFeed(url, { fetchImpl = fetch, timeoutMs = 1500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`public-settings answered ${res.status}`);
    const body = await res.json();
    if (!body || typeof body.values !== "object" || body.values === null) {
      throw new Error("public-settings answered without values");
    }
    return { values: body.values };
  } finally {
    clearTimeout(timer);
  }
}
