// L-45 — the social kit (assets-src/social/). Nothing here is served, but every file is
// something the owner posts by hand under the product's name, so the rules the site keeps are
// pinned here too: the generated files match their source, every slide exists at Instagram's
// 4:5 size, the month's calendar respects the owner's decisions (December, 2–3 posts a week,
// nothing on 24, 25 or 31), and the copy carries no emoji (U-31), no price and no competitor.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { POSTS, CTA, BRAND_LINE } from "../assets-src/social/dezembro-2026.mjs";
import { carousels, slideFile, captionText, weekday } from "../assets-src/social/social.mjs";
import { outputs, pngSize } from "../assets-src/social/build.mjs";
import { readPins, pinFile, pinCopy, PIN_ORDER } from "../assets-src/social/pins.mjs";
import { REELS, OUTRO, reelFile } from "../assets-src/social/reels.mjs";

const root = (rel) => new URL("../" + rel, import.meta.url);
const read = (rel) => readFileSync(root(rel), "utf8").replace(/\r\n/g, "\n");

/** Every string a post carries: title, slides, caption, hashtags. */
function texts(post) {
  const out = [post.title, ...post.caption, ...post.hashtags];
  for (const s of post.slides ?? []) {
    for (const k of ["kicker", "title", "body", "quote", "pro", "con", "note"]) if (s[k]) out.push(s[k]);
    for (const it of s.items ?? []) out.push(it);
  }
  return out;
}

test("carrosseis.html and dezembro-2026.md are exactly what build.mjs renders", () => {
  for (const [rel, text] of Object.entries(outputs())) {
    assert.equal(read("assets-src/social/" + rel), text,
      `assets-src/social/${rel} is stale — run: node assets-src/social/build.mjs`);
  }
});

test("every carousel slide is a 1080x1350 PNG on disk, and nothing else is in the folder", () => {
  const expected = new Set();
  for (const p of carousels(POSTS)) {
    p.slides.forEach((_, i) => {
      const rel = slideFile(p, i);
      expected.add(rel.split("/")[1]);
      const file = root("assets-src/social/" + rel);
      assert.ok(existsSync(file), `${rel} is missing — run: node assets-src/social/build.mjs`);
      assert.deepEqual(pngSize(readFileSync(file)), { width: 1080, height: 1350 }, rel);
    });
  }
  const onDisk = readdirSync(root("assets-src/social/dezembro-2026/"));
  assert.deepEqual(onDisk.sort(), [...expected].sort());
});

