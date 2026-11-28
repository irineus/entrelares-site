// L-52 — the generator's spreadsheet (public/js/planilha-xlsx.js).
//
// "calendário guarda compartilhada excel" is what Brazilians type (Google's autocomplete,
// 28/11/2026), so the generator hands out the calendar it drew as an .xlsx. The file is
// written byte by byte in the browser, with no library, which is exactly the kind of code
// that looks fine and opens nowhere — so this suite UNZIPS it with its own reader, checks
// every CRC with node:zlib's (an independent implementation), and reads the sheet back:
// one row per day, the right Excel date, the right house, the handoff marked.

import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32 as zlibCrc32 } from "node:zlib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildSchedule } from "../public/js/gerador-rotina.js";
import {
  buildXlsx, excelSerial, crc32, sheetRows, HEAD_ROW, STYLE, XLSX_FILE,
} from "../public/js/planilha-xlsx.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Our own reader: the central directory → { name: text }, CRC checked against zlib. */
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, "end of central directory");
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  let at = view.getUint32(eocd + 16, true);
  assert.equal(at + cdSize, eocd, "central directory size and offset agree");
  const files = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50, "central directory entry");
    assert.equal(view.getUint16(at + 10, true), 0, "stored, no compression");
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    assert.equal(view.getUint32(offset, true), 0x04034b50, `${name}: local header`);
    const localName = view.getUint16(offset + 26, true);
    const start = offset + 30 + localName + view.getUint16(offset + 28, true);
    const data = bytes.subarray(start, start + size);
    assert.equal(zlibCrc32(data), crc, `${name}: CRC`);
    files[name] = dec.decode(data);
    at += 46 + nameLen;
  }
  return files;
}

/** The sheet's cells: "A6" → { s, t, v }. */
function cells(xml) {
  const out = {};
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"(?: s="(\d+)")?(?: t="(\w+)")?>(.*?)<\/c>/g)) {
    const [, ref, s, t, inner] = m;
    const v = t === "inlineStr" ? inner.match(/<t>(.*?)<\/t>/)[1] : inner.match(/<v>(.*?)<\/v>/)[1];
    out[ref] = { s: Number(s ?? 0), t, v };
  }
  return out;
}

const start = new Date(2026, 11, 4); // a Friday
const plan = buildSchedule({ preset: "3-2-1-6-1-1", start, days: 28 });
const opts = { plan, names: ["Casa da Ana", "Casa do Bruno <&>"], time: "18:00", modelLabel: "Fins de semana alternados + pernoite de quarta" };

test("excelSerial counts days the way Excel does (1900 system)", () => {
  assert.equal(excelSerial(new Date(2026, 10, 28)), 46354);
  assert.equal(excelSerial(new Date(1900, 2, 1)), 61); // past Excel's phantom 29/02/1900
  assert.equal(excelSerial(new Date(2025, 0, 1)), 45658);
});

test("the CRC is the standard one", () => {
  const b = new TextEncoder().encode("Calendário de guarda compartilhada");
  assert.equal(crc32(b), zlibCrc32(b));
});

test("the file is a valid ZIP holding the six parts an .xlsx needs", () => {
  const files = unzip(buildXlsx(opts));
  assert.deepEqual(Object.keys(files).sort(), [
    "[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels",
    "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml",
  ]);
  for (const [name, xml] of Object.entries(files)) {
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?></, name);
    // Every element closes: strip self-closing tags, then opens and closes must pair up.
    const tags = [...xml.replace(/<\?.*?\?>/, "").replace(/<[^>]+\/>/g, "").matchAll(/<(\/?)([\w:]+)[^>]*>/g)];
    const stack = [];
    for (const [, close, tag] of tags) {
      if (close) assert.equal(stack.pop(), tag, `${name}: </${tag}> out of order`);
      else stack.push(tag);
    }
    assert.equal(stack.length, 0, `${name}: unclosed ${stack.join(",")}`);
  }
  assert.ok(files["[Content_Types].xml"].includes("/xl/worksheets/sheet1.xml"));
});

test("the sheet is the calendar: one row per day, Excel dates, the house, the handoff", () => {
  const sheet = cells(unzip(buildXlsx(opts))["xl/worksheets/sheet1.xml"]);
  assert.deepEqual(["A", "B", "C", "D"].map((c) => sheet[`${c}${HEAD_ROW}`].v), ["Data", "Dia da semana", "Com quem", "Troca"]);
  plan.forEach((day, i) => {
    const r = HEAD_ROW + 1 + i;
    assert.equal(Number(sheet[`A${r}`].v), excelSerial(day.date), `A${r}: date`);
    assert.equal(sheet[`A${r}`].s, STYLE.date, `A${r}: date format`);
    const name = opts.names[day.parent].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    assert.equal(sheet[`C${r}`].v, name, `C${r}: house`);
    assert.equal(sheet[`C${r}`].s, STYLE.house[day.parent], `C${r}: house tint`);
    assert.equal(sheet[`D${r}`]?.v, day.isTransition ? "Troca às 18:00" : undefined, `D${r}: handoff`);
  });
  assert.equal(sheet[`A${HEAD_ROW + 1}`].v, String(excelSerial(start)));
  assert.equal(sheet[`B${HEAD_ROW + 1}`].v, "sexta-feira");
  assert.equal(sheet[`A${HEAD_ROW + plan.length + 1}`], undefined, "nothing after the last day but the credit");
});

test("the caption counts the days the way the preview does", () => {
  const rows = sheetRows(opts);
  const totals = [0, 1].map((p) => plan.filter((d) => d.parent === p).length);
  assert.equal(rows[2][0].v, `Casa da Ana: ${totals[0]} dias · Casa do Bruno <&>: ${totals[1]} dias`);
  assert.ok(rows.at(-1)[0].v.includes("entrelares.app/ferramentas/gerador-de-rotina-de-guarda"));
});

test("without a handoff time the column just says Troca", () => {
  const sheet = cells(unzip(buildXlsx({ ...opts, time: "" }))["xl/worksheets/sheet1.xml"]);
  const first = plan.findIndex((d) => d.isTransition);
  assert.equal(sheet[`D${HEAD_ROW + 1 + first}`].v, "Troca");
});

test("the same calendar always gives the same bytes", () => {
  assert.deepEqual(buildXlsx(opts), buildXlsx(opts));
});

test("the generator page offers the download, hidden until a calendar exists", () => {
  const html = readFileSync(join(ROOT, "public", "ferramentas", "gerador-de-rotina-de-guarda.html"), "utf8");
  assert.match(html, /<button class="btn btn-ghost" type="button" id="g-planilha" hidden data-umami-event="gerador-planilha">Baixar planilha \(Excel\)<\/button>/);
  assert.match(html, /import \{ buildXlsx, XLSX_MIME, XLSX_FILE \} from "\/js\/planilha-xlsx\.js";/);
  assert.equal(XLSX_FILE, "calendario-guarda-compartilhada.xlsx");
});
