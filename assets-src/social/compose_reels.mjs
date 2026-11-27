#!/usr/bin/env node
// L-45 (PR 2) — assembles the Reels from the clips record_reels.py recorded:
//
//   node assets-src/social/compose_reels.mjs <clips-dir> [r01 r02 ...]
//
// For each Reel: the opening card, then every beat (its clip turned into 30 fps with the last
// frame held to the beat's `secs`, the status and navigation bars cropped off, scaled into the
// phone window of the beat's card), then the closing card — concatenated into
// reels/<date>-<slug>.mp4 (1080x1920, H.264, no audio: the owner picks the music in Instagram).
// The cards are screenshots of reels.html (run build.mjs first); the beat frames are taken with
// a transparent page background, so the recording shows through their window.
// Needs ffmpeg on PATH (or FFMPEG=...) and the Chrome the other generators use (or CHROME=...).

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { REELS, PHONE, CARD_SECS, reelFile } from "./reels.mjs";
import { POSTS } from "./dezembro-2026.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const FFMPEG = process.env.FFMPEG || "ffmpeg";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status}): ${r.stderr}`);
}

function card(hash, file, transparent) {
  run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--virtual-time-budget=4000", "--window-size=1080,1920",
    ...(transparent ? ["--default-background-color=00000000"] : []),
    `--screenshot=${file}`, `${pathToFileURL(join(HERE, "reels.html")).href}#${hash}`]);
}

const ENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-an"];

function still(png, secs, out) {
  run(FFMPEG, ["-y", "-v", "error", "-loop", "1", "-i", png, "-t", String(secs), "-vf", "fps=30,format=yuv420p", ...ENC, out]);
}

function beat(clip, frame, secs, from, out) {
  const { x, y, width, height, crop } = PHONE;
  const graph = [
    `[0:v]fps=30,tpad=stop_mode=clone:stop_duration=${secs + from + 2},trim=start=${from}:duration=${secs},setpts=PTS-STARTPTS,`
      + `crop=1080:${crop.height}:0:${crop.top},scale=${width}:${height}[v]`,
    `color=c=0xFBF8F3:s=1080x1920:r=30:d=${secs}[bg]`,
    `[bg][v]overlay=${x}:${y}[b]`,
    "[1:v]format=rgba[f]",
    "[b][f]overlay=0:0:shortest=1,format=yuv420p",
  ].join(";");
  run(FFMPEG, ["-y", "-v", "error", "-i", clip, "-loop", "1", "-i", frame, "-filter_complex", graph, "-t", String(secs), ...ENC, out]);
}

const clips = process.argv[2];
if (!clips) throw new Error("usage: node compose_reels.mjs <clips-dir> [r01 ...]");
const only = process.argv.slice(3);
const work = join(tmpdir(), "l45-reels");
mkdirSync(work, { recursive: true });
mkdirSync(join(HERE, "reels"), { recursive: true });

for (const reel of REELS.filter((r) => !only.length || only.includes(r.id))) {
  const parts = [];
  card(`${reel.id}-intro`, join(work, `${reel.id}-intro.png`), false);
  still(join(work, `${reel.id}-intro.png`), CARD_SECS.intro, join(work, `${reel.id}-0.mp4`));
  parts.push(`${reel.id}-0.mp4`);
  reel.beats.forEach((b, i) => {
    const clip = join(clips, `${reel.id}-b${i + 1}.mp4`);
    if (!existsSync(clip)) throw new Error(`missing clip ${clip} — run record_reels.py`);
    const frame = join(work, `${reel.id}-b${i + 1}.png`);
    card(`${reel.id}-b${i + 1}`, frame, true);
    beat(clip, frame, b.secs, b.from ?? 0, join(work, `${reel.id}-${i + 1}.mp4`));
    parts.push(`${reel.id}-${i + 1}.mp4`);
  });
  card(`${reel.id}-outro`, join(work, `${reel.id}-outro.png`), false);
  still(join(work, `${reel.id}-outro.png`), CARD_SECS.outro, join(work, `${reel.id}-9.mp4`));
  parts.push(`${reel.id}-9.mp4`);

  const list = join(work, `${reel.id}.txt`);
  writeFileSync(list, parts.map((p) => `file '${join(work, p).replace(/\\/g, "/")}'`).join("\n") + "\n");
  const out = join(HERE, reelFile(reel, POSTS));
  run(FFMPEG, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, ...ENC, "-movflags", "+faststart", out]);
  console.log(`wrote ${reelFile(reel, POSTS)}`);
}
