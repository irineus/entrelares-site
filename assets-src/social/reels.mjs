// L-45 (PR 2) — the four December Reels: what each moment says, and the cards drawn around it.
//
// A Reel is 1080x1920: an opening card, then one CLIP per beat — a short screen recording of the
// real app (emulator, LOCAL Supabase stack, the T-97 demo family: Ana Martins, Bruno Costa, Lia)
// framed under that beat's sentence — and a closing card. record_reels.py records the clips (one
// per beat, in this order); compose_reels.mjs turns each clip into 30 fps (the emulator records
// only when the screen changes, so a file's own duration means nothing), holds its last frame, and
// lays it under its own sentence for exactly `secs` (from `from` seconds into the clip, when the
// clip opens on something that is not the app — the launcher, in r01) — the same seconds record_reels.py records
// (test/social.test.js compares the two files), so a caption can never drift from its picture.
//
// Every sentence is a claim about the app (S-15), checked against its code on 27/11/2026:
// the Hoje card names who has the child today; both caregivers read the same calendar; a festive
// day is an ordinary calendar day (no holiday mode); "Selecionar vários dias" + "Trocar" opens one
// request per day for the other caregiver to approve; a day with a pending request is frozen
// (enforce_day_protection); a handoff time shows in the month cell and in the day sheet; the
// Histórico (activity_logs, append-only, written by trigger) keeps every request and answer with
// date and author. No emoji (U-31), no price.

export const REELS = [
  {
    id: "r01",
    slug: "quem-fica-hoje",
    intro: { kicker: "Guarda compartilhada", title: "Quem fica com a criança hoje?" },
    beats: [
      { secs: 5, from: 1.4, screen: "O app abre no calendário; o cartão do topo diz quem é o responsável hoje.", text: "A resposta aparece assim que o app abre." },
      { secs: 4, screen: "Passa para dezembro.", text: "Os dois responsáveis veem o mesmo calendário." },
      { secs: 5, screen: "Toca no dia 24.", text: "O dia 24 é um dia do calendário como os outros." },
    ],
    outro: "app",
  },
  {
    id: "r02",
    slug: "trocar-24-pelo-31",
    intro: { kicker: "Festas de fim de ano", title: "Trocar o 24 pelo 31, sem conversa perdida" },
    beats: [
      { secs: 4, screen: "Dezembro: o 24 é do Bruno e o 31 é da Ana.", text: "O 24 está com o Bruno; o 31, com a Ana." },
      { secs: 6, screen: "Menu, Selecionar vários dias, toca no 24 e no 31.", text: "A Ana seleciona um dia de cada um." },
      { secs: 5, screen: "Toca em Trocar: a folha mostra quem assume cada dia.", text: "O app propõe a troca de uma vez, com um pedido por dia." },
      { secs: 7, screen: "Confirma a troca.", text: "Até o Bruno responder, os dois dias ficam congelados." },
      { secs: 6, screen: "O Bruno aprova os dois pedidos; o calendário da Ana se atualiza.", text: "Quando ele aprova, o calendário muda para os dois." },
    ],
    outro: "app",
  },
  {
    id: "r03",
    slug: "horario-da-entrega",
    intro: { kicker: "Festas de fim de ano", title: "“Dia 25 às 11h” é mais honesto do que “de manhã cedo”" },
    beats: [
      { secs: 5, screen: "Passa para dezembro: os dias de transição mostram 18:00 na célula.", text: "Nos dias de troca de casa, o horário da entrega fica no calendário." },
      { secs: 5, screen: "Toca no dia 28: a folha do dia mostra Entrega às 18:00.", text: "E dentro do dia, o mesmo horário para os dois." },
    ],
    outro: "app",
  },
  {
    id: "r04",
    slug: "tudo-no-historico",
    intro: { kicker: "Depois das festas", title: "Quem trocou o quê? Está no histórico" },
    beats: [
      { secs: 4, screen: "Abre Relatórios.", text: "Em Relatórios, o Histórico guarda cada pedido e cada resposta." },
      { secs: 6, screen: "Toca em Histórico: a troca do 24 pelo 31, pedida e aprovada.", text: "Com data e autor, e ninguém o reescreve depois." },
    ],
    outro: "app",
  },
];

