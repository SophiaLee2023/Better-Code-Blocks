/**
 * Code Highlighter — Google Docs editor add-on.
 * Highlights the selected text in place (font, text color, bold/italic, background). No tables.
 */

var SETTINGS_KEY = 'codeHighlighter.settings';
var FONTS = ['Roboto Mono', 'Source Code Pro', 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Inconsolata',
  'Ubuntu Mono', 'Space Mono', 'Consolas', 'Courier New'];
var DEFAULT_SETTINGS = {
  lang: 'auto', theme: 'one', mode: 'light', font: 'Roboto Mono', fontSize: 10, background: true, fontStyles: true
};

function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
    .addItem('Open highlighter', 'showSidebar')
    .addItem('Highlight selection (last settings)', 'quickHighlight')
    .addItem('Clear code formatting', 'quickClear')
    .addToUi();
}

function onInstall(e) { onOpen(e); }

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('sidebar').setTitle('Code Highlighter');
  DocumentApp.getUi().showSidebar(html);
}

// ------------------------------------------------------------------ called from the sidebar

function getConfig() {
  return {
    themes: Object.keys(THEMES).map(function (id) {
      var out = { id: id };
      ['light', 'dark'].forEach(function (mode) {
        var t = resolveTheme(id, mode);
        out[mode] = {
          name: t.name, bg: t.bg, fg: t.fg,
          swatch: ['keyword', 'string', 'function', 'type', 'ros', 'docker'].map(function (k) { return t.styles[k].c; })
        };
      });
      return out;
    }),
    languages: Highlighter.LANGUAGES,
    fonts: FONTS,
    settings: loadSettings_()
  };
}

function highlightSelection(opts) {
  opts = normalizeOpts_(opts);
  saveSettings_(opts);
  var sel = readSelection_();
  var lang = opts.lang === 'auto' ? Highlighter.detect(sel.text) : opts.lang;
  var theme = resolveTheme(opts.theme, opts.mode);
  var tokens = Highlighter.tokenize(sel.text, lang);
  var runs = buildRuns_(tokens, sel.text, theme, opts);
  applyBase_(sel.segments, theme, opts);
  applyRuns_(sel.segments, runs);
  return { lang: lang, langName: Highlighter.langName(lang), runs: runs.length, chars: sel.text.length };
}

function previewSelection(opts) {
  opts = normalizeOpts_(opts);
  var sel = readSelection_();
  var text = sel.text.slice(0, 5000);
  var lang = opts.lang === 'auto' ? Highlighter.detect(text) : opts.lang;
  var theme = resolveTheme(opts.theme, opts.mode);
  return {
    lang: lang, langName: Highlighter.langName(lang),
    html: renderHtml_(text, Highlighter.tokenize(text, lang), theme, opts),
    bg: theme.bg, fg: theme.fg, truncated: sel.text.length > text.length
  };
}

function clearSelection() {
  var sel = readSelection_();
  var A = DocumentApp.Attribute;
  sel.segments.forEach(function (seg) {
    if (!seg.len) return;
    var s = seg.start, e = seg.start + seg.len - 1;
    var attrs = {};
    attrs[A.BOLD] = false;
    attrs[A.ITALIC] = false;
    seg.text.setAttributes(s, e, attrs);
    seg.text.setForegroundColor(s, e, null);
    seg.text.setBackgroundColor(s, e, null);
    seg.text.setFontFamily(s, e, null);
    seg.text.setFontSize(s, e, null);
  });
  return { chars: sel.text.length };
}

// ------------------------------------------------------------------ menu shortcuts

function quickHighlight() {
  try { highlightSelection(loadSettings_()); } catch (err) { DocumentApp.getUi().alert(err.message); }
}

function quickClear() {
  try { clearSelection(); } catch (err) { DocumentApp.getUi().alert(err.message); }
}

// ------------------------------------------------------------------ internals

function normalizeOpts_(o) {
  var s = Object.assign({}, DEFAULT_SETTINGS, o || {});
  s.fontSize = Math.max(0, Math.min(72, Number(s.fontSize) || 0));
  s.background = !!s.background;
  s.fontStyles = !!s.fontStyles;
  // settings saved before themes had modes name a single palette, e.g. 'onedarkpro'
  if (!THEMES[s.theme] && LEGACY_THEMES[s.theme]) {
    if (!o || !o.mode) s.mode = LEGACY_THEMES[s.theme][1];
    s.theme = LEGACY_THEMES[s.theme][0];
  }
  if (!THEMES[s.theme]) s.theme = DEFAULT_THEME;
  if (s.mode !== 'light' && s.mode !== 'dark') s.mode = DEFAULT_MODE;
  return s;
}

