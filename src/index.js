// Cloudflare Worker for the landing site.
//
// The site is 99% static assets (served by the `ASSETS` binding). This Worker
// adds TWO dynamic endpoints:
//
//   · POST /api/subscribe    — the L-09 materials / newsletter opt-in: registers
//     the e-mail in a Resend segment (the launch / premium-announcement list)
//     and sends the "Modelos de rotina" PDF by e-mail.
//   · GET|POST /api/unsubscribe — L-20: the one-click way OUT, which the privacy
//     policy §4 promises ("revogável a qualquer tempo, com link/contato para
//     descadastro em cada mensagem") and which a scheduled sequence makes
//     mandatory rather than merely polite. See `handleUnsubscribe`.
//
// Everything else is delegated to the static assets, so the existing 404-page
// handling and asset routing are preserved unchanged.
//
// Config (wrangler.jsonc `vars`, non-secret):
//   RESEND_SEGMENT_ID  — the Resend segment the contact is added to.
//   FROM_EMAIL         — verified-domain sender: "Entrelares <materiais@entrelares.app>"
//                        (flipped at the F-54 promotion-A cutover, 12/08/2026 — the Resend
//                        Free plan verifies ONE domain, so the old one was deleted first).
//   REPLY_TO           — reply-to address shown to the reader.
// Secret (via `wrangler secret put RESEND_API_KEY` or the Cloudflare dashboard):
//   RESEND_API_KEY     — Resend full-access key. When ABSENT the endpoint runs in
//                        dry-run mode (returns ok without side effects) — this is
//                        how the preview environment behaves unless the key is set.
// KV binding:
//   OPTIN_LOG          — S-15/C-6: the opt-in evidence log (date, time, IP). The
//                        legal review accepted plain opt-in for the newsletter
//                        ONLY on condition that this log is kept, so it is written
//                        even in dry-run: the consent happened when the form was
//                        submitted, regardless of whether the e-mail went out.
//                        The same namespace carries the L-20 opt-OUT keys:
//                          `optin:<email>:<iso>` — consent evidence (never overwritten)
//                          `unsub:<token>`       — opaque token → the address it releases
//                          `stop:<email>`        — the tombstone the sequence obeys
//                        None of the three expires: evidence of what a person asked
//                        for has to outlive the list it justifies, in both directions.

import {
  button, footerHtml, footerText, INDIGO, INDIGO_DEEP, INK, li, MUTED, FONT,
  shell, SIGNATURE_TEXT, strong,
} from "./email-layout.js";
import { DAILY_CAP, dueStep, isFinished, renderStep } from "./sequence.js";

const RESEND_API = "https://api.resend.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/subscribe") {
      return handleSubscribe(request, env, ctx);
    }
    if (url.pathname === "/api/unsubscribe") {
      return handleUnsubscribe(request, env, ctx);
    }
    // Not our endpoint → let the static assets answer (keeps 404-page handling).
    return env.ASSETS.fetch(request);
  },

  // L-20 — the sequence's only clock. Declared in wrangler.jsonc `triggers`
  // for PRODUCTION only: preview has neither a cron nor a Resend key, so a
  // preview submission gets the dry-run welcome and no drip at all.
  async scheduled(event, env, ctx) {
    await runSequence(env, new Date(event.scheduledTime ?? Date.now()));
  },
};

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// ── Pure request-shape helpers (exported for unit tests) ────────────────────

/** Honeypot: real users never fill the hidden "empresa" field; bots do. */
export function isHoneypot(data) {
  return !!(data && typeof data.empresa === "string" && data.empresa.trim() !== "");
}

/** The submitted e-mail, trimmed + lower-cased; "" when absent or not a string. */
export function normalizeEmail(data) {
  return data && typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
}

/** A normalized e-mail is acceptable when non-empty, ≤254 chars, and matches the shape. */
export function isValidEmail(email) {
  return !!email && email.length <= 254 && EMAIL_RE.test(email);
}

