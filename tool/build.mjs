#!/usr/bin/env node
// L-50 — the landing's static generator: the two homes come out of src/site/, not out of a hand.
//
//   node tool/build.mjs            writes public/index.html and public/en/index.html
//   node tool/build.mjs --check    renders to memory and exits 1 if public/ differs
//
// Zero dependencies, like the other tools here. Sources live in src/site/home/:
//
//   template.html             ONE body for the two homes, with {{KEY}} placeholders
//   home.css                  the homes' inline <style>, with {{HEADER_CSS}} for the header block
//   pt.json, en.json          every string and list the template needs (TOUR, MODULES, ROLES,
//                             S_PICS…) — the two files carry the SAME keys (test/build.test.js)
//   partials/<lang>/          blocks kept verbatim because a test pins them or they are long prose:
//                             head.html (everything before <style>), header.css + header.html
//                             (test/menu.test.js), demo.html + demo-script.html (L-17), pricing.html
//                             (data-param, L-34), faq.html, letter.html (the founder's letter),
//                             materiais.html (PT only)
//
// The output is COMMITTED: the deploy still publishes exactly what is in public/, and every other
// test still reads public/. test/build.test.js fails when a source changed and public/ was not
// regenerated — "edit src/site/, run the build, commit both" is the whole workflow. Partials are
// the escape hatch, not a place to hide copy that belongs in the json.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "src", "site");
const PUBLIC = join(ROOT, "public");
// Sources are read LF whatever the checkout wrote (core.autocrlf on Windows), so the output is LF.
const rd = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

export function render(tpl, data) {
  const out = tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => {
    if (!(k in data)) throw new Error(`template needs {{${k}}} and the data has no such key`);
    return data[k];
  });
  const left = out.match(/\{\{[A-Z0-9_]+\}\}/);
  if (left) throw new Error(`unrendered placeholder ${left[0]}`);
  return out;
}

// One <picture> per screenshot, in the exact shape test/perf.test.js pins (540/720 WebP + 1080,
// one `sizes`, PNG fallback, lazy). Paths are relative on the PT home and absolute on /en/.
export function pic(lang, name, alt) {
  const base = `${lang === "pt" ? "" : "/"}img/screenshots/${lang === "pt" ? "" : "en/"}${name}`;
  const sizes = "(max-width: 860px) 230px, 230px";
  return `<picture>\n<source srcset="${base}-540.webp 540w, ${base}-720.webp 720w, ${base}.webp 1080w" sizes="${sizes}" type="image/webp" />\n<img src="${base}.png" width="1080" height="1920" alt="${alt}" loading="lazy" decoding="async" />\n</picture>`;
}

const ICO = {
  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M9 15l2 2 4-4"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M16 15h2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  phone: '<svg class="h-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/></svg>',
  share: '<svg class="h-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.2v10.6"/><path d="M8.4 6.8 12 3.2l3.6 3.6"/><path d="M7.6 10.4H5.6A1.6 1.6 0 0 0 4 12v7.2a1.6 1.6 0 0 0 1.6 1.6h12.8a1.6 1.6 0 0 0 1.6-1.6V12a1.6 1.6 0 0 0-1.6-1.6h-2"/></svg>',
};

// The two houses of the CSS-3D scene: five faces, a two-slope roof, two gables, door and windows.
const house = (c, x, y) => `<div class="box" style="--w:120px;--d:100px;--h:70px;--c1:${c[0]};--c2:${c[1]};--c3:${c[2]};--c4:${c[3]};--c5:${c[4]};--r:78px;left:${x}px;top:${y}px">
                    <i class="back"></i><i class="left"></i><i class="right"></i><i class="front"><span class="door"></span><span class="win" style="left:18px;top:14px"></span><span class="win" style="right:18px;top:14px"></span></i><i class="top"></i>
                    <div class="roof"><i class="ra"></i><i class="rb"></i></div><div class="gable gf"></div><div class="gable gb"></div>
                </div>`;
