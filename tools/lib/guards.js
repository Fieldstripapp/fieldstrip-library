/* guards.js — the three refusals.

   ⛔ THESE ARE REFUSALS, NOT CONVENTIONS. Each one returns a list of violations,
   and any violation at all stops the publish. There is no warn-and-continue path
   and none may be added. The repository is public from birth: a mistake here is
   not a bad commit, it is a disclosure, and `git rm` does not unpublish anything
   that a crawler already has.

   ⛔ EACH GUARD IS PROVEN AGAINST A FIXTURE THAT MUST TRIP IT, EVERY RUN — see
   tools/run_gates.js. A guard that has never refused anything is not a guard; it
   is an assertion about a guard. This lane has already shipped three filters that
   turned out to be ANTI-CORRELATED with the thing they were pointed at, so
   "it reports clean" is worth nothing on its own. The fixtures are what make
   "clean" mean something.
*/
'use strict';

const crypto = require('crypto');

/* ---------------------------------------------------------------- refusal 1 */

/* Document magic bytes. A file is refused on its CONTENT, not on its name —
   renaming a PDF to .json is precisely the mistake a name check misses. */
const MAGIC = [
  ['%PDF', 'PDF'],
  ['\x89PNG', 'PNG'],
  ['\xff\xd8\xff', 'JPEG'],
  ['GIF8', 'GIF'],
  ['PK\x03\x04', 'ZIP/OOXML'],
  ['%!PS', 'PostScript'],
  ['\x7fELF', 'ELF'],
  ['RIFF', 'RIFF/WebP'],
  ['\x00\x01\x00\x00', 'TrueType'],
  ['OTTO', 'OpenType'],
  ['{\\rtf', 'RTF'],
  ['\xd0\xcf\x11\xe0', 'MS Compound (doc/xls)'],
];

/* ⛔ TWO DIFFERENT QUESTIONS, TWO DIFFERENT PATTERNS. Conflating them is how a
   filter ends up pointed away from its target.

   FILE_IS_A_DOCUMENT asks "is this repo file a source document?" — there, a
   .pdf extension is decisive.

   CACHE_LEAK asks "does this authored prose name OUR internal cache?" — and
   there a .pdf mention is NOT evidence of anything. Measured against the real
   payload: a bare `\.pdf` test flagged five guides, and four were citations
   naming the PUBLISHER'S OWN published filename — Bergara's `B14-manual-3.21.pdf`,
   SilencerCo's `scythe-manual_2023.pdf`. That is provenance, the same kind of
   fact as an edition number, and refusing it would delete real citations while
   catching nothing. The fifth was the genuine article: an authored sentence
   quoting `scratchpad/manuals/_text/rugged/rugged-axial-file85.rawtxt line 53`.
   So the leak pattern keeps the cache roots and the extraction suffixes, which
   only ever appear when an internal path has escaped, and drops the extension
   that only ever appeared in legitimate provenance. */
const FILE_IS_A_DOCUMENT = /(scratchpad[\/\\]manuals|_viewonly|[\/\\]_text[\/\\]|\.pdf\b|\.rawtxt\b|\.ocrtxt\b|manual-drops)/i;
const CACHE_LEAK = /(scratchpad[\/\\]manuals|_viewonly|[\/\\]_text[\/\\]|\.rawtxt\b|\.ocrtxt\b|manual-drops)/i;

/* What a published tree is allowed to contain, by extension. */
const ALLOWED_EXT = new Set(['.json', '.md', '.js', '.yml', '.txt', '.py']);
const ALLOWED_BARE = new Set(['CNAME', '.nojekyll', '.gitignore', '.gitattributes']);

/* ⛔ THE ONE PLACE AN IMAGE MAY LIVE, AND IT IS NARROW ON PURPOSE. Plates are the
   only binary this repository serves, and admitting them re-opens the door that
   refusal 1 exists to keep shut. So the opening is as small as it can be made:
   ONE directory, a content-addressed name, PNG magic bytes, and — enforced in
   noUnverifiedPlates() — a referencing plate record that carries full provenance.
   An image nothing points at cannot be published, because an orphan is exactly
   what a stray manufacturer page would look like. */
