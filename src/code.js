/**
 * Code Highlighter — Google Docs editor add-on.
 * Highlights the selected text in place (font, text color, bold/italic, background). No tables.
 *
 * With "Full-width code block" on, every selected line is highlighted in full and its paragraph gets
 * the theme background as paragraph shading, which spans margin to margin. DocumentApp can't set
 * paragraph shading, so that part goes through the Docs API advanced service (`Docs`).
 */

var SETTINGS_KEY = 'codeHighlighter.settings';
var FONTS = ['Roboto Mono', 'Source Code Pro', 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Inconsolata',
  'Ubuntu Mono', 'Space Mono', 'Consolas', 'Courier New'];
var DEFAULT_SETTINGS = {
  lang: 'auto', theme: 'one', mode: 'light', font: 'Roboto Mono', fontSize: 10, background: true, fontStyles: true,
  fullWidth: false
};
var BLOCK_FIELDS = 'shading,borderTop,borderBottom,borderLeft,borderRight,borderBetween,spaceAbove,spaceBelow';

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
  var sel = readSelection_(opts.fullWidth);
  var lang = opts.lang === 'auto' ? Highlighter.detect(sel.text) : opts.lang;
  var theme = resolveTheme(opts.theme, opts.mode);
  var tokens = Highlighter.tokenize(sel.text, lang);
  var runs = buildRuns_(tokens, sel.text, theme, opts);
  var blocks = 0;
  var api = apiTargets_(sel);
  if (api) {
    // fast path: every change in one Docs API request
    var requests = textRequests_(sel.segments, runs, theme, opts, api.tabId);
    if (opts.fullWidth) {
      var para = paragraphRequests_(api.nodes, theme.bg, api.tabId);
      requests = requests.concat(para);
      blocks = para.length;
    }
    if (requests.length) Docs.Documents.batchUpdate({ requests: requests }, api.id);
  } else {
    applyBase_(sel.segments, theme, opts);
    applyRuns_(sel.segments, runs);
    if (opts.fullWidth) blocks = styleParagraphs_(sel.paragraphs, theme.bg);
  }
  if (opts.fullWidth && !blocks) {
    throw new Error('The text was highlighted, but no lines could be shaded as a block. Full-width blocks ' +
      'only work on lines in the document body, not in headers, footers or footnotes.');
  }
  return { lang: lang, langName: Highlighter.langName(lang), runs: runs.length, chars: sel.text.length, lines: blocks };
}

function previewSelection(opts) {
  opts = normalizeOpts_(opts);
  var sel = readSelection_(opts.fullWidth);
  var text = sel.text.slice(0, 5000);
  var lang = opts.lang === 'auto' ? Highlighter.detect(text) : opts.lang;
  var theme = resolveTheme(opts.theme, opts.mode);
  return {
    lang: lang, langName: Highlighter.langName(lang),
    html: renderHtml_(text, Highlighter.tokenize(text, lang), theme, opts),
    bg: theme.bg, fg: theme.fg, truncated: sel.text.length > text.length
  };
}

