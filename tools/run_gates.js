/* run_gates.js — prove the refusals refuse, before trusting that they passed.

   ⛔ A GUARD THAT HAS NEVER REFUSED ANYTHING IS NOT A GUARD. Every refusal here
   is fired at a fixture built to trip it, EVERY RUN, and a fixture that fails to
   trip its guard fails this suite exactly as loudly as a real violation. That is
   the only thing that makes a green "clean" mean anything: this project has
   already shipped three filters that were ANTI-CORRELATED with their own target
   and reported clean the whole time.

   ⛔ AND EVERY REFUSAL IS FIRED AT A CONTROL IT MUST *NOT* REFUSE. A guard that
   refuses everything passes a fixture test and is useless — it would withhold
   the entire shelf. The controls are drawn from real published content: a
   manufacturer's customer-service phone number, a part number shaped like an
   SSN, a citation naming the publisher's own PDF. Each of those tripped, or
   nearly tripped, an early draft of these patterns.

   ⛔ THE SUITE ASSERTS ITS OWN COMPLETENESS. Every refusal exported by
   lib/guards.js must be named in CASES below. Adding a fourth refusal without a
   fixture fails here rather than shipping unproven.

   ⛔ NO FIXTURE IS COMMITTED. They are built in memory at run time. A repo that
   is public from birth has no business containing a file that looks like a
   manufacturer PDF, even a fake one, and a fixture on disk is a fixture someone
   will eventually add to an exception list.

   Usage: node tools/run_gates.js
*/
'use strict';

const guards = require('./lib/guards');
const parity = require('./lib/parity');
const app = require('./lib/appsrc');
const publish = require('./publish');
const noblock = require('./lib/noblock');
/* --prove-fail=nofield: the Do-not block left off the published records again, the way it was until 2026-11-14.
   The RED DO-NOT BLOCKS line on the live payload must go red, and only it; then this exits 0. */
const PROVE = (process.argv.find(a => /^--prove-fail=/.test(a)) || '').split('=')[1] || null;
if (PROVE && PROVE !== 'nofield') { console.error('unknown --prove-fail mode: ' + PROVE); process.exit(2); }

const B = s => Buffer.from(s, 'utf8');
const cleanGuide = {
  row: 'fixturerow', make: 'Fixture', model: 'Control',
  sourcedFrom: 'Fixture Manual — 1st edition (2026)',
  sourceSha256: 'a'.repeat(64),
  cleanIntro: 'A control guide that every refusal must let through.',
  steps: [{ phase: 'Clear', title: 'Prove it is unloaded', action: 'Magazine out, chamber checked.',
            quote: 'MAKE SURE THE FIREARM IS UNLOADED.', cite: 'Fixture Manual — 1st edition — SAFETY' }],
  deepAbsentReason: 'The fixture publisher documents no deep clean.',
};
const asFile = (p, o) => ({ path: p, bytes: B(JSON.stringify(o, null, 1)) });

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const plateImg = (name = '0123456789abcdef') =>
  ({ path: 'plates/img/' + name + '.png', bytes: PNG });
const cleanPlate = {
  row: 'fixturerow', plateId: 'fixture-plate', title: 'Bolt Carrier Assembly',
  image: 'plates/img/0123456789abcdef.png',
  labels: [{ item: '1', name: 'PIN,FIRING' }],
  provenance: {
    tm: 'ARMY TM 9-1005-319-23&P', edition: 'May 1991, Change 5',
    figure: 'Figure C-2. Bolt Carrier Assembly', page: 261,
    sourceUrl: 'https://archive.org/download/example/TM.pdf',
    documentSha256: 'b'.repeat(64),
    publicDomain: {
      distribution: 'Distribution A — approved for public release, unlimited',
      preparer: 'issued by a US Government authority',
      reprint: 'no commercial reprint matter found',
      exportMarking: 'no export-control marking on the document',
    },
  },
};
const plateFile = o => asFile('plates/' + (o.row || 'x') + '.json', o);
const withProv = patch => {
  const c = JSON.parse(JSON.stringify(cleanPlate));
  Object.assign(c.provenance, patch);
  return c;
};