/**
 * S-15/C-6 — record the opt-in as evidence (date, time, IP), as the legal review
 * required in exchange for accepting simple opt-in as the consent mechanism.
 *
 * One key per submission (`optin:<email>:<iso>`), never one per e-mail: a person
 * who subscribes, unsubscribes and subscribes again performed TWO acts of consent,
 * and overwriting would destroy the evidence for the first. No expiration — proof
 * of consent has to outlive the contact it justifies.
 *
 * Best-effort by design. If KV is unavailable we log and continue: refusing the
 * material because the audit write failed would punish the user for our outage.
 * It runs BEFORE the Resend calls, so a send failure still leaves the record.
 */
export async function logOptIn(env, email, request) {
  if (!env.OPTIN_LOG) {
    console.warn("subscribe: OPTIN_LOG binding missing — opt-in not recorded for", email);
    return false;
  }
  const ts = new Date().toISOString();
  try {
    await env.OPTIN_LOG.put(`optin:${email}:${ts}`, JSON.stringify({
      email,
      ts,
      // CF-Connecting-IP is set by the edge and cannot be spoofed by the client.
      ip: request.headers.get("CF-Connecting-IP") ?? null,
      userAgent: request.headers.get("User-Agent") ?? null,
      origin: new URL(request.url).origin,
      source: "materiais",
    }));
    return true;
  } catch (err) {
    console.error("subscribe: opt-in log write failed", err);
    return false;
  }
}

// ── L-20 — the way out ──────────────────────────────────────────────────────
//
// §4 of the privacy policy declares the legal basis for this list as consent,
// "revogável a qualquer tempo, com link/contato para descadastro em cada
// mensagem". Until now the only channel was a mailto, and for ONE welcome
// e-mail that is defensible: the message is already delivered by the time the
// request is read, so a human turnaround costs the reader nothing.
//
// A SCHEDULED sequence breaks that. A message queued for day 5 goes out after
// somebody asked to stop on day 2 unless the stop lives in code, so the way out
// has to be machine-actionable BEFORE the first drip is scheduled — which is why
// it ships ahead of the sequence rather than with it.
//
// The token is the capability: an opaque 128-bit random string that IS the KV
// key holding the address. No signing secret, therefore no new secret for the
// owner to set, nothing to rotate, and no address in the URL — a forwarded
// e-mail leaks a revocation, never an inbox.

const UNSUB_TOKEN_BYTES = 16;

/** Opaque, unguessable, URL-safe. */
export function newUnsubToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(UNSUB_TOKEN_BYTES));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Mint the token that releases `email` and hand back its absolute URL.
 *
 * Best-effort, exactly like `logOptIn`: a KV outage must not cost the reader
 * their material. When it fails the caller falls back to the mailto footer,
 * which is what every message carried before this existed.
 */
export async function issueUnsubUrl(env, email, origin) {
  if (!env.OPTIN_LOG) return null;
  const token = newUnsubToken();
  try {
    await env.OPTIN_LOG.put(`unsub:${token}`, JSON.stringify({ email, ts: new Date().toISOString() }));
    return `${origin}/api/unsubscribe?t=${token}`;
  } catch (err) {
    console.error("unsubscribe: token write failed", err);
    return null;
  }
}

/**
 * The tombstone the future sequence reads before scheduling anything. Kept on
 * OUR side on purpose: "the cap and the stop are enforceable in our code" is the
 * safety property this item is built around, and a stop that only exists in the
 * provider's account is one API outage away from sending anyway.
 */
export async function hasStopped(env, email) {
  if (!env.OPTIN_LOG) return false;
  try {
    return (await env.OPTIN_LOG.get(`stop:${email}`)) !== null;
  } catch (err) {
    // Fail CLOSED: an unreadable tombstone must never be read as consent.
    console.error("unsubscribe: stop lookup failed — treating as stopped", err);
    return true;
  }
}

/**
 * GET  — shows a confirmation page with a button. It does NOT unsubscribe:
 *        mail clients and security scanners fetch every link in a message, and
 *        a GET that acts would let a scanner drop somebody off the list.
 * POST — performs it. This is also the RFC 8058 one-click target named by the
 *        `List-Unsubscribe-Post` header, so Gmail's own "Unsubscribe" button
 *        lands here directly.
 */
