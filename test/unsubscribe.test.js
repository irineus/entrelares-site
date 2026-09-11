// L-20 — tests for the way OUT (src/index.js, GET|POST /api/unsubscribe).
//
// Why this file exists before any sequence does: §4 of the privacy policy sells
// this list on consent that is "revogável a qualquer tempo, com link/contato
// para descadastro em cada mensagem". With one welcome e-mail, a mailto honours
// that — the message is delivered before anyone reads the request. With a
// SCHEDULED sequence it does not: a message queued for day 5 goes out after a
// stop on day 2 unless the stop is in code. So the stop is the prerequisite,
// and these are the tests that say it works.
//
// Same shape as subscribe.test.js: Node's built-in runner, zero dependencies,
// global fetch stubbed, a Map-backed KV double.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  handleSubscribe,
  handleUnsubscribe,
  newUnsubToken,
  issueUnsubUrl,
  hasStopped,
  clearStop,
  unsubHeaders,
  escapeHtml,
} from "../src/index.js";
import { kvStub } from "./kv-stub.js";

const realFetch = globalThis.fetch;
let calls;
let kv;

const LIVE_ENV = () => ({
  RESEND_API_KEY: "re_test_key",
  RESEND_SEGMENT_ID: "seg-123",
  OPTIN_LOG: kv,
});

beforeEach(() => {
  calls = [];
  kv = kvStub();
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method, body: opts.body ? JSON.parse(opts.body) : undefined });
    return new Response(JSON.stringify({ id: "ok" }), { status: 200 });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function unsubReq(token, method = "POST") {
  return new Request(`https://entrelares.app/api/unsubscribe?t=${token}`, { method });
}

/** Subscribe for real, then dig the minted token out of KV — the reader's path. */
async function subscribeAndGetToken(email = "ana@exemplo.com") {
  await handleSubscribe(
    new Request("https://entrelares.app/api/subscribe", {
      method: "POST",
      body: JSON.stringify({ email }),
      headers: { "content-type": "application/json" },
    }),
    LIVE_ENV(),
  );
  const key = [...kv.store.keys()].find((k) => k.startsWith("unsub:"));
  return key ? key.slice("unsub:".length) : null;
}

// ── the token ───────────────────────────────────────────────────────────────

