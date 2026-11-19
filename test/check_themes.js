#!/usr/bin/env node
/*
 * Checks every theme palette:
 *  - light palettes: every color has >= 4.5:1 contrast against light gray #e0e0e0, so text stays
 *    readable on white or gray pages even without the theme background;
 *  - dark palettes: every color has >= 3:1 contrast against the theme background;
 *  - the main token colors (keyword, string, number, function, type, comment, ros, docker and the
 *    default text color) are visibly different from each other (CIE76 delta E >= 12).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'themes.js'), 'utf8'), ctx);
const THEMES = vm.runInContext('THEMES', ctx);

const LIGHT_REF = '#e0e0e0';
const DISTINCT = ['keyword', 'string', 'number', 'function', 'type', 'comment', 'ros', 'docker'];

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function lab(h) {
  const [r, g, b] = rgb(h).map(lin);
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b,
    (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = xyz.map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}
const deltaE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

let failed = 0;
const fail = (msg) => { console.log('FAIL', msg); failed++; };

for (const id of Object.keys(THEMES)) {
  for (const mode of ['dark', 'light']) {
    const t = THEMES[id][mode];
    if (!t) { fail(`${id}: missing ${mode} palette`); continue; }
    const colors = { fg: t.fg };
    for (const k of Object.keys(t.s)) colors[k] = t.s[k].split(/\s+/)[0];
    for (const [k, c] of Object.entries(colors)) {
      if (mode === 'light') {
        const r = contrast(c, LIGHT_REF);
        if (r < 4.5) fail(`${t.name} ${k} ${c}: contrast ${r.toFixed(2)} vs ${LIGHT_REF}`);
        if (contrast(c, t.bg) < 4.5) fail(`${t.name} ${k} ${c}: contrast vs theme bg ${t.bg}`);
      } else if (contrast(c, t.bg) < 3) {
        fail(`${t.name} ${k} ${c}: contrast ${contrast(c, t.bg).toFixed(2)} vs ${t.bg}`);
      }
    }
    const keys = DISTINCT.concat('fg');
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const d = deltaE(colors[keys[i]], colors[keys[j]]);
        if (d < 12) fail(`${t.name}: ${keys[i]} ${colors[keys[i]]} and ${keys[j]} ${colors[keys[j]]} look alike (dE ${d.toFixed(1)})`);
      }
    }
  }
}
console.log(failed ? `\n${failed} theme problem(s)` : 'themes ok');
process.exit(failed ? 1 : 0);
