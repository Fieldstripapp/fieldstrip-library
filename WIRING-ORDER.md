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
git clone git@github.com:Fieldstripapp/fieldstrip-library.git ../fieldstrip-library
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

## Before the first push — two clicks that need a human

`gh` is not installed on this machine, so the GitHub side could not be done from
here. The repository is built and committed locally and the first push is ready.

1. Create **`Fieldstripapp/fieldstrip-library`**, **public**, with no README, no
   `.gitignore` and no licence — the local repo already has its first commit and
   an initialised remote would need a merge.
2. Push:
   ```
   git -C ../fieldstrip-library remote add origin git@github.com:Fieldstripapp/fieldstrip-library.git
   git -C ../fieldstrip-library push -u origin main
   ```
3. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
   `CNAME` and `.nojekyll` are already committed, so the custom domain fills in
   from the `CNAME` file on the first build.
4. Point DNS: `library` CNAME → `fieldstripapp.github.io`. Then tick **Enforce
   HTTPS** once the certificate is issued.

Until DNS resolves, the shelf is reachable at
`https://fieldstripapp.github.io/fieldstrip-library/index.json`.
