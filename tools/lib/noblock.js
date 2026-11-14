/* noblock.js — THE RED "DO NOT" BLOCK, SHELF AGAINST APP, AND EVERYTHING ELSE THE APP DRAWS THAT THE SHELF MIGHT DROP.

   ⛔ WHY THIS EXISTS (Darren 2026-11-14 11:45). The app draws a maker's prohibition as a red "Do not" block at the head
   of the step: the maker's own sentence in quotation marks with its citation (the app's fsNoHtml, Darren 2026-10-17).
   The app has read that block off a downloaded step since the day it was ruled — and this shelf never sent it, because
   the projection listed `prohibited` as internal working matter. A guide downloaded from the library showed the step as
   an ordinary card. 165 guides, 297 steps; nothing measured it, because parity.js compares only the provenance line.

   WHAT IS COMPARED, FOR EVERY GUIDE AND EVERY STEP:
     · the APP side is the app's own emitter's output for the spec — the generated SOURCED GUIDES block (shelf_block.js at
       the app's committed HEAD), EVALUATED, so each step's `no` is read as the object the app would hold, not by regex
     · the SHELF side is the guide record as published (the payload about to be written, or the bytes served)
     · both are then DRAWN by the app's own fsNoHtml, lifted out of the app page at HEAD with the helpers it calls, and
       the two pieces of HTML must be identical; the count of blocks per guide must be identical; and the sentence and
       the citation are compared as stored strings too, so a difference the drawing would hide is still a difference
   A renderer that cannot be lifted out of the page REFUSES: a comparison that silently fell back to something weaker
   would be this same defect again.

   ownerVisibleDrops() is the generic half: every field the app's emitter writes onto a guide or a step, by name, that
   the published record does not carry with the same value. The publisher prints it on every run. */
'use strict';

const BEGIN = '/* ===== BEGIN SOURCED GUIDES';
const END = '/* ===== END SOURCED GUIDES ===== */';

/** Evaluate the generated block. Body helpers (stA, stSrc, …) return '' — the body is not this file's subject; tgStep
 *  keeps the extra object exactly as the emitter wrote it. Returns Map(row -> guide object). */
function evalBlock(text) {
  const b = text.indexOf(BEGIN), e = text.indexOf(END);
  if (b < 0 || e < 0) throw new Error('⛔ REFUSING — no generated SOURCED GUIDES block in the text given');
  const src = text.slice(b, e);
  if (!/const SOURCED_GUIDES = \{/.test(src)) throw new Error('⛔ REFUSING — the block does not declare SOURCED_GUIDES');
  const tgStep = (phase, title, body, extra) => Object.assign({ phase, title, body }, extra || {});
  const own = { tgStep, GUNS: {} };
  const scope = new Proxy(own, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : (k in globalThis ? globalThis[k] : () => ''))),
  });
  // eslint-disable-next-line no-new-func
  const guides = new Function('scope', 'with (scope) {\n' + src + '\n; return SOURCED_GUIDES; }')(scope);
  const out = new Map();
  Object.keys(guides).forEach(k => { if (k.indexOf('sg_') === 0) out.set(k.slice(3), guides[k]); });
  if (!out.size) throw new Error('⛔ REFUSING — the SOURCED GUIDES block evaluated to no guide');
  return out;
}

/* lift one declaration out of the page: `function name(` to its matching brace, or a one-line `const name=` */
function liftFunction(html, name) {
  const at = html.indexOf('\n  function ' + name + '(');
  if (at < 0) throw new Error('⛔ REFUSING — the app page has no function ' + name + ' (the Do-not renderer cannot be lifted)');
  const open = html.indexOf('{', html.indexOf(')', at));
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(at, i + 1); }
  }
  throw new Error('⛔ REFUSING — function ' + name + ' never closes');
}
function liftConst(html, re, name) {
  const m = re.exec(html);
  if (!m) throw new Error('⛔ REFUSING — the app page has no ' + name + ' (the Do-not renderer cannot be lifted)');
  return m[0];
}