/* Each case: the guard, fixtures that MUST be refused, controls that MUST pass. */
const CASES = {
  'NO SOURCE DOCUMENTS': {
    run: files => guards.noSourceDocuments(files),
    mustRefuse: [
      ['a manufacturer PDF renamed to .json', () => [{
        path: 'guides/manual.json',
        /* the real thing's opening bytes — caught on content, not on name */
        bytes: B('%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n1 0 obj<</Type/Catalog>>'),
      }]],
      ['a PDF committed under its own extension', () => [{
        path: 'guides/ruger-lcp-manual.pdf', bytes: B('%PDF-1.4'),
      }]],
      ['a PDF smuggled into the plate image path', () => [{
        path: 'plates/img/0123456789abcdef.png', bytes: B('%PDF-1.7 not a png at all'),
      }]],
      ['an image outside the plate path', () => [{
        path: 'guides/diagram.png', bytes: PNG,
      }]],
      ['an extraction text file', () => [{
        path: 'scratchpad/manuals/_text/ruger/lcp.rawtxt', bytes: B('SAFETY AND INSTRUCTION MANUAL'),
      }]],
      ['a guide carrying an unpublishable field', () => [
        asFile('guides/leak.json', Object.assign({}, cleanGuide, { file: 'scratchpad/manuals/x.pdf' })),
      ]],
      ['a guide whose prose names our internal cache', () => [
        asFile('guides/leak2.json', Object.assign({}, cleanGuide, {
          deepAbsentReason: 'That sentence occurs only in scratchpad/manuals/_text/rugged/x.rawtxt line 53.',
        })),
      ]],
      ['a guide step carrying an unpublishable field', () => [
        asFile('guides/leak3.json', Object.assign({}, cleanGuide, {
          steps: [Object.assign({}, cleanGuide.steps[0], { prohibited: 'internal working note' })],
        })),
      ]],
      ['a Do-not block carrying a field of its own', () => [
        asFile('guides/leak4.json', Object.assign({}, cleanGuide, {
          steps: [Object.assign({}, cleanGuide.steps[0], { no: { q: 'DO NOT DISASSEMBLE.', who: 'Fixture', src: 'Fixture Manual — SAFETY', file: 'scratchpad/manuals/x.pdf' } })],
        })),
      ]],
      ['a Do-not block with no maker sentence in it', () => [
        asFile('guides/leak5.json', Object.assign({}, cleanGuide, {
          steps: [Object.assign({}, cleanGuide.steps[0], { no: { q: '', who: 'Fixture', src: 'Fixture Manual — SAFETY' } })],
        })),
      ]],
    ],
    mustPass: [
      ['a clean guide', () => [asFile('guides/fixturerow.json', cleanGuide)]],
      ['a step carrying the maker\'s Do-not block', () => [
        asFile('guides/fixturerow.json', Object.assign({}, cleanGuide, {
          steps: [Object.assign({}, cleanGuide.steps[0], { no: { q: 'DO NOT DISASSEMBLE.', who: 'Fixture', src: 'Fixture Manual — 1st edition — SAFETY' } })],
        })),
      ]],
      /* The plate path is the one place a binary is allowed — narrowly. */
      ['a content-addressed plate PNG', () => [plateImg()]],
      /* ⛔ THE ONE THAT MATTERS. Four real guides cite the publisher's OWN
         published filename; an early `\.pdf` content test refused all of them. */
      ['a citation naming the publisher\'s own published PDF', () => [
        asFile('guides/cite.json', Object.assign({}, cleanGuide, {
          sourcedFrom: 'Bergara B-14 Manual — the file the maker published as B14-manual-3.21.pdf (2021)',
        })),
      ]],
    ],
  },

  'NO HELD ROWS': {
    /* Held sets are passed in rather than derived, so the fixture is about the
       guard's judgement, not about re-testing the derivation. */
    run: entries => guards.noHeldRows(
      entries,
      new Map([['sccycpx1', { reason: 'pending adjudication — export marking', record: 'sccy-sourcing/ROWS-PENDING-ADJUDICATION.json' }]]),
      new Map([['scratchpad/manuals/_viewonly/archive-sccy/ModelCPX_UserManual.pdf', 'sccy-sourcing/ROWS-PENDING-ADJUDICATION.json']])),
    mustRefuse: [
      ['the SCCY row held pending the attorney', () => [{ row: 'sccycpx1', sourceFile: null }]],
      ['a different row authored from the held document', () => [
        { row: 'sccycpx3', sourceFile: 'scratchpad/manuals/_viewonly/archive-sccy/ModelCPX_UserManual.pdf' },
      ]],
      ['the held document named with Windows separators', () => [
        { row: 'sccycpx4', sourceFile: 'scratchpad\\manuals\\_viewonly\\archive-sccy\\ModelCPX_UserManual.pdf' },
      ]],
    ],
    mustPass: [
      ['an unheld row from an unheld document', () => [
        { row: 'rugerlcp', sourceFile: 'scratchpad/manuals/_viewonly/ruger/lcp.pdf' },
      ]],
    ],
  },

  'NO PERSONAL DATA': {
    /* ⚠ NO extraNames PASSED ON PURPOSE. The canary that matters must come from
       guards.PERSON_CANARIES itself; passing the name in here would test the
       fixture rather than the guard, which is exactly how the real leak of
       twelve guides survived a green run. */
    run: files => guards.noPersonalData(files, []),
    mustRefuse: [
      ['an email address in guide text', () => [
        asFile('guides/pd1.json', Object.assign({}, cleanGuide, {
          cleanIntro: 'Questions to owner@example.invalid before stripping.',
        })),
      ]],
      ['a Windows user-profile path', () => [
        asFile('guides/pd2.json', Object.assign({}, cleanGuide, {
          cleanIntro: 'Cached at C:\\Users\\operator\\fieldstrip-app for reference.',
        })),
      ]],
      ['a home-directory path', () => [
        asFile('guides/pd3.json', Object.assign({}, cleanGuide, { cleanIntro: 'See /home/dezrt/notes.' })),
      ]],
      ['the operator named in escaped internal prose', () => [
        asFile('guides/pd4.json', Object.assign({}, cleanGuide, {
          cleanIntro: 'Hand-downloaded by Darren and delivered 2026-08-21.',
        })),
      ]],
      ['a credential', () => [
        asFile('guides/pd5.json', Object.assign({}, cleanGuide, {
          cleanIntro: 'token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123',
        })),
      ]],
    ],
    mustPass: [
      ['a clean guide', () => [asFile('guides/fixturerow.json', cleanGuide)]],
      /* ⛔ CONTROLS AGAINST OVER-REFUSAL. A manufacturer's published support
         number is corporate contact detail, not personal data, and a part number
         wears the same shape as an SSN. Refusing either would delete verbatim
         quotes to catch nothing. */
      ['a manufacturer support number in a verbatim quote', () => [
        asFile('guides/ctl1.json', Object.assign({}, cleanGuide, {
          cleanIntro: 'Ruger\'s book prints "call 336-949-5200" for service.',
        })),
      ]],
      ['a part number shaped like an SSN', () => [
        asFile('guides/ctl2.json', Object.assign({}, cleanGuide, {
          cleanIntro: 'The CA book is part number 045-0056-00, the standard book 045-0053-00.',
        })),
      ]],
    ],
  },

  'NO UNVERIFIED PLATE': {
    run: files => guards.noUnverifiedPlates(files),
    mustRefuse: [
      ['a plate from a manufacturer host', () => [
        plateFile(withProv({ sourceUrl: 'https://www.sigsauer.com/manuals/p320.pdf' })), plateImg(),
      ]],
      ['a plate whose source is not a government TM/FM', () => [
        plateFile(withProv({ tm: 'Beretta 92 Series Operators Manual' })), plateImg(),
      ]],
      ['a plate on an UNMARKED distribution finding', () => [
        plateFile((() => { const c = JSON.parse(JSON.stringify(cleanPlate));
          c.provenance.publicDomain.distribution = 'UNMARKED — no distribution statement';
          return c; })()), plateImg(),
      ]],
      ['a plate on a Distribution C document', () => [
        plateFile((() => { const c = JSON.parse(JSON.stringify(cleanPlate));
          c.provenance.publicDomain.distribution = 'Distribution C — a release control';
          return c; })()), plateImg(),
      ]],
      ['a plate missing its document digest', () => [
        plateFile(withProv({ documentSha256: '' })), plateImg(),
      ]],
      ['a plate missing a public-domain check', () => [
        plateFile((() => { const c = JSON.parse(JSON.stringify(cleanPlate));
          delete c.provenance.publicDomain.exportMarking; return c; })()), plateImg(),
      ]],
      ['a plate with no numbered-part labels', () => [
        plateFile(Object.assign({}, cleanPlate, { labels: [] })), plateImg(),
      ]],
      ['a plate image no record references', () => [
        plateFile(cleanPlate), plateImg(), plateImg('fedcba9876543210'),
      ]],
    ],
    mustPass: [
      ['a fully provenanced Distribution A plate', () => [plateFile(cleanPlate), plateImg()]],
      ['no plates at all', () => []],
    ],
  },
};