const HOUSE_A = house(["#5C8BF5", "#3F6FD8", "#9DB8FF", "#2F4FA8", "#1E3C86"], 40, 40);
const HOUSE_B = house(["#F06A98", "#D4467A", "#FFB3CB", "#B2305C", "#8E2149"], 300, 320);

const BRAND_TAIL = `    <!-- Brand tokens + self-hosted fonts (phase 0, 07/10/2026). Linked AFTER the inline
         <style> on purpose: its :root wins over this page's copy of the tokens. -->
    <link rel="preload" href="/fonts/newsreader-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/css/brand.css" />
</head>`;

export function buildHome(lang) {
  const H = join(SRC, "home");
  const P = join(H, "partials", lang);
  const data = JSON.parse(rd(join(H, `${lang}.json`)));
  const part = (name) => (existsSync(join(P, name)) ? rd(join(P, name)) : "");
  const d = { ...data };
  delete d.TOUR; delete d.MODULES; delete d.ROLES; delete d.S_PICS;
  d.HEADER = part("header.html");
  d.HOUSE_A_HTML = HOUSE_A;
  d.HOUSE_B_HTML = HOUSE_B;
  d.ICO_PHONE = ICO.phone;
  d.ICO_SHARE = ICO.share;
  data.S_PICS.forEach((s, i) => { d[`S${i + 1}_PIC`] = pic(lang, s.shot, s.alt); });
  d.DEMO_SECTION = part("demo.html");
  d.PRICING_SECTION = part("pricing.html");
  d.FAQ_SECTION = part("faq.html");
  d.MATERIAIS_SECTION = part("materiais.html");
  d.DEMO_SCRIPT = part("demo-script.html");
  d.MATERIAIS_SCRIPT = lang === "pt" ? '<script defer src="/js/materiais.js"></script>' : "";
  d.ROLES = data.ROLES.map((r) => `            <li>${r}</li>`).join("\n");
  d.TABS = data.TOUR.map((t, i) =>
    `            <button type="button" class="tab" role="tab" id="tab-${t.key}" aria-controls="pane-${t.key}" aria-selected="${i === 0 ? "true" : "false"}" tabindex="${i === 0 ? "0" : "-1"}" data-key="${t.key}">${t.label}</button>`).join("\n");
  d.PANES = data.TOUR.map((t, i) =>
    `        <div class="pane${i === 0 ? " on" : ""}" id="pane-${t.key}" role="tabpanel" aria-labelledby="tab-${t.key}"><div><span class="tag${t.cls ? " " + t.cls : ""}">${t.tag}</span><h3>${t.h}</h3><p>${t.p}</p></div><div class="shot3d">${pic(lang, t.shot, t.alt)}</div></div>`).join("\n");
  d.MODULES = data.MODULES.map((m) =>
    `                <li>${ICO[m.icon]}<span class="module-tag">${m.tag}</span><b>${m.h}</b><p>${m.p}</p></li>`).join("\n");
  d.LETTER = part("letter.html");
  const css = render(rd(join(H, "home.css")), { HEADER_CSS: part("header.css") });
  const body = render(rd(join(H, "template.html")), d);
  return part("head.html") + "    <style>" + css + "    </style>\n" + BRAND_TAIL + "\n" + body;
}

export function outputs() {
  return { "index.html": buildHome("pt"), "en/index.html": buildHome("en") };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes("--check");
  let dirty = 0;
  for (const [rel, html] of Object.entries(outputs())) {
    const target = join(PUBLIC, rel);
    const current = existsSync(target) ? rd(target) : null;
    if (current === html) { console.log(`= ${rel}`); continue; }
    dirty++;
    if (check) console.log(`! ${rel} differs from the generator's output`);
    else { writeFileSync(target, html, "utf8"); console.log(`w ${rel}`); }
  }
  if (check && dirty) { console.error(`\n${dirty} file(s) out of date — run: node tool/build.mjs`); process.exit(1); }
}
