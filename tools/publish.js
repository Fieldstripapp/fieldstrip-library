/* publish.js — build the shelf.

   Reads the fieldstrip-app repository AT ITS COMMITTED HEAD, read-only, and
   writes guides/<row>.json, index.json and changelog.json into this repository.

   ⛔ NOTHING HERE IS HAND-COPIED. Guides come from the same authored specs the
   app's splice consumes, through the same projection; the index comes from the
   app's own CATALOG array; the held set comes from the app's own block records.
   Every one of those is regenerated on every run. A hand-maintained copy of any
   of them would be correct on the day it was written and silently wrong after.

   ⛔ THE GUARDS RUN BEFORE ANYTHING IS WRITTEN, ON THE BYTES THAT WOULD BE
   WRITTEN. Not after, not on a sample, not on the previous publish. The whole
   payload is built in memory, refused or cleared as one, and only then does a
   single byte reach the disk.

   Usage:
     node tools/publish.js --dry-run     build and check, write nothing
     node tools/publish.js               build, check, write
*/
'use strict';

const fs = require('fs');
const path = require('path');

const app = require('./lib/appsrc');
const project = require('./lib/project');
const { deriveHolds } = require('./lib/holds');
const guards = require('./lib/guards');

const ROOT = path.resolve(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');
const DRY = process.argv.includes('--dry-run');

const CR = 'scratchpad/clean-rebuild';
const SPECS_DIR = CR + '/authored';

const log = (...a) => console.log(...a);
const j = o => JSON.stringify(o, null, 1) + '\n';

/** Build the entire publish payload in memory. Writes nothing. */
function build() {
  const headCommit = app.head();
  const holds = deriveHolds();

  /* ---------- guides ---------- */
  const specPaths = app.lsTree(SPECS_DIR).filter(p => p.endsWith('.json'));
  if (!specPaths.length) throw new Error('⛔ REFUSING — zero authored specs at HEAD');

  const opNames = operatorNames();
  const guides = [];        // {row, bytes, sourceFile, sha256}
  const refusedHeld = [];   // held rows that HAVE a spec — the live catch
  const quarantined = [];   // guides withheld because their own text leaks a cache path
  const unknownFields = []; // spec fields the projection does not know

  for (const p of specPaths) {
    const spec = app.showJson(p);
    const row = spec.row;
    if (!row) throw new Error('⛔ ' + p + ': spec names no row');

    /* ⛔ HELD ROWS NEVER ENTER THE PAYLOAD. Refusing here — before projection —
       means a held guide is never even built, so it cannot be written by a later
       bug. The guard in run_gates.js is the second line, not the first. */
    if (holds.held.has(row)) {
      const h = holds.held.get(row);
      refusedHeld.push({ row, reason: h.reason, note: h.note, record: h.record, spec: p });
      continue;
    }
    const sf = String(spec.file || '').replace(/\\/g, '/');
    if (sf && [...holds.heldDocs.keys()].some(d => d.toLowerCase() === sf.toLowerCase())) {
      refusedHeld.push({ row, reason: 'authored from a document named in a live hold record',
                         record: holds.heldDocs.get(sf), spec: p });
      continue;
    }

    const { guide, unknown } = project.projectGuide(spec);
    if (unknown.length) unknownFields.push({ row, unknown });

    /* ⛔ A GUIDE THAT NAMES OUR OWN CACHE IS WITHHELD, NOT PUBLISHED AND NOT
       SILENTLY CLEANED. Editing the text here would make the library disagree
       with the app about what the guide says, which is the one thing this
       design exists to prevent — and it would hide a defect that belongs
       upstream, in the spec. So the row is withheld, named in the report, and
       marked in the index, and the fix happens where the defect is. */
    const leak = guards.cacheLeak(guide);
    if (leak) { quarantined.push({ row, leak: 'names our internal cache: ' + leak, spec: p }); continue; }

    /* ⛔ AND THE SAME FOR A PERSON NAMED IN OWNER-FACING COPY. Twelve guides
       carried "(Darren guardrail 2026-08-21)" in deepAbsentReason — an internal
       note that had escaped into published text. Withheld, named, fixed upstream. */
    const pleak = guards.personalLeak(guide, opNames);
    if (pleak) { quarantined.push({ row, leak: pleak, spec: p }); continue; }

    guides.push({
      row,
      bytes: Buffer.from(j(guide), 'utf8'),
      sourceFile: spec.file || null,
      sha256: null,
    });
  }
  guides.forEach(g => { g.sha256 = guards.sha256(g.bytes); });
  guides.sort((a, b) => (a.row < b.row ? -1 : a.row > b.row ? 1 : 0));

  const guideRows = new Set(guides.map(g => g.row));

  /* ---------- plates ----------
     ⛔ READ FROM plates/, NOT REBUILT HERE. Plates are produced by the python
     lane (hunt -> fetch -> verify -> build_plates), which is where the
     public-domain checks live. This publisher's job is to refuse anything that
     did not come through that lane, never to re-derive it. */
  const plates = [];
  const platesDir = path.join(ROOT, 'plates');
  if (fs.existsSync(platesDir)) {
    fs.readdirSync(platesDir).filter(f => f.endsWith('.json')).sort().forEach(f => {
      const bytes = fs.readFileSync(path.join(platesDir, f));
      plates.push({ row: f.replace(/\.json$/, ''), bytes,
                    rec: JSON.parse(bytes.toString('utf8')) });
    });
  }
  const plateImages = [];
  const imgDir = path.join(platesDir, 'img');
  if (fs.existsSync(imgDir)) {
    fs.readdirSync(imgDir).filter(f => f.endsWith('.png')).sort().forEach(f => {
      plateImages.push({ path: 'plates/img/' + f, bytes: fs.readFileSync(path.join(imgDir, f)) });
    });
  }
  const plateRows = new Map(plates.map(p2 => [p2.row, p2.rec]));

  /* ---------- index ---------- */
  const html = app.show('www/index.html');
  const catalog = project.parseCatalog(html);
  /* ⛔ REACHABILITY COMES FROM THE APP'S OWN ROUTING, NOT FROM THE ROW ID. See
     project.parseRouting — one guide may serve many rows by family. */
  const routing = project.parseRouting(html);
  const byId = new Map(guides.map(g => [g.row, g]));
  const reached = new Set();

  const seen = new Set();
  const rows = catalog.map(c => {
    if (seen.has(c.i)) throw new Error('⛔ REFUSING — duplicate catalog row id: ' + c.i);
    seen.add(c.i);
    const r = project.projectCatalogRow(c);
    const gid = project.guideIdFor(routing, c);
    const g = gid ? byId.get(gid) : null;
    r.guide = !!g;
    if (g) {
      reached.add(g.row);
      /* Named whenever a guide is reached, even where it equals the row id, so a
         client never has to know which of the two routes served it. */
      r.guideId = g.row;
      /* The per-guide digest is what makes "everything since version N" checkable
         rather than merely answerable — a client can verify what it fetched. */
      r.guideSha256 = g.sha256;
    }
    else if (holds.held.has(r.id)) r.held = true;        // stated, so the absence is not a mystery
    else if (quarantined.some(q => q.row === (gid || r.id))) r.withheld = true;

    /* ⛔ THE PLATE IS INDEPENDENT OF THE GUIDE, AND SO IS ITS FLAG. A row may have
       a guide and no plate, a plate and no guide, both, or neither — a plate comes
       from a government TM and a guide from the maker's book, and the two lanes
       cover different rows. So this sits OUTSIDE the if/else chain above: hanging
       it off the guide branch would have hidden every plate on a row whose guide
       is still unwritten, which is exactly the row an owner has least else to go on.
       ⛔ AND IT IS KEYED ON THE ROW, NEVER ON gid. A guide may be shared across a
       family by routing; a plate is mapped per row by the row test. */
    const pl = plateRows.get(r.id);
    if (pl) {
      r.plate = true;
      r.plateSha256 = guards.sha256(Buffer.from(JSON.stringify(pl)));
    }
    return r;
  });

  /* ⛔ A GUIDE NO CATALOG ROW CAN REACH IS A GHOST — it can never be opened in
     the app, and its presence means the two repos already disagree. The test is
     reachability, not id equality: `sg_tx1022` is reached by seven 10/22-pattern
     rows through their `fm` field and owns no catalog row at all. */
  const ghosts = [...guideRows].filter(r => !reached.has(r));
  if (ghosts.length) {
    throw new Error('⛔ REFUSING — ' + ghosts.length + ' guide(s) are unreachable from any catalog ' +
                    'row, by id or by family: ' + ghosts.slice(0, 12).join(', '));
  }

  /* ---------- version + changelog ---------- */
  const prevIndex = readJsonIfPresent(path.join(ROOT, 'index.json'));
  const prevLog = readJsonIfPresent(path.join(ROOT, 'changelog.json'));
  const prevVersion = prevIndex && Number.isInteger(prevIndex.version) ? prevIndex.version : 0;
  /* ⛔ KEYED BY THE GUIDE, NOT BY THE ROW. A family guide is reached by several
     rows and owns none of them, so keying this on `id` would find no previous
     entry for it, report it "added" on every run, and bump the version forever —
     destroying the property that a republish with no upstream change is a
     zero-byte diff. `guideId` is written on every row that reaches a guide
     precisely so this comparison has something stable to key on; the `|| r.id`
     fallback reads an index published before that field existed. */
  const prevGuides = new Map(
    (prevIndex ? prevIndex.rows || [] : [])
      .filter(r => r.guide)
      .map(r => [r.guideId || r.id, r.guideSha256 || '']));

  const added = guides.filter(g => !prevGuides.has(g.row)).map(g => g.row);
  const changed = guides.filter(g => prevGuides.has(g.row) && prevGuides.get(g.row) !== g.sha256)
                        .map(g => g.row);
  const removed = [...prevGuides.keys()].filter(r => !guideRows.has(r));

  const prevPlates = new Set((prevIndex ? prevIndex.rows || [] : [])
    .filter(r => r.plate).map(r => r.id));
  const platesAdded = [...plateRows.keys()].filter(r => !prevPlates.has(r)).sort();
  const platesRemoved = [...prevPlates].filter(r => !plateRows.has(r));

  const catalogChanged = !prevIndex ||
    JSON.stringify((prevIndex.rows || []).map(r => r.id)) !== JSON.stringify(rows.map(r => r.id));
  const contentChanged = !prevIndex || added.length || changed.length || removed.length ||
    catalogChanged || platesAdded.length || platesRemoved.length;
  const version = contentChanged ? prevVersion + 1 : prevVersion;

  const index = {
    _doc: 'The Fieldstrip library index. Every catalog row; `guide` says whether ' +
          'guides/<id>.json exists at this version. Generated by tools/publish.js — do not edit.',
    version,
    /* ⛔ LOCAL DATE, NOT UTC. Every dated record in the app repo is written in
       the operator's local date; a UTC stamp puts this publish a day ahead of
       the commit it was built from and makes the two ledgers disagree on sight. */
    /* ⛔ AND AN UNCHANGED PUBLISH KEEPS ITS ORIGINAL DATE. Re-stamping today's
       date on a version whose content did not move would make index.json claim
       a publish that never happened. */
    publishedAt: contentChanged ? localDate() : (prevIndex && prevIndex.publishedAt) || localDate(),
    appCommit: headCommit,
    counts: { catalogRows: rows.length, guides: guides.length, plates: plates.length },
    rows,
  };

  const entry = {
    version,
    publishedAt: index.publishedAt,
    appCommit: headCommit,
    counts: { catalogRows: rows.length, guides: guides.length, plates: plates.length },
    added, changed, removed, platesAdded,
  };
  const changelog = {
    _doc: 'One entry per published index version, newest first. `added` is the row ids ' +
          'whose guide first appeared at that version, so a client holding version N can ' +
          'ask for everything since N without a redesign.',
    versions: contentChanged
      ? [entry].concat((prevLog && prevLog.versions) || [])
      : ((prevLog && prevLog.versions) || [entry]),
  };

  /* ---------- the byte payload the guards judge ---------- */
  const files = guides.map(g => ({ path: 'guides/' + g.row + '.json', bytes: g.bytes }));
  plates.forEach(p2 => files.push({ path: 'plates/' + p2.row + '.json', bytes: p2.bytes }));
  plateImages.forEach(i => files.push(i));
  files.push({ path: 'index.json', bytes: Buffer.from(j(index), 'utf8') });
  files.push({ path: 'changelog.json', bytes: Buffer.from(j(changelog), 'utf8') });

  return { headCommit, headSubject: app.headSubject(), holds, guides, rows, index, changelog,
           files, added, changed, removed, contentChanged, version, prevVersion,
           refusedHeld, quarantined, unknownFields, specCount: specPaths.length,
           plates, plateImages, platesAdded, platesRemoved };
}

function localDate() {
  const d = new Date();
  const p2 = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}

function readJsonIfPresent(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { throw new Error('⛔ existing ' + path.basename(p) + ' is unparseable — ' + e.message); }
}

/** Run all three refusals over the payload. Returns violations by refusal. */
function check(payload, operatorNames) {
  const entries = payload.guides.map(g => ({
    row: g.row, guidePath: 'guides/' + g.row + '.json',
    sourceFile: g.sourceFile, sha256: g.sha256,
  }));
  return {
    'NO SOURCE DOCUMENTS': guards.noSourceDocuments(payload.files),
    'NO HELD ROWS': guards.noHeldRows(entries, payload.holds.held, payload.holds.heldDocs),
    'NO PERSONAL DATA': guards.noPersonalData(payload.files, operatorNames),
    'NO UNVERIFIED PLATE': guards.noUnverifiedPlates(payload.files),
  };
}

function operatorNames() {
  /* Derived from this machine's git identity — the canary is whoever is running
     the publisher, not a name typed into the source. */
  const out = [];
  try {
    const { execFileSync } = require('child_process');
    const n = execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim();
    if (n) out.push(n.split(/\s+/)[0]);
  } catch (e) { /* no identity configured — the other patterns still apply */ }
  return out;
}

function main() {
  log('FIELDSTRIP LIBRARY — publish');
  log('  app repo   : ' + app.APP);

  const payload = build();
  log('  app HEAD   : ' + payload.headCommit);
  log('               ' + payload.headSubject);
  log('');
  log('  authored specs at HEAD : ' + payload.specCount);
  log('  hold records read      : ' + payload.holds.holdFileCount +
      ' (' + payload.holds.resolvedSkipped.length + ' skipped as resolved/closed)');
  log('  block records read     : ' + payload.holds.blockFileCount);
  log('  rows held              : ' + payload.holds.held.size +
      '   documents held: ' + payload.holds.heldDocs.size);
  log('  guides built           : ' + payload.guides.length);
  log('  catalog rows           : ' + payload.rows.length);
  log('  plates                 : ' + payload.plates.length + ' row record(s), ' +
      payload.plateImages.length + ' image(s)');

  if (payload.refusedHeld.length) {
    log('');
    log('  ⛔ HELD ROWS REFUSED THOUGH A SPEC EXISTS — ' + payload.refusedHeld.length);
    payload.refusedHeld.forEach(r =>
      log('     ' + r.row + '  <- ' + r.record + '\n        ' + String(r.reason).slice(0, 120)));
    log('     A spec does not clear a hold. Only Darren does.');
  }
  if (payload.quarantined.length) {
    log('');
    log('  ⛔ GUIDES WITHHELD — a publication defect in the authored text: ' +
        payload.quarantined.length);
    payload.quarantined.forEach(q => log('     ' + q.row + '  — ' + q.leak));
    log('     Fix belongs in the spec, upstream. This publisher will not edit authored text.');
  }
  if (payload.unknownFields.length) {
    log('');
    log('  ⚠ SPEC FIELDS THE PROJECTION DOES NOT KNOW (excluded, not published):');
    payload.unknownFields.slice(0, 20).forEach(u => log('     ' + u.row + ': ' + u.unknown.join(', ')));
  }

  log('');
  log('  REFUSALS');
  const violations = check(payload, operatorNames());
  let failed = 0;
  Object.keys(violations).forEach(name => {
    const v = violations[name];
    if (v.length) {
      failed += v.length;
      log('    ⛔ ' + name + ' — ' + v.length + ' violation(s):');
      v.slice(0, 25).forEach(x => log('       ' + x));
    } else {
      log('    ✅ ' + name + ' — clean');
    }
  });
  if (failed) {
    log('');
    log('⛔ NOTHING WRITTEN. ' + failed + ' violation(s).');
    return 1;
  }

  const total = payload.files.reduce((n, f) => n + f.bytes.length, 0);
  log('');
  log('  index version : ' + payload.version + (payload.contentChanged ? '' : ' (unchanged — nothing to publish)'));
  log('  added / changed / removed : ' + payload.added.length + ' / ' +
      payload.changed.length + ' / ' + payload.removed.length);
  log('  payload size  : ' + (total / 1024).toFixed(1) + ' KiB across ' + payload.files.length + ' files');

  if (DRY) { log('\n  --dry-run: nothing written.'); return 0; }

  /* ⛔ THE GUIDES DIRECTORY IS REBUILT, NOT MERGED. A guide whose row was
     withdrawn upstream must disappear here too; merging would leave it served
     forever. MANIFEST-clobbering has already cost this project once — the fix is
     that the whole directory is derived, so there is nothing to merge. */
  /* ⛔ plates/ IS NOT REBUILT HERE — it is the python lane's output and is already
     on disk. Deleting it the way guides/ is deleted would erase the very files
     this publisher was asked to publish. */
  if (fs.existsSync(GUIDES_DIR)) {
    fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.json'))
      .forEach(f => fs.unlinkSync(path.join(GUIDES_DIR, f)));
  } else {
    fs.mkdirSync(GUIDES_DIR, { recursive: true });
  }
  payload.files.forEach(f => {
    const dest = path.join(ROOT, f.path.replace(/\//g, path.sep));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.bytes);
  });
  log('\n  ✅ written.');
  return 0;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { console.error('\n' + (e && e.message ? e.message : e)); process.exit(2); }
}

module.exports = { build, check, operatorNames };