test("the calendar is December 2026, 2–3 posts a week, nothing on 24, 25 or 31", () => {
  const ids = new Set();
  const perWeek = new Map();
  for (const p of POSTS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.match(p.date, /^2026-12-\d\d$/, p.id);
    assert.ok(!["24", "25", "31"].includes(p.date.slice(8)), `${p.id} falls on ${p.date}`);
    const [y, m, d] = p.date.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const monday = new Date(dt - ((dt.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
    perWeek.set(monday, (perWeek.get(monday) ?? 0) + 1);
  }
  const sorted = POSTS.map((p) => p.date);
  assert.deepEqual(sorted, [...sorted].sort(), "posts are listed in date order");
  for (const [monday, n] of perWeek) assert.ok(n <= 3, `week of ${monday} has ${n} posts`);
  assert.ok(carousels(POSTS).length >= 8 && carousels(POSTS).length <= 12, "the card asks for 8–12 carousels");
  assert.equal(POSTS.filter((p) => p.kind === "reel").length, 4, "the card asks for 4 Reels");
  assert.equal(weekday("2026-12-01"), "terça");
});

test("a carousel opens on a cover, closes on a call to action, and fits Instagram's limit", () => {
  for (const p of carousels(POSTS)) {
    assert.equal(p.slides[0].type, "cover", p.id);
    assert.equal(p.slides.at(-1).type, "cta", p.id);
    assert.ok(CTA[p.slides.at(-1).cta], `${p.id}: unknown cta`);
    assert.ok(p.slides.length >= 3 && p.slides.length <= 10, `${p.id} has ${p.slides.length} slides`);
  }
});

test("no emoji, no price and no competitor anywhere in the kit (U-31, L-45)", () => {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
  const forbidden = [/R\$/, /\breais\b/i, /compartilhando a guarda/i, /ourfamilywizard/i, /2houses/i, /talkingparents/i, /\bcozi\b/i];
  const reelTexts = REELS.flatMap((r) => [r.intro.kicker, r.intro.title, ...r.beats.flatMap((b) => [b.text, b.screen])]);
  const pinTexts = readPins(fileURLToPath(new URL("../public/", import.meta.url)))
    .flatMap((p) => [p.title, p.lead, ...p.fits, ...Object.values(pinCopy(p))]);
  const all = [...POSTS.flatMap(texts), BRAND_LINE, ...Object.values(CTA).flatMap((c) => [c.line, c.action]),
    ...reelTexts, ...pinTexts, ...Object.values(OUTRO)];
  for (const t of all) {
    assert.doesNotMatch(t, emoji, `emoji in: ${t}`);
    for (const re of forbidden) assert.doesNotMatch(t, re, `forbidden in: ${t}`);
  }
});

test("captions fit Instagram, carry 3–5 plain hashtags, and legal topics carry the disclaimer", () => {
  for (const p of POSTS) {
    const caption = captionText(p);
    assert.ok(caption.length <= 2200, `${p.id} caption is ${caption.length} characters`);
    assert.ok(p.hashtags.length >= 3 && p.hashtags.length <= 5, `${p.id} has ${p.hashtags.length} hashtags`);
    for (const h of p.hashtags) assert.match(h, /^#[a-z]+$/, `${p.id}: ${h}`);
    const legal = texts(p).some((t) => /advogad|autoriza[cç]/i.test(t));
    if (legal) assert.ok(p.caption.some((c) => /não é aconselhamento jurídico/.test(c)), `${p.id} touches legal ground without the disclaimer`);
  }
});

test("every article a post points to exists on the site, in its extensionless form", () => {
  for (const p of POSTS.filter((x) => x.link)) {
    assert.match(p.link, /^\/blog\/[a-z0-9-]+$/, p.id);
    assert.ok(existsSync(root("public" + p.link + ".html")), `${p.id}: public${p.link}.html does not exist`);
  }
});

test("the PT home carries the Pinterest domain claim (L-45, profile entrelaresapp)", () => {
  // Pinterest reads the tag at the site's root when the owner clicks Verify; without it the
  // claim drops and the pins lose their site attribution. The value is public by design.
  assert.match(read("public/index.html"), /<meta name="p:domain_verify" content="a594c7f784fbf5a00c3eb0caf598ad5b" \/>/);
});

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

test("one 1000x1500 pin per routine page, and nothing else in pins/", () => {
  const pins = readPins(publicDir);
  assert.equal(pins.length, PIN_ORDER.length);
  for (const p of pins) {
    const file = root("assets-src/social/" + pinFile(p));
    assert.ok(existsSync(file), `${pinFile(p)} is missing — run: node assets-src/social/build.mjs`);
    assert.deepEqual(pngSize(readFileSync(file)), { width: 1000, height: 1500 }, pinFile(p));
    assert.equal(p.rows.length, 2);
    assert.ok(p.fits.length >= 1, `${p.slug}: no "para quem costuma funcionar" item`);
    const c = pinCopy(p);
    assert.ok(c.title.length <= 100, `${p.slug}: Pinterest title is ${c.title.length} characters`);
    assert.ok(c.description.length <= 500, `${p.slug}: Pinterest description is ${c.description.length} characters`);
    assert.ok(existsSync(root("public" + p.link + ".html")), `${p.slug}: its page does not exist`);
  }
  assert.deepEqual(readdirSync(root("assets-src/social/pins/")).sort(), pins.map((p) => pinFile(p).split("/")[1]).sort());
});

test("every Reel of the calendar has its video, and its beats match the recorder's seconds", () => {
  const reelPosts = POSTS.filter((p) => p.kind === "reel").map((p) => p.id).sort();
  assert.deepEqual(REELS.map((r) => r.id).sort(), reelPosts, "reels.mjs and the calendar name the same Reels");
  const recorder = read("assets-src/social/record_reels.py");
  for (const r of REELS) {
    const file = root("assets-src/social/" + reelFile(r, POSTS));
    assert.ok(existsSync(file), `${reelFile(r, POSTS)} is missing — run record_reels.py, then compose_reels.mjs`);
    assert.ok(readFileSync(file).length > 100_000, `${reelFile(r, POSTS)} looks empty`);
    // the recorder's block for this Reel: "rNN": dict(prep=[...], beats=[ (secs, [...]), ... ]),
    const start = recorder.indexOf(`"${r.id}": dict(`);
    assert.ok(start >= 0, `record_reels.py has no block for ${r.id}`);
    const end = recorder.indexOf("\n    ]),", start);
    const recorded = [...recorder.slice(start, end).matchAll(/^\s+\((\d+), \[/gm)].map((m) => Number(m[1]));
    assert.deepEqual(recorded, r.beats.map((b) => b.secs), `${r.id}: beat seconds differ between reels.mjs and record_reels.py`);
  }
});

test("both homes name the product's own profiles in the Organization sameAs (L-45)", () => {
  // Google ties a brand's profiles to its site through sameAs; a profile renamed or dropped
  // must leave this list in the same delivery, or the homes point at somebody else's page.
  const profiles = [
    "https://play.google.com/store/apps/details?id=com.entrelares.app",
    "https://www.instagram.com/app.entrelares/",
    "https://www.pinterest.com/entrelaresapp/",
    "https://www.youtube.com/@EntrelaresApp",
  ];
  for (const rel of ["public/index.html", "public/en/index.html"]) {
    const org = /"@type": "Organization",[\s\S]*?"sameAs": (\[.*?\])/.exec(read(rel));
    assert.ok(org, `${rel}: no Organization sameAs`);
    assert.deepEqual(JSON.parse(org[1]), profiles, rel);
  }
});
