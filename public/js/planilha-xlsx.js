// L-52 (28/11/2026) — the generator's calendar as a spreadsheet, built in the browser.
//
// People search for "calendário guarda compartilhada excel": they want the days in a file
// they can keep, sort and edit. This module turns the plan the generator just drew
// (`buildSchedule` in gerador-rotina.js) into an .xlsx that Excel, Google Planilhas and
// LibreOffice open, with no library and no request: the workbook is a handful of XML
// files in a ZIP with no compression ("stored"), written here byte by byte. The names a
// parent typed never leave the device, the same promise the share link keeps (L-30).
//
// Pure functions, no DOM: test/planilha-xlsx.test.js unzips the result and reads it back.

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const XLSX_FILE = "calendario-guarda-compartilhada.xlsx";

const WEEKDAY_NAMES = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado",
];

/** Excel's day number (1900 system) for a LOCAL calendar date: 1899-12-30 is day 0. */
export function excelSerial(date) {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day - Date.UTC(1899, 11, 30)) / 86400000);
}

// Cell styles, by their index in styles.xml's <cellXfs>.
export const STYLE = { plain: 0, title: 1, head: 2, date: 3, house: [4, 5] };

/** The header row's position (1-based); the rows above it are the sheet's caption. */
export const HEAD_ROW = 5;

/**
 * The sheet as rows of cells: { v, s?, date? }. A date cell holds an Excel serial.
 * @param {object} o
 * @param {Array<{date: Date, parent: number, isTransition: boolean}>} o.plan
 * @param {[string, string]} o.names    how each house is called on the calendar
 * @param {string} [o.time]             "HH:MM" handoff time, or ""
 * @param {string} o.modelLabel         the routine's name, as the preview's title says it
 */
export function sheetRows({ plan, names, time = "", modelLabel }) {
  const totals = [0, 0];
  for (const day of plan) totals[day.parent] += 1;
  const handoff = time ? `Troca às ${time}` : "Troca";
  return [
    [{ v: "Calendário de guarda compartilhada", s: STYLE.title }],
    [{ v: `${modelLabel} · ${plan.length} dias a partir de ${plan[0].date.toLocaleDateString("pt-BR")}` }],
    [{ v: `${names[0]}: ${totals[0]} dias · ${names[1]}: ${totals[1]} dias` }],
    [],
    ["Data", "Dia da semana", "Com quem", "Troca"].map((v) => ({ v, s: STYLE.head })),
    ...plan.map((day) => [
      { v: excelSerial(day.date), s: STYLE.date, date: true },
      { v: WEEKDAY_NAMES[day.date.getDay()] },
      { v: names[day.parent], s: STYLE.house[day.parent] },
      { v: day.isTransition ? handoff : "" },
    ]),
    [],
    [{ v: "Gerado em entrelares.app/ferramentas/gerador-de-rotina-de-guarda" }],
  ];
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const col = (i) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i];

function sheetXml(rows) {
  const body = rows.map((cells, r) => {
    const ref = r + 1;
    const xml = cells.map((c, i) => {
      if (c.v === "" || c.v == null) return "";
      const s = c.s ? ` s="${c.s}"` : "";
      return c.date
        ? `<c r="${col(i)}${ref}"${s}><v>${c.v}</v></c>`
        : `<c r="${col(i)}${ref}"${s} t="inlineStr"><is><t>${esc(c.v)}</t></is></c>`;
    }).join("");
    return `<row r="${ref}">${xml}</row>`;
  }).join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0">' +
    `<pane ySplit="${HEAD_ROW}" topLeftCell="A${HEAD_ROW + 1}" activePane="bottomLeft" state="frozen"/>` +
    "</sheetView></sheetViews>" +
    '<cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/>' +
    '<col min="3" max="3" width="24" customWidth="1"/><col min="4" max="4" width="16" customWidth="1"/></cols>' +
    `<sheetData>${body}</sheetData></worksheet>`;
}

// The two houses keep the generator's tints (the preview's .cal-a / .cal-b).
const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>' +
  '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><name val="Calibri"/></font></fonts>' +
  '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF1EDE6"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFECEFFB"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFDF2F8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

const PKG = "http://schemas.openxmlformats.org/package/2006";
const DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** The workbook's parts, path → XML text, in the order they go into the ZIP. */
export function workbookParts(rows) {
  return {
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<Types xmlns="${PKG}/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      "</Types>",
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<Relationships xmlns="${PKG}/relationships">` +
      `<Relationship Id="rId1" Type="${DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${DOC}">` +
      '<sheets><sheet name="Calendário" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<Relationships xmlns="${PKG}/relationships">` +
      `<Relationship Id="rId1" Type="${DOC}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${DOC}/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": STYLES_XML,
    "xl/worksheets/sheet1.xml": sheetXml(rows),
  };
}

// ── a ZIP with stored (uncompressed) entries ────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A fixed timestamp (01/01/2026 00:00): the same calendar always gives the same bytes.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/** path → text, into the bytes of a ZIP archive. */
export function zipStore(files) {
  const enc = new TextEncoder();
  const entries = Object.entries(files).map(([name, text]) => {
    const data = enc.encode(text);
    return { name: enc.encode(name), data, crc: crc32(data) };
  });
  const local = entries.reduce((n, e) => n + 30 + e.name.length + e.data.length, 0);
  const central = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(local + central + 22);
  const view = new DataView(out.buffer);
  let at = 0;
  const u16 = (v) => { view.setUint16(at, v, true); at += 2; };
  const u32 = (v) => { view.setUint32(at, v, true); at += 4; };
  const bytes = (b) => { out.set(b, at); at += b.length; };
  const offsets = [];
  for (const e of entries) {
    offsets.push(at);
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(DOS_TIME); u16(DOS_DATE);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0);
    bytes(e.name); bytes(e.data);
  }
  const cdStart = at;
  entries.forEach((e, i) => {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(DOS_TIME); u16(DOS_DATE);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0); u16(0);
    u16(0); u16(0); u32(0); u32(offsets[i]);
    bytes(e.name);
  });
  const cdSize = at - cdStart;
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length);
  u32(cdSize); u32(cdStart); u16(0);
  return out;
}

/** The whole thing: the generator's plan → the .xlsx file's bytes. */
export function buildXlsx(opts) {
  return zipStore(workbookParts(sheetRows(opts)));
}
