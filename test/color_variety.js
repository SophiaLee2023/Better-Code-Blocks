#!/usr/bin/env node
/*
 * Checks that highlighted lines aren't mostly one color. For every sample line with at least four
 * words, it counts the color of each word (a whole string counts as one word, comments are skipped)
 * and fails if one color covers more than MAX_SHARE of them on more than MAX_BAD_LINES of all lines.
 *
 *   node test/color_variety.js            # every theme, both modes
 *   node test/color_variety.js one light  # one palette, listing the offending lines
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MAX_SHARE = 0.6;
const MAX_BAD_LINES = 0.12;

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
for (const f of ['themes.js', 'highlighter.js', 'code.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), ctx, { filename: f });
}
const { Highlighter } = vm.runInContext('({ Highlighter })', ctx);
const samplesDir = path.join(__dirname, 'samples');
const samples = fs.readdirSync(samplesDir).sort().map((f) => {
  const lang = path.basename(f, path.extname(f));
  const code = fs.readFileSync(path.join(samplesDir, f), 'utf8');
  const tokAt = new Array(code.length).fill(null);
  for (const t of Highlighter.tokenize(code, lang)) for (let i = t.s; i < t.e; i++) tokAt[i] = t;
  return { lang, code, tokAt };
});

function check(id, mode, verbose) {
  const theme = vm.runInContext(`resolveTheme(${JSON.stringify(id)}, ${JSON.stringify(mode)})`, ctx);
  let bad = 0, total = 0;
  for (const { lang, code, tokAt } of samples) {
    let off = 0;
    for (const line of code.split('\n')) {
      const counts = {}, seen = new Set();
      let n = 0;
      const re = /\w+/g;
      let m;
      while ((m = re.exec(line))) {
        const tok = tokAt[off + m.index];
        if (tok && tok.t === 'comment') continue;
        if (tok && tok.t === 'string') { if (seen.has(tok)) continue; seen.add(tok); }
        const st = tok && theme.styles[tok.t];
        const c = st ? st.c : theme.fg;
        counts[c] = (counts[c] || 0) + 1;
        n++;
      }
      if (n >= 4) {
        total++;
        const [c, k] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (k / n > MAX_SHARE) {
          bad++;
          if (verbose) console.log('  ' + lang.padEnd(11), (c === theme.fg ? 'text ' : '     ') + c, k + '/' + n, line.trim().slice(0, 80));
        }
      }
      off += line.length + 1;
    }
  }
  return { name: theme.name, bad, total };
}

const args = process.argv.slice(2);
const runs = args.length ? [[args[0], args[1] || 'light']]
  : vm.runInContext('Object.keys(THEMES)', ctx).flatMap((id) => [[id, 'light'], [id, 'dark']]);
let failed = 0;
for (const [id, mode] of runs) {
  const r = check(id, mode, args.length > 0);
  const ok = r.bad / r.total <= MAX_BAD_LINES;
  if (!ok) failed++;
  console.log((ok ? 'ok   ' : 'FAIL ') + r.name.padEnd(26), `${r.bad}/${r.total} lines mostly one color`);
}
process.exit(failed ? 1 : 0);
