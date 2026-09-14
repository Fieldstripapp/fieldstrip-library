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
  /* ⛔ A ROW MAY CITE TWO OF THE MAKER'S OWN BOOKS (app, 2026-08-23). Walther's SSP-E
     supplement tells the owner in print to use the SSP manual as well, so `waltherssp e`
     names both. Without these keys the projection EXCLUDED them and then built every
     doc:2 step's citation from the FIRST book — putting the SSP manual's name under four
     sentences that are the supplement's. A wrong citation is worse than none: the shelf
     would be asserting provenance it does not have. */
  'manual2', 'edition2', 'sha256_2',
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
  /* ⛔ file2 IS A REPO PATH, exactly like `file`, and is excluded for the same
     reason. Named here so the report says "excluded on purpose" instead of
     "new, look at this" — an unrecognised field is a prompt to read, and a
     prompt that fires every run on a known exclusion trains people past it. */
  'file2',
]);

const STEP_EMITTED = new Set([
  'phase', 'title', 'action', 'prose', 'caution', 'aside',
  'quote', 'quoteLang', 'quoteEnglish', 'section', 'warn', 'branch',
  /* ⛔ gloss — OUR MARGIN NOTE ON A MAKER'S PASSAGE, and without it a passage
     step is broken rather than merely plainer. A passage carries NO action: the
     maker's sentence IS the content, and stPassage(quote, cite, gloss) draws our
     note under it. Excluded, a downloaded passage step would render the maker's
     words with an empty margin — the one place the app speaks in its own voice
     about his, silently missing. Measured: 6 steps, all on one guide today. */
  'gloss',
  /* ⛔ `doc` NAMES WHICH OF THE ROW'S TWO BOOKS THIS STEP CAME FROM, and it must reach
     citeFor() or the citation is built from the wrong one. It is read, not rendered:
     the reader sees the second book's NAME in the citation, never the index. */
  'doc',
  /* ⛔ warnSrc — WHOSE SENTENCE THE WARNING IS (Darren ruling, vC34 item 17).
     714 of the app's 1,637 warn values were measured to be the manufacturer's
     own words, verbatim in the book the row cites, and every one of them was
     rendering as unattributed prose. The app now draws a maker's warning in
     quotation marks and ours plain — no label, no badge. This shelf publishes
     the SAME guides to the same owners, so excluding the flag here would
     re-create the defect on a public page: a reader unsure whose sentence he is
     reading. The flag is decided upstream against the repository's own verbatim
     oracle, never here. */
  'warnSrc',
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
  /* a step marked doc:2 belongs to the SECOND book and is cited to it by name and
     edition — the same rule splice_authored.js applies on the app side */
  const man = st.doc === 2 ? spec.manual2 : spec.manual;
  const ed = st.doc === 2 ? spec.edition2 : spec.edition;
  return [man, ed, st.section].filter(Boolean).join(' — ');
}

function projectStep(spec, st, unknown, where, box) {
  Object.keys(st).forEach(k => {
    if (!STEP_EMITTED.has(k) && !STEP_INTERNAL.has(k)) unknown.push(where + '.' + k);
  });

  const out = { phase: st.phase, title: st.title, action: st.action };
  /* ⛔ WHICH QUOTATION FORM THE APP DRAWS FOR THIS STEP, read off the app's own
     generated block by tools/lib/quotebox.js — never decided here. A fetched
     guide has to present a manufacturer's words exactly as the compiled-in one
     does, and the phone cannot re-run the build-time detector that decides it. */
  if (box && box.box) out.box = box.box;
  /* only ever on a passage, which is the only form that draws it */
  if (st.gloss && box && box.box === 'passage') out.gloss = st.gloss;
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
  /* only ever alongside a warn, and only the two values the sweep writes */
  if (st.warn && (st.warnSrc === 'maker' || st.warnSrc === 'ours')) out.warnSrc = st.warnSrc;
  /* ⛔ THE BRANCH FLAG COMES FROM THE EMITTED BLOCK, NOT FROM THE SPEC. The
     splice DERIVES it for a guide with a deep section and no authored branch,
     in memory, and never writes it back — so `st.branch` is false for 83 guides
     that nonetheless render a DEEP CLEAN door in the app. Publishing the spec's
     value would ship those guides without their deep door. The spec's own flag
     still counts where it exists, so a guide the app has not spliced yet is not
     silently stripped of one it authored. */
  if ((box && box.branch) || st.branch) out.branch = true;
  return out;
}

/** spec -> published guide record.
 *
 *  `boxes` is {steps:[verdict], deep:[verdict]} for this row, read out of the
 *  app's generated block. Absent (a spec the app has not spliced yet) means no
 *  `box` field is emitted rather than a guessed one — see the refusal in
 *  publish.js, which will not publish a guide the app has not compiled.
 */
function projectGuide(spec, boxes) {
  const unknown = [];
  const bx = boxes || { steps: [], deep: [] };
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
    g.sourcedFrom = spec.manual + ' — ' + spec.edition + ' (' + spec.year + ')' +
      (spec.manual2 ? '  +  ' + spec.manual2 + ' — ' + spec.edition2 : '');
    g.sourceSha256 = spec.sha256;
    if (spec.sha256_2) g.sourceSha256_2 = spec.sha256_2;
  }

  g.cleanIntro = spec.cleanIntro;
  g.steps = (spec.steps || []).map((st, i) => projectStep(spec, st, unknown, 'steps[' + i + ']', bx.steps[i]));

  if (spec.deep && spec.deep.length) {
    g.deepSteps = spec.deep.map((st, i) => projectStep(spec, st, unknown, 'deep[' + i + ']', bx.deep[i]));
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

/* ⛔ A GUIDE IS NOT ALWAYS REACHED BY ROW ID, AND ASSUMING SO REFUSED A WHOLE
   PUBLISH. Until 2026-08-22 every authored spec's `row` was a catalog row id, so
   "one spec, one row" held and the publisher enforced it as an invariant: a
   guide with no catalog row is a ghost, unreachable in the app.

   Then the app shipped `sg_tx1022` — one guide written for the 10/22 PATTERN,
   reached by `TEXT_GUIDE_FAM` from each clone row's own `fm` field, deliberately
   NOT duplicated per brand (rule 7: no brand list in the routing path). It has no
   catalog row of its own and is reachable by seven of them. The old invariant
   called it a ghost and refused the entire publish.

   So reachability is now READ OUT OF THE APP'S OWN ROUTING rather than inferred
   from the id, in the same order `fkey()` resolves it: the row's own spec first,
   then its family. Anything the app can reach, the library can publish; anything
   it cannot is still a ghost. */
function parseRouting(html) {
  const obj = (decl, required) => {
    const at = html.indexOf(decl);
    if (at < 0) {
      if (required) throw new Error('⛔ REFUSING — "' + decl + '" not found in www/index.html');
      return {};
    }
    const start = html.indexOf('{', at);
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < html.length; i++) {
      const c = html[i];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') { inStr = true; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) throw new Error('⛔ REFUSING — "' + decl + '" never closes');
    return JSON.parse(html.slice(start, end));
  };
  /* SOURCED_FOR is generated by the splice and must exist; TEXT_GUIDE_FAM may
     legitimately be empty, but its ABSENCE is different from being empty and is
     not treated as "no families". */
  const sourcedFor = obj('const SOURCED_FOR = {', true);
  const textGuideFam = obj('const TEXT_GUIDE_FAM = {', true);
  if (!Object.keys(sourcedFor).length) {
    throw new Error('⛔ REFUSING — SOURCED_FOR parsed to nothing; the routing read is broken');
  }
  return { sourcedFor, textGuideFam };
}

/** The guide id a catalog row reaches, or null. `sg_` is the app's key prefix;
 *  the published guide is named for the SPEC row underneath it. */
function guideIdFor(routing, c) {
  const key = routing.sourcedFor[c.i] || (c.fm ? routing.textGuideFam[c.fm] : null);
  return key ? String(key).replace(/^sg_/, '') : null;
}

/** catalog row -> index record. Short keys expanded to named ones.
 *
 *  ⛔ `category` IS PUBLISHED AND THE FIELD LIST IS NOT AN OVERSIGHT. The app's
 *  picker renders "<chambering> · <category>" on every card and searches the
 *  category text; a row that arrives by delta without it would render a card
 *  with a dangling separator and would be unfindable by the words an owner
 *  actually types. Uniformity is a ruling: a delta row must render exactly as a
 *  shipped row does.
 */
function projectCatalogRow(c) {
  return {
    id: c.i,
    maker: c.mk,
    model: c.md,
    chambering: c.ch,
    category: c.ct || null,
    family: c.fm || null,
    tier: typeof c.tr === 'number' ? c.tr : null,
    group: c.gp || null,
  };
}

/* ⛔ THE ROW VERDICT, READ OUT OF THE APP'S OWN GENERATED BLOCK. A row that
   reaches the phone by delta has no entry in the app's compiled DOOR_VERDICT —
   it did not exist when that build was made — so without this the door would
   fall back to "we don't have it yet" for every new row, including the ones the
   manual hunt proved the maker publishes nothing for.
   ⛔ AND IT IS READ, NEVER RE-DERIVED. tools/library/gen_door_verdicts.js in the
   app repo derives it from the hunt's per-row verdicts and the blocked ledger
   and writes the block; this republishes what that wrote. Two derivations of
   "does this manufacturer publish a procedure" is exactly the disagreement the
   sentence cannot survive. */
function parseDoorVerdict(html) {
  const decl = 'const DOOR_VERDICT = {';
  const at = html.indexOf(decl);
  if (at < 0) {
    throw new Error('⛔ REFUSING — the app has no generated DOOR_VERDICT block at HEAD');
  }
  const start = html.indexOf('{', at);
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
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('⛔ REFUSING — DOOR_VERDICT never closes');
  return JSON.parse(html.slice(start, end));
}

module.exports = {
  projectGuide, parseCatalog, projectCatalogRow, citeFor, parseRouting, guideIdFor,
  parseDoorVerdict,
  SPEC_EMITTED, SPEC_INTERNAL, STEP_EMITTED, STEP_INTERNAL,
};
