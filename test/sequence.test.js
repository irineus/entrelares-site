// L-20 — tests for the sequence: the pure scheduling rule and the cron walk.
//
// Two of these are not "coverage", they are the item's safety properties, and
// they are the reason this file exists:
//
//   · THE STOP — somebody who unsubscribed never receives another step. Checked
//     before a message is even rendered, and a KV that cannot be read is taken
//     as "stopped" rather than as consent.
//   · THE CAP  — the sequence can never eat the Resend allowance a real user's
//     sign-up confirmation or password reset depends on. The allowance is 100/day
//     for the whole ACCOUNT, shared with both Supabase projects' GoTrue SMTP and,
//     since 02/09/2026, with a second product (gestaoim360.com).

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { runSequence, enqueueSequence, handleSubscribe } from "../src/index.js";
import { DAILY_CAP, LAST_STEP, SEQUENCE, daysBetween, dueStep, isFinished, renderStep } from "../src/sequence.js";
import { kvStub } from "./kv-stub.js";

const realFetch = globalThis.fetch;
let sends;
let kv;
let failSend;

const ENV = () => ({ RESEND_API_KEY: "re_test_key", OPTIN_LOG: kv });

beforeEach(() => {
  sends = [];
  failSend = false;
  kv = kvStub();
  globalThis.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    if (String(url).endsWith("/emails")) {
      sends.push(body);
      if (failSend) return new Response("nope", { status: 500 });
    }
    return new Response(JSON.stringify({ id: "ok" }), { status: 200 });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const DAY = 86400000;
const T0 = new Date("2026-09-01T12:00:00Z");
const at = (days) => new Date(T0.getTime() + days * DAY);

/** Put somebody in the queue as if they had subscribed at T0. */
async function queued(email, { lastStep = 1, startedAt = T0.toISOString() } = {}) {
  await kv.put(`seq:${email}`, JSON.stringify({
    email, startedAt, lastStep, unsubUrl: `https://entrelares.app/api/unsubscribe?t=${"a".repeat(32)}`,
  }));
}

async function stateOf(email) {
  const raw = await kv.get(`seq:${email}`);
  return raw ? JSON.parse(raw) : null;
}

// ── the pure rule ───────────────────────────────────────────────────────────

test("daysBetween counts whole elapsed days, and reports NaN for junk", () => {
  assert.equal(daysBetween(T0.toISOString(), at(0)), 0);
  assert.equal(daysBetween(T0.toISOString(), new Date(T0.getTime() + DAY - 1)), 0);
  assert.equal(daysBetween(T0.toISOString(), at(3)), 3);
  assert.ok(Number.isNaN(daysBetween("not-a-date", at(3))));
});

test("nothing is due before its day", () => {
  const state = { startedAt: T0.toISOString(), lastStep: 1 };
  assert.equal(dueStep(state, at(0)), null);
  assert.equal(dueStep(state, at(1)), null);
  assert.equal(dueStep(state, at(2)).step, 2); // day 3
});

test("step 3 waits for step 2 — never two messages in one morning", () => {
  // Somebody whose day 5 arrives with step 2 unsent (the cap bit, or we were
  // down) gets step 2 today and step 3 tomorrow.
  const behind = { startedAt: T0.toISOString(), lastStep: 1 };
  assert.equal(dueStep(behind, at(9)).step, 2);
  assert.equal(dueStep({ ...behind, lastStep: 2 }, at(9)).step, 3);
});

test("a finished sequence is due nothing, ever again", () => {
  const done = { startedAt: T0.toISOString(), lastStep: LAST_STEP };
  assert.equal(dueStep(done, at(90)), null);
  assert.equal(isFinished(done), true);
});

test("unreadable state sends NOTHING — the fail-closed reading", () => {
  assert.equal(dueStep(null, at(9)), null);
  assert.equal(dueStep({}, at(9)), null);
  assert.equal(dueStep({ startedAt: "garbage", lastStep: 1 }, at(9)), null);
  // A clock that went backwards is not a licence to send everything at once.
  assert.equal(dueStep({ startedAt: at(5).toISOString(), lastStep: 1 }, T0), null);
});

test("every declared step can actually be rendered", () => {
  for (const { step, subject } of SEQUENCE) {
    const m = renderStep(step, { unsubUrl: "https://x.test/u", unsubscribeMailto: "p@e.app", appUrl: "https://entrelares.app/" });
    assert.equal(m.subject, subject);
    assert.ok(m.html.includes("<!DOCTYPE html>"));
    assert.ok(m.text.length > 200);
    // Every message carries the way out, in both bodies — §4's promise.
    assert.ok(m.html.includes("https://x.test/u"));
    assert.ok(m.text.includes("https://x.test/u"));
  }
  assert.throws(() => renderStep(99, {}), /no message for step 99/);
});

// ── the walk ────────────────────────────────────────────────────────────────

test("a due step is sent once and the state advances", async () => {
  await queued("ana@exemplo.com");

  const r = await runSequence(ENV(), at(2));

  assert.equal(r.sent, 1);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].to[0], "ana@exemplo.com");
  assert.equal(sends[0].subject, SEQUENCE[0].subject);
  assert.equal((await stateOf("ana@exemplo.com")).lastStep, 2);

  // Running again the same day must not send it twice.
  await runSequence(ENV(), at(2));
  assert.equal(sends.length, 1);
});

test("THE STOP: an unsubscribed address is dropped before anything is rendered", async () => {
  await queued("saiu@exemplo.com");
  await kv.put("stop:saiu@exemplo.com", JSON.stringify({ ts: T0.toISOString() }));

  const r = await runSequence(ENV(), at(2));

  assert.equal(sends.length, 0);
  assert.equal(r.stopped, 1);
  assert.equal(await stateOf("saiu@exemplo.com"), null, "and the queue entry is gone");
});

