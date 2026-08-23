/* project.js — turn an authored spec into the published guide record, and the
   app's CATALOG into index rows.

   ⛔ SPLICE PARITY IS THE WHOLE POINT. The published guide carries EXACTLY the
   fields scratchpad/clean-rebuild/splice_authored.js emits into the app, and
   nothing else. Not "roughly the same", not "the useful ones" — the same set.
   The moment the library carries a field the app does not render, the two can
   disagree about what a guide says, and the library becomes a second source of
   truth for the same guide. That is the failure this design exists to prevent.

   ⛔ THAT ALLOWLIST IS ALSO THE FIRST LINE OF THE NO-SOURCE-DOCUMENTS RULE. A
   spec carries internal working matter the splice never emits — `file` (a path
   into the manual cache), `sourceClassWhy`, `coverageBasis`, `sourcingNote`,
   `ocrProvenance`. Projecting by allowlist means a new internal field added
   upstream tomorrow is excluded by default rather than published by default.

   ⛔ AND AN UNKNOWN FIELD IS REPORTED, NEVER SILENTLY DROPPED. A silent drop is
   how `quoteGerman` (17 steps) or a future `quoteFrench` becomes an invisible
   content loss that no gate can see. Unknown fields are collected and returned
   so the publisher can print them; known-internal ones are listed explicitly so
   the report distinguishes "deliberately excluded" from "new, look at this".
*/
'use strict';

/* Fields the splice reads off a spec. Anything here reaches the app. */
const SPEC_EMITTED = new Set([
  'row', 'make', 'model',            // identity
  'manual', 'edition', 'year',       // -> sourcedFrom line
  'sha256',                          // -> sourceSha256
  'sourceClass',                     // read, deliberately NOT rendered (Darren struck the label)
  'cleanIntro', 'steps', 'deep', 'deepAbsentReason',
  'cleaning', 'reassembly', 'fncheck',
]);

/* Fields that are internal working matter by design. Named so the report can
   say "excluded on purpose" rather than "unrecognised". */
const SPEC_INTERNAL = new Set([
  'file', 'publisher', 'sourceClassWhy', 'coverageBasis', 'sourcingNote',
  'sourceText', 'ocrProvenance', 'ocrTool', 'ocrDate', 'translationTool',
  'translationDate', 'sourceLang', 'foreignLanguageBasis', 'bestPracticesBasis',
  'searchRecord', 'consulted', 'sources', 'notes', 'coverageNote',
  'typeRowNote', 'rowTestNote', 'hostFirearmNote', 'withdrawalAndRestore',
  'prohibits',
]);

const STEP_EMITTED = new Set([
  'phase', 'title', 'action', 'prose', 'caution', 'aside',
  'quote', 'quoteLang', 'quoteEnglish', 'section', 'warn', 'branch',
]);

const STEP_INTERNAL = new Set([
  'prohibited', 'quoteGerman', 'asideLang', 'asideOriginal', 'warnLang',
  'warnOriginal', 'cautionLang', 'cautionOriginal',
  'cautionOriginalNotContiguousInExtraction', 'm',
]);

const LANGS = { de: 'German', fr: 'French', it: 'Italian', es: 'Spanish',
                pt: 'Portuguese', sv: 'Swedish', ru: 'Russian', nl: 'Dutch' };
const langName = t => LANGS[String(t).toLowerCase()] || String(t);

/* The citation the splice builds for a step. Identical join, identical order. */
function citeFor(spec, st) {
  return [spec.manual, spec.edition, st.section].filter(Boolean).join(' — ');
}

