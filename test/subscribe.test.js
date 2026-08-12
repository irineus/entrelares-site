// L-09 — tests for the Worker's POST /api/subscribe endpoint (src/index.js).
// Runs on Node's built-in test runner (zero dependencies): `node --test`.
// The endpoint's only side effects are two Resend HTTP calls (contact + email),
// so we stub the global fetch and assert on request shape + returned status.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  handleSubscribe,
  isHoneypot,
  normalizeEmail,
  isValidEmail,
  logOptIn,
} from "../src/index.js";

// ── fetch stub ──────────────────────────────────────────────────────────────

const realFetch = globalThis.fetch;
let calls; // recorded outbound requests: { url, method, headers, body }
let responders; // { contacts: () => Response, emails: () => Response }
let optInLog; // S-15/C-6 KV stub, replaced per test

/** Minimal KV double: only .put() is used by the Worker. */
function kvStub({ failing = false } = {}) {
  const store = new Map();
  return {
    store,
    async put(key, value) {
      if (failing) throw new Error("kv unavailable");
      store.set(key, value);
    },
  };
}

beforeEach(() => {
  calls = [];
  responders = {
    contacts: () => new Response(JSON.stringify({ id: "c1" }), { status: 200 }),
    emails: () => new Response(JSON.stringify({ id: "e1" }), { status: 200 }),
  };
  optInLog = kvStub();
  LIVE_ENV.OPTIN_LOG = optInLog;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({
      url: u,
      method: opts.method,
      headers: opts.headers || {},
      body: opts.body ? JSON.parse(opts.body) : undefined,
    });
    if (u.includes("/contacts")) return responders.contacts();
    if (u.includes("/emails")) return responders.emails();
    throw new Error(`unexpected fetch to ${u}`);
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

// ── helpers ─────────────────────────────────────────────────────────────────

function req(body, { method = "POST", origin = "https://entrelares.app" } = {}) {
  const init = { method };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }
  return new Request(`${origin}/api/subscribe`, init);
}

const LIVE_ENV = {
  RESEND_API_KEY: "re_test_key",
  RESEND_SEGMENT_ID: "seg-123",
  FROM_EMAIL: "Guarda <materiais@entrelares.app>",
  REPLY_TO: "contato@entrelares.app",
};

async function body(res) {
  return JSON.parse(await res.text());
}

// ── pure helpers ──────────────────────────────────────────────────────────

test("isHoneypot: filled hidden field is a bot", () => {
  assert.equal(isHoneypot({ empresa: "Acme" }), true);
  assert.equal(isHoneypot({ empresa: "  x " }), true);
});

test("isHoneypot: empty/whitespace/missing/non-string is a human", () => {
  assert.equal(isHoneypot({ empresa: "" }), false);
  assert.equal(isHoneypot({ empresa: "   " }), false);
  assert.equal(isHoneypot({}), false);
  assert.equal(isHoneypot({ empresa: 123 }), false);
  assert.equal(isHoneypot(null), false);
});

test("normalizeEmail: trims and lowercases", () => {
  assert.equal(normalizeEmail({ email: "  Foo@Bar.COM " }), "foo@bar.com");
});

test("normalizeEmail: missing or non-string yields empty string", () => {
  assert.equal(normalizeEmail({}), "");
  assert.equal(normalizeEmail({ email: 42 }), "");
  assert.equal(normalizeEmail(null), "");
});

test("isValidEmail: accepts a well-formed address", () => {
  assert.equal(isValidEmail("foo@bar.com"), true);
});

test("isValidEmail: rejects empty, unshaped, and over-long", () => {
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("no-at-sign"), false);
  assert.equal(isValidEmail("no@dot"), false);
  assert.equal(isValidEmail("a b@c.com"), false); // whitespace not allowed
  const longLocal = "a".repeat(250) + "@b.com"; // > 254 chars total
  assert.equal(isValidEmail(longLocal), false);
});

// ── method / payload guards ─────────────────────────────────────────────────

test("OPTIONS preflight returns 204 with no side effects", async () => {
  const res = await handleSubscribe(req(undefined, { method: "OPTIONS" }), LIVE_ENV);
  assert.equal(res.status, 204);
  assert.equal(calls.length, 0);
});

test("non-POST method is rejected 405", async () => {
  const res = await handleSubscribe(req(undefined, { method: "GET" }), LIVE_ENV);
  assert.equal(res.status, 405);
  assert.equal((await body(res)).error, "method_not_allowed");
});

test("oversized payload is rejected 413 before parsing", async () => {
  const huge = JSON.stringify({ email: "x@y.com", pad: "z".repeat(2100) });
  const res = await handleSubscribe(req(huge), LIVE_ENV);
  assert.equal(res.status, 413);
  assert.equal((await body(res)).error, "payload_too_large");
});

