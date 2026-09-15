// L-30 — the shareable routine: the link a parent sends from the generator
// (public/js/gerador-rotina.js `encodeRoutine`/`decodeRoutine`) and the page
// guarantees that keep the names typed into it out of our analytics.
// Zero dependencies: Node's built-in runner, same lane as the rest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  encodeRoutine,
  decodeRoutine,
  buildSchedule,
  customBlocks,
  NAME_MAX,
} from "../public/js/gerador-rotina.js";

const PAGE = readFileSync(
  new URL("../public/ferramentas/gerador-de-rotina-de-guarda.html", import.meta.url),
  "utf8",
);

const preset = {
  model: "7-7", days: null, first: 1, start: "2026-09-15", time: "18:30", weeks: 8,
  names: ["Casa da mãe", "Casa do pai"],
};
const custom = {
  model: "custom", days: [5, 2, 2], first: 0, start: "2026-12-28", time: "", weeks: 4,
  names: ["", ""],
};

// ── round trip ──────────────────────────────────────────────────────────────

test("a preset routine survives the link unchanged", () => {
  assert.deepEqual(decodeRoutine(encodeRoutine(preset)), preset);
});

test("a custom routine survives the link unchanged, and the '#' is optional", () => {
  const frag = encodeRoutine(custom);
  assert.deepEqual(decodeRoutine(frag), custom);
  assert.deepEqual(decodeRoutine("#" + frag), custom);
});

test("names with the characters a URL cares about come back byte for byte", () => {
  const r = { ...preset, names: ["Ana & João #1", "Zé=100% 👨‍👧 ?x"] };
  assert.deepEqual(decodeRoutine(encodeRoutine(r)).names, r.names);
});

test("the fragment never carries a raw name — WhatsApp must not cut the link at a space", () => {
  const frag = encodeRoutine(preset);
  assert.doesNotMatch(frag, /[\s#?]/);
  assert.ok(!frag.includes("mãe"), "accents are percent-encoded");
});

test("names are capped at the input's 30 characters, counted as characters", () => {
  const long = "ã".repeat(NAME_MAX + 5);
  const r = decodeRoutine(encodeRoutine({ ...preset, names: [long, "  b  "] }));
  assert.equal([...r.names[0]].length, NAME_MAX);
  assert.equal(r.names[1], "b");
});

test("the same link builds the same calendar, day by day, wherever it is opened", () => {
  // The acceptance: built on one phone, opened on another. The start travels as a
  // calendar date (never an instant), so the receiver's time zone cannot move it.
  const plan = (r) => {
    const [y, m, d] = r.start.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    return r.model === "custom"
      ? buildSchedule({ blocks: customBlocks(...r.days), start, days: r.weeks * 7 })
      : buildSchedule({ preset: r.model, start, days: r.weeks * 7, firstParent: r.first });
  };
  const flat = (p) => p.map((x) => [x.date.getFullYear(), x.date.getMonth(), x.date.getDate(), x.parent, x.isTransition]);
  for (const r of [preset, custom]) {
    assert.deepEqual(flat(plan(decodeRoutine(encodeRoutine(r)))), flat(plan(r)));
  }
});

test("custom block lengths are clamped to the app's 1..60 on the way out", () => {
  const r = decodeRoutine(encodeRoutine({ ...custom, days: [99, 0] }));
  assert.deepEqual(r.days, [60, 1]);
});

// ── what a link may NOT be ──────────────────────────────────────────────────

test("an empty fragment, a stray anchor or another version renders nothing", () => {
  for (const bad of ["", "#", "#faq", "v=2&m=7-7&c=0&i=2026-09-15&s=4"]) {
    assert.equal(decodeRoutine(bad), null, bad);
  }
});

test("only what the page's menus can show is accepted", () => {
  const ok = new URLSearchParams(encodeRoutine(preset));
  const withParam = (k, v) => {
    const p = new URLSearchParams(ok);
    if (v === null) p.delete(k); else p.set(k, v);
    return p.toString();
  };
  const cases = [
    ["m", "2-2-3"],      // an app preset the page's menu does not offer
    ["m", null],
    ["c", "2"],
    ["c", null],
    ["i", "2026-02-30"], // not a calendar day
    ["i", "15/09/2026"],
    ["i", null],
    ["t", "24:00"],
    ["t", "8:00"],
    ["s", "5"],
    ["s", null],
  ];
  for (const [k, v] of cases) {
    assert.equal(decodeRoutine(withParam(k, v)), null, `${k}=${v}`);
  }
});

test("a custom link needs two or three blocks of 1..60 days", () => {
  const base = new URLSearchParams(encodeRoutine(custom));
  for (const d of ["5", "5-2-2-5", "0-2", "61-2", "5-x", "5--2", ""]) {
    const p = new URLSearchParams(base);
    p.set("d", d);
    assert.equal(decodeRoutine(p.toString()), null, `d=${d}`);
  }
});

test("a mangled fragment never throws", () => {
  for (const bad of ["%", "%E0%A4%A", "v=1&m=%ZZ", "&&&", "v=1&v=1&m=7-7"]) {
    assert.doesNotThrow(() => decodeRoutine(bad), bad);
  }
});

// ── the page ────────────────────────────────────────────────────────────────

test("the generator's Umami tag excludes the fragment — the names live there", () => {
  // The tracker sends location.href with query AND hash unless told otherwise
  // (cloud.umami.is/script.js, read 15/09/2026). Without this attribute every
  // opened link would put the names a parent typed into our analytics.
  const tag = PAGE.match(/<script[^>]+cloud\.umami\.is\/script\.js[^>]*>/);
  assert.ok(tag, "the page has no Umami tag");
  assert.match(tag[0], /data-exclude-hash="true"/);
});

test("the share button and the arrival are counted under their own event names", () => {
  assert.match(PAGE, /id="g-compartilhar"[^>]*data-umami-event="gerador-compartilhar"/);
  assert.match(PAGE, /track\("gerador-rotina-recebida"\)/);
});

test("the received routine's CTA opens the app's sign-up, tagged with where it came from", () => {
  const note = PAGE.match(/<div class="recebida-note"[\s\S]*?<\/div>/);
  assert.ok(note, "the page has no received-routine note");
  assert.match(note[0], /href="https:\/\/web\.entrelares\.app\/register"/);
  assert.match(note[0], /data-umami-event="cta-signup"/);
  assert.match(note[0], /data-umami-event-origem="rotina-recebida"/);
});

test("a week of long names fits a 375 px phone — the calendar's tracks may shrink", () => {
  // `repeat(7,1fr)` grows each track to a nowrap name's min-content: "Casa da mãe" made the
  // week 573 px wide at 375 px (measured 15/09/2026), and a shared link opens on a phone.
  assert.match(PAGE, /\.cal\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
});

test("the page imports the shared rules instead of re-implementing them", () => {
  assert.match(PAGE, /encodeRoutine, decodeRoutine,?\s*\}\s*from "\/js\/gerador-rotina\.js"/);
});
