// L-05 — pure rules of the "Gerador de rotina de guarda" (public/ferramentas/).
// MIRROR of the app's Rotation Wizard presets — entrelares-app,
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

// ── L-30: the shareable routine ─────────────────────────────────────────────
// A routine travels in the URL FRAGMENT, never in the path or the query: the
// fragment never reaches our server, and the page's Umami tag carries
// `data-exclude-hash="true"`, so the names a parent typed never reach analytics
// either. The Umami tracker sends query AND fragment by default — the app's
// `sanitizeAnalyticsPath` does not exist on this site. Only what the PAGE can
// show is accepted, so a hand-edited link renders the same routine on every
// phone or renders nothing.

/** Format version carried as `v` — bump it only together with a decoder for the old one. */
export const SHARE_VERSION = "1";

/** Presets the page's menu offers (the module keeps all five app presets). */
export const MENU_PRESETS = ["7-7", "14-14", "1-1"];

/** Preview lengths the page's menu offers, in weeks. */
export const MENU_WEEKS = [4, 8, 12];

/** Same cap as the page's name inputs (`maxlength="30"`), counted in characters. */
export const NAME_MAX = 30;

const isDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const cutName = (s) => [...String(s ?? "").trim()].slice(0, NAME_MAX).join("");

/**
 * Routine → fragment body (without `#`).
 * @param {object} r
 * @param {string} r.model     a MENU_PRESETS id or "custom"
 * @param {number[]} [r.days]  custom only: 2 or 3 block lengths (clamped to 1..60)
 * @param {number} [r.first]   presets only: 0 or 1, who takes the first block
 * @param {string} r.start     "yyyy-mm-dd"
 * @param {string} [r.time]    "HH:MM", or "" for none
 * @param {number} r.weeks     one of MENU_WEEKS
 * @param {string[]} [r.names] the two typed names, "" when left blank
 */
export function encodeRoutine({ model, days, first = 0, start, time = "", weeks, names = ["", ""] }) {
  const p = new URLSearchParams();
  p.set("v", SHARE_VERSION);
  p.set("m", model);
  if (model === "custom") p.set("d", days.map(clampDays).join("-"));
  else p.set("c", first === 1 ? "1" : "0");
  p.set("i", start);
  if (time) p.set("t", time);
  p.set("s", String(weeks));
  const [a, b] = names.map(cutName);
  if (a) p.set("a", a);
  if (b) p.set("b", b);
  return p.toString();
}

/**
 * Fragment (with or without `#`) → routine, or null when anything is missing,
 * unknown or out of range. Never throws: the input is whatever was pasted.
 * @returns {null | {model: string, days: number[]|null, first: number,
 *   start: string, time: string, weeks: number, names: [string, string]}}
 */
export function decodeRoutine(fragment) {
  const raw = String(fragment ?? "").replace(/^#/, "");
  if (!raw) return null;
  const p = new URLSearchParams(raw);
  if (p.get("v") !== SHARE_VERSION) return null;

  const model = p.get("m");
  let days = null;
  let first = 0;
  if (model === "custom") {
    const parts = (p.get("d") ?? "").split("-");
    if (parts.length < 2 || parts.length > 3) return null;
    if (!parts.every((x) => /^\d{1,2}$/.test(x))) return null;
    days = parts.map(Number);
    if (!days.every((n) => n >= 1 && n <= 60)) return null;
  } else if (MENU_PRESETS.includes(model)) {
    const c = p.get("c");
    if (c !== "0" && c !== "1") return null;
    first = Number(c);
  } else {
    return null;
  }

  const start = p.get("i") ?? "";
  if (!isDate(start)) return null;
  const time = p.get("t") ?? "";
  if (time && !isTime(time)) return null;
  const weeks = Number(p.get("s"));
  if (!MENU_WEEKS.includes(weeks)) return null;

  return { model, days, first, start, time, weeks, names: [cutName(p.get("a")), cutName(p.get("b"))] };
}
