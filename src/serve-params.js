// L-34 — serve time: the live parameters, rewritten into the page as it leaves.
//
// The routes that carry a parameter are listed in wrangler.jsonc
// `assets.run_worker_first` (the home in both languages, the three blog
// articles and the routine tool with a call-to-action box): every other asset
// keeps the fast path, where a hit never reaches the Worker.
//
// The values come from the app's T-81 feed, cached here for FIVE MINUTES
// (owner, 23/09/2026) in the colo's Cache API. Past five minutes the next page
// view refreshes it, waiting at most 1.5 s; on any failure the last copy is
// used, however old, and with no copy at all the page leaves untouched — the
// values baked at deploy are real HTML. The feed can make a page fresher; it
// can never make one slower than 1.5 s, broken or empty.
//
// The rewriting follows `rewriteHtml` (src/params.js) rule for rule, as
// HTMLRewriter handlers, so the page streams instead of being buffered.

import { blockHidden, fetchFeed, META_NAME, renderParam, substituteJsonLd } from "./params.js";

export const FRESH_MS = 5 * 60 * 1000;
export const FEED_TIMEOUT_MS = 1500;
const CACHE_KEY_HOST = "https://entrelares-params.cache";

/**
 * The live values for this environment, or null (feed never answered here).
 * [deps] exists for the tests: `cache` (a Cache API object), `fetchImpl`,
 * `now`.
 */
export async function getLiveParams(env, ctx, deps = {}) {
  return (await loadLiveParams(env, ctx, deps)).values;
}

/**
 * [getLiveParams] plus WHERE the values came from — `fresh` (the feed answered
 * now), `cached` (a copy younger than five minutes), `stale` (the feed failed,
 * an older copy served) or `baked` (nothing live; the deploy's values stand).
 * Fulcrum 03.4.5: the page reports it in `x-entrelares-params`, because a
 * Worker that cannot reach the gateway serves a perfectly good BAKED page and
 * nothing else outside the Worker's own log would tell the two apart.
 */
export async function loadLiveParams(env, ctx, deps = {}) {
  if (!env.PARAMS_URL) return { values: null, source: "baked" };
  const cache = deps.cache ?? (typeof caches !== "undefined" ? caches.default : null);
  const now = deps.now ?? Date.now();
  const key = new Request(`${CACHE_KEY_HOST}/${encodeURIComponent(env.PARAMS_URL)}`);

  let stale = null;
  if (cache) {
    const hit = await cache.match(key);
    if (hit) {
      const fetchedAt = Number(hit.headers.get("x-fetched-at")) || 0;
      stale = await hit.json();
      if (now - fetchedAt < FRESH_MS) return { values: stale, source: "cached" };
    }
  }

  try {
    const { values } = await fetchFeed(env.PARAMS_URL, {
      fetchImpl: deps.fetchImpl ?? fetch,
      timeoutMs: FEED_TIMEOUT_MS,
      apiKey: env.PARAMS_KEY,
    });
    if (cache) {
      // A day of retention: the five minutes decide FRESHNESS, not presence —
      // an old copy is still better than none when the feed is down.
      const stored = new Response(JSON.stringify(values), {
        headers: { "content-type": "application/json", "cache-control": "max-age=86400", "x-fetched-at": String(now) },
      });
      const put = cache.put(key, stored);
      if (ctx?.waitUntil) ctx.waitUntil(put);
      else await put;
    }
    return { values, source: "fresh" };
  } catch (error) {
    console.warn("L-34: public-settings unavailable, serving", stale ? "the cached copy" : "the baked page", String(error));
    return stale ? { values: stale, source: "stale" } : { values: null, source: "baked" };
  }
}

/** HTMLRewriter handlers equivalent to `rewriteHtml` for [live]. */
export function paramHandlers(live) {
  const state = { lang: "pt", baked: null, merged: null };
  const toggle = (element, hidden) => {
    if (hidden) element.setAttribute("hidden", "");
    else element.removeAttribute("hidden");
  };

  return [
    [`meta[name="${META_NAME}"]`, {
      element(el) {
        state.lang = el.getAttribute("data-lang") || "pt";
        try {
          state.baked = JSON.parse(el.getAttribute("content") || "{}");
        } catch {
          state.baked = {};
        }
        state.merged = { ...state.baked };
        for (const [k, v] of Object.entries(live)) state.merged[k] = String(v);
        const sorted = Object.fromEntries(Object.keys(state.merged).sort().map((k) => [k, state.merged[k]]));
        el.setAttribute("content", JSON.stringify(sorted));
      },
    }],
    ["[data-param]", {
      element(el) {
        if (!state.merged) return;
        const rendered = renderParam(
          el.getAttribute("data-param"),
          el.getAttribute("data-format"),
          state.lang,
          state.merged,
          el.getAttribute("data-prefix") ?? "",
        );
        if (rendered === undefined) return;
        toggle(el, rendered === null);
        if (rendered !== null) el.setInnerContent(rendered);
      },
    }],
    ["[data-param-show]", {
      element(el) {
        const hidden = blockHidden("show", el.getAttribute("data-param-show"), state.merged);
        if (hidden !== undefined) toggle(el, hidden);
      },
    }],
    ["[data-param-hide]", {
      element(el) {
        const hidden = blockHidden("hide", el.getAttribute("data-param-hide"), state.merged);
        if (hidden !== undefined) toggle(el, hidden);
      },
    }],
    ['script[type="application/ld+json"][data-param-jsonld]', {
      element(el) {
        state.jsonldKeys = (el.getAttribute("data-param-jsonld") || "").split(/\s+/).filter(Boolean);
        state.jsonldText = "";
      },
      text(chunk) {
        state.jsonldText += chunk.text;
        if (!chunk.lastInTextNode) {
          chunk.remove();
          return;
        }
        const out = state.merged
          ? substituteJsonLd(state.jsonldText, state.jsonldKeys, state.lang, state.baked, state.merged)
          : state.jsonldText;
        chunk.replace(out, { html: true });
      },
    }],
  ];
}

/**
 * Serves a page from the static assets with the live parameters in it.
 * Anything that is not an HTML 200, or any moment without values, passes
 * through exactly as the assets answered it.
 */
export async function serveWithParams(request, env, ctx, deps = {}) {
  const response = await env.ASSETS.fetch(request);
  if (request.method !== "GET" || response.status !== 200) return response;
  if (!(response.headers.get("content-type") || "").includes("text/html")) return response;

  const { values: live, source } = await loadLiveParams(env, ctx, deps);
  if (!live) return withSource(response, source);

  const Rewriter = deps.HTMLRewriter ?? globalThis.HTMLRewriter;
  if (!Rewriter) return withSource(response, "baked");
  let rewriter = new Rewriter();
  for (const [selector, handler] of paramHandlers(live)) rewriter = rewriter.on(selector, handler);
  return withSource(rewriter.transform(response), source);
}

/** The page, with where its values came from (see [loadLiveParams]). */
function withSource(response, source) {
  const out = new Response(response.body, response);
  out.headers.set("x-entrelares-params", source);
  return out;
}