/** Seconds of the opening and closing cards. */
export const CARD_SECS = { intro: 2.5, outro: 3 };

export const OUTRO = { title: "Entrelares", line: "O calendário da guarda compartilhada", action: "Crie a conta grátis: link na bio" };

/** Final MP4 of a Reel, relative to assets-src/social/. */
export const reelFile = (reel, posts) => {
  const post = posts.find((p) => p.id === reel.id);
  return `reels/${post.date}-${reel.slug}.mp4`;
};

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Geometry shared with compose_reels.mjs: where the phone recording sits on the card. */
export const PHONE = { x: 228, y: 560, width: 624, height: 1300, crop: { top: 80, height: 2250 } };

/**
 * The cards: #<id>-intro and #<id>-outro are opaque; #<id>-b<n> is the beat's frame — caption on
 * top and a TRANSPARENT rounded window where the recording shows through (rendered with a
 * transparent page background).
 */
export function reelsHtml(reels) {
  const cards = [];
  for (const r of reels) {
    cards.push(`<section class="card intro" id="${r.id}-intro"><p class="kicker">${esc(r.intro.kicker)}</p><h1>${esc(r.intro.title)}</h1><div class="strip">${"abbaaab".split("").map((h) => `<i class="${h}"></i>`).join("")}</div><footer><img src="../brand-marca.png" alt="" /><span>Entrelares</span></footer></section>`);
    r.beats.forEach((b, i) => {
      cards.push(`<section class="card beat" id="${r.id}-b${i + 1}"><div class="top"><p class="cap">${esc(b.text)}</p></div><div class="side l"></div><div class="side r"></div><div class="bottom"><img src="../brand-marca.png" alt="" /><span>entrelares.app</span></div><div class="window"></div></section>`);
    });
    cards.push(`<section class="card outro" id="${r.id}-outro"><img class="mark" src="../brand-marca.png" alt="" /><h1>${esc(OUTRO.title)}</h1><p class="line">${esc(OUTRO.line)}</p><p class="action">${esc(OUTRO.action)}</p></section>`);
  }
  const P = PHONE;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Entrelares — cartões dos Reels de dezembro (L-45)</title>
<!--
  GENERATED by assets-src/social/build.mjs from reels.mjs. Do not edit by hand. NOT served.
  compose_reels.mjs screenshots each card (beat frames with a transparent page background) and
  lays the recordings under them with ffmpeg. #check lists captions that do not fit.
-->
<style>
  @font-face { font-family: "Newsreader"; font-weight: 500 700; src: url("../../public/fonts/newsreader-latin.woff2") format("woff2"); }
  @font-face { font-family: "Inter"; font-weight: 400 600; src: url("../../public/fonts/inter-latin.woff2") format("woff2"); }
  :root { --bg: #FBF8F3; --ink: #2A1F33; --ink-soft: #4A3F53; --muted: #6B6072; --a: #2F57C9; --b: #D83A6E; --accent: #F2A33A; --accent-ink: #5A3A00; --deep: #2A1F33; --deep-ink: #FBF8F3; --deep-soft: #CFC6D6; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: transparent; }
  body { width: 1080px; font-family: "Inter", system-ui, sans-serif; color: var(--ink); }
  .card { display: none; width: 1080px; height: 1920px; position: relative; overflow: hidden; }
  .card:target, body.check .card { display: block; }
  .intro { background: var(--bg); padding: 300px 96px 120px; }
  .intro .kicker { font-size: 44px; font-weight: 600; color: var(--b); }
  .intro h1 { font-family: "Newsreader", Georgia, serif; font-weight: 600; font-size: 118px; line-height: 1.04; letter-spacing: -.01em; margin-top: 36px; }
  .strip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 16px; width: 760px; margin-top: 90px; }
  .strip i { height: 90px; border-radius: 20px; } .strip i.a { background: var(--a); } .strip i.b { background: var(--b); }
  .intro footer { position: absolute; left: 96px; bottom: 120px; display: flex; align-items: center; gap: 22px; font-family: "Newsreader", Georgia, serif; font-weight: 600; font-size: 52px; }
  .intro footer img, .beat .bottom img { width: 84px; height: 84px; border-radius: 20px; }
  .beat .top { position: absolute; left: 0; top: 0; width: 1080px; height: ${P.y}px; background: var(--bg); padding: 150px 80px 0; }
  .beat .cap { font-family: "Newsreader", Georgia, serif; font-weight: 600; font-size: 70px; line-height: 1.12; letter-spacing: -.01em; }
  .beat .side { position: absolute; top: ${P.y}px; height: ${P.height}px; background: var(--bg); }
  .beat .side.l { left: 0; width: ${P.x}px; } .beat .side.r { left: ${P.x + P.width}px; width: ${1080 - P.x - P.width}px; }
  .beat .bottom { position: absolute; left: 0; top: ${P.y + P.height}px; width: 1080px; height: ${1920 - P.y - P.height}px; background: var(--bg); display: flex; align-items: center; justify-content: center; gap: 18px; font-size: 34px; font-weight: 600; color: var(--muted); }
  .beat .bottom img { width: 52px; height: 52px; border-radius: 12px; }
  /* the rounded window: its corners are painted from outside by a big cream shadow */
  .beat .window { position: absolute; left: ${P.x}px; top: ${P.y}px; width: ${P.width}px; height: ${P.height}px; border-radius: 44px; box-shadow: 0 0 0 60px var(--bg), inset 0 0 0 4px rgba(42, 31, 51, .12); }
  .outro { background: var(--deep); color: var(--deep-ink); padding: 520px 96px 0; }
  .outro .mark { width: 150px; height: 150px; border-radius: 34px; }
  .outro h1 { font-family: "Newsreader", Georgia, serif; font-weight: 600; font-size: 130px; margin-top: 50px; }
  .outro .line { font-size: 50px; color: var(--deep-soft); margin-top: 24px; line-height: 1.3; }
  .outro .action { display: inline-block; margin-top: 90px; font-size: 54px; font-weight: 600; background: var(--accent); color: var(--accent-ink); padding: 34px 56px; border-radius: 999px; }
  body.check .card { margin-bottom: 20px; }
</style>
</head>
<body>
${cards.join("\n")}
<pre id="report"></pre>
<script>
  if (location.hash === "#check") {
    document.body.classList.add("check");
    document.fonts.ready.then(() => {
      const bad = [];
      for (const t of document.querySelectorAll(".beat .top")) {
        if (t.querySelector(".cap").getBoundingClientRect().bottom > t.getBoundingClientRect().bottom - 24) bad.push(t.parentElement.id + " caption too long");
      }
      for (const c of document.querySelectorAll(".intro")) {
        if (c.querySelector("h1").getBoundingClientRect().bottom > c.querySelector(".strip").getBoundingClientRect().top - 30) bad.push(c.id + " title too long");
      }
      document.getElementById("report").textContent = "CHECK " + (bad.length ? bad.join("; ") : "ok") + " END";
    });
  }
</script>
</body>
</html>
`;
}

/** The Reels' scripts for the owner's calendar: what is on screen and what is written, per beat. */
export function reelsMarkdown(reels, posts, weekday) {
  return `## Reels — roteiros (vídeos em \`reels/\`)

Gravados no emulador contra a stack LOCAL do app (nunca dev nem produção), com a família demo do
T-97 (Ana Martins, Bruno Costa e a filha Lia). Vertical 1080x1920, sem áudio: escolha a música no
próprio Instagram ao publicar. A legenda de cada Reel está no calendário acima.

${reels.map((r) => {
    const post = posts.find((p) => p.id === r.id);
    return `### ${post.date.slice(8, 10)}/12 (${weekday(post.date)}) · ${post.title}

Arquivo: \`${reelFile(r, posts)}\`

| Momento | Na tela | Texto |
|---|---|---|
| Abertura | Cartão | ${r.intro.title} |
${r.beats.map((b, i) => `| ${i + 1} | ${b.screen} | ${b.text} |`).join("\n")}
| Fecho | Cartão | ${OUTRO.title} · ${OUTRO.action} |`;
  }).join("\n\n")}
`;
}
