#!/usr/bin/env node
// The lead-magnet PDF's source, generated from the generator's engine (07/10/2026).
//
//   node assets-src/modelos-rotina.mjs        writes assets-src/modelos-rotina.html
//   "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu \
//     --no-pdf-header-footer --print-to-pdf=public/downloads/modelos-rotina-guarda-compartilhada.pdf \
//     file:///<repo>/assets-src/modelos-rotina.html
//
// The seven models are PRESET_IDS of public/js/gerador-rotina.js — the mirror of the app's
// rotation wizard — in the app's own order, and every two-week strip and every number of the
// comparison table is walked by `buildSchedule`, never typed: a preset that changes in the app
// changes here on the next run. The alternating-weekend presets open on a Friday, like the
// wizard (`anchorStart`); the strips show Monday-based weeks, so week 1 carries the first
// weekend. The PDF's /Title comes from <title>, so it opens with a proper name (CLAUDE.md).
//
// Layout (A4, three pages): cover + 2 models; 3 models + the comparison table; 2 models + the
// holidays box + the CTA. Three models under the cover band, the table under the cover band, or
// the table after two models on page 3, overflow the page — checked with a screenshot of the HTML at 794 px (07/10/2026).

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRESET_IDS, buildSchedule, anchorStart } from "../public/js/gerador-rotina.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONDAY = new Date(2026, 1, 2); // any Monday: the strips are weekday-relative

const COPY = {
  "3-11": {
    title: "Fins de semana alternados", tag: "sex–dom · casa-base", short: "Fins de semana alternados",
    who: "A criança mora a semana com um responsável e passa um fim de semana sim, outro não, com o outro — da saída da escola de sexta até o domingo à noite.",
    pros: ["Rotina escolar estável, numa casa só.", "Só duas trocas a cada duas semanas."],
    cons: ["Até onze dias sem dormir na outra casa.", "Convivência desigual entre os responsáveis."],
    note: "<b>No app e no gerador</b>, o modelo começa numa sexta-feira. Um jantar ou uma chamada no meio da semana encurta a ausência.",
  },
  "3-2-1-6-1-1": {
    title: "Fins de semana alternados + pernoite de quarta", tag: "casa-base", short: "FDS alternados + pernoite de quarta",
    who: "A mesma base, com uma noite fixa toda quarta-feira na casa do responsável do fim de semana — a criança vai para a escola de lá na quinta.",
    pros: ["A maior ausência cai de onze para seis dias.", "Uma noite previsível toda semana, no mesmo dia."],
    cons: ["Seis trocas a cada duas semanas.", "Pede as duas casas perto da escola."],
  },
  "7-7": {
    title: "Semana alternada", tag: "7/7", short: "Semana alternada (7/7)",
    who: "Uma semana inteira com cada responsável, com uma troca por semana, sempre no mesmo dia. Simples e previsível — o modelo mais usado quando o tempo se divide ao meio.",
    pros: ["Poucas trocas de casa; rotina estável.", "Fácil de combinar com a escola."],
    cons: ["Uma semana longe do outro responsável.", "Menos indicado para crianças bem pequenas."],
  },
  "14-14": {
    title: "Quinzenal", tag: "14/14", short: "Quinzenal (14/14)",
    who: "Duas semanas seguidas com cada responsável. Indicado quando as casas ficam distantes ou para crianças maiores e adolescentes.",
    pros: ["Metade das trocas da semana alternada.", "Tolera distância entre as casas."],
    cons: ["Até duas semanas sem ver o outro responsável.", "Exige boa comunicação sobre escola e saúde."],
    rows: [["Semanas 1 e 2 · Responsável A", 0], ["Semanas 3 e 4 · Responsável B", 14]],
    days: "14 e 14 (ciclo de 4 sem.)",
  },
  "1-1": {
    title: "Dia sim, dia não", tag: "1/1 · fases específicas", short: "Dia sim, dia não (1/1)",
    who: "A criança troca de casa todos os dias. Raro como rotina permanente; aparece em fases de adaptação, com casas vizinhas, ou nas férias.",
    pros: ["Nunca mais de um dia longe de cada um.", "Fácil de montar e de explicar."],
    cons: ["Quatorze trocas a cada duas semanas.", "Difícil de sustentar com escola e trabalho."],
  },
  "5-2-2-5": {
    title: "Rotação 5-2-2-5", tag: "dias fixos", short: "Rotação 5-2-2-5",
    who: "Cada responsável tem sempre os mesmos dois dias de semana; o fim de semana longo, de sexta a domingo, se reveza — e o tempo fecha em metade para cada um.",
    pros: ["Dias de semana previsíveis para a escola.", "Divisão equilibrada dos fins de semana."],
    cons: ["Um pouco mais complexo de explicar no começo.", "Ainda exige casas relativamente próximas."],
    note: "<b>Dias fixos:</b> Seg/Ter sempre com A, Qua/Qui sempre com B — fácil de memorizar. Só os dias de Sex a Dom giram entre as semanas.",
  },
  "2-2-3": {
    title: "Rotação 2-2-3", tag: "crianças pequenas", short: "Rotação 2-2-3",
    who: "Blocos curtos que se invertem a cada semana. A criança nunca fica mais de três dias longe de nenhum dos dois.",
    pros: ["Contato frequente com os dois responsáveis.", "Ótimo para crianças pequenas."],
    cons: ["Seis trocas de casa a cada duas semanas.", "Pede casas próximas e rotina bem alinhada."],
  },
};