export async function handleUnsubscribe(request, env, ctx) {
  const url = new URL(request.url);
  const token = (url.searchParams.get("t") || "").trim();

  if (!/^[0-9a-f]{32}$/.test(token)) {
    return htmlPage(400, "Link inválido", `
      <p>Este link de descadastro não é válido — ele pode ter sido cortado pelo
      programa de e-mail ao ser copiado.</p>
      <p>Escreva para <a href="mailto:privacidade@entrelares.app?subject=descadastro">privacidade@entrelares.app</a>
      que tiramos você da lista na mão.</p>`);
  }

  if (request.method === "GET") {
    return htmlPage(200, "Sair da lista", `
      <p>Quer parar de receber os materiais e novidades do Entrelares neste e-mail?</p>
      <form method="post" action="/api/unsubscribe?t=${token}">
        <button type="submit">Confirmar descadastro</button>
      </form>
      <p class="fine">Seus dados da conta do aplicativo não são afetados — isto vale
      apenas para a lista de materiais e novidades do site.</p>`);
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const email = await resolveUnsubToken(env, token);
  if (!email) {
    // Three ways to get here: the token never existed, KV is down, or the write
    // has not propagated yet — KV is eventually consistent, so a click within
    // seconds of the welcome e-mail can miss a token that does exist. All three
    // look the same to the reader, and all three deserve the address of a human
    // rather than a stack trace. (The realistic click is minutes to days later.)
    return htmlPage(404, "Não encontramos essa inscrição", `
      <p>Não localizamos uma inscrição para este link. Se você continuar recebendo
      nossas mensagens, escreva para
      <a href="mailto:privacidade@entrelares.app?subject=descadastro">privacidade@entrelares.app</a>.</p>`);
  }

  // OUR record first, the provider second — the order `logOptIn` already
  // established. If Resend is unreachable the person is still stopped here, and
  // here is what the sequence consults.
  await recordStop(env, email);
  await markContactUnsubscribed(env, email);

  return htmlPage(200, "Pronto, você saiu da lista", `
    <p>Não vamos mais enviar materiais nem novidades para <strong>${escapeHtml(email)}</strong>.</p>
    <p class="fine">Isto não cancela nem apaga uma conta do aplicativo. Para isso, veja
    <a href="/exclusao-de-conta">exclusão de conta</a>.</p>`);
}

/** The token → address lookup. Returns null when absent or unreadable. */
async function resolveUnsubToken(env, token) {
  if (!env.OPTIN_LOG) return null;
  try {
    const raw = await env.OPTIN_LOG.get(`unsub:${token}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.email === "string" ? parsed.email : null;
  } catch (err) {
    console.error("unsubscribe: token lookup failed", err);
    return null;
  }
}

/** The stop tombstone. Never expires — see the OPTIN_LOG note at the top. */
async function recordStop(env, email) {
  if (!env.OPTIN_LOG) return false;
  try {
    await env.OPTIN_LOG.put(`stop:${email}`, JSON.stringify({ email, ts: new Date().toISOString() }));
    return true;
  } catch (err) {
    console.error("unsubscribe: stop write failed", err);
    return false;
  }
}

/** Lift a stop, so a fresh opt-in is honoured. Best-effort, like its siblings. */
export async function clearStop(env, email) {
  if (!env.OPTIN_LOG) return false;
  try {
    await env.OPTIN_LOG.delete(`stop:${email}`);
    return true;
  } catch (err) {
    console.error("unsubscribe: stop clear failed", err);
    return false;
  }
}

/**
 * Best-effort mirror into Resend, so the provider's own list agrees with ours.
 *
 * `PATCH /contacts/{id|email}` — addressing by e-mail is supported and no
 * audience/segment id belongs in the path (resend.com/docs/api-reference/
 * contacts/update-contact, read 11/09/2026). Dated because it is somebody
 * else's API: the next session can re-check instead of re-deriving.
 *
 * A failure here is logged and swallowed ON PURPOSE — the stop that matters was
 * already written on our side, and that is the one the sequence reads.
 */
async function markContactUnsubscribed(env, email) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch(`${RESEND_API}/contacts/${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ unsubscribed: true }),
    });
    if (!res.ok) console.error("unsubscribe: contact patch failed", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("unsubscribe: contact patch threw", err);
    return false;
  }
}

