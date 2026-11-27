// L-45 (PR 2) — Pinterest pins, one per routine page of L-43 (public/rotinas/).
//
// Nothing on a pin is typed here: the title, the lead sentence, the two-week grid, the three
// numbers and "para quem costuma funcionar" are READ from the page the pin links to, so a pin
// can never say something its page does not (S-15 — the pages were already checked against the
// app's wizard). Change a page, re-run build.mjs, and the pin follows; test/social.test.js fails
// while a committed pin disagrees with its page.
//
// A pin is 1000x1500 (Pinterest's 2:3). Pure functions only; build.mjs writes and renders.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decode = (s) => s
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"").replace(/&#39;/g, "'");

const text = (html) => decode(html.replace(/<span class="sr">.*?<\/span>/g, "").replace(/<[^>]+>/g, ""))
  .replace(/\s+/g, " ").trim();

/** Scheduling: Wednesdays and Fridays of the first three weeks, in the pages' own order. */
export const PIN_DATES = ["2026-12-02", "2026-12-04", "2026-12-09", "2026-12-11", "2026-12-16", "2026-12-18"];

/** The order pins go out in — the alternating weekends first, like the app's wizard menu. */
export const PIN_ORDER = [
  "fins-de-semana-alternados",
  "fins-de-semana-alternados-com-pernoite",
  "2-2-3",
  "5-2-2-5",
  "3-4-4-3",
  "1-1",
];

/** Reads one routine page into the facts a pin shows. Throws when the page changed shape. */
export function readRoutine(html, slug) {
  const h1 = /<h1[^>]*>(.*?)<\/h1>/s.exec(html);
  const desc = /<meta name="description" content="([^"]*)"/.exec(html);
  const grid = /<table class="grade"[^>]*>(.*?)<\/table>/s.exec(html);
  const fits = /Para quem costuma funcionar<\/h2>\s*<ul>(.*?)<\/ul>/s.exec(html);
  if (!h1 || !desc || !grid || !fits) throw new Error(`rotinas/${slug}.html changed shape`);
  const rows = [...grid[1].matchAll(/<tr><th scope="row">.*?<\/th>(.*?)<\/tr>/gs)].map((r) =>
    [...r[1].matchAll(/<td class="(r[12])( troca)?">/g)].map((c) => ({ who: c[1] === "r1" ? 1 : 2, change: !!c[2] })));
  if (rows.length !== 2 || rows.some((r) => r.length !== 7)) throw new Error(`rotinas/${slug}.html grid is not 2x7`);
  const numbers = [...html.matchAll(/<dt>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map((m) => ({ label: text(m[1]), value: text(m[2]) }));
  if (numbers.length !== 3) throw new Error(`rotinas/${slug}.html does not carry three numbers`);
  const fullTitle = text(h1[1]);
  return {
    slug,
    link: `/rotinas/${slug}`,
    title: fullTitle.split(":")[0].trim(),
    pageTitle: fullTitle,
    lead: decode(desc[1]).split(/(?<=\.)\s/)[0],
    rows,
    numbers,
    // every item the page lists; the pin page drops the last ones that do not fit (script below)
    fits: [...fits[1].matchAll(/<li>(.*?)<\/li>/gs)].map((m) => text(m[1]).replace(/[;.]$/, "")),
  };
}

/** Every pin, in PIN_ORDER, read from public/rotinas/. */
export function readPins(publicDir) {
  const onDisk = readdirSync(join(publicDir, "rotinas")).filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => f.slice(0, -5)).sort();
  if (JSON.stringify(onDisk) !== JSON.stringify([...PIN_ORDER].sort())) {
    throw new Error(`rotinas/ pages ${onDisk.join(", ")} differ from PIN_ORDER — add or drop a pin`);
  }
  return PIN_ORDER.map((slug, i) => ({
    ...readRoutine(readFileSync(join(publicDir, "rotinas", slug + ".html"), "utf8"), slug),
    id: `p${String(i + 1).padStart(2, "0")}`,
    date: PIN_DATES[i],
  }));
}

export const pinFile = (pin) => `pins/${pin.date}-${pin.slug}.png`;