function projectStep(spec, st, unknown, where) {
  Object.keys(st).forEach(k => {
    if (!STEP_EMITTED.has(k) && !STEP_INTERNAL.has(k)) unknown.push(where + '.' + k);
  });

  const out = { phase: st.phase, title: st.title, action: st.action };
  if (st.prose)   out.prose = st.prose;
  if (st.caution) out.caution = st.caution;
  if (st.aside)   out.aside = st.aside;

  /* ⛔ THE TRANSLATION NEVER SITS INSIDE THE QUOTATION. A non-English quote is
     published as the publisher's verbatim sentence PLUS our English rendering,
     under separate keys and with the language named, exactly as stSrcX() draws
     it. Collapsing them into one `quote` field would republish our own prose as
     the manufacturer's words. */
  if (st.quote) {
    out.quote = st.quote;
    out.cite = citeFor(spec, st);
    const lang = st.quoteLang && String(st.quoteLang).toLowerCase();
    if (lang && lang !== 'en' && st.quoteEnglish) {
      out.quoteLang = langName(lang);
      out.quoteEnglish = st.quoteEnglish;   // ours, labelled as ours
    }
  }
  /* no quote -> no cite. citeFor() on a tier (c) row yields "undefined — undefined". */

  if (st.warn)   out.warn = st.warn;
  if (st.branch) out.branch = true;
  return out;
}

/** spec -> published guide record. */
function projectGuide(spec) {
  const unknown = [];
  Object.keys(spec).forEach(k => {
    if (!SPEC_EMITTED.has(k) && !SPEC_INTERNAL.has(k)) unknown.push(k);
  });

  const bp = spec.sourceClass === 'best-practices';
  const g = { row: spec.row, make: spec.make, model: spec.model };

  /* ⛔ A DOCUMENT LINE ONLY WHERE A DOCUMENT EXISTS — a best-practices row has
     none, and emitting one would print provenance for a document that does not
     exist. sourceClass itself is never published: Darren struck the label, so a
     best-practices guide is indistinguishable from a manufacturer one. */
  if (!bp) {
    g.sourcedFrom = spec.manual + ' — ' + spec.edition + ' (' + spec.year + ')';
    g.sourceSha256 = spec.sha256;
  }

  g.cleanIntro = spec.cleanIntro;
  g.steps = (spec.steps || []).map((st, i) => projectStep(spec, st, unknown, 'steps[' + i + ']'));

  if (spec.deep && spec.deep.length) {
    g.deepSteps = spec.deep.map((st, i) => projectStep(spec, st, unknown, 'deep[' + i + ']'));
  } else {
    /* "none documented" is stated, never implied. */
    g.deepAbsentReason = spec.deepAbsentReason;
  }
  if (spec.cleaning && spec.cleaning.length)     g.cleaning = spec.cleaning;
  if (spec.reassembly && spec.reassembly.length) g.reassembly = spec.reassembly;
  if (spec.fncheck) g.fncheck = spec.fncheck;

  return { guide: g, unknown };
}

/* ---------- the catalog ---------- */

/* ⛔ PARSED FROM THE APP'S OWN CATALOG LINE, NOT RETYPED. The catalog is the
   app's; a hand-copied index would drift the first time a row is added there.
   The array is located by its declaration and read as a brace-matched slice, so
   a bracket inside a model name cannot end it early. */
function parseCatalog(html) {
  const decl = 'const CATALOG=[';
  const at = html.indexOf(decl);
  if (at < 0) throw new Error('⛔ REFUSING — the CATALOG declaration was not found in www/index.html');

  const start = at + decl.length - 1;         // the opening bracket
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('⛔ REFUSING — the CATALOG array never closes');

  const rows = JSON.parse(html.slice(start, end));
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('⛔ REFUSING — CATALOG parsed to nothing');
  }
  return rows;
}

/** catalog row -> index record. Short keys expanded to named ones. */
function projectCatalogRow(c) {
  return {
    id: c.i,
    maker: c.mk,
    model: c.md,
    chambering: c.ch,
    family: c.fm || null,
    tier: typeof c.tr === 'number' ? c.tr : null,
    group: c.gp || null,
  };
}

module.exports = {
  projectGuide, parseCatalog, projectCatalogRow, citeFor,
  SPEC_EMITTED, SPEC_INTERNAL, STEP_EMITTED, STEP_INTERNAL,
};
