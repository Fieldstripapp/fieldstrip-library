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
    ],
    mustPass: [
      ['a clean guide', () => [asFile('guides/fixturerow.json', cleanGuide)]],
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
    run: files => guards.noPersonalData(files, ['Darren']),
    mustRefuse: [
      ['an email address in guide text', () => [
        asFile('guides/pd1.json', Object.assign({}, cleanGuide, {
          cleanIntro: 'Questions to dezrtracr33@gmail.com before stripping.',
        })),
      ]],
      ['a Windows user-profile path', () => [
        asFile('guides/pd2.json', Object.assign({}, cleanGuide, {
          cleanIntro: 'Cached at C:\\Users\\Dezrt\\fieldstrip-app for reference.',
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

  /* ---- and the claim the whole design rests on, measured ---- */
  console.log('\nAPP/LIBRARY PARITY');
  const par = parity.compare(payload.guides, app.show('www/index.html'));
  line(par.mismatches.length === 0,
    par.mismatches.length
      ? par.mismatches.length + ' guide(s) cite a different document than the app:\n       ' +
        par.mismatches.slice(0, 5).join('\n       ')
      : 'provenance matches the app\'s spliced output for all ' + par.checked + ' guides it has spliced');
  if (par.notYetSpliced.length) {
    console.log('   · ' + par.notYetSpliced.length + ' guide(s) authored since the app last ran its splice — ' +
                'not a mismatch: ' + par.notYetSpliced.slice(0, 6).join(', ') +
                (par.notYetSpliced.length > 6 ? ' …' : ''));
  }

  console.log('\n' + (failed ? '⛔ GATES FAILED (' + failed + ')' : '✅ ALL GATES PASS'));
  return failed ? 1 : 0;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { console.error('\n' + (e && e.message ? e.message : e)); process.exit(2); }
}