test("invalid JSON is rejected 400", async () => {
  const res = await handleSubscribe(req("{not json"), LIVE_ENV);
  assert.equal(res.status, 400);
  assert.equal((await body(res)).error, "invalid_json");
});

test("empty body parses to {} then fails email validation 422", async () => {
  const res = await handleSubscribe(req(""), LIVE_ENV);
  assert.equal(res.status, 422);
  assert.equal((await body(res)).error, "invalid_email");
});

// ── honeypot & validation ────────────────────────────────────────────────

test("honeypot hit returns ok:true and makes NO provider calls", async () => {
  const res = await handleSubscribe(req({ email: "real@x.com", empresa: "bot" }), LIVE_ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), { ok: true });
  assert.equal(calls.length, 0);
});

test("invalid email returns 422 and makes no provider calls", async () => {
  const res = await handleSubscribe(req({ email: "nope" }), LIVE_ENV);
  assert.equal(res.status, 422);
  assert.equal(calls.length, 0);
});

// ── dry-run (no secret) ──────────────────────────────────────────────────

test("without RESEND_API_KEY the endpoint dry-runs (no calls)", async () => {
  const res = await handleSubscribe(req({ email: "foo@bar.com" }), { RESEND_SEGMENT_ID: "seg" });
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), { ok: true, dryRun: true });
  assert.equal(calls.length, 0);
});

// ── happy path ───────────────────────────────────────────────────────────

test("happy path: adds contact to segment and sends the welcome e-mail", async () => {
  const res = await handleSubscribe(req({ email: " Foo@Bar.com " }), LIVE_ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), { ok: true, emailQueued: true });

  const contact = calls.find((c) => c.url.includes("/contacts"));
  const emailCall = calls.find((c) => c.url.includes("/emails"));
  assert.ok(contact, "contact create was called");
  assert.ok(emailCall, "email send was called");

  // Contact registered with the normalized address and the configured segment.
  assert.equal(contact.body.email, "foo@bar.com");
  assert.deepEqual(contact.body.segment_ids, ["seg-123"]);
  assert.equal(contact.body.unsubscribed, false);
  assert.match(contact.headers.Authorization, /^Bearer re_test_key$/);

  // Email addressed to the subscriber with the configured from/reply-to + PDF link.
  assert.deepEqual(emailCall.body.to, ["foo@bar.com"]);
  assert.equal(emailCall.body.from, LIVE_ENV.FROM_EMAIL);
  assert.equal(emailCall.body.reply_to, LIVE_ENV.REPLY_TO);
  assert.match(emailCall.body.subject, /guia de rotinas/i);
  assert.ok(emailCall.body.html.includes("/downloads/modelos-rotina-guarda-compartilhada.pdf"));
  assert.ok(emailCall.body.headers["List-Unsubscribe"].includes("mailto:"));
});

test("PDF link and sender fall back to defaults, and track the request origin", async () => {
  const env = { RESEND_API_KEY: "re_x" }; // no SEGMENT/FROM/REPLY configured
  const res = await handleSubscribe(
    req({ email: "a@b.com" }, { origin: "https://preview.entrelares.app" }),
    env,
  );
  assert.equal((await body(res)).emailQueued, true);

  const contact = calls.find((c) => c.url.includes("/contacts"));
  const emailCall = calls.find((c) => c.url.includes("/emails"));
  // No segment configured → the contact body omits segment_ids entirely.
  assert.equal("segment_ids" in contact.body, false);
  // From/reply-to fall back to the built-in defaults.
  assert.match(emailCall.body.from, /materiais@guardacompartilhada\.com/);
  assert.equal(emailCall.body.reply_to, "contato@entrelares.app");
  // The PDF URL tracks the origin the request came in on (preview → preview).
  assert.ok(emailCall.body.html.includes("https://preview.entrelares.app/downloads/"));
});

// ── duplicate contact tolerated ──────────────────────────────────────────

test("a 409 (already a contact) is tolerated and the e-mail still sends", async () => {
  responders.contacts = () => new Response("conflict", { status: 409 });
  const res = await handleSubscribe(req({ email: "dup@x.com" }), LIVE_ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), { ok: true, emailQueued: true });
  assert.ok(calls.some((c) => c.url.includes("/emails")), "email still attempted");
});

// ── provider failures ─────────────────────────────────────────────────────

test("contact create 5xx aborts with 502 and does NOT send the e-mail", async () => {
  responders.contacts = () => new Response("boom", { status: 503 });
  const res = await handleSubscribe(req({ email: "x@y.com" }), LIVE_ENV);
  assert.equal(res.status, 502);
  assert.equal((await body(res)).error, "provider_unavailable");
  assert.equal(calls.filter((c) => c.url.includes("/emails")).length, 0);
});

