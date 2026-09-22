/* quotebox.js — WHICH QUOTATION FORM A STEP DRAWS, read off the app itself.

   ⛔ THE DECISION IS NOT MADE HERE, AND THAT IS THE WHOLE POINT.
   splice_authored.js decides, per step, whether the manufacturer's sentence is
   drawn as a quotation box (stSrc), an inline limit line with his name on it
   (stLimit), a bilingual block carrying the original AND our labelled English
   (stSrcX), a passage in his own register (stPassage), or not at all. It makes
   that call at BUILD time, in Node, with a Python detector beside it.

   A guide the phone FETCHES has to reach the same answer, and the phone has
   neither. So the verdict travels with the published guide — and it is obtained
   the only way that cannot drift: by READING WHAT THE APP ACTUALLY EMITTED.

   ⛔ RE-DERIVING IT WOULD BE A SECOND ANSWER to "what did the manufacturer say",
   which is the one question this project never allows two answers to. An earlier
   version of this shelf carried a re-implementation of the splice's branch and a
   gate that measured the two against each other. That gate passed — 9,182 steps,
   zero disagreements — and it was still the wrong shape: two mechanisms held in
   step by a third. The generated SOURCED GUIDES block in www/index.html already
   contains the decision, one call per step. This reads it.

   ⛔ AND IT IS READ AT HEAD, like every other app read on this shelf. The block
   is a fixed commit's bytes, so a publish is reproducible and can be named in
   the changelog.

   The five verdicts, named for what the reader sees:

     "none"       no quotation drawn. The action says it; the spec still holds
                  the verbatim sentence and every gate still reads it.
     "quote"      stSrc — the quotation box, kept where the action is under
                  eight words and removing it would leave a title and a fragment.
     "limit"      stLimit — the maker's voice where it PROTECTS the owner, as ONE
                  inline line with his name on it, never a box.
     "bilingual"  stSrcX — a non-English sentence: the maker's original in
                  quotation marks, our English under it, labelled as ours.
     "passage"    stPassage — a maker's passage IS the content; it carries no
                  action of its own, only a citation and our margin gloss.
*/
'use strict';

const BEGIN = '/* ===== BEGIN SOURCED GUIDES';
const END = '/* ===== END SOURCED GUIDES ===== */';

/* ⛔ LONGEST NAME FIRST. `stSrcX` contains `stSrc`; tested the other way round a
   bilingual step would read as an ordinary quotation box and the maker's
   original sentence would be dropped from the published record. */
function callOf(chunk) {
  if (/\bstPassage\(/.test(chunk)) return 'passage';
  if (/\bstSrcX\(/.test(chunk)) return 'bilingual';
  if (/\bstSrc\(/.test(chunk)) return 'quote';
  if (/\bstLimit\(/.test(chunk)) return 'limit';
  return 'none';
}

/* ⛔ THE BRANCH FLAG IS READ HERE TOO, AND IT HAS TO BE. A guide with a deep
   section must carry a branch:true strip step or its DEEP CLEAN door never
   renders (the app's `bb.hidden = !(s.branch && !WALK.deep && gun.deepSteps)`).
   splice_authored.js DERIVES that flag in memory for any guide whose spec has a
   deep section and no authored branch — 83 guides corpus-wide at the walk-48
   ruling — and never writes it back to the spec. So a shelf that published only
   what the spec carries would ship those guides with no deep door, and a fetched
   guide would silently lose a whole section the compiled-in one has.
   Reading it off the emitted block gets the derived flag for free, and by the
   same mechanism as the quotation verdict: one read, both facts, no second
   derivation to keep in step. */
function branchOf(chunk) {
  return /[{,]"branch":true[,}]/.test(chunk);
}

/**
 * Parse the app's generated guide block into
 *   Map<row, {steps: [verdict], deep: [verdict]}>
 * keyed by the SPEC row (the `sg_` prefix is the app's key, not the row).
 *
 * ⛔ A BLOCK THAT PARSES TO NOTHING IS A REFUSAL, NEVER AN EMPTY ANSWER. If this
 * returned {} on a changed emitter, every guide would publish with `box:"none"`
 * and every fetched guide would quietly lose its maker's quotations.
 */
/* ⛔ THE TEXT GIVEN IS THE SHELF BLOCK NOW (ruling 2026-09-22): scratchpad/clean-rebuild/
   shelf_block.js at the app's HEAD — the app's emitter run over EVERY spec — rather than the
   page, which carries only the subset the app bakes in. Same markers, same parser; the page
   is still read by guideBodies() for the app ⊆ shelf guard. */
function readBlock(html) {
  const b = html.indexOf(BEGIN), e = html.indexOf(END);
  if (b < 0 || e < 0) {
    throw new Error('⛔ REFUSING — no generated SOURCED GUIDES block in the text given (the page or shelf_block.js)');
  }
  const block = html.slice(b, e);

  const starts = [];
  const re = /"sg_([^"]+)":\s*\{/g;
  let m;
  while ((m = re.exec(block)) !== null) starts.push({ row: m[1], at: m.index });
  if (!starts.length) {
    throw new Error('⛔ REFUSING — the SOURCED GUIDES block parsed to zero guides');
  }

  const out = new Map();
  starts.forEach((s, i) => {
    const body = block.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : block.length);
    /* `deepSteps:[` opens the deep list; everything before it is the base flow.
       Both lists emit steps at the same indentation, so one split serves both
       once the boundary is known. */
    const dAt = body.indexOf('\n      deepSteps:[');
    const split = src => src.split('\n        tgStep(').slice(1)
      .map(chunk => ({ box: callOf(chunk), branch: branchOf(chunk) }));
    out.set(s.row, {
      steps: split(dAt < 0 ? body : body.slice(0, dAt)),
      deep: dAt < 0 ? [] : split(body.slice(dAt)),
    });
  });
  return out;
}

/** Totals, so a publish can report what it read rather than assert it. */
function census(map) {
  const c = { guides: map.size, steps: 0, verdicts: {}, branch: 0 };
  map.forEach(v => {
    [].concat(v.steps, v.deep).forEach(s => {
      c.steps++;
      c.verdicts[s.box] = (c.verdicts[s.box] || 0) + 1;
      if (s.branch) c.branch++;
    });
  });
  return c;
}

/**
 * The emitted TEXT of every guide in a block, keyed by row — for the app ⊆ shelf guard.
 * A body runs from its `"sg_<row>": {` to the 4-space closing brace of that guide, so the
 * trailing SOURCED_FOR of a block (which differs between the app's subset and the shelf's
 * superset by construction) never leaks into the last guide's comparison.
 */
function guideBodies(text) {
  const b = text.indexOf(BEGIN), e = text.indexOf(END);
  if (b < 0 || e < 0) throw new Error('⛔ REFUSING — no generated SOURCED GUIDES block in the text given');
  const block = text.slice(b, e).replace(/\r\n/g, '\n');
  const re = /"sg_([^"]+)":\s*\{/g;
  const starts = [];
  let m;
  while ((m = re.exec(block)) !== null) starts.push({ row: m[1], at: m.index });
  if (!starts.length) throw new Error('⛔ REFUSING — the SOURCED GUIDES block parsed to zero guides');
  const out = new Map();
  starts.forEach((s, i) => {
    let body = block.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : block.length);
    const close = body.lastIndexOf('\n    }');
    if (close < 0) throw new Error('⛔ REFUSING — guide ' + s.row + ' never closes');
    body = body.slice(0, close + 6);
    out.set(s.row, body);
  });
  return out;
}

module.exports = { guideBodies, readBlock, census, callOf, branchOf, BEGIN, END };