/**
 * RFC 8058 one-click when we have a URL: the `-Post` header is what turns
 * Gmail's own "Unsubscribe" control into a POST to our endpoint instead of a
 * suggestion that the reader hunt for a link. The mailto stays as the second
 * URI for clients that do not implement it.
 */
export function unsubHeaders(unsubUrl, mailto) {
  const mailtoUri = `<mailto:${mailto}?subject=descadastro>`;
  if (!unsubUrl) return { "List-Unsubscribe": mailtoUri };
  return {
    "List-Unsubscribe": `<${unsubUrl}>, ${mailtoUri}`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** A small self-contained page — the Worker serves these, not the asset pipeline. */
function htmlPage(status, title, inner) {
  return new Response(`<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — Entrelares</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#eef2ff; font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#1e293b; }
  main { max-width:34rem; margin:0 auto; padding:48px 20px; }
  .card { background:#fff; border:1px solid #e6e8ef; border-radius:16px; padding:28px 26px; }
  h1 { margin:0 0 14px; font-size:22px; line-height:1.3; }
  p { margin:0 0 14px; color:#475569; }
  .fine { font-size:13px; color:#94a3b8; }
  a { color:#4f46e5; }
  button { margin:6px 0 16px; padding:13px 24px; font:inherit; font-weight:700; color:#fff; background:#4f46e5; border:0; border-radius:10px; cursor:pointer; }
  .brand { text-align:center; margin-bottom:18px; font-weight:700; color:#03173d; }
</style>
</head><body><main>
  <div class="brand"><a href="/" style="color:inherit;text-decoration:none;">Entrelares</a></div>
  <div class="card"><h1>${escapeHtml(title)}</h1>${inner}</div>
</main></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// ── L-20 — the sequence's queue and its clock ───────────────────────────────

/**
 * Put a fresh subscriber in the queue. One key per address (`seq:<email>`), so
 * a re-subscribe restarts the sequence rather than running two of them.
 *
 * The unsubscribe URL is stored WITH the state instead of being minted per
 * message: the reader should be able to leave from any of the three e-mails
 * with the same link, and a token that stops working after the next one would
 * be a way out that expires.
 */
export async function enqueueSequence(env, email, unsubUrl) {
  if (!env.OPTIN_LOG) return false;
  try {
    await env.OPTIN_LOG.put(`seq:${email}`, JSON.stringify({
      email,
      startedAt: new Date().toISOString(),
      lastStep: 1, // the welcome e-mail, already sent synchronously
      unsubUrl,
    }));
    return true;
  } catch (err) {
    console.error("sequence: enqueue failed", err);
    return false;
  }
}

/**
 * Walk the queue once. Called by `scheduled()` — nothing else may send.
 *
 * The order of the guards is the whole design:
 *   1. no key           → do not pretend. Preview has no key and must not
 *                         advance state it never actually sent.
 *   2. per subscriber, `hasStopped` FIRST, before anything is rendered or sent.
 *   3. the cap, checked before each send and never after — a run that stops at
 *      the cap leaves the rest of the queue untouched and due tomorrow.
 */
export async function runSequence(env, now = new Date()) {
  if (!env.OPTIN_LOG) {
    console.warn("sequence: no OPTIN_LOG binding — nothing to walk");
    return { walked: 0, sent: 0, stopped: 0, capped: false };
  }
  if (!env.RESEND_API_KEY) {
    // Dry-run means "send nothing", not "mark everything as sent".
    console.warn("sequence: RESEND_API_KEY not set — skipping the whole run");
    return { walked: 0, sent: 0, stopped: 0, capped: false };
  }

  const day = now.toISOString().slice(0, 10);
  let budget = DAILY_CAP - (await readCap(env, day));
  const result = { walked: 0, sent: 0, stopped: 0, capped: false };

  for (const key of await listSequenceKeys(env)) {
    if (budget <= 0) {
      result.capped = true;
      console.warn(`sequence: daily cap of ${DAILY_CAP} reached — the rest is due tomorrow`);
      break;
    }

    const state = await readJson(env, key);
    if (!state) continue;
    result.walked++;

    // The stop wins over everything, and is read before a message is built.
    if (await hasStopped(env, state.email)) {
      await env.OPTIN_LOG.delete(key);
      result.stopped++;
      continue;
    }

    if (isFinished(state)) {
      await env.OPTIN_LOG.delete(key);
      continue;
    }

    const step = dueStep(state, now);
    if (!step) continue;

    const sent = await sendSequenceStep(env, state, step.step);
    if (!sent) continue; // leave the state alone; the step is due again tomorrow

    budget--;
    result.sent++;
    await env.OPTIN_LOG.put(key, JSON.stringify({ ...state, lastStep: step.step }));
    await bumpCap(env, day);
  }

  return result;
}

async function listSequenceKeys(env) {
  try {
    const out = [];
    let cursor;
    do {
      const page = await env.OPTIN_LOG.list({ prefix: "seq:", cursor });
      out.push(...page.keys.map((k) => k.name));
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return out;
  } catch (err) {
    console.error("sequence: listing the queue failed", err);
    return [];
  }
}

async function readJson(env, key) {
  try {
    const raw = await env.OPTIN_LOG.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("sequence: unreadable state at", key, err);
    return null;
  }
}

/**
 * The cap counter, one key per UTC day. Best-effort like everything else here,
 * but it fails in the SAFE direction: an unreadable counter is read as a full
 * day's worth already spent, so an outage stops the drip instead of letting it
 * run unmetered against the allowance that real sign-ups depend on.
 */
async function readCap(env, day) {
  try {
    const raw = await env.OPTIN_LOG.get(`cap:${day}`);
    const n = raw ? Number(JSON.parse(raw).sent) : 0;
    return Number.isFinite(n) ? n : DAILY_CAP;
  } catch (err) {
    console.error("sequence: cap unreadable — treating the day as spent", err);
    return DAILY_CAP;
  }
}

async function bumpCap(env, day) {
  try {
    const current = await readCap(env, day);
    // 7 days is plenty to audit a run; the counter is not evidence, unlike the
    // three keys above, so this is the one that is allowed to expire.
    await env.OPTIN_LOG.put(`cap:${day}`, JSON.stringify({ sent: current + 1 }),
      { expirationTtl: 604800 });
  } catch (err) {
    console.error("sequence: cap bump failed", err);
  }
}

/** Render and send one step. Returns false on anything short of accepted. */
async function sendSequenceStep(env, state, step) {
  let message;
  try {
    message = renderStep(step, {
      unsubUrl: state.unsubUrl ?? null,
      unsubscribeMailto: "privacidade@entrelares.app",
      appUrl: "https://entrelares.app/",
    });
  } catch (err) {
    console.error("sequence: could not render step", step, err);
    return false;
  }

  try {
    const res = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || "Entrelares <materiais@entrelares.app>",
        to: [state.email],
        reply_to: env.REPLY_TO || "contato@entrelares.app",
        subject: message.subject,
        headers: unsubHeaders(state.unsubUrl ?? null, "privacidade@entrelares.app"),
        text: message.text,
        html: message.html,
      }),
    });
    if (!res.ok) {
      console.error("sequence: send failed", step, res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("sequence: send threw", step, err);
    return false;
  }
}

export async function handleSubscribe(request, env, ctx) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  // Parse a small JSON body defensively.
  let data;
  try {
    const raw = await request.text();
    if (raw.length > 2000) return json({ ok: false, error: "payload_too_large" }, 413);
    data = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Honeypot: pretend success so the bot gets no signal, but do nothing.
  if (isHoneypot(data)) {
    return json({ ok: true });
  }

  const email = normalizeEmail(data);
  if (!isValidEmail(email)) {
    return json({ ok: false, error: "invalid_email" }, 422);
  }

  // S-15/C-6: the consent happened HERE, at a valid submission. Recorded before
  // any provider call so the evidence survives a Resend failure — and recorded in
  // dry-run too, where the act is just as real even though no e-mail is sent.
  await logOptIn(env, email, request);

  // A re-subscribe is a SECOND act of consent (the same reasoning that gives the
  // evidence log one key per submission), so it lifts an earlier stop. Without
  // this, somebody who left and came back would be silently ignored by the
  // sequence while the form told them "pronto!".
  await clearStop(env, email);

  // Dry-run when no key is configured (e.g. the preview worker without the secret).
  if (!env.RESEND_API_KEY) {
    console.warn("subscribe: RESEND_API_KEY not set — dry run for", email);
    return json({ ok: true, dryRun: true });
  }

  const authHeaders = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };

  // 1) Add to the Resend segment (the mailing list). A duplicate is fine.
  try {
    const body = { email, unsubscribed: false };
    if (env.RESEND_SEGMENT_ID) body.segment_ids = [env.RESEND_SEGMENT_ID];
    const res = await fetch(`${RESEND_API}/contacts`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 409) {
      const detail = await res.text();
      console.error("subscribe: contact create failed", res.status, detail);
      // Non-fatal for the user if the delivery e-mail still goes out, but a
      // failed list write is the core deliverable — surface it.
      if (res.status >= 500) {
        return json({ ok: false, error: "provider_unavailable" }, 502);
      }
    }
  } catch (err) {
    console.error("subscribe: contact create threw", err);
    return json({ ok: false, error: "provider_unavailable" }, 502);
  }

  // 2) Send the welcome e-mail with the PDF link. Link to the same origin
  //    the request came from (prod → prod, preview → preview).
  const origin = new URL(request.url).origin;
  const pdfUrl = `${origin}/downloads/modelos-rotina-guarda-compartilhada.pdf`;
  const from = env.FROM_EMAIL || "Entrelares <materiais@entrelares.app>";
  const replyTo = env.REPLY_TO || "contato@entrelares.app";
  const unsubscribe = "privacidade@entrelares.app";
  // Null when KV is unavailable — the footer then degrades to the mailto that
  // every message carried before L-20, never to no way out at all.
  const unsubUrl = await issueUnsubUrl(env, email, origin);

  try {
    const res = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        from,
        to: [email],
        reply_to: replyTo,
        subject: "Seu guia de rotinas de guarda compartilhada 🎉",
        headers: unsubHeaders(unsubUrl, unsubscribe),
        text: emailText(pdfUrl, unsubscribe, unsubUrl),
        html: emailHtml(pdfUrl, unsubscribe, unsubUrl),
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("subscribe: email send failed", res.status, detail);
      // The contact was already saved; report a partial success so the UI can
      // still thank the user (they are on the list; the e-mail can be retried).
      return json({ ok: true, emailQueued: false });
    }
  } catch (err) {
    console.error("subscribe: email send threw", err);
    return json({ ok: true, emailQueued: false });
  }

  // The welcome e-mail landed, so the sequence may start counting from here.
  await enqueueSequence(env, email, unsubUrl);
  return json({ ok: true, emailQueued: true });
}

function emailText(pdfUrl, unsubscribe, unsubUrl) {
  return [
    "Que bom ter você por aqui :)",
    "",
    "Organizar a convivência dos filhos depois da separação é um dos maiores",
    "desafios do dia a dia. Preparamos um guia para ajudar você e o outro",
    "responsável a começar essa conversa a partir de exemplos claros.",
    "",
    "Baixe o guia (PDF): " + pdfUrl,
    "",
    "O que você vai encontrar:",
    "  - 5 modelos de rotina prontos, das semanas alternadas às opções para",
    "    crianças pequenas;",
    "  - um calendário visual de duas semanas para cada modelo;",
    "  - os prós e contras de cada rotina, em linguagem simples;",
    "  - um roteiro para combinar férias, feriados e datas especiais.",
    "",
    "E quando vocês escolherem a rotina, é só colocá-la no app Entrelares —",
    "grátis. Ele mantém o calendário num lugar só, igual para os dois",
    "responsáveis:",
    "  - de quem é o dia, sempre à vista;",
    "  - trocas de dia com a aprovação dos dois;",
    "  - histórico com data e hora, que não pode ser editado nem apagado.",
    "",
    "Conheça o app: https://entrelares.app/",
    "",
    ...SIGNATURE_TEXT,
    "",
    ...footerText(unsubscribe, unsubUrl),
  ].join("\n");
}

// The chrome (header bar, signature, footer) comes from `shell`; what lives
// here is only what makes THIS message the welcome e-mail.
function emailHtml(pdfUrl, unsubscribe, unsubUrl) {
  const content = `
        <!-- hero -->
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 12px;font-family:${FONT};font-size:23px;line-height:1.3;color:${INK};">Prontinho — aqui está o seu guia 🎉</h1>
          <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">Que bom ter você por aqui. Organizar a convivência dos filhos depois da separação é um dos maiores desafios do dia a dia — e este guia é um bom ponto de partida para vocês combinarem a rotina a partir de exemplos claros.</p>
        </td></tr>

        <!-- download card -->
        <tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f7ff;border:1px solid #e0e7ff;border-radius:12px;">
            <tr><td style="padding:22px 22px 24px;">
              <div style="font-family:${FONT};font-size:16px;font-weight:700;color:${INK};margin-bottom:6px;">📘 Modelos de rotina de guarda compartilhada</div>
              <p style="margin:0 0 18px;font-family:${FONT};font-size:14px;line-height:1.6;color:${MUTED};">Um guia visual com as formas mais comuns de dividir os dias — e um roteiro para férias e feriados.</p>
              ${button(pdfUrl, "Baixar o guia (PDF)", INDIGO)}
            </td></tr>
          </table>
        </td></tr>

        <!-- what's inside -->
        <tr><td style="padding:26px 32px 6px;">
          <div style="font-family:${FONT};font-size:15px;font-weight:700;color:${INK};margin-bottom:6px;">O que você vai encontrar</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${li("🗓️", `${strong("5 modelos prontos")} — das semanas alternadas às opções para crianças pequenas`)}
            ${li("👀", `Um ${strong("calendário visual de duas semanas")} para cada modelo`)}
            ${li("⚖️", `Os ${strong("prós e contras")} de cada rotina, em linguagem simples`)}
            ${li("🏖️", `Um roteiro para combinar ${strong("férias, feriados e datas especiais")}`)}
          </table>
        </td></tr>

        <!-- app intro -->
        <tr><td style="padding:14px 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-top:1px solid #e6e8ef;border-radius:0 0 4px 4px;">
            <tr><td style="padding:26px 12px 4px;">
              <h2 style="margin:0 0 8px;font-family:${FONT};font-size:18px;line-height:1.35;color:${INK};">E quando vocês escolherem a rotina?</h2>
              <p style="margin:0 0 14px;font-family:${FONT};font-size:14.5px;line-height:1.6;color:${MUTED};">Coloque-a no app Entrelares — grátis. Ele mantém o calendário num lugar só, igual para os dois responsáveis:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${li("📅", `De quem é o dia, ${strong("sempre à vista")}`)}
                ${li("🤝", `Trocas de dia só valem com a ${strong("aprovação dos dois")}`)}
                ${li("📜", `Histórico com data e hora, que ${strong("não pode ser editado nem apagado")}`)}
              </table>
              <div style="padding:18px 0 4px;">${button("https://entrelares.app/", "Conhecer o app", INDIGO_DEEP)}</div>
            </td></tr>
          </table>
        </td></tr>`;

  return shell(
    "Seu guia de rotinas de guarda compartilhada",
    "Seu guia com 5 modelos de rotina — e como dar mais previsibilidade para os filhos.",
    content,
    footerHtml(unsubscribe, unsubUrl),
  );
}