const PLATE_IMAGE = /^plates\/img\/[0-9a-f]{16}\.png$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* The only keys a published guide may carry. Anything else is either internal
   working matter or something nobody has reviewed for publication. */
const GUIDE_KEYS = new Set([
  'row', 'make', 'model', 'sourcedFrom', 'sourceSha256', 'cleanIntro',
  /* ⛔ sourceSha256_2 — REVIEWED AND ADMITTED ON THE SAME GROUND AS sourceSha256.
     A row may cite TWO of the maker's own books where the maker himself joins them
     (app, 2026-08-23; the Walther SSP-E supplement tells its owner in print to use the
     SSP manual as well). It is a hex digest and nothing else — it names no file, no
     path and no person, and it is what lets a reader confirm the SECOND document is the
     one the quotes were checked against. Publishing the first hash and withholding the
     second would leave half the row's provenance unprovable.
     ⚠ `file2` is NOT admitted and must never be: it is a repo path, exactly like
     `file`, and the projection excludes it. */
  'sourceSha256_2',
  'steps', 'deepSteps', 'deepAbsentReason', 'cleaning', 'reassembly', 'fncheck',
]);
const STEP_KEYS = new Set([
  'phase', 'title', 'action', 'prose', 'caution', 'aside',
  'quote', 'cite', 'quoteLang', 'quoteEnglish', 'warn', 'branch',
  /* ⛔ warnSrc — REVIEWED AND ADMITTED (Darren ruling, vC34 item 17). It carries
     no text of its own: the only values are the literals "maker" and "ours", and
     it says whose sentence the `warn` beside it is. 714 of the app's 1,637
     warnings were measured to be the manufacturer's own words and were rendering
     unattributed; the app now quotes his and leaves ours plain. A reader of THIS
     shelf is the same reader, so the flag travels. It leaks nothing — it is not
     free text and cannot carry a cache path, a person or a document. */
  'warnSrc',
]);

function looksBinary(buf) {
  const head = buf.slice(0, 8).toString('latin1');
  for (const [sig, name] of MAGIC) if (head.startsWith(sig)) return name;
  /* A NUL in the first 4 KB is not text. */
  if (buf.slice(0, 4096).includes(0)) return 'binary (NUL byte)';
  return null;
}

/**
 * Refusal 1 — NO SOURCE DOCUMENTS.
 * files: [{path, bytes:Buffer}]
 */
function noSourceDocuments(files) {
  const v = [];
  for (const f of files) {
    const base = f.path.split('/').pop();
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 ? base.slice(dot) : '';

    if (!ALLOWED_BARE.has(base) && !ALLOWED_EXT.has(ext) && !PLATE_IMAGE.test(f.path)) {
      v.push(f.path + ': file type "' + (ext || base) + '" is not publishable — ' +
             'only Fieldstrip-authored JSON and repo text may be served');
    }
    const isPlateImage = PLATE_IMAGE.test(f.path);
    if (isPlateImage) {
      if (!f.bytes.slice(0, 8).equals(PNG_MAGIC)) {
        v.push(f.path + ': in the plate image path but not a PNG — refused on its bytes');
      }
    } else {
      const kind = looksBinary(f.bytes);
      if (kind) v.push(f.path + ': content is ' + kind + ' — a source document, not authored JSON');
    }

    if (FILE_IS_A_DOCUMENT.test(f.path)) {
      v.push(f.path + ': path names the manual cache or an extraction');
    }

    /* Guide payloads get a schema check: an unexpected key is refused rather
       than published, because nobody has reviewed it for a public repo. */
    if (/^guides\/[^/]+\.json$/.test(f.path)) {
      let g;
      try { g = JSON.parse(f.bytes.toString('utf8')); }
      catch (e) { v.push(f.path + ': not valid JSON — ' + e.message); continue; }

      Object.keys(g).forEach(k => {
        if (!GUIDE_KEYS.has(k)) v.push(f.path + ': unpublishable guide field "' + k + '"');
      });
      [].concat(g.steps || [], g.deepSteps || []).forEach((st, i) => {
        Object.keys(st).forEach(k => {
          if (!STEP_KEYS.has(k)) v.push(f.path + ': step ' + (i + 1) + ' carries unpublishable field "' + k + '"');
        });
      });
      /* ⛔ AND NO CACHE PATH MAY RIDE INSIDE A STRING. The schema check above
         catches a whole field; this catches a path smuggled into prose. */
      const leak = cacheLeak(g);
      if (leak) v.push(f.path + ': guide text names our internal manual cache (' + leak + ')');
    }
  }
  return v;
}

