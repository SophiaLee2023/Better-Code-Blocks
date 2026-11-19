#!/usr/bin/env node
/*
 * Local test harness: loads the Apps Script sources into a Node VM, runs the tokenizer on the
 * samples in test/samples, and writes test/out/preview.html showing every language in a theme.
 *
 *   node test/run_samples.js [themeId]        # default: onedarkpro
 *   node test/run_samples.js --dump bash      # print tokens for one sample
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
for (const f of ['themes.js', 'highlighter.js', 'code.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), ctx, { filename: f });
}
const { Highlighter } = vm.runInContext('({ Highlighter })', ctx);

const samplesDir = path.join(__dirname, 'samples');
const samples = fs.readdirSync(samplesDir).sort().map((f) => ({
  lang: path.basename(f, path.extname(f)),
  code: fs.readFileSync(path.join(samplesDir, f), 'utf8'),
}));

const args = process.argv.slice(2);
if (args[0] === '--dump') {
  const s = samples.find((x) => x.lang === args[1]);
  if (!s) throw new Error('no sample ' + args[1]);
  for (const t of Highlighter.tokenize(s.code, s.lang)) {
    console.log(t.t.padEnd(12), JSON.stringify(s.code.slice(t.s, t.e)));
  }
  process.exit(0);
}

let failed = 0;
for (const s of samples) {
  const detected = Highlighter.detect(s.code);
  const toks = Highlighter.tokenize(s.code, s.lang);
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (!(t.s >= 0 && t.e <= s.code.length && t.e > t.s) || (k && toks[k - 1].e > t.s)) {
      console.log('BAD TOKEN', s.lang, t); failed++;
    }
  }
  const flag = detected === s.lang ? '' : '   <-- detect mismatch';
  console.log(s.lang.padEnd(12), 'tokens:', String(toks.length).padStart(4), ' detected:', detected + flag);
}

const themeIds = vm.runInContext('Object.keys(THEMES)', ctx);
const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
const opts = { fontStyles: true };
let html = '<!doctype html><meta charset="utf-8"><title>Highlighter preview</title>' +
  '<style>body{font-family:sans-serif;background:#ddd;margin:16px}pre{padding:12px;border-radius:6px;' +
  'font:13px/1.45 "Roboto Mono",Consolas,monospace;overflow:auto}h2{margin:24px 0 6px}</style>';
const themesToShow = args[0] === '--all' ? themeIds : [args[0] || 'onedarkpro'];
for (const id of themesToShow) {
  const theme = vm.runInContext('resolveTheme(' + JSON.stringify(id) + ')', ctx);
  html += '<h1>' + theme.name + '</h1>';
  for (const s of samples) {
    const body = ctx.renderHtml_(s.code, Highlighter.tokenize(s.code, s.lang), theme, opts);
    html += '<h2>' + Highlighter.langName(s.lang) + '</h2><pre style="background:' + theme.bg + ';color:' +
      theme.fg + '">' + body + '</pre>';
  }
}
fs.writeFileSync(path.join(outDir, 'preview.html'), html);
console.log('\nwrote', path.join(outDir, 'preview.html'));
process.exit(failed ? 1 : 0);