/** The app's own drawing of a step's Do-not block: step -> HTML ('' when the step has none). */
function noRenderer(html) {
  const parts = [
    liftConst(html, /\n  const esc = s => String\(s\)[^\n]*;/, 'HTML esc'),
    liftConst(html, /\n  const FS_CITE_NOTE=[^\n]*;/, 'FS_CITE_NOTE'),
    liftFunction(html, 'fsCiteNb'),
    liftFunction(html, 'citeShow'),
    liftConst(html, /\n  const fsWhoShow=who=>[^\n]*;/, 'fsWhoShow'),
    liftFunction(html, 'fsNoHtml'),
  ];
  // eslint-disable-next-line no-new-func
  const fn = new Function(parts.join('\n') + '\n  return fsNoHtml;')();
  /* it must actually draw: a known block in, a red block with the sentence and the citation out */
  const probe = fn({ body: '', no: { q: 'DO NOT DO THIS.', who: 'Fixture', src: 'Fixture Manual — SAFETY, p.3' } });
  if (!/st-no/.test(probe) || probe.indexOf('DO NOT DO THIS.') < 0 || probe.indexOf('p.3') < 0 || fn({ body: '' }) !== '') {
    throw new Error('⛔ REFUSING — the lifted fsNoHtml does not draw a Do-not block the way this gate expects');
  }
  return fn;
}

/* what the app does with a SHELF step (libStepFrom): a block only when the step carries no.q */
const shelfNo = st => (st && st.no && st.no.q) ? st.no : null;
const appNo = st => (st && st.no && st.no.q) ? st.no : null;

/** compare(shelfGuides: Map(row -> published guide record), blockGuides: Map(row -> app guide object), render)
 *  -> { guides, appBlocks, shelfBlocks, bad: [string] } */
function compare(shelfGuides, blockGuides, render) {
  const bad = [], passage = []; let appBlocks = 0, shelfBlocks = 0, guides = 0;
  for (const [row, g] of shelfGuides) {
    const a = blockGuides.get(row);
    if (!a) { bad.push(row + ': on the shelf, absent from the app\'s emitted block'); continue; }
    guides++;
    let na = 0, ns = 0;
    for (const [ak, sk, label] of [['steps', 'steps', 'step'], ['deepSteps', 'deepSteps', 'deep step']]) {
      const as = a[ak] || [], ss = g[sk] || [];
      if (as.length !== ss.length) { bad.push(row + ': ' + label + ' count differs (app ' + as.length + ', shelf ' + ss.length + ')'); continue; }
      for (let i = 0; i < as.length; i++) {
        const x = appNo(as[i]), y = shelfNo(ss[i]);
        if (x) na++; if (y) ns++;
        const where = row + ' ' + label + ' ' + (i + 1) + ' "' + String(as[i].title || '').slice(0, 60) + '"';
        if (!x && !y) continue;
        if (x && !y) { bad.push(where + ': the app draws a Do-not block, the shelf carries none'); continue; }
        if (!x && y) { bad.push(where + ': the shelf carries a Do-not block the app does not draw'); continue; }
        if (x.q !== y.q) { bad.push(where + ': the sentence differs'); continue; }
        if (x.src !== y.src || x.who !== y.who) { bad.push(where + ': the citation differs'); continue; }
        /* drawn by the app's own function, on the step as each side holds it */
        const ha = render({ body: '', no: x }), hs = render({ body: '', no: y });
        if (ha !== hs || !ha) bad.push(where + ': the drawn block differs');
        /* carried correctly, but a PASSAGE step: see appDrawsPassageNo() */
        if (ss[i].box === 'passage') passage.push(row + ' ' + label + ' ' + (i + 1));
      }
    }
    appBlocks += na; shelfBlocks += ns;
    if (na !== ns && !bad.some(b => b.indexOf(row + ' ') === 0 || b.indexOf(row + ':') === 0)) bad.push(row + ': block count differs (app ' + na + ', shelf ' + ns + ')');
  }
  for (const row of blockGuides.keys()) if (!shelfGuides.has(row)) { /* a held or withheld row: not this gate's subject */ }
  return { guides, appBlocks, shelfBlocks, bad, passage };
}