/* ---------------------------------------------------------------- refusal 2 */

/**
 * Refusal 2 — NO HELD ROWS.
 *
 * ⛔ HELD IS A RULING STATE AND A SPEC DOES NOT CLEAR IT. If a held row turns up
 * with an authored spec, that is a CONFLICT between two records in the app repo,
 * not permission. Only Darren clears a hold. The conservative reading — refuse,
 * and say so loudly — costs a few withheld guides; the other reading publishes a
 * row that is held pending an attorney.
 *
 * held: Map(rowId -> record) · heldDocs: Map(docPath -> record)
 * entries: [{row, guidePath, sourceFile, sha256, inIndexAsGuide}]
 */
function noHeldRows(entries, held, heldDocs) {
  const v = [];
  const docSet = new Set([...heldDocs.keys()].map(s => s.replace(/\\/g, '/').toLowerCase()));

  for (const e of entries) {
    if (held.has(e.row)) {
      const h = held.get(e.row);
      v.push('HELD ROW WOULD PUBLISH: ' + e.row + ' — ' + (h.reason || 'pending adjudication') +
             ' (record: ' + h.record + ')');
    }
    /* A sibling row authored from the same held book walks past a row-id check. */
    if (e.sourceFile) {
      const sf = String(e.sourceFile).replace(/\\/g, '/').toLowerCase();
      if (docSet.has(sf)) {
        v.push('HELD DOCUMENT WOULD PUBLISH: ' + e.row + ' is authored from ' + e.sourceFile +
               ', a document named in a live hold record');
      }
    }
  }
  return v;
}


/* ---------------------------------------------------------------- refusal 4 */

/* A government technical or field manual designation. A plate may come from
   nothing else. */
const GOV_DESIGNATION =
  /(?:ARMY\s+)?TM\s*\d|FM\s*\d{1,2}[-.]|TO\s*\d|SW\d{3}-|COMDTINST/i;

/* Hosts that are manufacturers, or that redistribute manufacturer material.
   ⛔ A plate is never sourced from one, whatever the page appears to show. */
const MANUFACTURER_HOST =
  /(?:^|\/\/|\.)(?:sigsauer|glock|ruger|smith-wesson|smithwesson|beretta|colt|mossberg|remington|springfield-armory|springfieldarmory|hk-usa|heckler-koch|fnamerica|daniel-?defense|barrett|silencerco|deadair|cz-?usa|taurususa|kimberamerica|wilsoncombat)\.[a-z.]+/i;

const REQUIRED_PROVENANCE = ['tm', 'edition', 'figure', 'page', 'sourceUrl', 'documentSha256'];
const REQUIRED_PD_CHECKS = ['distribution', 'preparer', 'reprint', 'exportMarking'];

/**
 * Refusal 4 — NO UNVERIFIED PLATE, AND NO MANUFACTURER PAGE IN THE PLATE PATH.
 *
 * ⛔ TWO REFUSALS IN ONE FUNCTION BECAUSE THEY GUARD ONE DOOR. A plate ships only
 * with complete provenance AND a recorded Distribution A finding; and a page from
 * a manufacturer can never enter the plate path AT ALL — not verified-and-refused,
 * not held, not staged. Manufacturer manuals sit behind attorney question 6, and
 * the plate lane must not even be able to represent one.
 *
 * ⛔ AND AN IMAGE NOBODY REFERENCES IS REFUSED. Provenance attaches to the plate
 * RECORD; an unreferenced PNG carries none, and "a binary in the repo that no
 * record accounts for" is precisely the shape of an accident.
 *
 * files: [{path, bytes}] — the whole publish payload.
 */