test("contact create network throw aborts with 502", async () => {
  responders.contacts = () => {
    throw new Error("network down");
  };
  const res = await handleSubscribe(req({ email: "x@y.com" }), LIVE_ENV);
  assert.equal(res.status, 502);
  assert.equal((await body(res)).error, "provider_unavailable");
});

test("contact 4xx (not 409) is non-fatal: e-mail still attempted", async () => {
  // e.g. a 422 from the provider on the contact — the send is the user-facing win.
  responders.contacts = () => new Response("bad", { status: 422 });
  const res = await handleSubscribe(req({ email: "x@y.com" }), LIVE_ENV);
  assert.equal(res.status, 200);
  assert.equal((await body(res)).emailQueued, true);
});

test("email send failure reports partial success (ok, emailQueued:false)", async () => {
  responders.emails = () => new Response("nope", { status: 500 });
  const res = await handleSubscribe(req({ email: "x@y.com" }), LIVE_ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), { ok: true, emailQueued: false });
});

test("email send network throw also reports partial success", async () => {
  responders.emails = () => {
    throw new Error("smtp down");
  };
  const res = await handleSubscribe(req({ email: "x@y.com" }), LIVE_ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), { ok: true, emailQueued: false });
});

// ── S-15/C-6 — opt-in evidence log ──────────────────────────────────────────
// The legal review accepted plain opt-in for the newsletter ONLY on condition
// that a log of date, time and IP is kept. These tests are that condition.

test("opt-in log: records email, timestamp and IP on a valid subscribe", async () => {
  const request = new Request("https://entrelares.app/api/subscribe", {
    method: "POST",
    body: JSON.stringify({ email: "Ana@Exemplo.com " }),
    headers: { "content-type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
  });

  await handleSubscribe(request, LIVE_ENV);

  assert.equal(optInLog.store.size, 1);
  const [key, raw] = [...optInLog.store.entries()][0];
  const entry = JSON.parse(raw);

  // Normalized, same as what goes to Resend — the evidence must match the contact.
  assert.equal(entry.email, "ana@exemplo.com");
  assert.equal(entry.ip, "203.0.113.7");
  assert.ok(key.startsWith("optin:ana@exemplo.com:"));
  assert.ok(!Number.isNaN(Date.parse(entry.ts)));
});

test("opt-in log: written even in dry-run (no RESEND_API_KEY)", async () => {
  // The preview worker has no key. The consent still happened, so the evidence
  // must exist regardless of whether any e-mail went out.
  const kv = kvStub();
  const res = await handleSubscribe(req({ email: "x@y.com" }), { OPTIN_LOG: kv });

  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), { ok: true, dryRun: true });
  assert.equal(kv.store.size, 1);
});

test("opt-in log: nothing recorded for a honeypot submission", async () => {
  await handleSubscribe(req({ email: "bot@spam.com", empresa: "Acme" }), LIVE_ENV);
  assert.equal(optInLog.store.size, 0);
});

test("opt-in log: nothing recorded for an invalid e-mail", async () => {
  await handleSubscribe(req({ email: "not-an-email" }), LIVE_ENV);
  assert.equal(optInLog.store.size, 0);
});

test("opt-in log: one key per submission, so a re-subscribe is not overwritten", async () => {
  // Two acts of consent must leave two records — overwriting would destroy the
  // evidence for the first one.
  await handleSubscribe(req({ email: "dup@y.com" }), LIVE_ENV);
  await new Promise((r) => setTimeout(r, 2)); // distinct ISO timestamps
  await handleSubscribe(req({ email: "dup@y.com" }), LIVE_ENV);

  assert.equal(optInLog.store.size, 2);
});

test("opt-in log: a KV outage does not fail the subscription", async () => {
  // Best-effort by design: refusing the material because the audit write failed
  // would punish the user for our outage.
  const env = { ...LIVE_ENV, OPTIN_LOG: kvStub({ failing: true }) };
  const res = await handleSubscribe(req({ email: "x@y.com" }), env);

  assert.equal(res.status, 200);
  assert.equal((await body(res)).ok, true);
});

test("opt-in log: a missing binding does not fail the subscription", async () => {
  const { OPTIN_LOG, ...envWithoutKv } = LIVE_ENV;
  const res = await handleSubscribe(req({ email: "x@y.com" }), envWithoutKv);

  assert.equal(res.status, 200);
  assert.equal((await body(res)).ok, true);
});

test("logOptIn: reports false when the binding is absent, true on success", async () => {
  const request = req({ email: "x@y.com" });
  assert.equal(await logOptIn({}, "x@y.com", request), false);
  assert.equal(await logOptIn({ OPTIN_LOG: kvStub() }, "x@y.com", request), true);
  assert.equal(await logOptIn({ OPTIN_LOG: kvStub({ failing: true }) }, "x@y.com", request), false);
});