function loadSettings_() {
  var raw = PropertiesService.getUserProperties().getProperty(SETTINGS_KEY);
  try { return normalizeOpts_(raw ? JSON.parse(raw) : {}); } catch (e) { return normalizeOpts_({}); }
}

function saveSettings_(opts) {
  PropertiesService.getUserProperties().setProperty(SETTINGS_KEY, JSON.stringify(opts));
}

/**
 * Reads the current selection as one string plus the document segments it came from.
 * Each segment: {text: Text, start: offset in that element, off: offset in the joined string, len}.
 */
function readSelection_() {
  var sel = DocumentApp.getActiveDocument().getSelection();
  if (!sel) throw new Error('Select the code you want to format first.');
  var segments = [], parts = [], off = 0;
  sel.getRangeElements().forEach(function (re) {
    var el = re.getElement();
    if (typeof el.editAsText !== 'function') return; // images, rules, etc.
    var t = el.editAsText();
    var full = t.getText();
    var s = 0, e = full.length - 1;
    if (re.isPartial()) { s = re.getStartOffset(); e = re.getEndOffsetInclusive(); }
    var str = e >= s ? full.substring(s, e + 1) : '';
    if (parts.length) { parts.push('\n'); off += 1; }
    segments.push({ text: t, start: s, off: off, len: str.length });
    parts.push(str);
    off += str.length;
  });
  var text = parts.join('');
  if (!text.trim()) throw new Error('The selection contains no text.');
  return { text: text, segments: segments };
}

function styleKey_(st) { return st.c + (st.b ? 'b' : '') + (st.i ? 'i' : ''); }

/** Converts tokens into styled runs, dropping default-styled tokens and merging neighbours. */
function buildRuns_(tokens, text, theme, opts) {
  var runs = [];
  var baseKey = styleKey_({ c: theme.fg, b: false, i: false });
  tokens.forEach(function (tok) {
    var st = styleFor(theme, tok.t);
    if (!st) return;
    var style = { c: st.c, b: opts.fontStyles && st.b, i: opts.fontStyles && st.i };
    var key = styleKey_(style);
    if (key === baseKey) return;
    var prev = runs[runs.length - 1];
    if (prev && prev.key === key && /^\s*$/.test(text.slice(prev.e, tok.s))) {
      prev.e = tok.e;
    } else {
      runs.push({ s: tok.s, e: tok.e, key: key, style: style });
    }
  });
  return runs;
}

function applyBase_(segments, theme, opts) {
  var A = DocumentApp.Attribute;
  var attrs = {};
  attrs[A.FOREGROUND_COLOR] = theme.fg;
  attrs[A.BOLD] = false;
  attrs[A.ITALIC] = false;
  if (opts.font && opts.font !== 'keep') attrs[A.FONT_FAMILY] = opts.font;
  if (opts.fontSize > 0) attrs[A.FONT_SIZE] = opts.fontSize;
  if (opts.background) attrs[A.BACKGROUND_COLOR] = theme.bg;
  segments.forEach(function (seg) {
    if (!seg.len) return;
    var s = seg.start, e = seg.start + seg.len - 1;
    seg.text.setAttributes(s, e, attrs);
    if (!opts.background) seg.text.setBackgroundColor(s, e, null);
  });
}

function applyRuns_(segments, runs) {
  var A = DocumentApp.Attribute;
  var j = 0;
  runs.forEach(function (run) {
    while (j < segments.length && segments[j].off + segments[j].len <= run.s) j++;
    var attrs = {};
    attrs[A.FOREGROUND_COLOR] = run.style.c;
    attrs[A.BOLD] = run.style.b;
    attrs[A.ITALIC] = run.style.i;
    for (var k = j; k < segments.length && segments[k].off < run.e; k++) {
      var seg = segments[k];
      var a = Math.max(run.s, seg.off), b = Math.min(run.e, seg.off + seg.len);
      if (b > a) seg.text.setAttributes(seg.start + a - seg.off, seg.start + b - seg.off - 1, attrs);
    }
  });
}

function escapeHtml_(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHtml_(text, tokens, theme, opts) {
  var html = '', pos = 0;
  tokens.forEach(function (tok) {
    if (tok.s > pos) html += escapeHtml_(text.slice(pos, tok.s));
    var st = styleFor(theme, tok.t);
    var chunk = escapeHtml_(text.slice(tok.s, tok.e));
    if (st) {
      var css = 'color:' + st.c + (opts.fontStyles && st.b ? ';font-weight:bold' : '') + (opts.fontStyles && st.i ? ';font-style:italic' : '');
      html += '<span style="' + css + '">' + chunk + '</span>';
    } else {
      html += chunk;
    }
    pos = tok.e;
  });
  return html + escapeHtml_(text.slice(pos));
}
