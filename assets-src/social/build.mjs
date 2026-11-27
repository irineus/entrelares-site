#!/usr/bin/env node
// L-45 — writes the social kit from dezembro-2026.mjs:
//
//   node assets-src/social/build.mjs           carrosseis.html + dezembro-2026.md + every PNG
//   node assets-src/social/build.mjs --text    only the two text files (no Chrome)
//
// The PNGs are screenshots of carrosseis.html#<slide id> taken by headless Chrome at 1080x1350
// (Instagram's 4:5 portrait) with the site's own fonts. Before any screenshot, the page is opened
// as #check and the run STOPS if a slide's text does not fit — a cut sentence on a carousel is
// published by the owner's own hand, so nothing downstream would catch it. Chrome's path can be
// overridden with CHROME=...; the default is the Windows install the other generators use.

import { writeFileSync, mkdirSync, readdirSync, unlinkSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { POSTS, MONTH, CTA, BRAND_LINE } from "./dezembro-2026.mjs";
import { slidesHtml, calendarMarkdown, carousels, slideFile, weekday } from "./social.mjs";
import { readPins, pinsHtml, pinsMarkdown, pinFile } from "./pins.mjs";
import { REELS, reelsHtml, reelsMarkdown } from "./reels.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The text outputs, relative to assets-src/social/ — what test/social.test.js compares. */
export function outputs() {
  const pins = readPins(join(HERE, "..", "..", "public"));
  return {
    "carrosseis.html": slidesHtml(POSTS, { cta: CTA, brandLine: BRAND_LINE }),
    "pins.html": pinsHtml(pins),
    "reels.html": reelsHtml(REELS),
    "dezembro-2026.md": calendarMarkdown(POSTS, MONTH) + "\n" + pinsMarkdown(pins, weekday)
      + "\n" + reelsMarkdown(REELS, POSTS, weekday),
  };
}

/** Width and height read from a PNG's IHDR chunk. */
export function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1"];

function chrome(args) {
  const r = spawnSync(CHROME, [...BASE, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`chrome failed (${r.status}): ${r.stderr}`);
  return r.stdout;
}

/** Refuses to screenshot a page whose #check report lists a slide that does not fit. */
function check(page, size) {
  const dom = chrome(["--virtual-time-budget=8000", `--window-size=${size}`, "--dump-dom", `${page}#check`]);
  const report = /CHECK (.*?) END/s.exec(dom);
  if (!report) throw new Error(`the #check report of ${page} never appeared — did the page script fail?`);
  if (report[1] !== "ok") throw new Error(`text does not fit: ${report[1]}`);
}

/** Screenshots each [hash, relative file] of one page into a folder, then drops stale files. */
function render(page, [w, h], shots, dir) {
  mkdirSync(join(HERE, dir), { recursive: true });
  const wanted = new Set();
  for (const [hash, rel] of shots) {
    const file = join(HERE, rel);
    wanted.add(file);
    chrome(["--virtual-time-budget=4000", `--window-size=${w},${h}`, `--screenshot=${file}`, `${page}#${hash}`]);
    const size = pngSize(readFileSync(file));
    if (size.width !== w || size.height !== h) throw new Error(`${rel} is ${size.width}x${size.height}, not ${w}x${h}`);
  }
  for (const f of readdirSync(join(HERE, dir))) {
    const full = join(HERE, dir, f);
    if (!wanted.has(full)) { unlinkSync(full); console.log(`removed stale ${dir}/${f}`); }
  }
  console.log(`rendered ${wanted.size} images into ${dir}/`);
}

function main() {
  const out = outputs();
  for (const [rel, text] of Object.entries(out)) writeFileSync(join(HERE, rel), text);
  console.log(`wrote ${Object.keys(out).join(", ")}`);
  if (process.argv.includes("--text")) return;

  const slides = pathToFileURL(join(HERE, "carrosseis.html")).href;
  check(slides, "1080,1350");
  const shots = carousels(POSTS).flatMap((p) => p.slides.map((_, i) => [`${p.id}-${i + 1}`, slideFile(p, i)]));
  render(slides, [1080, 1350], shots, "dezembro-2026");

  const pinsPage = pathToFileURL(join(HERE, "pins.html")).href;
  check(pinsPage, "1000,1500");
  const pins = readPins(join(HERE, "..", "..", "public"));
  render(pinsPage, [1000, 1500], pins.map((p) => [p.id, pinFile(p)]), "pins");

  // The Reels' cards are only checked here; compose_reels.mjs renders them next to the clips.
  check(pathToFileURL(join(HERE, "reels.html")).href, "1080,1920");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
