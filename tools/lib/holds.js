/* holds.js — derive, from the app repo's own records, every row this library is
   forbidden to publish.

   ⛔ NEVER A TYPED LIST. The order is explicit: the SCCY rows held pending the
   attorney, and anything flagged held or restricted, come out of the block
   records — not out of a constant in this file. A typed list is correct exactly
   once and silently wrong forever after; the day a new row is routed to Darren,
   a typed list publishes it.

   THREE RECORD SHAPES, READ ON PURPOSE:

     HELD      <pub>-sourcing/ROWS-PENDING-ADJUDICATION.json
               A row whose answer is a ruling, not a fetch. SCCY's two CPX rows
               are here because both SCCY books carry an ITAR/EAR marking and
               "what may this app distribute internationally" is a question for
               an attorney, not a terminal.

     BLOCKED   <pub>-sourcing/BLOCKED*.json  (BLOCKED.json, BLOCKED-ROWS.json)
               A sourcing gap. Such a row normally has no spec at all, so it
               cannot publish anyway — but it is derived and enforced regardless,
               because "it cannot happen" is not a guard.

     RESTRICTED  the documents named inside a live HELD record.
               A held row is one thing; the DOCUMENT it was held over is another,
               and a second row authored from that same book would walk straight
               past a row-id check. So the documents are collected too and matched
               on the spec's own file path and sha256.

   ⛔ A RESOLVED RECORD IS NOT A HOLD, AND MUST NOT BE READ AS ONE. Two of these
   files are finished: uberti's says "RESOLVED — NOTHING IN THIS FILE IS PENDING
   ANY MORE" and traditions' says "CLOSED — DARREN RULED, ALL SEVEN AUTHORED".
   Treating those as live would withhold guides Darren has already cleared, which
   is a real content loss dressed up as caution. They are skipped BY THEIR OWN
   STATUS FIELD and the skip is reported, so it is visible rather than silent.

   ⛔⛔ AND A FILE WE CANNOT READ ROWS OUT OF IS A HARD ERROR, NEVER A ZERO. The
   shapes genuinely differ — `rows` in most, `rowsPendingAdjudication` in
   pedersoli's. A parser that shrugs and returns [] would report "no holds" for a
   file full of them, and every count downstream would look clean. This lane has
   been bitten by exactly that: a gate that finds nothing is refused, not
   reported clean.
*/
'use strict';

const path = require('path');
const app = require('./appsrc');

const CR = 'scratchpad/clean-rebuild';

/* Keys a hold record may carry its rows under. Extend deliberately; an
   unrecognised shape must raise, not silently read as empty. */
const HOLD_ROW_KEYS = ['rows', 'rowsPendingAdjudication', 'rowsPending'];

/* ⛔ ANCHORED. A record whose status merely mentions the word "resolved" mid
   sentence is still live; only a status that OPENS with the verdict closes it. */
const RESOLVED = /^\s*[^A-Za-z]*\s*(RESOLVED|CLOSED|SUPERSEDED)\b/i;

const rowId = r => (typeof r === 'string' ? r : (r && typeof r === 'object' ? r.row : null));

function statusOf(d) {
  return String(d.status || d.STATUS || d.state || '').trim();
}

/** Every document path a hold record names, so a sibling row cannot reuse the book. */
function docsFrom(d, out, file) {
  const push = v => {
    if (v && typeof v === 'string') out.set(v.replace(/\\/g, '/'), file);
  };
  (d.documentsRead || []).forEach(doc => { if (doc && typeof doc === 'object') push(doc.file); });
  if (d.manual && typeof d.manual === 'object') push(d.manual.file);
  (d.documents || []).forEach(doc => {
    if (typeof doc === 'string') push(doc);
    else if (doc && typeof doc === 'object') push(doc.file);
  });
}

function deriveHolds() {
  const paths = app.lsTree(CR);

  const held = new Map();          // rowId -> {reason, record}
  const heldDocs = new Map();      // document path -> record
  const blocked = new Map();       // rowId -> {reason, record}
  const resolvedSkipped = [];      // {file, status}
  const noRowList = [];            // BLOCKED records that enumerate no rows
  const problems = [];

  /* ---------- HELD ---------- */
  const holdFiles = paths.filter(p =>
    /-sourcing\//.test(p) && /ROWS-PENDING-ADJUDICATION\.json$/.test(path.basename(p)));

  if (!holdFiles.length) {
    throw new Error('⛔ REFUSING — zero ROWS-PENDING-ADJUDICATION records found under ' + CR +
      '.\n   That is not "nothing is held", it is a broken derivation.');
  }

  holdFiles.forEach(f => {
    const d = app.showJson(f);
    const st = statusOf(d);
    if (RESOLVED.test(st)) { resolvedSkipped.push({ file: f, status: st }); return; }

    const key = HOLD_ROW_KEYS.find(k => Array.isArray(d[k]));
    if (!key) {
      problems.push('⛔ ' + f + ' is a LIVE hold record and carries no recognised rows list ' +
        '(looked for: ' + HOLD_ROW_KEYS.join(', ') + '). Refusing to read it as empty.');
      return;
    }
    docsFrom(d, heldDocs, f);
    d[key].forEach(r => {
      const id = rowId(r);
      if (!id) { problems.push('⛔ ' + f + ': a ' + key + ' entry names no row'); return; }
      held.set(id, {
        reason: (r && r.status) || 'pending adjudication',
        note: (r && r.note) || '',
        record: f,
      });
    });
  });

  /* ---------- BLOCKED ---------- */
  const blockFiles = paths.filter(p =>
    /-sourcing\//.test(p) && /^BLOCKED.*\.json$/.test(path.basename(p)));

  if (!blockFiles.length) {
    throw new Error('⛔ REFUSING — zero BLOCKED records found under ' + CR + '.');
  }

  blockFiles.forEach(f => {
    let d;
    try { d = app.showJson(f); }
    catch (e) { problems.push('⛔ ' + f + ': ' + e.message); return; }
    const recs = Array.isArray(d) ? d : [d];
    let sawList = false;
    recs.forEach(r => {
      if (!r || typeof r !== 'object') return;
      if (!Array.isArray(r.rows)) return;
      sawList = true;
      r.rows.forEach(row => {
        const id = rowId(row);
        if (id) blocked.set(id, { reason: r.reason || r.category || 'blocked', record: f });
      });
    });
    if (!sawList) noRowList.push(f);
  });

  /* ---------- the ledger's own row-level block map ---------- */
  const progressPath = CR + '/PROGRESS.json';
  if (app.exists(progressPath)) {
    const pr = app.showJson(progressPath);
    Object.keys(pr.blockedRows || {}).forEach(id => {
      if (!blocked.has(id)) {
        blocked.set(id, { reason: String(pr.blockedRows[id]), record: progressPath });
      }
    });
  }

  if (problems.length) {
    throw new Error('⛔ HOLD DERIVATION FAILED — nothing may publish:\n  ' + problems.join('\n  '));
  }

  return { held, heldDocs, blocked, resolvedSkipped, noRowList,
           holdFileCount: holdFiles.length, blockFileCount: blockFiles.length };
}

module.exports = { deriveHolds };
