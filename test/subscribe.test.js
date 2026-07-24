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
} from "../src/index.js";

// ── fetch stub ──────────────────────────────────────────────────────────────

const realFetch = globalThis.fetch;
let calls; // recorded outbound requests: { url, method, headers, body }
let responders; // { contacts: () => Response, emails: () => Response }

beforeEach(() => {
  calls = [];
  responders = {
    contacts: () => new Response(JSON.stringify({ id: "c1" }), { status: 200 }),
    emails: () => new Response(JSON.stringify({ id: "e1" }), { status: 200 }),
  };
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

function req(body, { method = "POST", origin = "https://guardacompartilhada.com" } = {}) {
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
  FROM_EMAIL: "Guarda <materiais@guardacompartilhada.com>",
  REPLY_TO: "contato@guardacompartilhada.com",
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
    req({ email: "a@b.com" }, { origin: "https://preview.guardacompartilhada.com" }),
    env,
  );
  assert.equal((await body(res)).emailQueued, true);

  const contact = calls.find((c) => c.url.includes("/contacts"));
  const emailCall = calls.find((c) => c.url.includes("/emails"));
  // No segment configured → the contact body omits segment_ids entirely.
  assert.equal("segment_ids" in contact.body, false);
  // From/reply-to fall back to the built-in defaults.
  assert.match(emailCall.body.from, /materiais@guardacompartilhada\.com/);
  assert.equal(emailCall.body.reply_to, "contato@guardacompartilhada.com");
  // The PDF URL tracks the origin the request came in on (preview → preview).
  assert.ok(emailCall.body.html.includes("https://preview.guardacompartilhada.com/downloads/"));
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