function noUnverifiedPlates(files) {
  const v = [];
  const records = files.filter(f => /^plates\/[^/]+\.json$/.test(f.path));
  const images = files.filter(f => PLATE_IMAGE.test(f.path));
  const referenced = new Set();

  for (const f of records) {
    let p;
    try { p = JSON.parse(f.bytes.toString('utf8')); }
    catch (e) { v.push(f.path + ': not valid JSON — ' + e.message); continue; }

    const prov = p.provenance || {};
    REQUIRED_PROVENANCE.forEach(k => {
      if (prov[k] === undefined || prov[k] === null || prov[k] === '') {
        v.push(f.path + ': incomplete provenance — missing ' + k);
      }
    });

    const pd = prov.publicDomain || {};
    REQUIRED_PD_CHECKS.forEach(k => {
      if (!pd[k]) v.push(f.path + ': no recorded public-domain finding for "' + k + '"');
    });

    /* ⛔ THE FINDING MUST SAY DISTRIBUTION A. "Verified" is not a state a plate
       may be in without the statement that made it verifiable. UNMARKED does not
       ship — absence of a restriction is not a grant of release. */
    if (pd.distribution && !/Distribution A\b/i.test(pd.distribution)) {
      v.push(f.path + ': distribution finding is not Distribution A — "' + pd.distribution + '"');
    }

    if (prov.tm && !GOV_DESIGNATION.test(prov.tm)) {
      v.push(f.path + ': "' + prov.tm + '" is not a US Government TM/FM designation — ' +
             'a plate may come from nothing else');
    }
    if (prov.sourceUrl && MANUFACTURER_HOST.test(String(prov.sourceUrl))) {
      v.push(f.path + ': sourceUrl is a manufacturer host (' + prov.sourceUrl + ') — ' +
             'manufacturer pages may never enter the plate path');
    }

    if (!Array.isArray(p.labels) || !p.labels.length) {
      v.push(f.path + ': no numbered-part labels');
    }
    if (!p.image || !PLATE_IMAGE.test(p.image)) {
      v.push(f.path + ': image reference is not a content-addressed plate image');
    } else {
      referenced.add(p.image);
    }
  }

  images.forEach(img => {
    if (!referenced.has(img.path)) {
      v.push(img.path + ': plate image referenced by no plate record — an unaccounted binary');
    }
  });

  return v;
}

/* ---------------------------------------------------------------- refusal 3 */

/* ⛔ CALIBRATED, NOT GUESSED. Every pattern below was measured against the real
   published payload before it was trusted, because a filter aimed at nothing is
   this lane's most repeated defect.
   ⚠ NO BARE PHONE PATTERN. Manufacturer manuals print customer-service numbers,
   and those are published corporate contact details, not personal data — a
   phone regex here would refuse legitimate verbatim quotes while catching
   nothing real. Part numbers like `045-0056-00` sit in the same shape. The
   personal-data risk in this pipeline is OPERATOR data leaking out of internal
   notes, so that is what is detected. */
const PERSONAL = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'email address'],
  /* ⛔ THE SEPARATOR IS DOUBLED IN THE PUBLISHED BYTES AND A SINGLE-SEPARATOR
     PATTERN MISSES IT ENTIRELY. These guards read the JSON text as it will be
     served, and JSON escapes a backslash — `C:\Users\<name>` is stored as
     `C:\\Users\\<name>`. The first draft of this pattern required exactly one
     separator, matched nothing, and reported clean; its fixture is what caught
     it. Hence {1,2}, and hence the fixture stays. */
  [/\b[A-Za-z]:[\\\/]{1,2}Users[\\\/]{1,2}[A-Za-z0-9._-]+/g, 'Windows user-profile path'],
  [/[\\\/]{1,2}(?:home|Users)[\\\/]{1,2}[A-Za-z0-9._-]+/g, 'home-directory path'],
  [/\bssh-(?:rsa|ed25519)\s+AAAA/g, 'SSH public key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, 'private key'],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/g, 'GitHub token'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, 'US SSN pattern'],
];

