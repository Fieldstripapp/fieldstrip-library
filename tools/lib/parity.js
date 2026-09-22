/* parity.js — prove the library and the app say the same thing.

   ⛔ SHARING A PROJECTION IS AN ARGUMENT, NOT A MEASUREMENT. tools/lib/project.js
   is written to emit exactly what splice_authored.js emits, and that is the
   reason to believe the two agree — but a reason is not evidence, and the two
   files can drift the moment either side is edited. This measures the claim
   against the app's ACTUAL spliced output at HEAD.

   What it compares, per guide, is the provenance line and the document digest:
   `sourcedFrom` and `sourceSha256`. Those are the fields that say WHICH BOOK a
   guide's words came from, so a disagreement there is the serious kind — the
   library would be citing a different document than the app for the same row.

   ⛔ A GUIDE ON THE SHELF THAT THE APP DOES NOT CARRY IS NOT A MISMATCH — IT IS
   THE RULING (Darren, 2026-09-22): the shelf may hold guides the app does not,
   and the app bakes in a subset of the shelf. Those are reported as SHELF-ONLY.
   ⛔ THE OTHER DIRECTION IS THE DEFECT. A guide the app compiles in that the
   shelf does not publish violates app ⊆ shelf and is returned as appOnly, which
   the gates treat as a refusal.
*/
'use strict';

/** Pull `sg_<row>` provenance out of the app's generated SOURCED_GUIDES block. */
function spliceProvenance(html) {
  const BEGIN = '/* ===== BEGIN SOURCED GUIDES';
  const END = '/* ===== END SOURCED GUIDES ===== */';
  const b = html.indexOf(BEGIN), e = html.indexOf(END);
  if (b < 0 || e < 0) {
    throw new Error('⛔ REFUSING — the app has no generated SOURCED GUIDES block at HEAD');
  }
  const block = html.slice(b, e);

  const out = new Map();
  /* Each guide opens `"sg_<row>": {` and may carry sourcedFrom / sourceSha256
     before the next one opens. Tier (c) rows carry neither, by design.

     ⛔ THE ROW IS EVERYTHING UP TO THE CLOSING QUOTE, NOT [A-Za-z0-9_]+.
     Measured 2026-09-14: the stricter class silently skipped `waltherssp e`,
     whose id carries a space — so this gate reported it as "authored since the
     app last ran its splice" when the app HAD spliced it, and never checked its
     provenance at all. That row is the one guide in the corpus citing TWO of the
     maker's own books, which makes it precisely the row whose provenance line is
     most worth comparing. A character class is an assumption about ids; the
     closing quote is the actual delimiter. */
  const re = /"sg_([^"]+)":\s*\{/g;
  const starts = [];
  let m;
  while ((m = re.exec(block)) !== null) starts.push({ row: m[1], at: m.index });

  starts.forEach((s, i) => {
    const body = block.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : block.length);
    const sf = body.match(/\n\s*sourcedFrom:\s*("(?:[^"\\]|\\.)*")/);
    const sh = body.match(/\n\s*sourceSha256:\s*("(?:[^"\\]|\\.)*")/);
    out.set(s.row, {
      sourcedFrom: sf ? JSON.parse(sf[1]) : null,
      sourceSha256: sh ? JSON.parse(sh[1]) : null,
    });
  });
  if (!out.size) throw new Error('⛔ REFUSING — the SOURCED GUIDES block parsed to zero guides');
  return out;
}

/**
 * guides: [{row, bytes}] as the publisher built them.
 * Returns {checked, mismatches[], shelfOnly[], appOnly[], appGuides}
 */
function compare(guides, html) {
  const app = spliceProvenance(html);
  const mismatches = [], shelfOnly = [];
  let checked = 0;
  const mineRows = new Set(guides.map(g => g.row));
  const appOnly = [...app.keys()].filter(r => !mineRows.has(r));

  for (const g of guides) {
    const mine = JSON.parse(g.bytes.toString('utf8'));
    const theirs = app.get(g.row);
    if (!theirs) { shelfOnly.push(g.row); continue; }
    checked++;
    const a = mine.sourcedFrom || null, b = theirs.sourcedFrom || null;
    if (a !== b) {
      mismatches.push(g.row + ': sourcedFrom differs\n        library: ' + JSON.stringify(a) +
                      '\n        app    : ' + JSON.stringify(b));
    }
    const x = mine.sourceSha256 || null, y = theirs.sourceSha256 || null;
    if (x !== y) {
      mismatches.push(g.row + ': sourceSha256 differs — library ' + x + ' vs app ' + y);
    }
  }
  return { checked, mismatches, shelfOnly, appOnly, appGuides: app.size };
}

module.exports = { compare, spliceProvenance };
