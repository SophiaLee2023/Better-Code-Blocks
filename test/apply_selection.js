#!/usr/bin/env node
/*
 * Exercises highlightSelection() against a fake DocumentApp to check that token offsets map
 * back onto the right characters of each selected paragraph (including a partial selection), and
 * the full-width block mode against a fake Docs API.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

let closed = false; // set by saveAndClose(); DocumentApp edits after that would be lost
const body = { getType: () => 'BODY_SECTION', getParent: () => null, getChildIndex: (p) => paragraphs.indexOf(p) };

function fakeText(str) {
  const chars = [...str].map((ch) => ({ ch, a: {} }));
  const text = {
    chars,
    getType: () => 'TEXT',
    getText: () => str,
    editAsText() { return this; },
    setAttributes(s, e, attrs) {
      assert(!closed, 'DocumentApp edit after saveAndClose()');
      assert(s >= 0 && e < chars.length && s <= e, `bad range ${s}-${e} on "${str}"`);
      for (let k = s; k <= e; k++) Object.assign(chars[k].a, attrs);
    },
    setBackgroundColor(s, e, c) { this.setAttributes(s, e, { BACKGROUND_COLOR: c }); },
    setForegroundColor(s, e, c) { this.setAttributes(s, e, { FOREGROUND_COLOR: c }); },
    setFontFamily(s, e, f) { this.setAttributes(s, e, { FONT_FAMILY: f }); },
    setFontSize(s, e, f) { this.setAttributes(s, e, { FONT_SIZE: f }); },
  };
  text.para = { getType: () => 'PARAGRAPH', getParent: () => body, getChildIndex: () => 0, editAsText: () => text };
  text.getParent = () => text.para;
  return text;
}

const paras = [
  fakeText('Intro text: ros2 topic list'), // partially selected from offset 12
  fakeText('docker compose up -d'),
  fakeText(''),
  fakeText('echo "$HOME"  # done'),
];
const paragraphs = paras.map((t) => t.para);
const rangeElements = [
  { el: paras[0], partial: true, s: 12, e: paras[0].getText().length - 1 },
  { el: paras[1], partial: false },
  { el: paras[2], partial: false },
  { el: paras[3], partial: false },
].map((r) => ({
  getElement: () => r.el,
  isPartial: () => r.partial,
  getStartOffset: () => r.s,
  getEndOffsetInclusive: () => r.e,
}));

// fake Docs API: the selection is in tab t.1 (a child tab); its body starts with a section break,
// then one paragraph per line
const apiStyles = paras.map(() => ({}));
const batches = [];
function apiContent() {
  let i = 1;
  return [{ endIndex: 1, sectionBreak: {} }].concat(paras.map((p, k) => {
    const node = { startIndex: i, endIndex: i + p.getText().length + 1, paragraph: { paragraphStyle: apiStyles[k] } };
    i = node.endIndex;
    return node;
  }));
}
const Docs = {
  Documents: {
    get(id, o) {
      assert.strictEqual(id, 'doc1');
      assert(closed, 'Docs API read before saveAndClose()');
      assert(o && o.includeTabsContent, 'tab content not requested');
      return { tabs: [{ tabProperties: { tabId: 't.0' }, childTabs: [
        { tabProperties: { tabId: 't.1' }, documentTab: { body: { content: apiContent() } } }] }] };
    },
    batchUpdate(req, id) {
      assert.strictEqual(id, 'doc1');
      batches.push(req.requests);
      const content = apiContent();
      req.requests.forEach(({ updateParagraphStyle: u }) => {
        assert.strictEqual(u.range.tabId, 't.1');
        const k = content.findIndex((n) => n.startIndex === u.range.startIndex && n.endIndex === u.range.endIndex) - 1;
        assert(k >= 0, 'range is not a paragraph');
        apiStyles[k] = u.paragraphStyle;
      });
    },
  },
};

const props = {};
const ctx = vm.createContext({
  console,
  Docs,
  DocumentApp: {
    ElementType: { PARAGRAPH: 'PARAGRAPH', LIST_ITEM: 'LIST_ITEM', BODY_SECTION: 'BODY_SECTION' },
    Attribute: { FOREGROUND_COLOR: 'FOREGROUND_COLOR', BACKGROUND_COLOR: 'BACKGROUND_COLOR', BOLD: 'BOLD',
      ITALIC: 'ITALIC', FONT_FAMILY: 'FONT_FAMILY', FONT_SIZE: 'FONT_SIZE' },
    getActiveDocument: () => ({
      getSelection: () => ({ getRangeElements: () => rangeElements }),
      getId: () => 'doc1',
      getActiveTab: () => ({ getId: () => 't.1' }),
      saveAndClose: () => { closed = true; },
    }),
  },
  PropertiesService: { getUserProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
});
const root = path.join(__dirname, '..');
for (const f of ['themes.js', 'highlighter.js', 'code.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), ctx, { filename: f });
}

// each call is a separate script execution, which reopens the document
const run = (fn, o) => { closed = false; return ctx[fn](o); };
const colorAt = (p, word) => p.chars[p.getText().indexOf(word)].a;

const res = run('highlightSelection', { lang: 'auto', theme: 'one', mode: 'dark', font: 'Roboto Mono', fontSize: 10, background: true, fontStyles: true });
console.log('result', res);
assert.strictEqual(res.lang, 'bash');

// untouched text before the selection
assert.deepStrictEqual(paras[0].chars[0].a, {});
// ros2 -> deep red bold, topic -> cyan regular
assert.strictEqual(colorAt(paras[0], 'ros2').FOREGROUND_COLOR, '#e2584a');
assert.strictEqual(colorAt(paras[0], 'ros2').BOLD, true);
assert.strictEqual(colorAt(paras[0], 'topic').FOREGROUND_COLOR, '#56b6c2');
assert.strictEqual(colorAt(paras[0], 'topic').BOLD, false);
assert.strictEqual(colorAt(paras[0], 'ros2').FONT_FAMILY, 'Roboto Mono');
assert.strictEqual(colorAt(paras[0], 'ros2').BACKGROUND_COLOR, '#282c34');
// docker -> cerulean bold, compose/up -> purple, -d -> flag orange
assert.strictEqual(colorAt(paras[1], 'docker').FOREGROUND_COLOR, '#2496ed');
assert.strictEqual(colorAt(paras[1], 'up').FOREGROUND_COLOR, '#c678dd');
assert.strictEqual(colorAt(paras[1], '-d').FOREGROUND_COLOR, '#d19a66');
// variable inside string, comment italic
assert.strictEqual(colorAt(paras[3], '$HOME').FOREGROUND_COLOR, '#e06c75');
assert.strictEqual(colorAt(paras[3], '"').FOREGROUND_COLOR, '#98c379');
assert.strictEqual(colorAt(paras[3], '#').ITALIC, true);
// last character of last paragraph got formatted
assert.strictEqual(paras[3].chars[paras[3].chars.length - 1].a.ITALIC, true);
// no block requested, nothing shaded
assert.strictEqual(batches.length, 0);

run('clearSelection');
assert.strictEqual(colorAt(paras[1], 'docker').FOREGROUND_COLOR, null);

// light mode, no theme background: light palette colors and the page background is left alone
run('highlightSelection', { lang: 'bash', theme: 'one', mode: 'light', font: 'keep', fontSize: 0, background: false, fontStyles: true });
const oneLight = vm.runInContext('resolveTheme("one", "light")', ctx);
assert.strictEqual(colorAt(paras[0], 'ros2').FOREGROUND_COLOR, oneLight.styles.ros.c);
assert.strictEqual(colorAt(paras[0], 'ros2').BACKGROUND_COLOR, null);
assert.strictEqual(colorAt(paras[1], 'compose').FOREGROUND_COLOR, oneLight.styles.dockerSub.c);
assert.strictEqual(JSON.parse(props['codeHighlighter.settings']).mode, 'light');
run('clearSelection');

// full-width block: whole lines are highlighted, every touched paragraph is shaded
const block = run('highlightSelection', { lang: 'bash', theme: 'one', mode: 'dark', font: 'keep', fontSize: 0, background: true, fontStyles: true, fullWidth: true });
assert.strictEqual(block.lines, 4);
assert.ok(paras[0].chars[0].a.FOREGROUND_COLOR, 'text before the partial selection is highlighted too');
assert.strictEqual(colorAt(paras[0], 'ros2').BACKGROUND_COLOR, null, 'no text highlight on top of the block');
assert.strictEqual(batches.length, 1);
const reqs = batches[0].map((r) => r.updateParagraphStyle);
assert.strictEqual(JSON.stringify(reqs.map((u) => [u.range.startIndex, u.range.endIndex])), JSON.stringify([[1, 29], [29, 50], [50, 51], [51, 72]]));
const shade = reqs[0].paragraphStyle.shading.backgroundColor.color.rgbColor;
assert.strictEqual(JSON.stringify(shade), JSON.stringify({ red: 0x28 / 255, green: 0x2c / 255, blue: 0x34 / 255 }));
assert.strictEqual(JSON.stringify(reqs[0].paragraphStyle.borderLeft.color), JSON.stringify(reqs[0].paragraphStyle.shading.backgroundColor));
assert.strictEqual(reqs[0].paragraphStyle.spaceBelow.magnitude, 0);

// clearing with the block setting on removes the shading again
const cleared = run('clearSelection', { fullWidth: true });
assert.strictEqual(cleared.lines, 4);
assert(apiStyles.every((st) => !st.shading), 'shading removed');
assert.strictEqual(paras[0].chars[0].a.FOREGROUND_COLOR, null);

// settings saved with an old single-palette theme id still load
props['codeHighlighter.settings'] = JSON.stringify({ theme: 'githublight' });
const loaded = ctx.loadSettings_();
assert.strictEqual(loaded.theme, 'github');
assert.strictEqual(loaded.mode, 'light');
props['codeHighlighter.settings'] = JSON.stringify({ theme: 'onedarkpro' });
assert.strictEqual(ctx.loadSettings_().mode, 'dark');
console.log('apply test passed');
