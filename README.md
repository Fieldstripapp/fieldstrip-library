# fieldstrip-library

The shelf. Fieldstrip's authored cleaning guides and a versioned catalog index,
served as static JSON from GitHub Pages at **https://library.fieldstripapp.com**.

The app fetches from here. It does not push to here, and nothing here is edited
by hand.

## What is served

| path | what it is |
|---|---|
| `index.json` | every catalog row — id, maker, model, chambering, family, tier — plus an integer `version` and, for each row, whether a guide exists and that guide's sha256 |
| `guides/<rowid>.json` | one authored guide, exactly as the app renders it |
| `changelog.json` | one entry per version, newest first, naming the row ids added / changed / removed |

A client holding version *N* reads `changelog.json`, unions the `added` and
`changed` arrays of every entry above *N*, and fetches only those guides. The
per-row `guideSha256` in `index.json` lets it verify what it got. That is why
the delta question is answerable today without a redesign later.

## Everything here is derived

Nothing in this repository is typed by hand. `tools/publish.js` reads the
`fieldstrip-app` repository **at its committed HEAD, read-only**, and regenerates
the whole payload:

- **guides** from `scratchpad/clean-rebuild/authored/<row>.json` — the same specs
  the app's `splice_authored.js` consumes, through the same projection, so the
  app and the library cannot disagree about what a guide says;
- **the index** from the app's own `CATALOG` array in `www/index.html`;
- **the held set** from the app's own block and adjudication records.

Reads go through `git show HEAD:<path>`, never the filesystem. That makes a
publish reproducible from a named commit, and makes it impossible for this
tooling to write to the app repo even by accident.

## What must never publish

Three refusals. Each one stops the publish outright — there is no
warn-and-continue path, and none may be added. This repository is public from
birth: a mistake here is a disclosure, not a bad commit.

1. **No source documents.** No manufacturer PDFs, extractions, OCR text or
   provenance bytes. Only schema-valid Fieldstrip-authored guide JSON. Files are
   judged on their bytes, not their names.
2. **No held rows.** Anything pending a ruling — the SCCY CPX rows held over an
   export marking, and everything else flagged held or restricted — derived from
   the block records, never from a list in the source. A held row that acquires
   an authored spec is still held: only Darren clears a hold.
3. **No personal data.** Email addresses, user-profile paths, credentials, and
   operator identifiers that would mean an internal note had escaped. A guide
   that trips this is withheld and named, never edited — editing published text
   here is exactly how the library would start disagreeing with the app.

```
node tools/run_gates.js     # prove the refusals refuse, then check the live payload
node tools/publish.js       # build, check, write
```

`run_gates.js` fires every refusal at a fixture built to trip it **and** at a
control it must not refuse, every run. A guard that has never refused anything is
not a guard, and a guard that refuses everything is worse. It also asserts its own
completeness: a refusal without fixtures fails the suite.

No fixture is committed. They are built in memory, because a repo that is public
from birth has no business containing a file that looks like a manufacturer PDF.
