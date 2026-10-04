/* test_appcommit.js — A NO-CHANGE PUBLISH LEAVES THE LIBRARY BYTE-IDENTICAL (Darren repair order 2026-10-04).

   The 2026-10-03 night published nothing (0 added, 0 changed, 0 removed, version 20 unchanged) and still
   rewrote index.json: appCommit took the app's new HEAD. That stray edit sat uncommitted in this repository
   and told the shelf it had been built from a commit it never was. The fix keeps appCommit on a no-change run.

   Run THE publisher's own build() — no copy of its logic — against a scratch output folder (--out), with
   the app HEAD swapped through lib/appsrc (the one module the publisher asks for it):
     1. seed the scratch folder with this repository's published index.json + changelog.json and build once
        at the real app HEAD → the state S1 (written to the scratch folder, exactly as main() writes it);
     2. NO CHANGE: build again with a DIFFERENT app HEAD and nothing else moved → index.json and
        changelog.json must be byte-identical to S1, appCommit unchanged, version unchanged;
     3. REAL PUBLISH: move one catalog row in the previous index (so the content differs) and build with that
        different HEAD → the version goes up and appCommit IS the new HEAD.
   Nothing in this repository is written; the scratch folder is removed at the end.

   Usage: node tools/test_appcommit.js [--prove-fail]
     --prove-fail   the old stamp put back (FIELDSTRIP_PUBLISH_PROVE_FAIL=stamp): exactly the NO CHANGE
                    assertions must go red, the REAL PUBLISH ones must stay green
   Exit 0 pass · 1 fail.
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROVE = process.argv.includes('--prove-fail');
if (PROVE) process.env.FIELDSTRIP_PUBLISH_PROVE_FAIL = 'stamp';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-appcommit-'));
process.argv.push('--out', tmp);                       /* publish.js reads --out at load */
const app = require('./lib/appsrc');
const { build } = require('./publish');

let n = 0, f = 0; const failed = [];
const T = (name, ok, d) => { n++; if (!ok) { f++; failed.push(name); } console.log((ok ? 'ok    ' : 'FAIL  ') + name + (ok || d === undefined ? '' : '  -- ' + String(d).slice(0, 400))); };
const fileOf = (p, name) => (p.files.find(x => x.path === name) || {}).bytes;

try {
  ['index.json', 'changelog.json'].forEach(x => fs.copyFileSync(path.join(ROOT, x), path.join(tmp, x)));
  const realHead = app.head();
  const p1 = build();
  ['index.json', 'changelog.json'].forEach(x => fs.writeFileSync(path.join(tmp, x), fileOf(p1, x)));
  const s1Index = fs.readFileSync(path.join(tmp, 'index.json')), s1Log = fs.readFileSync(path.join(tmp, 'changelog.json'));
  const s1 = JSON.parse(s1Index);
  const shelf = JSON.parse(fs.readFileSync(path.join(ROOT, 'index.json'), 'utf8'));
  /* the 2026-10-03 shape itself: today's app HEAD against the published shelf. When it publishes nothing,
     appCommit must stay the shelf's; when it would publish, it must take the HEAD */
  T('THE REAL SHELF at app HEAD ' + realHead.slice(0, 8) + ': ' + (p1.contentChanged ? 'content moved, appCommit takes the HEAD' : 'nothing to publish, appCommit stays the shelf\'s (' + String(shelf.appCommit).slice(0, 8) + ')'),
    p1.contentChanged ? s1.appCommit === realHead : (s1.appCommit === shelf.appCommit && Buffer.compare(s1Index, fs.readFileSync(path.join(ROOT, 'index.json'))) === 0),
    JSON.stringify({ contentChanged: p1.contentChanged, s1: s1.appCommit, shelf: shelf.appCommit }));

  /* 2. no change, a different app HEAD */
  const otherHead = 'f'.repeat(40);
  app.head = () => otherHead;
  const p2 = build();
  T('NO CHANGE: the run publishes nothing (0 added / 0 changed / 0 removed, version unchanged)',
    !p2.contentChanged && p2.added.length === 0 && p2.changed.length === 0 && p2.removed.length === 0 && p2.index.version === s1.version,
    JSON.stringify({ contentChanged: p2.contentChanged, a: p2.added.length, c: p2.changed.length, r: p2.removed.length, v: p2.index.version }));
  T('NO CHANGE: appCommit stays the commit the content was built from — not the new app HEAD', p2.index.appCommit === s1.appCommit && p2.index.appCommit !== otherHead, p2.index.appCommit);
  T('NO CHANGE: index.json is byte-identical', Buffer.compare(fileOf(p2, 'index.json'), s1Index) === 0, 'bytes ' + fileOf(p2, 'index.json').length + ' vs ' + s1Index.length);
  T('NO CHANGE: changelog.json is byte-identical', Buffer.compare(fileOf(p2, 'changelog.json'), s1Log) === 0);

  /* 3. a real publish: the previous index differs by one row, so the content moved */
  const moved = JSON.parse(s1Index);
  moved.rows = moved.rows.slice(0, -1);
  fs.writeFileSync(path.join(tmp, 'index.json'), JSON.stringify(moved, null, 1) + '\n');
  const p3 = build();
  T('REAL PUBLISH: content moved, so the version goes up', p3.contentChanged && p3.index.version === s1.version + 1, JSON.stringify({ contentChanged: p3.contentChanged, v: p3.index.version }));
  T('REAL PUBLISH: appCommit IS updated to the app HEAD it was built from', p3.index.appCommit === otherHead, p3.index.appCommit);
} catch (e) {
  T('the test ran to the end', false, e.stack || e.message);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (PROVE) {
  /* the plant must redden the no-change appCommit and index.json checks — and the real-shelf check, which IS the
     2026-10-03 no-change night — while the real publish stays green */
  const ok = failed.length > 0 && failed.every(x => /^NO CHANGE: (appCommit|index\.json)|^THE REAL SHELF/.test(x)) && failed.some(x => /appCommit stays/.test(x)) && !failed.some(x => /^REAL PUBLISH/.test(x));
  console.log('\n' + (ok ? 'PROVE-FAIL OK: with the old stamp put back, exactly the no-change appCommit/index.json assertions went RED; the real publish stayed green.' : 'PROVE-FAIL BROKEN: red: ' + (failed.join(' | ') || 'nothing')));
  process.exit(ok ? 0 : 1);
}
console.log('\n' + (f ? '⛔ APPCOMMIT TEST FAILED (' + f + ' of ' + n + ')' : 'APPCOMMIT TEST PASSED — ' + n + ' checks: a no-change publish leaves index.json and changelog.json byte-identical; a real publish updates appCommit.'));
process.exit(f ? 1 : 0);
