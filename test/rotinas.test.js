// L-43 — the routine pages (/rotinas/<id>) draw what the app generates.
//
// Each page shows a two-week grid and three numbers (days per house, handoffs, longest
// absence), and tells the reader how to build the routine in the app's rotation wizard.
// All of it is a claim about somebody else's code, so this suite pins it the way
// `gerador-rotina.test.js` pins the generator:
//
//   - the grid is not drawn by hand: each <table class="grade"> declares its cycle in
//     `data-blocks` (parent index 0|1 : days) and the weekday the cycle starts on in
//     `data-inicio` (0 = Monday), and every cell must equal the cycle walked by the
//     generator's `buildSchedule` — the mirror of the app's `generateRotation`;
//   - a page that names an app quick model (`data-preset`) must declare exactly that
//     preset's blocks from `PRESET_BLOCKS` (the mirror of the app's `wizardPresetBlocks`)
//     and quote the model's label as the app's PT-BR catalogue writes it;
//   - the three numbers are recomputed from the same cycle.
//
// APP_PRESET_LABELS is a MIRROR, like the generator: read from the app repo,
// packages/entrelares_core/lib/src/localization/strings_pt_br.dart (K.wizPreset*),
// 02/10/2026. Nothing here goes red when the APP renames a model — the sync is a
// convention, the same one CLAUDE.md states for gerador-rotina.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESET_BLOCKS, buildSchedule } from '../public/js/gerador-rotina.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = join(ROOT, 'public', 'rotinas');

const APP_PRESET_LABELS = {
  '7-7': 'Semanas alternadas (7/7)',
  '14-14': 'Quinzenas alternadas (14/14)',
  '1-1': 'Dias alternados (1/1)',
  '5-2-2-5': 'Dias fixos + fins de semana alternados (5/2/2/5)',
  '2-2-3': 'Revezamento quinzenal alternado (2/2/3)',
  // F-97 (06/10/2026): KApp.wizPreset311 / wizPreset321611 in k_app.dart.
  '3-11': 'Fins de semana alternados (sex–dom)',
  '3-2-1-6-1-1': 'Fins de semana alternados + pernoite de quarta',
};
const APP_WIZARD_ENTRY = 'Assistente de rotação'; // K.calWizard
const APP_GENERATE = 'Gerar plano'; // K.wizGenerate

const pages = readdirSync(DIR)
  .filter((f) => f.endsWith('.html') && f !== 'index.html')
  .map((f) => ({ file: f, html: readFileSync(join(DIR, f), 'utf8') }));

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function parseGrid(html, file) {
  const m = html.match(/<table class="grade"[^>]*>/);
  assert.ok(m, `${file}: no two-week grid`);
  const blocks = attr(m[0], 'data-blocks').split(',').map((b) => b.split(':').map(Number));
  const offset = Number(attr(m[0], 'data-inicio'));
  const preset = attr(m[0], 'data-preset');
  const body = html.slice(m.index, html.indexOf('</table>', m.index));
  const cells = [...body.matchAll(/<td class="(r[12])( troca)?">/g)].map((c) => ({
    parent: c[1] === 'r1' ? 0 : 1,
    troca: Boolean(c[2]),
  }));
  return { blocks, offset, preset, cells };
}

// The steady-state fortnight: the cycle walked from its start, read Monday to Sunday.
function expected(blocks, offset) {
  const length = blocks.reduce((s, [, d]) => s + d, 0);
  const plan = buildSchedule({ blocks, start: new Date(2026, 0, 5), days: length }); // any start: only the order matters
  const at = (i) => plan[(((i - offset) % length) + length) % length].parent;
  return Array.from({ length: 14 }, (_, i) => ({ parent: at(i), troca: at(i) !== at(i - 1) }));
}

test('the six routine pages exist (a broken glob would make every rule below pass)', () => {
  assert.deepEqual(
    pages.map((p) => p.file).sort(),
    ['1-1.html', '2-2-3.html', '3-4-4-3.html', '5-2-2-5.html',
      'fins-de-semana-alternados-com-pernoite.html', 'fins-de-semana-alternados.html'],
  );
});