function clearSelection(opts) {
  opts = normalizeOpts_(opts || loadSettings_());
  var sel = readSelection_(opts.fullWidth);
  var api = apiTargets_(sel);
  if (api) {
    var requests = [];
    sel.segments.forEach(function (seg) {
      if (!seg.len) return;
      requests.push({ updateTextStyle: { range: apiRange_(seg.api, seg.api + seg.len, api.tabId), textStyle: {},
        fields: 'foregroundColor,backgroundColor,bold,italic,weightedFontFamily,fontSize' } });
    });
    var para = paragraphRequests_(api.nodes, null, api.tabId);
    requests = requests.concat(para);
    if (requests.length) Docs.Documents.batchUpdate({ requests: requests }, api.id);
    return { chars: sel.text.length, lines: para.length };
  }
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
  var blocks = styleParagraphs_(sel.paragraphs, null);
  return { chars: sel.text.length, lines: blocks };
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
  s.fullWidth = !!s.fullWidth;
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
 * Each segment: {text: Text, start: offset in that element, off: offset in the joined string, len,
 * para: its Paragraph / ListItem, whole: true when the Text spans that whole paragraph, so `start` is
 * also an offset into the paragraph, full: the element's whole text}.
 * With wholeLines, every paragraph the selection touches is read in full.
 * Also returns the touched paragraphs (Paragraph / ListItem elements), each listed once.
 */
function readSelection_(wholeLines) {
  var sel = DocumentApp.getActiveDocument().getSelection();
  if (!sel) throw new Error('Select the code you want to format first.');
  var segments = [], parts = [], paragraphs = [], off = 0;
  sel.getRangeElements().forEach(function (re) {
    var el = re.getElement();
    var para = paragraphOf_(el);
    var known = paragraphs.indexOf(para) >= 0;
    if (para && !known) paragraphs.push(para);
    if (wholeLines && para) {
      if (known) return;
      el = para;
    }
    if (typeof el.editAsText !== 'function') return; // images, rules, etc.
    var t = el.editAsText();
    var full = t.getText();
    var s = 0, e = full.length - 1;
    if (re.isPartial() && !(wholeLines && para)) { s = re.getStartOffset(); e = re.getEndOffsetInclusive(); }
    var str = e >= s ? full.substring(s, e + 1) : '';
    if (parts.length) { parts.push('\n'); off += 1; }
    var whole = !!para && (el === para || para.getNumChildren() === 1);
    segments.push({ text: t, start: s, off: off, len: str.length, para: para, whole: whole, full: full });
    parts.push(str);
    off += str.length;
  });
  var text = parts.join('');
  if (!text.trim()) throw new Error('The selection contains no text.');
  return { text: text, segments: segments, paragraphs: paragraphs };
}

/** The Paragraph or ListItem containing el (or el itself), or null. */
function paragraphOf_(el) {
  var T = DocumentApp.ElementType;
  while (el && el.getType() !== T.PARAGRAPH && el.getType() !== T.LIST_ITEM) el = el.getParent();
  return el || null;
}

/**
 * Child-index path from the document body down to el, e.g. [4] for the fifth body element or
 * [2, 0, 1, 3] for the fourth paragraph in row 0, cell 1 of the table at body index 2.
 * Null when el is not in the body (headers, footers, footnotes).
 */
function bodyPath_(el) {
  var path = [];
  for (var p = el.getParent(); p; el = p, p = p.getParent()) {
    path.unshift(p.getChildIndex(el));
    if (p.getType() === DocumentApp.ElementType.BODY_SECTION) return path;
  }
  return null;
}

/** Finds the Docs API paragraph element for a bodyPath_() path. */
function apiParagraphAt_(content, path) {
  var items = function (c) { return (c || []).filter(function (x) { return !x.sectionBreak; }); };
  var node = items(content)[path[0]], i = 1;
  while (node && node.table && i + 2 < path.length) {
    var row = node.table.tableRows[path[i]];
    var cell = row && row.tableCells[path[i + 1]];
    node = cell && items(cell.content)[path[i + 2]];
    i += 3;
  }
  return node && node.paragraph && i === path.length ? node : null;
}

/**
 * Gives paragraphs margin-to-margin shading in color bg, with matching borders as padding and no
 * gaps between lines, so consecutive lines merge into one block. bg = null removes that styling
 * from paragraphs that have shading. Saves the document first, so no DocumentApp calls may follow.
 * Returns the number of paragraphs changed.
 */
function styleParagraphs_(paragraphs, bg) {
  var paths = paragraphs.map(bodyPath_).filter(function (p) { return p; });
  if (!paths.length) return 0;
  var docApp = DocumentApp.getActiveDocument();
  var id = docApp.getId();
  var tabId = activeTabId_(docApp);
  docApp.saveAndClose(); // the Docs API only sees changes once DocumentApp has saved them
  var content = apiBodyContent_(id, tabId);
  if (!content) return 0;
  var nodes = paths.map(function (path) { return apiParagraphAt_(content, path); });
  var requests = paragraphRequests_(nodes, bg, tabId);
  if (requests.length) Docs.Documents.batchUpdate({ requests: requests }, id);
  return requests.length;
}

/**
 * updateParagraphStyle requests for the block styling of styleParagraphs_(). Skips null nodes, and
 * with bg = null only includes paragraphs that have shading.
 */
function paragraphRequests_(nodes, bg, tabId) {
  var style = {}, fields = BLOCK_FIELDS;
  if (bg) {
    var color = { color: { rgbColor: hexToRgb_(bg) } };
    var border = function (pad) {
      return { color: color, width: { magnitude: 1, unit: 'PT' }, padding: { magnitude: pad, unit: 'PT' }, dashStyle: 'SOLID' };
    };
    style = {
      shading: { backgroundColor: color },
      borderTop: border(6), borderBottom: border(6), borderLeft: border(6), borderRight: border(6),
      borderBetween: border(0),
      spaceAbove: { magnitude: 0, unit: 'PT' }, spaceBelow: { magnitude: 0, unit: 'PT' }
    };
  }
  var requests = [];
  nodes.forEach(function (node) {
    if (!node) return;
    if (!bg) {
      var sh = node.paragraph.paragraphStyle && node.paragraph.paragraphStyle.shading;
      if (!(sh && sh.backgroundColor && sh.backgroundColor.color)) return;
    }
    requests.push({ updateParagraphStyle: {
      range: apiRange_(node.startIndex || 0, node.endIndex, tabId), paragraphStyle: style, fields: fields
    } });
  });
  return requests;
}

function activeTabId_(docApp) {
  try { return docApp.getActiveTab().getId(); } catch (e) { return null; /* runtime without tabs */ }
}

function apiRange_(start, end, tabId) {
  var r = { startIndex: start, endIndex: end };
  if (tabId) r.tabId = tabId;
  return r;
}

/** A paragraph's text as the Docs API sees it; non-text elements become \u0000 so they never match. */
function apiParagraphText_(node) {
  return (node.paragraph.elements || []).map(function (e) {
    return e.textRun ? e.textRun.content : '\u0000';
  }).join('').replace(/\n$/, '');
}

/**
 * Locates the selection in the Docs API's view of the document, setting seg.api (the API index of
 * seg.start) on each segment. Returns {id, tabId, nodes: API paragraph per sel.paragraphs entry}, or
 * null when some part can't be mapped reliably (headers, inline images, chips, line breaks, ...), in
 * which case the caller falls back to DocumentApp.
 */
function apiTargets_(sel) {
  if (!sel.segments.every(function (seg) { return seg.whole; })) return null;
  var paths = sel.paragraphs.map(bodyPath_);
  if (paths.some(function (p) { return !p; })) return null;
  var docApp = DocumentApp.getActiveDocument();
  var id = docApp.getId(), tabId = activeTabId_(docApp);
  var content = apiBodyContent_(id, tabId);
  if (!content) return null;
  var nodes = paths.map(function (path) { return apiParagraphAt_(content, path); });
  if (nodes.some(function (n) { return !n; })) return null;
  for (var k = 0; k < sel.segments.length; k++) {
    var seg = sel.segments[k];
    var node = nodes[sel.paragraphs.indexOf(seg.para)];
    if (!node || apiParagraphText_(node) !== seg.full) return null;
    seg.api = node.startIndex + seg.start;
  }
  return { id: id, tabId: tabId, nodes: nodes };
}

/** updateTextStyle requests for the base style of every segment and then each colored run. */
function textRequests_(segments, runs, theme, opts, tabId) {
  var requests = [];
  var color = function (hex) { return { color: { rgbColor: hexToRgb_(hex) } }; };
  var base = { foregroundColor: color(theme.fg), bold: false, italic: false };
  var fields = ['foregroundColor', 'bold', 'italic', 'backgroundColor'];
  if (opts.font && opts.font !== 'keep') { base.weightedFontFamily = { fontFamily: opts.font }; fields.push('weightedFontFamily'); }
  if (opts.fontSize > 0) { base.fontSize = { magnitude: opts.fontSize, unit: 'PT' }; fields.push('fontSize'); }
  // a full-width block colors the whole paragraph, so the text itself needs no highlight
  if (opts.background && !opts.fullWidth) base.backgroundColor = color(theme.bg);
  segments.forEach(function (seg) {
    if (!seg.len) return;
    requests.push({ updateTextStyle: { range: apiRange_(seg.api, seg.api + seg.len, tabId), textStyle: base,
      fields: fields.join(',') } });
  });
  var j = 0;
  runs.forEach(function (run) {
    while (j < segments.length && segments[j].off + segments[j].len <= run.s) j++;
    var style = { foregroundColor: color(run.style.c), bold: run.style.b, italic: run.style.i };
    for (var k = j; k < segments.length && segments[k].off < run.e; k++) {
      var seg = segments[k];
      var a = Math.max(run.s, seg.off), b = Math.min(run.e, seg.off + seg.len);
      if (b <= a) continue;
      requests.push({ updateTextStyle: { range: apiRange_(seg.api + a - seg.off, seg.api + b - seg.off, tabId),
        textStyle: style, fields: 'foregroundColor,bold,italic' } });
    }
  });
  return requests;
}

/** Body content of the given tab (or of the document when tabId is null), from the Docs API. */
function apiBodyContent_(id, tabId) {
  if (!tabId) return Docs.Documents.get(id).body.content;
  var find = function (tabs) {
    for (var k = 0; k < (tabs || []).length; k++) {
      if (tabs[k].tabProperties.tabId === tabId) return tabs[k];
      var child = find(tabs[k].childTabs);
      if (child) return child;
    }
    return null;
  };
  var tab = find(Docs.Documents.get(id, { includeTabsContent: true }).tabs);
  return tab && tab.documentTab ? tab.documentTab.body.content : null;
}

function hexToRgb_(hex) {
  return { red: parseInt(hex.substr(1, 2), 16) / 255, green: parseInt(hex.substr(3, 2), 16) / 255,
    blue: parseInt(hex.substr(5, 2), 16) / 255 };
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
  // a full-width block colors the whole paragraph, so the text itself needs no highlight
  var textBg = opts.background && !opts.fullWidth;
  if (textBg) attrs[A.BACKGROUND_COLOR] = theme.bg;
  segments.forEach(function (seg) {
    if (!seg.len) return;
    var s = seg.start, e = seg.start + seg.len - 1;
    seg.text.setAttributes(s, e, attrs);
    if (!textBg) seg.text.setBackgroundColor(s, e, null);
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