test("THE STOP holds even when the tombstone is unreadable", async () => {
  await queued("ana@exemplo.com");
  const flaky = {
    ...kv,
    async get(key) {
      if (key.startsWith("stop:")) throw new Error("kv unavailable");
      return kv.get(key);
    },
  };

  await runSequence({ RESEND_API_KEY: "k", OPTIN_LOG: flaky }, at(2));

  // Fail closed: the cost of guessing 'not stopped' is mail to somebody who
  // asked us to stop, which is the one failure this item exists to prevent.
  assert.equal(sends.length, 0);
});

test("THE CAP: a run never sends more than DAILY_CAP", async () => {
  for (let i = 0; i < DAILY_CAP + 5; i++) await queued(`p${i}@exemplo.com`);

  const r = await runSequence(ENV(), at(2));

  assert.equal(r.sent, DAILY_CAP);
  assert.equal(sends.length, DAILY_CAP);
  assert.equal(r.capped, true);
});

test("THE CAP is per day and cumulative, not per run", async () => {
  for (let i = 0; i < DAILY_CAP; i++) await queued(`p${i}@exemplo.com`);
  await runSequence(ENV(), at(2));
  sends = [];

  // Same UTC day, fresh queue: the budget is already spent.
  await queued("tarde@exemplo.com");
  const r = await runSequence(ENV(), at(2.4));

  assert.equal(sends.length, 0);
  assert.equal(r.capped, true);
});

test("what the cap defers is not lost — it goes out the next day", async () => {
  for (let i = 0; i < DAILY_CAP + 1; i++) await queued(`p${i}@exemplo.com`);
  await runSequence(ENV(), at(2));
  const leftover = (await Promise.all(
    [...Array(DAILY_CAP + 1).keys()].map((i) => stateOf(`p${i}@exemplo.com`)),
  )).filter((s) => s.lastStep === 1);
  assert.equal(leftover.length, 1);

  sends = [];
  await runSequence(ENV(), at(3));
  assert.equal(sends.length, 1, "the deferred one is still due");
});

test("an unreadable cap counter stops the drip instead of letting it run unmetered", async () => {
  await queued("ana@exemplo.com");
  const flaky = {
    ...kv,
    async get(key) {
      if (key.startsWith("cap:")) throw new Error("kv unavailable");
      return kv.get(key);
    },
  };

  const r = await runSequence({ RESEND_API_KEY: "k", OPTIN_LOG: flaky }, at(2));

  assert.equal(sends.length, 0);
  assert.equal(r.capped, true);
});

test("a failed send does NOT advance the state — the step is due again tomorrow", async () => {
  await queued("ana@exemplo.com");
  failSend = true;

  const r = await runSequence(ENV(), at(2));

  assert.equal(r.sent, 0);
  assert.equal((await stateOf("ana@exemplo.com")).lastStep, 1);

  failSend = false;
  await runSequence(ENV(), at(3));
  assert.equal((await stateOf("ana@exemplo.com")).lastStep, 2);
});

test("without a Resend key the run sends nothing AND marks nothing (preview)", async () => {
  await queued("ana@exemplo.com");

  const r = await runSequence({ OPTIN_LOG: kv }, at(2));

  assert.equal(sends.length, 0);
  assert.equal(r.walked, 0);
  // The bug this guards: a dry run that "delivers" the whole sequence into a
  // log file and leaves everyone marked as done.
  assert.equal((await stateOf("ana@exemplo.com")).lastStep, 1);
});

test("without a KV binding the run is a no-op rather than a crash", async () => {
  const r = await runSequence({ RESEND_API_KEY: "k" }, at(2));
  assert.deepEqual(r, { walked: 0, sent: 0, stopped: 0, capped: false });
});

test("a finished subscriber leaves the queue", async () => {
  await queued("pronto@exemplo.com", { lastStep: LAST_STEP });
  await runSequence(ENV(), at(30));
  assert.equal(await stateOf("pronto@exemplo.com"), null);
  assert.equal(sends.length, 0);
});

test("the whole sequence, day by day, ends and stays ended", async () => {
  await queued("ana@exemplo.com");
  for (let d = 0; d <= 12; d++) await runSequence(ENV(), at(d));

  assert.deepEqual(sends.map((s) => s.subject), SEQUENCE.map((s) => s.subject));
  assert.equal(await stateOf("ana@exemplo.com"), null, "and it cleans up after itself");
});

// ── the join with the opt-in ────────────────────────────────────────────────

test("subscribing enqueues the sequence at step 1, carrying the same way out", async () => {
  const res = await handleSubscribe(
    new Request("https://entrelares.app/api/subscribe", {
      method: "POST",
      body: JSON.stringify({ email: "nova@exemplo.com" }),
      headers: { "content-type": "application/json" },
    }),
    ENV(),
  );
  assert.equal(res.status, 200);

  const state = await stateOf("nova@exemplo.com");
  assert.equal(state.lastStep, 1, "the welcome e-mail IS step 1");
  // The reader must be able to leave from any message with the same link.
  assert.match(state.unsubUrl, /^https:\/\/entrelares\.app\/api\/unsubscribe\?t=[0-9a-f]{32}$/);
});

test("a re-subscribe restarts the sequence rather than running two of them", async () => {
  await queued("volta@exemplo.com", { lastStep: 2, startedAt: at(-30).toISOString() });

  await enqueueSequence(ENV(), "volta@exemplo.com", "https://x.test/u");

  const state = await stateOf("volta@exemplo.com");
  assert.equal(state.lastStep, 1);
  assert.equal([...kv.store.keys()].filter((k) => k.startsWith("seq:")).length, 1);
});