/* ⛔ THE ONE PLACE THE SHELF CANNOT FIX (found 2026-11-14, routed to Darren — his order of that day bars any app
   change). The app assembles a downloaded PASSAGE step on its own early path (libStepFrom: `if (st.box === "passage")
   return tgStep(…, { src, passage: true })`) and that path does not copy `no`, while the app's emitter DOES put the
   block on a compiled-in passage step. So a Do-not block on a passage step is carried by the shelf and still not drawn
   from a download until the app changes. KNOWN_PASSAGE_GAP is every such step today; the gate holds it EXACTLY: a new
   one fails (the gap grew), and one that is gone — or an app whose passage path has learned `no` — fails too, so this
   list cannot outlive its reason. It only shrinks. */
const KNOWN_PASSAGE_GAP = ['caniksfxrivals deep step 1', 'caniksfxrivals deep step 2', 'caniksfxrivals deep step 3'];
/** does the app's shelf-step assembly copy `no` on its passage path? Read off the page at HEAD. */
function appDrawsPassageNo(html) {
  const fn = liftFunction(html, 'libStepFrom');
  const at = fn.indexOf('if (st.box === "passage") {');
  if (at < 0) throw new Error('⛔ REFUSING — libStepFrom has no passage path where this gate expects it');
  const end = fn.indexOf('\n    }', at);
  if (end < 0) throw new Error('⛔ REFUSING — libStepFrom\'s passage path never closes');
  return /\bst\.no\b/.test(fn.slice(at, end));
}

/* ---------------- every emitted field, by name ---------------- */
/* assembled by the app from the record's parts, or the same fact under another key: compared elsewhere, not by name */
const TOP_ASSEMBLED = new Set(['textMode', 'parts', 'origins', 'steps', 'deepSteps']);
const STEP_ASSEMBLED = new Set(['phase', 'title', 'body', 'src', 'passage']);
/* the app quotes a warning only when warnSrc is exactly "maker" (www/index.html renderStep), so that is what is compared */
const norm = (k, v) => (k === 'warnSrc' ? (v === 'maker') : v);
const same = (k, a, b) => JSON.stringify(norm(k, a)) === JSON.stringify(norm(k, b));

/** ownerVisibleDrops(shelfGuides, blockGuides) -> [{ field, guides, places, example }]: a field the app's emitter wrote
 *  that the published record does not carry with the same value. `prohibited` is the app's flag for a Do-not step and is
 *  carried as `no` — it counts as dropped exactly when the block is. */
function ownerVisibleDrops(shelfGuides, blockGuides) {
  const acc = new Map();
  const hit = (field, row) => { const e = acc.get(field) || { field, rows: new Set(), places: 0, example: row }; e.rows.add(row); e.places++; acc.set(field, e); };
  for (const [row, g] of shelfGuides) {
    const a = blockGuides.get(row); if (!a) continue;
    Object.keys(a).forEach(k => { if (!TOP_ASSEMBLED.has(k) && a[k] !== undefined && !same(k, a[k], g[k])) hit(k, row); });
    for (const k of ['steps', 'deepSteps']) {
      const as = a[k] || [], ss = g[k] || [];
      for (let i = 0; i < Math.min(as.length, ss.length); i++) {
        Object.keys(as[i]).forEach(f => {
          if (STEP_ASSEMBLED.has(f)) return;
          if (f === 'prohibited') { if (!shelfNo(ss[i])) hit('step.prohibited (the red Do-not card)', row); return; }
          if (f === 'no') { if (!same(f, as[i].no, ss[i].no)) hit('step.no (the red Do-not block)', row); return; }
          if (as[i][f] !== undefined && as[i][f] !== '' && !same(f, as[i][f], ss[i][f])) hit('step.' + f, row);
        });
      }
    }
  }
  return [...acc.values()].map(e => ({ field: e.field, guides: e.rows.size, places: e.places, example: e.example }))
    .sort((x, y) => y.guides - x.guides);
}

module.exports = { evalBlock, noRenderer, compare, ownerVisibleDrops, appDrawsPassageNo, KNOWN_PASSAGE_GAP };
