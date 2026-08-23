# WIRING ORDER — for the Clean terminal, at its next boundary

**Status: waiting. Nothing in `fieldstrip-app` has been touched.**

The shelf is built, gated and published locally. This file is the handoff: the
exact steps to adopt *publish-on-green*, to be taken by whoever owns
`fieldstrip-app` — not by the terminal that built this repo. Nothing here is
urgent and nothing here is a prerequisite for the library working; the library
publishes correctly today when run by hand.

---

## What was deliberately NOT done

- No file in `fieldstrip-app` was created, edited, staged, committed, or
  otherwise touched. Its `HEAD` and index are exactly as the Clean lane left them.
- Nothing was added to `run_all_gates.js`, to the batch flow, or to any script
  in that repository.
- Every read of that repo went through `git show HEAD:<path>`, which cannot write.

## Two findings that belong to the Clean lane

These came out of building the guards. Neither is a library problem; both are
records in `fieldstrip-app` that disagree with each other.

### 1. Three held rows have acquired authored specs

| row | hold record |
|---|---|
| `deadairmaskhd` | `deadair-sourcing/ROWS-PENDING-ADJUDICATION.json` |
| `mlpedsxsperc` | `pedersoli-sourcing/ROWS-PENDING-ADJUDICATION.json` |
| `mlpedsxsflint` | `pedersoli-sourcing/ROWS-PENDING-ADJUDICATION.json` |

Each hold record is live — no `status`, no resolution — and each says the row is
`UNAUTHORED — pending adjudication`. A spec now exists for all three anyway.

The library refuses to publish them, because a spec does not clear a hold; only
Darren does. But the refusal is a symptom. Either the rows were adjudicated and
the hold records were never closed, or they were authored while still held. **The
library will keep withholding them until the hold record is closed** the way
uberti's and traditions' were — a `status` field opening with `RESOLVED` or
`CLOSED`. That is the only signal the derivation reads, and it is deliberately
the only one.

### 2. One guide's authored text names our internal cache

`ruggedalaskan360`'s `deepAbsentReason` contains:

> It occurs only in Rugged's AXIAL manual (`scratchpad/manuals/_text/rugged/rugged-axial-file85.rawtxt` line 53) and has therefore NOT been used here.

That is owner-facing copy in the app naming an extraction file in our cache. The
library withholds the guide rather than editing it — editing published text here
would make the library disagree with the app about what the guide says, which is
the one thing this design exists to prevent, and it would hide a defect that
belongs in the spec.

**The fix is upstream:** rewrite that sentence in
`scratchpad/clean-rebuild/authored/ruggedalaskan360.json` to name the document
without the path — "Rugged's AXIAL manual" alone carries the whole meaning. The
row republishes by itself on the next run.

⚠ Worth a sweep while you are there: this was found by a guard, not by a gate in
the app repo. Nothing on that side currently refuses a cache path in owner-facing
prose.

---

## The wiring, when you want it

### Step 1 — clone the library beside the app, not inside it

```
git clone https://github.com/Fieldstripapp/fieldstrip-library.git ../fieldstrip-library
```

It must be a sibling, never nested. `tools/lib/appsrc.js` resolves the app repo
as `../fieldstrip-app` by default and honours `FIELDSTRIP_APP`.

### Step 2 — publish only from a green, committed tree

The publisher reads `HEAD`, so **an uncommitted spec does not publish**. That is
deliberate: it makes a publish reproducible from a named commit and immune to a
half-written spec in someone's working tree. The consequence is that the publish
step belongs *after* the commit, not before.

```
node scratchpad/clean-rebuild/run_all_gates.js   # app gates, in the app repo
git -C . commit ...                              # the batch lands
node ../fieldstrip-library/tools/run_gates.js    # library refusals + parity
node ../fieldstrip-library/tools/publish.js      # writes guides/, index.json, changelog.json
git -C ../fieldstrip-library add -A && git -C ../fieldstrip-library commit -m "publish vN"
git -C ../fieldstrip-library push
```

⛔ `git add -A` is safe **in the library repo only**. It is not safe in
`fieldstrip-app` and this order never suggests it there.

### Step 3 — let the version increment do its own work

Do not set the version by hand. `publish.js` reads the previous `index.json`,
compares per-guide sha256, and increments only when content actually moved. A
re-run that changes nothing leaves the version and the publish date alone, so a
publish-on-green hook can run on every batch without churning the index.

### Step 4 — treat a library refusal as a batch failure

If `run_gates.js` refuses, the batch is not green. The three refusals are
disclosure controls on a repository that is public from birth, and there is no
warn-and-continue path in them by design.

### Optionally — publish from CI instead

A workflow in the library repo can run `run_gates.js` then `publish.js` on a
`repository_dispatch` from the app repo. It needs a checkout of *both* repos and
`FIELDSTRIP_APP` pointed at the app checkout. Nothing in the publisher assumes a
local machine. This is a convenience, not a requirement, and the manual order
above is the one to adopt first.

---

## Still to do on the GitHub side

The repository is created and `main` is pushed. `origin` is
`https://github.com/Fieldstripapp/fieldstrip-library.git` over HTTPS, matching
how `fieldstrip-app` authenticates (Git Credential Manager) — no SSH key is
needed or present on this machine.

Two settings remain, both in the browser:

1. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`.**
   `CNAME` and `.nojekyll` are already committed, so the custom domain fills
   itself in from the `CNAME` file on the first build.
2. **DNS:** `library` CNAME → `fieldstripapp.github.io`. Tick **Enforce HTTPS**
   once the certificate is issued.

Until DNS resolves, the shelf is reachable at
`https://fieldstripapp.github.io/fieldstrip-library/index.json`.

## One judgement call left to you

The published payload — `guides/`, `index.json`, `changelog.json` — carries no
personal data of any kind; that is gated. The **tooling** is a different matter,
and it is public too:

- `tools/lib/guards.js` contains `PERSON_CANARIES = ['Darren', 'Dezrt']`. Those
  names have to be in the guard for the guard to work, so publishing the guard
  publishes the names.
- Several design comments explain rulings as yours by name ("only Darren clears a
  hold"), which is genuinely useful documentation of how this lane decides things.

Both are mild and neither was scrubbed unilaterally, because the comments carry
real engineering meaning. If you would rather they were not public, the options
are to move the canary list to an untracked local file the guard reads, or to make
this repo's history start from a squashed commit with the names generalised. Say
which and it is a small change.


---

# ADDENDUM — PARTS-DIAGRAM PLATES (index version 2)

Recovered **official** US Government plates now ship alongside the guides. Nothing
in `fieldstrip-app` was touched to add them.

⛔ **No self-made art, ever.** Nothing here is drawn, traced, re-rendered or
generated. Every plate is a page out of a US Government technical manual that
passed all four public-domain checks, and the military-manual look is genuine
because the plate is genuine. If a row has no verified official plate it has no
plate, and that is the correct state.

⛔ **No manufacturer pages, at all.** They sit behind attorney question 6. The
plate lane cannot even represent one: `noUnverifiedPlates()` refuses any record
whose source is not a government TM/FM designation, and refuses any manufacturer
host outright. That refusal is fired at a fixture on every gate run.

## What the app needs

### 1. The index field

`index.json` rows gain two optional fields:

```json
{ "id": "radianmodel1", "guide": false, "plate": true,
  "plateSha256": "4e48df0e…" }
```

`plate` is **independent of `guide`** — deliberately. A plate comes from a
government TM and a guide from the maker's book, and the two lanes cover different
rows. `radianmodel1` above has **no guide and a plate**; there are rows the other
way round. Do not gate the plate UI on the guide existing.

`plateSha256` is the digest of the plate record, so a cached client can tell
whether its copy is current without refetching the image.

### 2. The fetch path

```
GET  https://library.fieldstripapp.com/plates/<rowid>.json
GET  https://library.fieldstripapp.com/<record.image>      # plates/img/<sha16>.png
```

⚠ **The image is content-addressed and SHARED between rows.** One official plate
legitimately serves every row that passes the row test for it — 54 rows share the
bolt-carrier plate today. Fetch `plates/<rowid>.json` per row, then fetch the image
it names, and cache the image by its own filename: the second row through costs
nothing. This is why the image is not at `plates/<rowid>.png`; 54 byte-identical
copies of the same PNG is not something to ship.

### 3. Rendering the labels

The record carries `labels`, the manual's own numbered nomenclature:

```json
"labels": [ {"item": "1", "name": "PIN,FIRING"},
            {"item": "4A", "name": "BOLT,BREECH  ASSEMBLY (M4 AND M4A1)"} ]
```

Render these in the app's own palette as a legend beside the plate. Two rules:

- ⛔ **The callout numbers are already drawn on the image. Never re-draw them.**
- ⛔ **`x`/`y` are absent on these plates and that is a finding, not an oversight.**
  Read `labelsNote`. The callout numbers are part of the scanned drawing with no
  text layer, so their positions cannot be known. An earlier build emitted a
  position anyway and it was wrong twice over — it had matched the page footer
  ("Change 5"), and it was measured against the full page while the published
  image is cropped. A plausible coordinate silently highlights the wrong part;
  an absent one is visibly absent. If `x`/`y` are ever present they are
  normalised to the published image, not to the source page.

### 4. ⛔ A USER PHOTO OVERRIDES A PLATE, ALWAYS

If the owner has attached his own photo to a row, **his photo wins.** The plate is
a good generic drawing of the pattern; his photo is his actual gun, with his
furniture, his optic and his wear. Precedence, highest first:

1. the owner's own photo
2. the official plate
3. nothing — and nothing is a legitimate state; draw no placeholder

⚠ Never composite the two, and never show the plate as a "before" against his
photo. The plate is not a picture of his rifle and must not be presented as one.

### 5. What the plate is, so the copy does not overclaim

Today's plate is the **bolt carrier group**, not a whole rifle — chosen because it
is the one assembly that is genuinely identical between the service weapon and a
civilian AR-15, so it passes the row test on every row it is offered to. Label it
for what it is ("Bolt Carrier Assembly — TM 9-1005-319-23&P"), never as "exploded
view of your rifle". The `provenance` block carries the TM number, edition, figure,
page, source URL and document digest; showing the TM number under the plate is
encouraged, and is part of why it reads as official.

## Running the lane

```
python tools/plates/hunt.py            # search (re-runnable; this lane is ongoing)
python tools/plates/fetch.py <id>      # into .plate-cache/, which is gitignored
python tools/plates/verify.py          # four checks; --selftest fires each at a fixture
python tools/plates/build_plates.py    # cut plates from SHIP documents only
node tools/run_gates.js && node tools/publish.js
```

⛔ **Recovered documents never enter the repository.** `.plate-cache/` is
gitignored. Public-domain status makes a TM publishable in principle; it does not
make it our business to redistribute the book. We publish the plate.