/** What the owner pastes into Pinterest's title and description fields (100 / 500 characters). */
export function pinCopy(pin) {
  const title = `${pin.title}: o calendário de duas semanas`;
  const description = `${pin.lead} ${pin.numbers.map((n) => `${n.label}: ${n.value}.`).join(" ")} `
    + "Veja o calendário, para quem costuma funcionar e como montar no app Entrelares.";
  return { title, description, link: `https://entrelares.app${pin.link}` };
}

const DOW = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function pinsHtml(pins) {
  const sections = pins.map((p) => `<section class="pin" id="${p.id}" data-file="${pinFile(p)}">
  <p class="kicker">Rotina de guarda compartilhada</p>
  <h1>${esc(p.title).replace(/(\S*\d-\d\S*)/g, '<span class="nw">$1</span>')}</h1>
  <p class="lead">${esc(p.lead)}</p>
  <div class="grid">
    <p class="legend"><span><i class="sw r1"></i>Responsável 1</span><span><i class="sw r2"></i>Responsável 2</span><span><i class="dot"></i>dia de troca</span></p>
    <div class="row head"><b></b>${DOW.map((d) => `<b>${d}</b>`).join("")}</div>
${p.rows.map((r, k) => `    <div class="row"><b>Sem. ${k + 1}</b>${r.map((c) => `<span class="c r${c.who}${c.change ? " troca" : ""}">${c.who}</span>`).join("")}</div>`).join("\n")}
  </div>
  <dl>${p.numbers.map((n) => `<div><dt>${esc(n.label)}</dt><dd>${esc(n.value)}</dd></div>`).join("")}</dl>
  <div class="fits"><p class="h">Para quem costuma funcionar</p><ul>${p.fits.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
  <footer><img src="../brand-marca.png" alt="" /><span class="word">Entrelares</span><span class="site">entrelares.app${esc(p.link)}</span></footer>
</section>`);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Entrelares — pins do Pinterest, rotinas (L-45)</title>
<!--
  GENERATED by assets-src/social/build.mjs from public/rotinas/ (every fact on a pin is read
  from the page it links to). Do not edit by hand. NOT served: assets-src/.
  Open with #check to lay out every pin and list the ones whose content overflows.
-->
<style>
  @font-face { font-family: "Newsreader"; font-weight: 500 700; src: url("../../public/fonts/newsreader-latin.woff2") format("woff2"); }
  @font-face { font-family: "Inter"; font-weight: 400 600; src: url("../../public/fonts/inter-latin.woff2") format("woff2"); }
  :root { --bg: #FBF8F3; --tint: #ECEFFB; --rose-tint: #FDF2F8; --line: #E9E1D8; --ink: #2A1F33; --ink-soft: #4A3F53; --muted: #6B6072;
          --a: #2F57C9; --a-deep: #1F3F99; --b: #D83A6E; --b-deep: #9D174D; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1000px; font-family: "Inter", system-ui, sans-serif; color: var(--ink); background: var(--bg); }
  .pin { display: none; width: 1000px; height: 1500px; padding: 76px 72px 60px; flex-direction: column; gap: 28px; overflow: hidden; background: var(--bg); }
  .pin:target, body.check .pin { display: flex; }
  .kicker { font-size: 28px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--b); }
  h1 { font-family: "Newsreader", Georgia, serif; font-weight: 600; font-size: 72px; line-height: 1.05; letter-spacing: -.01em; margin-top: -14px; }
  .nw { white-space: nowrap; }
  .lead { font-size: 32px; line-height: 1.4; color: var(--ink-soft); }
  .grid { background: #fff; border: 2px solid var(--line); border-radius: 28px; padding: 30px 30px 34px; display: flex; flex-direction: column; gap: 12px; }
  .legend { display: flex; gap: 28px; font-size: 24px; color: var(--muted); margin-bottom: 8px; }
  .legend span { display: flex; align-items: center; gap: 10px; }
  .sw { width: 26px; height: 26px; border-radius: 7px; display: inline-block; }
  .sw.r1 { background: var(--tint); border: 3px solid var(--a); } .sw.r2 { background: var(--rose-tint); border: 3px dashed var(--b); }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--ink); display: inline-block; }
  .row { display: grid; grid-template-columns: 112px repeat(7, 1fr); gap: 10px; align-items: center; }
  .row b { font-size: 22px; font-weight: 600; color: var(--muted); }
  .row.head b { text-align: center; text-transform: uppercase; letter-spacing: .04em; }
  .row.head b:first-child { text-align: left; }
  .c { height: 84px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 700; position: relative; }
  .c.r1 { background: var(--tint); border: 3px solid var(--a); color: var(--a-deep); }
  .c.r2 { background: var(--rose-tint); border: 3px dashed var(--b); color: var(--b-deep); }
  .c.troca::after { content: ""; position: absolute; top: 9px; right: 9px; width: 13px; height: 13px; border-radius: 50%; background: var(--ink); }
  dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  dl div { background: var(--tint); border-radius: 20px; padding: 20px 22px; }
  dt { font-size: 22px; line-height: 1.3; color: var(--ink-soft); }
  dd { font-family: "Newsreader", Georgia, serif; font-weight: 600; font-size: 34px; line-height: 1.15; margin-top: 8px; }
  .fits { flex: 1; overflow: hidden; }
  .fits .h { font-size: 26px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--a); margin-bottom: 14px; }
  .fits ul { list-style: none; display: flex; flex-direction: column; gap: 14px; }
  .fits li { font-size: 29px; line-height: 1.36; color: var(--ink-soft); padding-left: 34px; position: relative; }
  .fits li::before { content: ""; position: absolute; left: 0; top: 13px; width: 16px; height: 16px; border-radius: 5px; background: var(--b); }
  footer { display: flex; align-items: center; gap: 16px; border-top: 2px solid var(--line); padding-top: 26px; }
  footer img { width: 56px; height: 56px; border-radius: 13px; }
  .word { font-family: "Newsreader", Georgia, serif; font-weight: 600; font-size: 36px; }
  .site { margin-left: auto; font-size: 22px; font-weight: 600; color: var(--a); text-align: right; }
  body.check .pin { margin-bottom: 20px; }