/* ⛔ THE ONE LIST THAT MUST BE TYPED, AND WHY. Everywhere else in this repo a
   hand-maintained list is a defect — held rows, blocked rows and the catalog are
   all derived, because a record exists to derive them from. No record anywhere
   enumerates the humans working on this project, so their names cannot be
   derived from anything, and the alternative to naming them is not naming them.

   ⚠ AND DERIVING IT FROM GIT WAS ACTIVELY WORSE THAN USELESS. The first version
   took the canary from `git config user.name` alone — which is "Dezrt" — and
   reported clean while twelve published guides carried "(Darren guardrail
   2026-08-21)" in owner-facing copy. A canary pointed at the wrong name is the
   same failure as a filter pointed at nothing: it makes a green mean nothing.
   The git identity is still added at call time; it is a supplement to this list,
   never a substitute for it. */
const PERSON_CANARIES = ['Darren', 'Dezrt'];

/**
 * Refusal 3 — NO PERSONAL DATA.
 * extraNames: further operator identifiers (e.g. the git author name), unioned
 * with PERSON_CANARIES. Their presence means an internal note escaped.
 */
function noPersonalData(files, extraNames) {
  const v = [];
  const canaries = [...new Set(PERSON_CANARIES.concat(extraNames || [])
    .filter(Boolean).map(n => String(n)))];

  for (const f of files) {
    const text = f.bytes.toString('utf8');
    for (const [re, label] of PERSONAL) {
      re.lastIndex = 0;
      const hits = text.match(re);
      if (hits) {
        v.push(f.path + ': ' + label + ' — ' + [...new Set(hits)].slice(0, 3).join(', '));
      }
    }
    for (const name of canaries) {
      const re = new RegExp('(?<![A-Za-z])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])', 'i');
      if (re.test(text)) {
        v.push(f.path + ': operator identifier "' + name + '" appears — an internal note has escaped the projection');
      }
    }
  }
  return v;
}

/**
 * The matched cache path if this guide names our internal cache, else null.
 *
 * ⛔ EXPORTED SO THE PUBLISHER CAN QUARANTINE ONE GUIDE INSTEAD OF LOSING THE
 * SHELF. An upstream spec that leaks a path is a defect in that spec, and the
 * proportionate answer is to withhold that guide and name it — not to refuse
 * 637 sound guides alongside it. The guard above stays as the second line: if a
 * leak ever reaches the payload anyway, the publish still fails outright.
 */
function cacheLeak(guide) {
  const m = JSON.stringify(guide).match(CACHE_LEAK);
  return m ? m[0] : null;
}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * The personal identifier this guide carries, if any, else null.
 *
 * ⛔ EXPORTED FOR THE SAME REASON cacheLeak() IS: an authored spec that names a
 * person in owner-facing copy is a defect in that spec, and the proportionate
 * answer is to withhold that guide and name it upstream — not to edit published
 * text here, and not to lose the shelf over it. The guard above remains the
 * second line and still fails the publish outright if one reaches the payload.
 */
function personalLeak(guide, extraNames) {
  const hits = noPersonalData([{ path: 'guide', bytes: Buffer.from(JSON.stringify(guide), 'utf8') }],
                              extraNames);
  return hits.length ? hits[0].replace(/^guide: /, '') : null;
}

module.exports = { noSourceDocuments, noHeldRows, noPersonalData, noUnverifiedPlates,
                  cacheLeak, personalLeak, sha256, GUIDE_KEYS, STEP_KEYS, PERSON_CANARIES,
                  PLATE_IMAGE };