test('every grid is the cycle the app generates, day by day, handoffs included', () => {
  for (const { file, html } of pages) {
    const { blocks, offset, cells } = parseGrid(html, file);
    assert.equal(cells.length, 14, `${file}: two weeks of seven days`);
    assert.deepEqual(cells, expected(blocks, offset), `${file}: the grid drifted from its declared cycle`);
  }
});

test("a page that names an app quick model declares that model's blocks and quotes its label", () => {
  const withPreset = pages.filter(({ html, file }) => parseGrid(html, file).preset);
  assert.deepEqual(withPreset.map((p) => p.file).sort(),
    ['1-1.html', '2-2-3.html', '5-2-2-5.html', 'fins-de-semana-alternados-com-pernoite.html']);
  for (const { file, html } of withPreset) {
    const { blocks, preset } = parseGrid(html, file);
    assert.deepEqual(blocks, PRESET_BLOCKS[preset], `${file}: not the app's ${preset} expansion`);
    assert.ok(plain(html).includes(APP_PRESET_LABELS[preset]), `${file}: the app calls it "${APP_PRESET_LABELS[preset]}"`);
  }
  // The custom-cycle pages must not pretend to be a quick model.
  for (const { file, html } of pages.filter((p) => !withPreset.includes(p))) {
    assert.ok(/Adicionar bloco/.test(html), `${file}: a custom cycle is built with "Adicionar bloco"`);
  }
});

test('every page walks the reader through the wizard with the labels the app shows', () => {
  for (const { file, html } of pages) {
    const text = plain(html);
    for (const label of [APP_WIZARD_ENTRY, 'Blocos do ciclo', 'Data de início', 'Horário de troca', 'Não temos horário fixo', APP_GENERATE]) {
      assert.ok(text.includes(label), `${file}: "${label}" is missing from the how-to`);
    }
  }
});

test('the three numbers are recomputed from the cycle, not typed', () => {
  const days = (n) => (n === 1 ? '1 dia' : `${n} dias`);
  for (const { file, html } of pages) {
    const { blocks, offset } = parseGrid(html, file);
    const cells = expected(blocks, offset);
    const split = [0, 1].map((p) => cells.filter((c) => c.parent === p).length);
    const handoffs = cells.filter((c) => c.troca).length;
    const seq = blocks.flatMap(([p, d]) => Array(d).fill(p));
    const longest = (p) => {
      let best = 0;
      let run = 0;
      for (const x of [...seq, ...seq]) {
        run = x === p ? run + 1 : 0;
        best = Math.max(best, Math.min(run, seq.length));
      }
      return best;
    };
    const away = [longest(1), longest(0)];
    const absence = away[0] === away[1]
      ? days(away[0])
      : `${days(Math.max(...away))} (Responsável ${away[0] > away[1] ? 1 : 2})`;
    const dd = (key) => html.match(new RegExp(`<dd data-calc="${key}">([^<]*)</dd>`))?.[1];
    assert.equal(dd('dias'), `${split[0]} e ${split[1]}`, `${file}: days per house`);
    assert.equal(dd('trocas'), String(handoffs), `${file}: handoffs per fortnight`);
    assert.equal(dd('ausencia'), absence, `${file}: longest absence`);
  }
});

test('the CTA goes to /register with the blog attribute, and no app link carries a utm', () => {
  for (const { file, html } of pages) {
    assert.match(html, /<a class="btn btn-primary" href="https:\/\/web\.entrelares\.app\/register" data-umami-event="cta-signup">/, file);
    assert.ok(!/utm_/.test(html), `${file}: a utm_ on an app link measures nothing (L-27)`);
  }
});

// The generator's only pre-fill is the L-30 shared-routine fragment: it needs a fixed start
// date, opens with "Rotina compartilhada com você" and counts the visit as the event
// `gerador-rotina-recebida`. A static link through that door would date itself, tell the
// reader somebody sent them a routine, and pollute the measurement of real shares.
test('no page links to the generator through the shared-routine fragment', () => {
  for (const { file, html } of pages) {
    assert.ok(!/gerador-de-rotina-de-guarda#/.test(html), `${file}: the fragment is the share door, not a preset link`);
  }
});