</style>
</head>
<body>
${sections.join("\n")}
<pre id="report"></pre>
<script>
  // A pin shows as many of its page's "para quem costuma funcionar" items as fit, in order,
  // never fewer than one; #check fails only when even the first one does not fit.
  function trim() {
    for (const f of document.querySelectorAll(".fits")) {
      const items = f.querySelectorAll("li");
      for (let i = items.length - 1; i > 0 && f.scrollHeight > f.clientHeight + 1; i--) items[i].remove();
    }
  }
  document.fonts.ready.then(trim);
  if (location.hash === "#check") {
    document.body.classList.add("check");
    document.fonts.ready.then(() => {
      trim();
      const bad = [];
      for (const s of document.querySelectorAll(".pin")) {
        if (s.scrollHeight > s.clientHeight + 1) bad.push(s.id + " overflows by " + (s.scrollHeight - s.clientHeight) + "px");
        const f = s.querySelector(".fits");
        if (f.scrollHeight > f.clientHeight + 1) bad.push(s.id + " list cut by " + (f.scrollHeight - f.clientHeight) + "px");
      }
      document.getElementById("report").textContent = "CHECK " + (bad.length ? bad.join("; ") : "ok") + " END";
    });
  }
</script>
</body>
</html>
`;
}

/** The Pinterest section of the owner's calendar. */
export function pinsMarkdown(pins, weekday) {
  const rows = pins.map((p) => `| ${p.date.slice(8, 10)}/12 | ${weekday(p.date)} | ${p.title} | \`${pinFile(p)}\` |`);
  const blocks = pins.map((p) => {
    const c = pinCopy(p);
    return `### ${p.date.slice(8, 10)}/12 (${weekday(p.date)}) · Pin · ${p.title}

Imagem: \`${pinFile(p)}\`

\`\`\`text
Título: ${c.title}
Link: ${c.link}
Descrição: ${c.description}
\`\`\``;
  });
  return `## Pinterest — um pin por rotina (perfil pinterest.com/entrelaresapp)

Cada pin leva para a página da própria rotina, de onde vêm todos os números e frases da arte.
Prancha sugerida: **Rotinas de guarda compartilhada**. Site reivindicado em 27/11/2026, então o
pin mostra o Entrelares como autor do link.

| Data | Dia | Rotina | Imagem |
|---|---|---|---|
${rows.join("\n")}

${blocks.join("\n\n")}
`;
}
