#!/usr/bin/env node
/*
 * Exercises highlightSelection() against a fake DocumentApp to check that token offsets map
 * back onto the right characters of each selected paragraph (including a partial selection).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function fakeText(str) {
  const chars = [...str].map((ch) => ({ ch, a: {} }));
  return {
    chars,
    getText: () => str,
    editAsText() { return this; },
    setAttributes(s, e, attrs) {
      assert(s >= 0 && e < chars.length && s <= e, `bad range ${s}-${e} on "${str}"`);
      for (let k = s; k <= e; k++) Object.assign(chars[k].a, attrs);
    },
    setBackgroundColor(s, e, c) { this.setAttributes(s, e, { BACKGROUND_COLOR: c }); },
    setForegroundColor(s, e, c) { this.setAttributes(s, e, { FOREGROUND_COLOR: c }); },
    setFontFamily(s, e, f) { this.setAttributes(s, e, { FONT_FAMILY: f }); },
    setFontSize(s, e, f) { this.setAttributes(s, e, { FONT_SIZE: f }); },
  };
}

const paras = [
  fakeText('Intro text: ros2 topic list'), // partially selected from offset 12
  fakeText('docker compose up -d'),
  fakeText(''),
  fakeText('echo "$HOME"  # done'),
];
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

let props = {};
const ctx = vm.createContext({
  console,
  DocumentApp: {
    Attribute: { FOREGROUND_COLOR: 'FOREGROUND_COLOR', BACKGROUND_COLOR: 'BACKGROUND_COLOR', BOLD: 'BOLD',
      ITALIC: 'ITALIC', FONT_FAMILY: 'FONT_FAMILY', FONT_SIZE: 'FONT_SIZE' },
    getActiveDocument: () => ({ getSelection: () => ({ getRangeElements: () => rangeElements }) }),
  },
  PropertiesService: { getUserProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
});
const root = path.join(__dirname, '..');
for (const f of ['themes.js', 'highlighter.js', 'code.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), ctx, { filename: f });
}

const res = ctx.highlightSelection({ lang: 'auto', theme: 'onedarkpro', font: 'Roboto Mono', fontSize: 10, background: true, fontStyles: true });
console.log('result', res);
assert.strictEqual(res.lang, 'bash');

const colorAt = (p, word) => {
  const idx = p.getText().indexOf(word);
  return p.chars[idx].a;
};
// untouched text before the selection
assert.deepStrictEqual(paras[0].chars[0].a, {});
// ros2 -> deep red bold, topic -> cyan regular
assert.strictEqual(colorAt(paras[0], 'ros2').FOREGROUND_COLOR, '#be5046');
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

ctx.clearSelection();
assert.strictEqual(colorAt(paras[1], 'docker').FOREGROUND_COLOR, null);
console.log('apply test passed');
