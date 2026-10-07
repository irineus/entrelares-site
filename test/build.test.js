// L-50 — the two homes are GENERATED (tool/build.mjs, sources in src/site/home/). This lane fails
// when a source changed and public/ was not regenerated, or when public/ was edited by hand: the
// fix is always "edit src/site/, run `node tool/build.mjs`, commit both". A whole-file assert
// would print two 100 kB strings, so the report names the first line that differs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outputs } from "../tool/build.mjs";

const read = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("public/ homes are exactly what tool/build.mjs renders", () => {
  for (const [rel, html] of Object.entries(outputs())) {
    const cur = read("public/" + rel);
    if (cur === html) continue;
    const a = cur.split("\n"), b = html.split("\n");
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    assert.fail(`public/${rel} line ${i + 1} differs from the generator's output — run: node tool/build.mjs\n  public:    ${a[i]}\n  generated: ${b[i]}`);
  }
});

test("pt.json and en.json carry the same keys (a string added to one home exists in the other)", () => {
  const keys = (lang) => Object.keys(JSON.parse(read(`src/site/home/${lang}.json`))).sort();
  assert.deepEqual(keys("en"), keys("pt"));
});

test("the hero calendar renders from the generator's engine, never from a hand-written cycle", () => {
  const tpl = read("src/site/home/template.html");
  assert.match(tpl, /import \{ buildSchedule, anchorStart \} from '\/js\/gerador-rotina\.js';/);
  assert.doesNotMatch(tpl, /'aaaaaaabbbbbbb'/, "a 14-letter cycle string crept back into the hero");
  // every chip is a preset the engine knows, and the two alternating-weekend presets are offered
  const chips = [...tpl.matchAll(/class="chip" data-preset="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chips, ["7-7", "2-2-3", "5-2-2-5", "3-11", "3-2-1-6-1-1"]);
});