test("token is 128 bits of hex, and two of them differ", () => {
  const a = newUnsubToken();
  const b = newUnsubToken();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test("the URL carries the token and NOT the address", async () => {
  const url = await issueUnsubUrl(LIVE_ENV(), "ana@exemplo.com", "https://entrelares.app");
  // A forwarded e-mail must leak a revocation, never an inbox.
  assert.ok(!url.includes("ana"));
  assert.ok(!url.includes("@"));
  assert.match(url, /^https:\/\/entrelares\.app\/api\/unsubscribe\?t=[0-9a-f]{32}$/);
});

test("a KV outage degrades to no URL rather than to a broken one", async () => {
  const url = await issueUnsubUrl({ OPTIN_LOG: kvStub({ failing: true }) }, "a@b.com", "https://x.test");
  assert.equal(url, null);
  assert.equal(await issueUnsubUrl({}, "a@b.com", "https://x.test"), null);
});

// ── the e-mail's way out ────────────────────────────────────────────────────

test("subscribing mints a token and puts a real link in both bodies", async () => {
  const token = await subscribeAndGetToken();
  assert.match(token, /^[0-9a-f]{32}$/);

  const send = calls.find((c) => c.url.endsWith("/emails"));
  const url = `https://entrelares.app/api/unsubscribe?t=${token}`;
  assert.ok(send.body.html.includes(url), "html body links the unsubscribe URL");
  assert.ok(send.body.text.includes(url), "text body spells the unsubscribe URL");
});

test("RFC 8058 one-click headers ride along, with the mailto as the fallback URI", () => {
  const h = unsubHeaders("https://entrelares.app/api/unsubscribe?t=abc", "privacidade@entrelares.app");
  assert.equal(h["List-Unsubscribe"],
    "<https://entrelares.app/api/unsubscribe?t=abc>, <mailto:privacidade@entrelares.app?subject=descadastro>");
  // Without this header Gmail's own Unsubscribe button is a suggestion, not a POST.
  assert.equal(h["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("with no URL the headers fall back to the mailto alone — never to nothing", () => {
  const h = unsubHeaders(null, "privacidade@entrelares.app");
  assert.equal(h["List-Unsubscribe"], "<mailto:privacidade@entrelares.app?subject=descadastro>");
  assert.equal("List-Unsubscribe-Post" in h, false);
});

test("the welcome e-mail says Entrelares in BOTH bodies (F-54/L-22 rebrand)", async () => {
  await subscribeAndGetToken();
  const send = calls.find((c) => c.url.endsWith("/emails"));
  // The rebrand reached the HTML and missed the plain text for a month.
  assert.ok(!send.body.text.includes("Guarda Compartilhada"));
  assert.ok(!send.body.html.includes("Guarda Compartilhada"));
  assert.ok(send.body.text.includes("app Entrelares"));
});

// ── GET does not act ────────────────────────────────────────────────────────

test("GET shows a confirmation page and changes NOTHING", async () => {
  const token = await subscribeAndGetToken();
  calls = [];

  const res = await handleUnsubscribe(unsubReq(token, "GET"), LIVE_ENV());
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.ok(html.includes(`action="/api/unsubscribe?t=${token}"`), "the button posts back");
  // A mail client or security scanner fetching every link must not drop
  // somebody off the list on their behalf.
  assert.equal(await hasStopped(LIVE_ENV(), "ana@exemplo.com"), false);
  assert.equal(calls.length, 0);
});

test("the pages are noindex — a revocation link is nobody's search result", async () => {
  const token = await subscribeAndGetToken();
  const html = await (await handleUnsubscribe(unsubReq(token, "GET"), LIVE_ENV())).text();
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
});

// ── POST acts ───────────────────────────────────────────────────────────────

test("POST stops the address here first, then tells Resend", async () => {
  const token = await subscribeAndGetToken();
  calls = [];

  const res = await handleUnsubscribe(unsubReq(token), LIVE_ENV());
  assert.equal(res.status, 200);

  // OUR record is the one the sequence will consult.
  assert.equal(await hasStopped(LIVE_ENV(), "ana@exemplo.com"), true);

  const patch = calls.find((c) => c.url.includes("/contacts/"));
  assert.equal(patch.method, "PATCH");
  assert.deepEqual(patch.body, { unsubscribed: true });
  assert.ok(patch.url.endsWith(encodeURIComponent("ana@exemplo.com")));
});

test("POST is idempotent: clicking twice still reports success", async () => {
  const token = await subscribeAndGetToken();
  assert.equal((await handleUnsubscribe(unsubReq(token), LIVE_ENV())).status, 200);
  assert.equal((await handleUnsubscribe(unsubReq(token), LIVE_ENV())).status, 200);
  assert.equal(await hasStopped(LIVE_ENV(), "ana@exemplo.com"), true);
});

test("a Resend outage does not undo the stop we already recorded", async () => {
  const token = await subscribeAndGetToken();
  globalThis.fetch = async () => { throw new Error("resend down"); };

  const res = await handleUnsubscribe(unsubReq(token), LIVE_ENV());

  assert.equal(res.status, 200);
  assert.equal(await hasStopped(LIVE_ENV(), "ana@exemplo.com"), true);
});

test("the confirmation page escapes the address it echoes", async () => {
  const token = await subscribeAndGetToken('"><script>x</script>"@evil.test');
  const html = await (await handleUnsubscribe(unsubReq(token), LIVE_ENV())).text();
  assert.ok(!html.includes("<script>x</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("escapeHtml covers the five characters that matter", () => {
  assert.equal(escapeHtml(`<&">'`), "&lt;&amp;&quot;&gt;&#39;");
});

// ── the refusals ────────────────────────────────────────────────────────────

test("a malformed token is refused before any lookup", async () => {
  for (const bad of ["", "nope", "z".repeat(32), "abc123"]) {
    const res = await handleUnsubscribe(unsubReq(bad), LIVE_ENV());
    assert.equal(res.status, 400);
  }
  assert.equal(calls.length, 0);
});

test("a well-formed but unknown token answers 404 with a human to write to", async () => {
  const res = await handleUnsubscribe(unsubReq("a".repeat(32)), LIVE_ENV());
  const html = await res.text();
  assert.equal(res.status, 404);
  assert.ok(html.includes("privacidade@entrelares.app"));
});

test("anything but GET/POST is rejected", async () => {
  const token = await subscribeAndGetToken();
  const res = await handleUnsubscribe(unsubReq(token, "DELETE"), LIVE_ENV());
  assert.equal(res.status, 405);
});

test("an unreadable tombstone is read as STOPPED, never as consent", async () => {
  // Fail closed: the cost of a wrong 'false' here is mail to somebody who asked
  // us to stop, which is the one failure this whole item exists to prevent.
  assert.equal(await hasStopped({ OPTIN_LOG: kvStub({ failing: true }) }, "a@b.com"), true);
});

// ── coming back ─────────────────────────────────────────────────────────────

test("a re-subscribe lifts the stop — a second opt-in is a second consent", async () => {
  const token = await subscribeAndGetToken("volta@exemplo.com");
  await handleUnsubscribe(unsubReq(token), LIVE_ENV());
  assert.equal(await hasStopped(LIVE_ENV(), "volta@exemplo.com"), true);

  await subscribeAndGetToken("volta@exemplo.com");

  assert.equal(await hasStopped(LIVE_ENV(), "volta@exemplo.com"), false);
});

test("clearStop survives a missing binding and a KV outage", async () => {
  assert.equal(await clearStop({}, "a@b.com"), false);
  assert.equal(await clearStop({ OPTIN_LOG: kvStub({ failing: true }) }, "a@b.com"), false);
});
