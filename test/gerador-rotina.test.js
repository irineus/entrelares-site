// L-05 — tests for the routine-generator's pure rules (public/js/gerador-rotina.js).
// The module is a MIRROR of the app's wizard presets (entrelares-flutter,
// packages/entrelares_core/lib/src/wizard_rules.dart) — the expansion tables
// asserted here are copied from that file's `wizardPresetBlocks`, so a drift
// between the tool's preview and the app's generation fails this suite.
// Zero dependencies: Node's built-in runner (`npm test` / `node --test`).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRESET_BLOCKS,
  PRESET_IDS,
  presetBlocks,
  cycleLength,
  clampDays,
  customBlocks,
  buildSchedule,
  countDays,
} from "../public/js/gerador-rotina.js";

// The PAGE's menu offers only the named presets (7-7, 14-14, 1-1) plus the
// custom-blocks option; the module keeps ALL five app presets on purpose —
// the mirror below is about wizard_rules.dart, not about what the menu shows.

// ── preset expansions (the app mirror — keep byte-identical to wizard_rules.dart)

test("presets expand exactly like the app's wizardPresetBlocks", () => {
  assert.deepEqual(PRESET_BLOCKS["7-7"], [[0, 7], [1, 7]]);
  assert.deepEqual(PRESET_BLOCKS["14-14"], [[0, 14], [1, 14]]);
  assert.deepEqual(PRESET_BLOCKS["1-1"], [[0, 1], [1, 1]]);
  assert.deepEqual(PRESET_BLOCKS["5-2-2-5"], [[0, 5], [1, 2], [0, 2], [1, 5]]);
  assert.deepEqual(PRESET_BLOCKS["2-2-3"],
    [[0, 2], [1, 2], [0, 3], [1, 2], [0, 2], [1, 3]]);
});

test("preset ids keep the app's menu order", () => {
  assert.deepEqual(PRESET_IDS, ["7-7", "14-14", "1-1", "5-2-2-5", "2-2-3"]);
});

test("unknown preset falls back to 7-7, like the app", () => {
  assert.deepEqual(presetBlocks("nope"), [[0, 7], [1, 7]]);
});

test("firstParent=1 swaps the caregivers without touching the days", () => {
  assert.deepEqual(presetBlocks("5-2-2-5", 1),
    [[1, 5], [0, 2], [1, 2], [0, 5]]);
});

test("presetBlocks returns fresh copies (mutation-safe)", () => {
  const a = presetBlocks("7-7");
  a[0][1] = 99;
  assert.deepEqual(presetBlocks("7-7"), [[0, 7], [1, 7]]);
});

test("cycle lengths", () => {
  assert.equal(cycleLength("7-7"), 14);
  assert.equal(cycleLength("14-14"), 28);
  assert.equal(cycleLength("1-1"), 2);
  assert.equal(cycleLength("5-2-2-5"), 14);
  assert.equal(cycleLength("2-2-3"), 14);
});

// ── buildSchedule ───────────────────────────────────────────────────────────

const START = new Date(2026, 8, 7); // Mon 2026-09-07 (month is 0-based)

test("7-7: first week parent 0, second week parent 1", () => {
  const plan = buildSchedule({ preset: "7-7", start: START, days: 14 });
  assert.equal(plan.length, 14);
  assert.deepEqual(plan.map((d) => d.parent),
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]);
});

test("dates are consecutive and start at the given day", () => {
  const plan = buildSchedule({ preset: "1-1", start: START, days: 5 });
  assert.equal(plan[0].date.getTime(), new Date(2026, 8, 7).getTime());
  for (let i = 1; i < plan.length; i++) {
    const diff = plan[i].date.getTime() - plan[i - 1].date.getTime();
    assert.equal(Math.round(diff / 86400000), 1);
  }
});

test("transition flags: never on day 1, only where the caregiver changes (T-27)", () => {
  const plan = buildSchedule({ preset: "7-7", start: START, days: 15 });
  assert.equal(plan[0].isTransition, false);
  assert.equal(plan[6].isTransition, false);
  assert.equal(plan[7].isTransition, true);
  assert.equal(plan[8].isTransition, false);
  assert.equal(plan[14].isTransition, true); // cycle wraps back to parent 0
});

test("2-2-3 repeats after its 14-day cycle", () => {
  const plan = buildSchedule({ preset: "2-2-3", start: START, days: 28 });
  for (let i = 0; i < 14; i++) {
    assert.equal(plan[i].parent, plan[i + 14].parent);
  }
});

test("2-2-3 splits 14 days 7/7 — the 50/50 the model promises", () => {
  const plan = buildSchedule({ preset: "2-2-3", start: START, days: 14 });
  assert.deepEqual(countDays(plan), [7, 7]);
});

test("5-2-2-5 with firstParent=1 gives parent 1 the first five days", () => {
  const plan = buildSchedule({
    preset: "5-2-2-5", start: START, days: 14, firstParent: 1,
  });
  assert.deepEqual(plan.slice(0, 7).map((d) => d.parent),
    [1, 1, 1, 1, 1, 0, 0]);
  assert.deepEqual(countDays(plan), [7, 7]);
});

// ── custom blocks (the page's "Customizado" option) ─────────────────────────

test("customBlocks: two fields make a two-block cycle, third is optional", () => {
  assert.deepEqual(customBlocks(5, 2), [[0, 5], [1, 2]]);
  assert.deepEqual(customBlocks(5, 2, 2), [[0, 5], [1, 2], [0, 2]]);
  assert.deepEqual(customBlocks(3, 4, 0), [[0, 3], [1, 4]]);
});

test("customBlocks clamps each block to the app's 1..60 (clampBlockDays)", () => {
  assert.equal(clampDays(0), 1);
  assert.equal(clampDays(61), 60);
  assert.deepEqual(customBlocks(0, 99), [[0, 1], [1, 60]]);
});

test("buildSchedule with explicit blocks follows the custom cycle", () => {
  const plan = buildSchedule({
    blocks: customBlocks(5, 2, 2), start: START, days: 18,
  });
  // 9-day cycle: 5 with parent 0, 2 with parent 1, 2 with parent 0, repeat.
  assert.deepEqual(plan.slice(0, 9).map((d) => d.parent),
    [0, 0, 0, 0, 0, 1, 1, 0, 0]);
  for (let i = 0; i < 9; i++) assert.equal(plan[i].parent, plan[i + 9].parent);
  assert.deepEqual(countDays(plan), [14, 4]);
});

test("month and year boundaries advance correctly", () => {
  const plan = buildSchedule({
    preset: "7-7", start: new Date(2026, 11, 28), days: 8,
  });
  const last = plan[7].date;
  assert.deepEqual(
    [last.getFullYear(), last.getMonth(), last.getDate()],
    [2027, 0, 4],
  );
});
