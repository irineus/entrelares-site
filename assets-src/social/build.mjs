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
import { slidesHtml, calendarMarkdown, carousels, slideFile } from "./social.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The two text outputs, relative to assets-src/social/ — what test/social.test.js compares. */
export function outputs() {
  return {
    "carrosseis.html": slidesHtml(POSTS, { cta: CTA, brandLine: BRAND_LINE }),
    "dezembro-2026.md": calendarMarkdown(POSTS, MONTH),
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

function main() {
  for (const [rel, text] of Object.entries(outputs())) writeFileSync(join(HERE, rel), text);
  console.log("wrote carrosseis.html, dezembro-2026.md");
  if (process.argv.includes("--text")) return;

  const page = pathToFileURL(join(HERE, "carrosseis.html")).href;
  const dom = chrome(["--virtual-time-budget=8000", "--window-size=1080,1350", "--dump-dom", `${page}#check`]);
  const report = /CHECK (.*?) END/s.exec(dom);
  if (!report) throw new Error("the #check report never appeared — did the page script fail?");
  if (report[1] !== "ok") throw new Error(`text does not fit: ${report[1]}`);

  const outDir = join(HERE, "dezembro-2026");
  mkdirSync(outDir, { recursive: true });
  const wanted = new Set();
  for (const p of carousels(POSTS)) {
    p.slides.forEach((_, i) => {
      const file = join(HERE, slideFile(p, i));
      wanted.add(file);
      chrome(["--virtual-time-budget=4000", "--window-size=1080,1350", `--screenshot=${file}`, `${page}#${p.id}-${i + 1}`]);
      const { width, height } = pngSize(readFileSync(file));
      if (width !== 1080 || height !== 1350) throw new Error(`${file} is ${width}x${height}, not 1080x1350`);
    });
  }
  for (const f of readdirSync(outDir)) {
    const full = join(outDir, f);
    if (!wanted.has(full)) { unlinkSync(full); console.log(`removed stale ${f}`); }
  }
  console.log(`rendered ${wanted.size} slides into dezembro-2026/`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