function main() {
  let failed = 0;
  const line = (ok, s) => { console.log('   ' + (ok ? '✅' : '⛔') + ' ' + s); if (!ok) failed++; };

  console.log('FIELDSTRIP LIBRARY — refusal gates\n');

  /* ---- completeness: every refusal the publisher runs must have a case ---- */
  const declared = Object.keys(CASES);
  const enforced = Object.keys(publish.check(
    { guides: [], files: [], holds: { held: new Map(), heldDocs: new Map() } }, []));
  const missing = enforced.filter(n => !declared.includes(n));
  const extra = declared.filter(n => !enforced.includes(n));
  console.log('COMPLETENESS');
  line(!missing.length, missing.length
    ? 'refusals with no fixture: ' + missing.join(', ')
    : 'every refusal the publisher enforces has fixtures (' + enforced.length + ')');
  line(!extra.length, extra.length
    ? 'fixtures for refusals the publisher does not run: ' + extra.join(', ')
    : 'no orphan fixtures');

  /* ---- each refusal, against what must trip it and what must not ---- */
  for (const name of declared) {
    const c = CASES[name];
    console.log('\n' + name);
    c.mustRefuse.forEach(([label, mk]) => {
      const v = c.run(mk());
      line(v.length > 0, 'REFUSES ' + label + (v.length ? '' : '  ← FIXTURE DID NOT TRIP THE GUARD'));
    });
    c.mustPass.forEach(([label, mk]) => {
      const v = c.run(mk());
      line(v.length === 0, 'ALLOWS  ' + label + (v.length ? '  ← OVER-REFUSED: ' + v[0] : ''));
    });
  }

  /* ---- withdrawn rows (vC35b STEP 10, 2026-09-23) ----
     A catalog row carrying wd:1 projects to an index row carrying withdrawn:true, and
     the one decision function refuses a guide for it; a row without the flag carries
     no such key and is allowed. Both directions, every run. */
  console.log('\nWITHDRAWN ROWS');
  {
    const project = require('./lib/project');
    const wd = project.projectCatalogRow({ i: 'fx_wd', mk: 'Fixture', md: 'Withdrawn', wd: 1 });
    const ok = project.projectCatalogRow({ i: 'fx_ok', mk: 'Fixture', md: 'Allowed' });
    line(wd.withdrawn === true, 'REFUSES a wd:1 catalog row projects withdrawn:true');
    line(!('withdrawn' in ok), 'ALLOWS  an ordinary row carries no withdrawn key');
    line(project.guideAllowedForRow(wd) === false, 'REFUSES a guide on a withdrawn row');
    line(project.guideAllowedForRow(ok) === true, 'ALLOWS  a guide on an ordinary row');
  }

  /* ---- and the live payload, judged by the same guards ---- */
  console.log('\nLIVE PAYLOAD');
  let payload;
  try {
    payload = publish.build();
  } catch (e) {
    line(false, 'publish.build() threw — ' + e.message);
    console.log('\n⛔ GATES FAILED (' + failed + ')');
    return 1;
  }
  const live = publish.check(payload, publish.operatorNames());
  Object.keys(live).forEach(n => line(live[n].length === 0,
    n + ' — ' + (live[n].length ? live[n].length + ' violation(s): ' + live[n][0] : 'clean')));
  line(payload.guides.length > 0, 'payload is not empty (' + payload.guides.length + ' guides)');
  {
    const wdRows = payload.index.rows.filter(r => r.withdrawn);
    const wdWithGuide = wdRows.filter(r => r.guide);
    line(wdWithGuide.length === 0, 'no withdrawn row carries a guide (' + wdRows.length +
         ' withdrawn row(s)' + (wdRows.length ? ': ' + wdRows.map(r => r.id).join(', ') : '') + ')');
  }
  {
    /* ---- the delta a client holding the previous version would get ----
       ⛔ A ROW THAT MOVED WITHOUT ITS GUIDE MOVING MUST STILL REACH THE DELTA
       (2026-09-27). Fixture first: a changelog naming a row change and a row removal
       with no guide list at all must produce a delta carrying both, and the delta for
       the current version must be empty. Then the live payload: every row the build
       says changed or left since the previous version is in that version's delta. */
    const fx = publish.deltaFiles(
      { versions: [{ version: 2, rowsChanged: ['a'], rowsRemoved: ['z'] }, { version: 1 }] },
      2, [{ id: 'a' }, { id: 'b' }]);
    const d1 = JSON.parse(fx.find(d => d.version === 1).bytes.toString('utf8'));
    const d2 = JSON.parse(fx.find(d => d.version === 2).bytes.toString('utf8'));
    line(d1.rows.length === 1 && d1.rows[0].id === 'a' && d1.removed.length === 1 && d1.removed[0] === 'z',
         'REFUSES a row change with no guide change is carried to the older version\'s delta');
    line(d2.rows.length === 0 && d2.removed.length === 0,
         'ALLOWS  the current version\'s delta is empty');
    const pv = payload.prevVersion;
    const live = payload.deltas.find(d => d.version === pv);
    if (payload.version !== pv && live) {
      const dj = JSON.parse(live.bytes.toString('utf8'));
      const have = new Set(dj.rows.map(r => r.id));
      const gone = new Set(dj.removed);
      const missing = payload.rowsChanged.filter(id => !have.has(id))
        .concat(payload.rowsRemoved.filter(id => !gone.has(id)));
      line(missing.length === 0, missing.length
        ? 'delta/' + pv + '.json omits ' + missing.length + ' moved row(s): ' + missing.slice(0, 5).join(', ')
        : 'delta/' + pv + '.json carries every moved row (' + payload.rowsChanged.length +
          ' changed, ' + payload.rowsRemoved.length + ' removed)');
    } else {
      line(true, 'no version bump this publish — delta/' + pv + '.json is unchanged by design');
    }
  }
  line(payload.staleShelf.length === 0, payload.staleShelf.length
    ? 'the shelf block is STALE for ' + payload.staleShelf.length + ' spec(s): ' + payload.staleShelf.slice(0, 5).join(', ')
    : 'the shelf block covers every spec at HEAD (' + payload.appGuides + ' baked into the app, ' +
      payload.shelfOnly.length + ' shelf-only' + (payload.shelfOnly.length ? ': ' + payload.shelfOnly.slice(0, 6).join(', ') : '') + ')');

  /* ---- the repository tree itself, not just the payload ----
     ⛔ THE PAYLOAD GUARDS JUDGE WHAT publish.js WRITES. They cannot see a file
     somebody committed by hand, and the plate lane now downloads whole manuals to
     a gitignored cache — one `git add -f` away from publishing a book. This asks
     git what is actually tracked. */
  console.log('\nTRACKED TREE');
  try {
    const tracked = require('child_process')
      .execFileSync('git', ['-C', require('path').resolve(__dirname, '..'), 'ls-files'],
                    { encoding: 'utf8' }).split('\n').filter(Boolean);
    const docs = tracked.filter(f => /\.(pdf|rawtxt|ocrtxt|djvu|epub)$/i.test(f));
    line(docs.length === 0, docs.length
      ? 'source documents are tracked: ' + docs.slice(0, 5).join(', ')
      : 'no source document is tracked (' + tracked.length + ' files)');
    const stray = tracked.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f) &&
                                      !guards.PLATE_IMAGE.test(f));
    line(stray.length === 0, stray.length
      ? 'images outside the plate path are tracked: ' + stray.slice(0, 5).join(', ')
      : 'no image outside plates/img/');
  } catch (e) {
    line(false, 'could not read the tracked tree — ' + e.message);
  }

  /* ---- the red "Do not" block, every guide, every step (Darren 2026-11-14 11:45) ----
     Fixtures first, built in memory from the real payload: the field left out, one word of a maker's sentence changed,
     one citation changed, a block moved to the wrong step — each must REFUSE; the payload as built must be ALLOWED.
     Then the live payload itself. The app side is the app's own emitted block, evaluated; both sides are drawn by the
     app's own fsNoHtml lifted from the page at HEAD (tools/lib/noblock.js). */
  console.log('\nRED DO-NOT BLOCKS');
  let noRed = false;
  try {
    const block = noblock.evalBlock(app.show('scratchpad/clean-rebuild/shelf_block.js'));
    const render = noblock.noRenderer(app.show('www/index.html'));
    const asMap = fn => new Map(payload.guides.map(g => { const o = JSON.parse(g.bytes.toString('utf8')); return [g.row, fn ? fn(o, g.row) : o]; }));
    const eachStep = (o, f) => { ['steps', 'deepSteps'].forEach(k => (o[k] || []).forEach((st, i) => f(st, i, o[k]))); return o; };
    const firstNo = (() => { for (const g of payload.guides) { const o = JSON.parse(g.bytes.toString('utf8')); let hit = null; eachStep(o, st => { if (!hit && st.no) hit = st; }); if (hit) return g.row; } return null; })();
    const real = noblock.compare(asMap(), block, render);
    if (!firstNo) line(PROVE === 'nofield', 'no published guide carries a Do-not block at all — the fixtures have nothing to break');
    else {
      const stripped = noblock.compare(asMap(o => eachStep(o, st => { delete st.no; })), block, render);
      line(stripped.bad.length > 0 && stripped.shelfBlocks === 0, 'REFUSES the field left out of every published step (' + stripped.bad.length + ' step(s) named)');
      const worded = noblock.compare(asMap((o, row) => row !== firstNo ? o : eachStep(o, st => { if (st.no) st.no = Object.assign({}, st.no, { q: st.no.q + ' Otherwise.' }); })), block, render);
      line(worded.bad.length > 0 && worded.bad.every(b => /the sentence differs/.test(b)), 'REFUSES a changed maker\'s sentence (' + firstNo + ')');
      const cited = noblock.compare(asMap((o, row) => row !== firstNo ? o : eachStep(o, st => { if (st.no) st.no = Object.assign({}, st.no, { src: st.no.src + ' (p.999)' }); })), block, render);
      line(cited.bad.length > 0 && cited.bad.every(b => /the citation differs/.test(b)), 'REFUSES a changed citation under a maker\'s sentence (' + firstNo + ')');
      const moved = noblock.compare(asMap((o, row) => row !== firstNo ? o : eachStep(o, (st, i, arr) => { if (st.no && !st._moved && arr.length > 1) { const j = (i + 1) % arr.length; if (!arr[j].no) { arr[j].no = st.no; arr[j]._moved = true; delete st.no; } } })), block, render);
      line(moved.bad.length > 0, 'REFUSES a Do-not block carried on the wrong step (' + firstNo + ')');
      line(real.bad.length === 0, 'ALLOWS  the payload as built (the control for the four refusals above)');
    }
    const judged = PROVE === 'nofield' ? noblock.compare(asMap(o => eachStep(o, st => { delete st.no; })), block, render) : real;
    if (PROVE === 'nofield') console.log('   PROVE-FAIL: the Do-not block left off every published step');
    noRed = judged.bad.length > 0;
    line(judged.bad.length === 0, judged.bad.length
      ? judged.bad.length + ' step(s) where the red Do-not block differs between the app and the shelf (app draws ' + judged.appBlocks + ', shelf carries ' + judged.shelfBlocks + '):\n       ' + judged.bad.slice(0, 6).join('\n       ')
      : 'every red Do-not block matches the app\'s own, in count, sentence, citation and as drawn: ' + judged.appBlocks + ' block(s) across ' + judged.guides + ' guides');
    /* the passage path: carried, and not drawn from a download until the app changes — held to the recorded list */
    if (PROVE !== 'nofield') {
      const appHas = noblock.appDrawsPassageNo(app.show('www/index.html'));
      const now = real.passage.slice().sort(), known = noblock.KNOWN_PASSAGE_GAP.slice().sort();
      if (appHas) line(known.length === 0, known.length
        ? 'the app\'s passage path now copies the Do-not block: KNOWN_PASSAGE_GAP in tools/lib/noblock.js has outlived its reason — empty it'
        : 'the app draws a Do-not block on a downloaded passage step too (' + now.length + ' such step(s))');
      else {
        const grew = now.filter(x => !known.includes(x)), gone = known.filter(x => !now.includes(x));
        line(!grew.length && !gone.length, (grew.length || gone.length)
          ? 'Do-not blocks on PASSAGE steps (not drawn from a download until the app changes) no longer match the recorded list' +
            (grew.length ? ' — NEW: ' + grew.join(', ') : '') + (gone.length ? ' — GONE, remove from the list: ' + gone.join(', ') : '')
          : 'Do-not blocks on PASSAGE steps are exactly the recorded ' + known.length + ' (' + known.join('; ') + ') — carried by the shelf, NOT drawn from a download until the app changes; routed to Darren 2026-11-14');
      }
    }
  } catch (e) {
    noRed = true;
    line(false, 'the Do-not comparison could not run — ' + (e && e.message ? e.message : e));
  }
  if (PROVE === 'nofield') {
    const only = noRed && failed === 1;
    console.log('\n' + (only ? 'CONTROL OK — with the field left out the Do-not gate is red, and nothing else is' : 'CONTROL BROKEN — ' + (noRed ? 'something else went red too (' + failed + ' failures)' : 'the Do-not gate stayed green with the field left out')));
    return only ? 0 : 1;
  }

  /* ---- and the claim the whole design rests on, measured ---- */
  console.log('\nAPP/LIBRARY PARITY');
  const par = parity.compare(payload.guides, app.show('www/index.html'));
  line(par.mismatches.length === 0,
    par.mismatches.length
      ? par.mismatches.length + ' guide(s) cite a different document than the app:\n       ' +
        par.mismatches.slice(0, 5).join('\n       ')
      : 'provenance matches the app\'s compiled block for all ' + par.checked + ' guides the app bakes in');
  /* ⛔ app ⊆ shelf, measured on the app's own block (ruling 2026-09-22) */
  line(par.appOnly.length === 0, par.appOnly.length
    ? 'the app compiles in ' + par.appOnly.length + ' guide(s) the shelf does not publish — app ⊆ shelf violated: ' + par.appOnly.slice(0, 6).join(', ')
    : 'every guide the app bakes in is on the shelf (app ⊆ shelf holds, ' + par.appGuides + ' guides)');
  if (par.shelfOnly.length) {
    console.log('   · ' + par.shelfOnly.length + ' guide(s) on the shelf that the app does not bake in — ' +
                'the ruling, not a mismatch: ' + par.shelfOnly.slice(0, 6).join(', ') +
                (par.shelfOnly.length > 6 ? ' …' : ''));
  }

  console.log('\n' + (failed ? '⛔ GATES FAILED (' + failed + ')' : '✅ ALL GATES PASS'));
  return failed ? 1 : 0;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { console.error('\n' + (e && e.message ? e.message : e)); process.exit(2); }
}