// A plan long enough for strips and numbers; `base` is where the Monday-based strip starts —
// one full cycle after the Friday anchor for the weekend presets, so week 1 carries a weekend.
function planOf(id) {
  const start = anchorStart(id, MONDAY);
  const skip = Math.round((MONDAY - start) / 864e5);
  const base = skip ? skip + 14 : 0;
  return { plan: buildSchedule({ preset: id, start, days: base + 28 }), base };
}

function strip(id) {
  const { plan, base } = planOf(id);
  const rows = COPY[id].rows ?? [["Semana 1", 0], ["Semana 2", 7]];
  return rows.map(([label, off]) =>
    `<div class="wk">${label}</div>\n        ` +
    plan.slice(base + off, base + off + 7).map((d, i) => {
      const ab = d.parent === 0 ? "a" : "b";
      return `<div class="cell c-${ab}"><small>${DOW[i]}</small>${ab.toUpperCase()}</div>`;
    }).join("")).join("\n        ");
}

function model(id) {
  const c = COPY[id];
  return `    <div class="model">
      <h2>${c.title} <span class="tag">${c.tag}</span></h2>
      <div class="who">${c.who}</div>
      <div class="strip">
        ${strip(id)}
      </div>${c.note ? `\n      <div class="note">${c.note}</div>` : ""}
      <div class="pros">
        <div class="p">${c.pros[0]}</div>
        <div class="c">${c.cons[0]}</div>
        <div class="p">${c.pros[1]}</div>
        <div class="c">${c.cons[1]}</div>
      </div>
    </div>`;
}

function tableRow(id) {
  const { plan, base } = planOf(id);
  const two = plan.slice(base, base + 14);
  const dA = two.filter((d) => d.parent === 0).length;
  const swaps = two.filter((d, i) => i > 0 && d.parent !== two[i - 1].parent).length + (two[13].parent !== plan[base + 14].parent ? 1 : 0);
  let longest = 0, run = 0, cur = plan[0].parent;
  for (const d of plan) { if (d.parent === cur) run++; else { longest = Math.max(longest, run); cur = d.parent; run = 1; } }
  longest = Math.max(longest, run);
  const days = COPY[id].days ?? `${dA} e ${14 - dA}`;
  return `<tr><td>${COPY[id].short}</td><td>${days}</td><td>${swaps}</td><td>${longest} dia${longest > 1 ? "s" : ""}</td></tr>`;
}

const ids = PRESET_IDS;
const PAGES = [ids.slice(0, 2), ids.slice(2, 5), ids.slice(5)];
const TOTAL = PAGES.length;
const foot = (n) => `  <div class="foot">
    <span>entrelares.app</span>
    <span>Modelos de rotina de guarda compartilhada · pág. ${n} de ${TOTAL}</span>
  </div>`;
const TABLE = `    <table class="compare">
      <tr><th>Rotina</th><th>Dias em cada casa (2 sem.)</th><th>Trocas (2 sem.)</th><th>Maior tempo longe de uma casa</th></tr>
      ${ids.map(tableRow).join("\n      ")}
    </table>`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Modelos de rotina de guarda compartilhada</title>
