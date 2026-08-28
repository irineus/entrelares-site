// L-05 — pure rules of the "Gerador de rotina de guarda" (public/ferramentas/).
// MIRROR of the app's Rotation Wizard presets — entrelares-flutter,
// packages/entrelares_core/lib/src/wizard_rules.dart (`wizardPresetBlocks`):
// the preset ids are pattern ids (never localized) and the block expansion must
// stay IDENTICAL to the app's, so what a visitor previews here is exactly what
// the app generates after signup. No DOM in this module — `node --test` covers
// it in test/gerador-rotina.test.js, the same zero-dependency lane as the
// Worker suite.

/** Preset id → cycle blocks, each block = [parentIndex (0|1), days]. */
export const PRESET_BLOCKS = {
  "7-7": [[0, 7], [1, 7]],
  "14-14": [[0, 14], [1, 14]],
  "1-1": [[0, 1], [1, 1]],
  "5-2-2-5": [[0, 5], [1, 2], [0, 2], [1, 5]],
  "2-2-3": [[0, 2], [1, 2], [0, 3], [1, 2], [0, 2], [1, 3]],
};

/** Preset ids in menu order — same order as the app's wizard dropdown. */
export const PRESET_IDS = ["7-7", "14-14", "1-1", "5-2-2-5", "2-2-3"];

/**
 * Expands a preset id into cycle blocks, optionally starting with the second
 * caregiver. Unknown ids fall back to 7-7, like the app.
 * @returns {Array<[number, number]>} fresh copies — safe to mutate.
 */
export function presetBlocks(preset, firstParent = 0) {
  const blocks = PRESET_BLOCKS[preset] ?? PRESET_BLOCKS["7-7"];
  return blocks.map(([p, d]) => [firstParent === 0 ? p : 1 - p, d]);
}

/** Total days of one full cycle of a preset. */
export function cycleLength(preset) {
  return (PRESET_BLOCKS[preset] ?? PRESET_BLOCKS["7-7"])
    .reduce((sum, [, d]) => sum + d, 0);
}

/** Mirror of the app's `clampBlockDays` — a block holds 1..60 days. */
export function clampDays(days) {
  return days < 1 ? 1 : (days > 60 ? 60 : days);
}

/**
 * Custom cycle from the page's three fields: days with caregiver 1, days with
 * caregiver 2, and optionally days with caregiver 1 again before the cycle
 * restarts (mirrors the app wizard's free-form blocks, capped at the same
 * 1..60 per block). `d3` empty/0 → a two-block cycle.
 * @returns {Array<[number, number]>}
 */
export function customBlocks(d1, d2, d3 = 0) {
  const blocks = [[0, clampDays(d1)], [1, clampDays(d2)]];
  if (d3 > 0) blocks.push([0, clampDays(d3)]);
  return blocks;
}

/**
 * Generates the day-by-day plan.
 * `isTransition` mirrors the app's T-27 rule: true when the day's caregiver
 * differs from D-1's — the handoff time only makes sense on those days. The
 * first day has no D-1 inside the plan, so it is never a transition.
 *
 * @param {object} opts
 * @param {string} [opts.preset]     preset id (see PRESET_IDS)
 * @param {Array<[number, number]>} [opts.blocks] explicit cycle blocks — wins
 *                                   over `preset` (e.g. from customBlocks)
 * @param {Date}   opts.start        first day of the plan (time-of-day ignored)
 * @param {number} opts.days         how many days to generate (> 0)
 * @param {number} [opts.firstParent] 0 or 1 — who takes the first block
 *                                   (preset expansion only; explicit blocks
 *                                   already say who is who)
 * @returns {Array<{date: Date, parent: number, isTransition: boolean}>}
 */
export function buildSchedule({ preset, blocks: explicit, start, days, firstParent = 0 }) {
  const blocks = explicit ?? presetBlocks(preset, firstParent);
  const plan = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let block = 0;
  let dayInBlock = 0;
  let prevParent = null;
  while (plan.length < days) {
    const parent = blocks[block][0];
    plan.push({
      date: new Date(cursor),
      parent,
      isTransition: prevParent !== null && parent !== prevParent,
    });
    prevParent = parent;
    dayInBlock += 1;
    if (dayInBlock >= blocks[block][1]) {
      dayInBlock = 0;
      block = (block + 1) % blocks.length;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return plan;
}

/**
 * Day counts per caregiver — the "equilíbrio" line above the preview.
 * @returns {[number, number]} days of parent 0 and parent 1.
 */
export function countDays(plan) {
  const totals = [0, 0];
  for (const day of plan) totals[day.parent] += 1;
  return totals;
}