<meta name="author" content="Entrelares" />
<meta name="subject" content="Guia de modelos de rotina de convivência para guarda compartilhada" />
<!-- GENERATED by assets-src/modelos-rotina.mjs from public/js/gerador-rotina.js — edit the script, not this file. -->
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  :root {
    --ink: #1e293b; --muted: #64748b; --indigo: #4f46e5; --indigo-deep: #3730a3;
    --rose: #db2777; --navy: #03173d; --bg: #f8fafc; --bg-tint: #eef2ff;
    --line: #e2e8f0; --a: #4f46e5; --a-soft: #e0e7ff; --b: #db2777; --b-soft: #fce7f3;
  }
  @page { size: A4; margin: 0; }
  html, body { font-family: "Liberation Sans", "DejaVu Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); line-height: 1.5; }
  .page { width: 210mm; height: 297mm; overflow: hidden; padding: 0; position: relative; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .band { background: linear-gradient(120deg, var(--navy) 0%, #12235c 55%, var(--indigo-deep) 100%); color: #fff; padding: 20px 22mm 22px; }
  .brand { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 14px; letter-spacing: .01em; opacity: .92; }
  .brand .dot { width: 20px; height: 20px; border-radius: 6px; background: #fff; color: var(--indigo-deep); display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; }
  h1 { font-size: 26px; line-height: 1.16; letter-spacing: -0.02em; margin: 12px 0 6px; max-width: 150mm; }
  .band .sub { font-size: 13px; opacity: .86; max-width: 150mm; }
  .body { padding: 15px 22mm 0; }
  .lead { font-size: 12.5px; color: var(--muted); max-width: 158mm; margin-bottom: 12px; }
  .lead strong { color: var(--ink); }
  .legend { display: flex; gap: 18px; align-items: center; margin: 0 0 12px; font-size: 12px; color: var(--muted); }
  .legend .k { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; color: var(--ink); }
  .swatch { width: 15px; height: 15px; border-radius: 4px; display: inline-block; }
  .sw-a { background: var(--a); } .sw-b { background: var(--b); }
  .model { border: 1px solid var(--line); border-radius: 13px; padding: 12px 15px 13px; margin-bottom: 9px; background: #fff; }
  .model h2 { font-size: 15px; color: var(--ink); display: flex; align-items: baseline; gap: 9px; }
  .model h2 .tag { font-size: 10.5px; font-weight: 700; color: var(--indigo-deep); background: var(--bg-tint); border-radius: 999px; padding: 2px 9px; letter-spacing: .02em; white-space: nowrap; }
  .model .who { font-size: 11.5px; color: var(--muted); margin: 2px 0 8px; }
  .strip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; max-width: 128mm; }
  .strip .wk { grid-column: 1 / -1; font-size: 9.5px; color: #94a3b8; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin: 4px 0 1px; }
  .cell { border-radius: 5px; padding: 4px 0 5px; text-align: center; font-size: 9px; font-weight: 700; color: #fff; }
  .cell small { display: block; font-size: 8px; font-weight: 600; opacity: .8; margin-bottom: 1px; }
  .c-a { background: var(--a); } .c-b { background: var(--b); }
  .note { font-size: 11px; color: var(--muted); margin-top: 11px; }
  .note b { color: var(--ink); font-weight: 600; }
  .pros { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px; margin-top: 8px; }
  .pros div { font-size: 10.5px; color: var(--muted); position: relative; padding-left: 15px; }
  .pros .p::before { content: "＋"; position: absolute; left: 0; color: #16a34a; font-weight: 800; }
  .pros .c::before { content: "－"; position: absolute; left: 0; color: var(--rose); font-weight: 800; }
  .compare { width: 100%; border-collapse: collapse; font-size: 10.5px; margin: 2px 0 0; }
  .compare th, .compare td { text-align: left; padding: 3px 8px; border-bottom: 1px solid var(--line); line-height: 1.35; }
  .compare th { font-size: 9.5px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .compare td:first-child { font-weight: 600; color: var(--ink); }
  .compare-title { font-size: 13px; margin: 2px 0 0; }
  .box { border: 1px dashed #c7d2fe; background: #f5f7ff; border-radius: 13px; padding: 12px 16px; margin-bottom: 10px; }
  .box h2 { font-size: 15px; margin-bottom: 6px; }
  .box ul { list-style: none; }
  .box li { font-size: 11.5px; color: var(--muted); position: relative; padding-left: 18px; margin-bottom: 4px; }
  .box li::before { content: "◆"; position: absolute; left: 0; top: 1px; color: var(--indigo); font-size: 9px; }
  .box li b { color: var(--ink); font-weight: 600; }
  .cta { margin: 4px 22mm 0; background: linear-gradient(120deg, var(--navy) 0%, var(--indigo-deep) 100%); color: #fff; border-radius: 15px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 18px; }
  .cta h3 { font-size: 16px; margin-bottom: 4px; }
  .cta p { font-size: 11.5px; opacity: .85; max-width: 105mm; }
  .cta .btn { background: #fff; color: var(--indigo-deep); font-weight: 700; font-size: 12.5px; padding: 11px 18px; border-radius: 10px; white-space: nowrap; text-decoration: none; }
  .foot { position: absolute; bottom: 9mm; left: 22mm; right: 22mm; display: flex; justify-content: space-between; font-size: 9.5px; color: #94a3b8; border-top: 1px solid var(--line); padding-top: 7px; }
  .disclaimer { font-size: 10px; color: #94a3b8; margin: 9px 22mm 0; line-height: 1.4; }
</style>
</head>
<body>

<!-- ==================== PAGE 1 ==================== -->
<div class="page">
  <div class="band">
    <div class="brand"><span class="dot">E</span> Entrelares</div>
    <h1>Modelos de rotina de guarda compartilhada</h1>
    <div class="sub">7 formas de dividir os dias entre os responsáveis — as mesmas do gerador de rotina e do app Entrelares —, com um guia visual de duas semanas para cada uma, para vocês escolherem o combinado que melhor cabe na vida dos filhos.</div>
  </div>

  <div class="body">
    <p class="lead">Não existe rotina “certa”: a melhor é a que respeita a idade da criança, a distância entre as casas e a rotina de cada responsável. Use estes modelos como <strong>ponto de partida da conversa</strong> — e lembre que qualquer combinado funciona melhor quando está num lugar só, igual para os dois. As cores mostram de quem é cada dia:</p>

    <div class="legend">
      <span class="k"><span class="swatch sw-a"></span> Responsável A</span>
      <span class="k"><span class="swatch sw-b"></span> Responsável B</span>
      <span style="font-size:11px">Seg · Ter · Qua · Qui · Sex · Sáb · Dom</span>
    </div>

${PAGES[0].map(model).join("\n\n")}
  </div>

${foot(1)}
</div>

<!-- ==================== PAGE 2 ==================== -->
<div class="page">
  <div class="body" style="padding-top:5mm">

${PAGES[1].map(model).join("\n\n")}

    <h2 class="compare-title">Os sete modelos num quadro</h2>
${TABLE}
  </div>

${foot(2)}
</div>

<!-- ==================== PAGE 3 ==================== -->
<div class="page">
  <div class="body" style="padding-top:8mm">

${PAGES[2].map(model).join("\n\n")}

    <div class="box">
      <h2>Férias, feriados e datas especiais</h2>
      <ul>
        <li><b>Combine à parte da rotina semanal.</b> Férias escolares e feriados costumam “pausar” o calendário normal e seguir uma divisão própria.</li>
        <li><b>Alternem por ano.</b> Natal com A e Ano-Novo com B neste ano; troca no ano seguinte. O mesmo vale para aniversários e feriados longos.</li>
        <li><b>Dia das Mães e Dia dos Pais</b> ficam sempre com o responsável homenageado, independentemente de quem é o dia na rotina.</li>
        <li><b>Aniversário da criança:</b> definam se será dividido no próprio dia ou alternado por ano — e registrem a decisão.</li>
        <li><b>Férias de meio de ano e fim de ano:</b> combinem os blocos com semanas de antecedência, para planejar viagens sem conflito.</li>
      </ul>
    </div>

    <p class="disclaimer">Este material é informativo e não constitui aconselhamento jurídico. As regras de guarda e convivência de cada família dependem do acordo entre os responsáveis e, quando houver, da decisão judicial. Em caso de dúvida, consulte seu advogado ou a Defensoria Pública.</p>
  </div>

  <div class="cta">
    <div>
      <h3>Coloque a rotina escolhida no app — grátis</h3>
      <p>Simule qualquer um destes modelos no gerador de rotina (entrelares.app/ferramentas/gerador-de-rotina-de-guarda) e, quando decidirem, monte o calendário no app: cada troca de dia passa a ter a aprovação dos dois, registrada com data e hora.</p>
    </div>
    <a class="btn" href="https://entrelares.app/">Começar agora →</a>
  </div>

${foot(3)}
</div>

</body>
</html>
`;
writeFileSync(join(HERE, "modelos-rotina.html"), html, "utf8");
console.log(`modelos-rotina.html: ${ids.length} models on ${TOTAL} pages`);
