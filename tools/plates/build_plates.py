"""build_plates.py — cut verified plates out of verified documents.

⛔ A DOCUMENT THAT IS NOT `SHIP` IN THE VERIFY LEDGER CANNOT REACH THIS FILE. The
verdict is re-read here rather than trusted from memory, so a document that is
later downgraded stops producing plates on the next run instead of quietly
continuing to.

⛔ THE MAPPING IS CURATED, AND THAT IS DELIBERATE. Everywhere else in this
repository a hand-maintained list is a defect. Not here: DARREN'S ROW TEST — "if
an owner can tell the depicted gun is not his, it is not his plate" — is a
judgement about what a person would recognise, and there is no field in the
catalog that answers it. What IS mechanised is the row SELECTION (a predicate over
the catalog, so new rows are picked up automatically) and the REASONING is recorded
per plate so the judgement can be argued with rather than merely trusted.

⛔ AND PLATE CHOICE NEEDED EYES, NOT A METRIC. Ink-density was tried as a
legibility proxy and it does not work: Figure C-1, a badly degraded scan whose
linework has dropped out, measures 0.65% ink, and Figure C-4, which is perfectly
crisp, measures 0.81% — because a small part legitimately carries less ink than a
whole rifle. The metric ranks by subject size, not by legibility. Every plate that
ships here was rendered and looked at.
"""
import glob
import hashlib
import subprocess
import io
import json
import os
import re
import sys

import pymupdf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(ROOT, ".plate-cache")
PLATES = os.path.join(ROOT, "plates")
IMGDIR = os.path.join(PLATES, "img")
VERIFY = os.path.join(ROOT, "plate-sourcing", "VERIFY-LEDGER.json")
FETCH = os.path.join(ROOT, "plate-sourcing", "FETCH-LEDGER.json")
MAPPING = os.path.join(ROOT, "plate-sourcing", "PLATE-MAPPING.json")

DPI = 200

# ──────────────────────────────────────────────────────────────────────────────
# THE PLATES. One entry per plate; `rows` is a predicate over the catalog index.
# ──────────────────────────────────────────────────────────────────────────────
PLATE_DEFS = [
    {
        "plateId": "ar15-bolt-carrier-assembly",
        "doc": "TM_9-1005-319-23_Technical_Manual_Maintenance_Repair_Manual_M16A2_-_M4_-_M4A1.pdf.pdf",
        "tm": "ARMY TM 9-1005-319-23&P / AIR FORCE TO 11W3-5-5-42",
        "edition": "May 1991, Change 5",
        "figure": "C-2",
        "title": "Bolt Carrier Assembly",
        "figurePage": 261,
        "listPage": 262,

        # Selection is mechanical; the judgement below is not.
        "select": {"family": "AR15", "chambering": "5.56"},

        # ⛔ EXCLUDED BY MECHANISM, NOT BY OVERSIGHT.
        "excludeFamilies": ["AR-PISTON", "AR10", "AK"],
        "excludeReason":
            "A piston AR's carrier has no gas key and carries an operating-rod strike "
            "face, so this plate's item 5 (KEY AND BOLT) depicts a part that row does "
            "not have — the row test fails on the one component the plate is about. "
            "AR10/.308 and 9mm blowback carriers are different parts entirely.",

        "rowTest":
            "PASSES. The plate is the bolt carrier group alone — the assembly an owner "
            "has in his hand at every cleaning — and a civilian 5.56 AR-15 carrier, bolt, "
            "firing pin, cam pin and carrier key are the same parts in the same "
            "arrangement as the M16A2/M4 items drawn here. Nothing in the drawing is "
            "M16A2-only: there is no carry handle, no A2 stock, no barrel length and no "
            "furniture of any kind, which is exactly what would betray a service rifle on "
            "a modern flat-top row. The plate additionally draws BOTH service variants "
            "(item 4 M16A2, item 4A M4/M4A1), so it does not present one configuration as "
            "the only one.",

        "rejectedAlternatives": [
            {"figure": "C-1", "what": "whole rifle (M16A2 + M4/M4A1)",
             "why": "REJECTED TWICE OVER. The scan is degraded — linework broken and "
                    "dropped out, confirmed by rendering it — and on the row test an "
                    "M16A2 with its carry handle, fixed stock and 20in barrel is "
                    "precisely the gun Darren named as failing on a modern flat-top row."},
            {"figure": "C-10", "what": "(M16A2) rear sight assembly",
             "why": "REJECTED. A carry-handle A2 sight does not exist on a flat-top row."},
            {"figure": "C-12", "what": "(M16A2) buttstock assembly",
             "why": "REJECTED. Fixed A2 stock; most rows here wear a collapsible stock."},
            {"figure": "C-6/C-7/C-8", "what": "upper receiver and barrel assemblies",
             "why": "REJECTED as arguable rather than wrong: drawn as a 20in M16A2 or a "
                    "14.5in M4, and a 16in civilian carbine is neither. Routed rather "
                    "than guessed."},
            {"figure": "C-3, C-4, C-13, C-14",
             "what": "bolt assembly, carrier key, hammer, trigger",
             "why": "NOT REJECTED — equally shippable, and verified. Held back only "
                    "because the order is one plate per row; they are the natural second "
                    "set when the app can carry more than one."},
        ],
    },
]


def load(path):
    return json.load(io.open(path, encoding="utf-8"))


APP = os.environ.get("FIELDSTRIP_APP") or os.path.join(os.path.dirname(ROOT), "fieldstrip-app")


def catalog_rows():
    """The catalog, read from the APP REPO AT HEAD — not from our own index.json.

    ⛔ READING OUR PUBLISHED index.json WOULD SELECT ROWS AGAINST A STALE CATALOG.
    It nearly did: plates were first selected against a 781-row index while the app
    had already moved to 906, so any AR-15 row added in between would have been
    silently missed — and "silently missed" is indistinguishable from "correctly
    excluded" in the output. Both this file and the publisher now resolve the
    catalog from the same commit, so they cannot disagree about what a row is."""
    html = subprocess.run(["git", "-C", APP, "show", "HEAD:www/index.html"],
                          capture_output=True, check=True).stdout.decode("utf-8", "replace")
    at = html.index("const CATALOG=[")
    start = at + len("const CATALOG=[") - 1
    depth, i, in_str, esc = 0, start, False, False
    while i < len(html):
        c = html[i]
        if in_str:
            if esc: esc = False
            elif c == "\\": esc = True
            elif c == '"': in_str = False
        elif c == '"': in_str = True
        elif c == "[": depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
        i += 1
    else:
        raise SystemExit("⛔ REFUSING — the CATALOG array never closes")
    raw = json.loads(html[start:end])
    return [{"id": r.get("i"), "maker": r.get("mk"), "model": r.get("md"),
             "chambering": r.get("ch"), "family": r.get("fm"), "tier": r.get("tr"),
             "group": r.get("gp")} for r in raw]


def parse_labels(page_text, figure):
    """Item number -> nomenclature, from the RPSTL list page facing the plate.

    ⛔ THE LIST IS ON THE FACING PAGE, NOT THE PLATE. The first pass at finding
    plates matched the LIST pages — they carry a column of item numbers and so look
    exactly like 'a page with numbered callouts' to a text-only heuristic. The
    illustration carries the drawing and almost no text. Both are needed: the plate
    is the picture, the labels are the words, and they live on different sheets."""
    lines = [l.strip() for l in page_text.split("\n")]
    try:
        start = next(i for i, l in enumerate(lines) if re.match(rf"FIG\.?\s*{re.escape(figure)}\b", l))
    except StopIteration:
        return []

    out, seen, i = [], set(), start + 1
    while i < len(lines):
        l = lines[i]
        if l.startswith("END OF FIGURE"):
            break
        # ⛔ THE QTY COLUMN LOOKS EXACTLY LIKE AN ITEM NUMBER. The last row's
        #    quantity ("1") sits on its own line just before END OF FIGURE, so the
        #    first parser read it as a seventh item and gave it the nomenclature
        #    "END OF FIGURE". An item number never repeats within a figure, which
        #    is what distinguishes the two.
        if re.fullmatch(r"\d{1,2}[A-Z]?", l) and l not in seen:
            item = l
            desc = None
            for j in range(i + 1, min(i + 8, len(lines))):
                c = lines[j]
                if re.fullmatch(r"\d{1,2}[A-Z]?", c):
                    break
                # the description is the run of words ending in the dot leader
                if re.search(r"[A-Za-z]{3,}", c) and not re.fullmatch(r"[A-Z]{5}", c) \
                        and not re.fullmatch(r"\d{5,}", c) and not c.startswith("UOC:"):
                    desc = re.sub(r"[.\s]+$", "", c).strip()
                    break
            if desc and not desc.startswith("END OF FIGURE"):
                seen.add(item)
                out.append({"item": item, "name": desc})
        i += 1
    return out


def callout_positions(page, items):
    """Where each callout number sits, normalised 0..1 — or {} when they cannot be
    known, which for these plates is always.

    ⛔⛔ THE FIRST VERSION OF THIS SHIPPED A COORDINATE THAT WAS WRONG TWICE OVER,
    and it looked entirely plausible in the JSON. On Figure C-2 it "found" callout 5
    at (0.125, 0.746). Both halves were broken:

      1. FALSE MATCH. The callout numbers on these plates are part of the scanned
         drawing, not text — there is no text layer to find them in. The only "5"
         on the page is in the footer, "Change 5". It matched a page number.
      2. WRONG COORDINATE SPACE. Positions were measured against the full page
         while the published image is CROPPED to the ink. Even a correct hit would
         have been displaced by the crop.

    A wrong coordinate is worse than no coordinate: an absent field is visibly
    absent, while a plausible one silently puts a highlight on the wrong part. So
    positions are emitted ONLY when every item is located inside the drawing region
    and measured in the crop's own space — and when they cannot all be found, none
    is emitted at all. Partial truth here is indistinguishable from error."""
    if not items:
        return {}
    want = {it["item"] for it in items}
    r = page.rect
    # the drawing region only: never the header band or the footer band
    top, bottom = r.y0 + r.height * 0.10, r.y0 + r.height * 0.88
    found = {}
    for w in page.get_text("words"):
        x0, y0, x1, y1, txt = w[0], w[1], w[2], w[3], w[4]
        if txt in want and top <= (y0 + y1) / 2 <= bottom and txt not in found:
            found[txt] = ((x0 + x1) / 2, (y0 + y1) / 2)
    if set(found) != want:
        return {}          # ⛔ all or nothing
    return found


def render_plate(page, out_path):
    """Render the illustration, cropped to its own ink with a margin.

    Cropping matters: an uncropped page is mostly white, so the diagram arrives in
    the app at a fraction of the width it could have had."""
    pix = page.get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY)
    w, h, s = pix.width, pix.height, pix.samples
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        base = y * w
        for x in range(w):
            if s[base + x] < 200:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx <= minx or maxy <= miny:
        raise RuntimeError("blank page — nothing to crop")
    m = int(DPI * 0.12)
    minx, miny = max(0, minx - m), max(0, miny - m)
    maxx, maxy = min(w - 1, maxx + m), min(h - 1, maxy + m)

    clip = pymupdf.Rect(minx, miny, maxx + 1, maxy + 1) * (72.0 / DPI)
    out = page.get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY, clip=clip)
    out.save(out_path)
    return out.width, out.height, clip


def main():
    verify = load(VERIFY)["documents"]
    fetch = load(FETCH)["documents"]
    catalog = catalog_rows()
    print(f"  catalog at app HEAD: {len(catalog)} rows")

    os.makedirs(IMGDIR, exist_ok=True)
    for f in glob.glob(os.path.join(PLATES, "*.json")):
        os.remove(f)
    for f in glob.glob(os.path.join(IMGDIR, "*.png")):
        os.remove(f)

    mapping = {"_doc": "Every plate built, the rows it was mapped to, and the reasoning. "
                       "Row selection is a predicate over the catalog; the row test is a "
                       "recorded judgement.",
               "plates": [], "refused": []}
    written = 0

    for d in PLATE_DEFS:
        docname = d["doc"]
        v = verify.get(docname)
        if not v or v["verdict"] != "SHIP":
            mapping["refused"].append({
                "plateId": d["plateId"],
                "why": f"source document verdict is {v['verdict'] if v else 'MISSING'}, not SHIP"})
            print(f"  ⛔ {d['plateId']}: source not SHIP")
            continue

        # provenance, taken from the fetch record rather than reconstructed
        frec = next((r for r in fetch.values()
                     if r.get("cachedAs", "").endswith("/" + docname)), None)
        if not frec or not frec.get("sha256") or not frec.get("sourceUrl"):
            mapping["refused"].append({"plateId": d["plateId"],
                                       "why": "incomplete provenance — no sha256/sourceUrl on record"})
            print(f"  ⛔ {d['plateId']}: incomplete provenance")
            continue

        doc = pymupdf.open(os.path.join(CACHE, docname))
        fig_page = doc[d["figurePage"] - 1]
        labels = parse_labels(doc[d["listPage"] - 1].get_text(), d["figure"])
        if not labels:
            mapping["refused"].append({"plateId": d["plateId"],
                                       "why": "no labels parsed from the facing list page"})
            print(f"  ⛔ {d['plateId']}: no labels")
            doc.close()
            continue

        tmp = os.path.join(IMGDIR, "_tmp.png")
        w, h, clip = render_plate(fig_page, tmp)
        raw = io.open(tmp, "rb").read()
        sha = hashlib.sha256(raw).hexdigest()
        img_name = f"{sha[:16]}.png"
        os.replace(tmp, os.path.join(IMGDIR, img_name))

        # ⛔ NORMALISED AGAINST THE CROP, NOT THE PAGE — see callout_positions().
        pos = callout_positions(fig_page, labels)
        for lab in labels:
            if lab["item"] in pos:
                px, py = pos[lab["item"]]
                lab["x"] = round((px - clip.x0) / clip.width, 4)
                lab["y"] = round((py - clip.y0) / clip.height, 4)
        has_pos = bool(pos)

        # ---- rows ----
        sel = d["select"]
        rows = [r for r in catalog
                if all(r.get(k) == val for k, val in sel.items())
                and r.get("family") not in d["excludeFamilies"]]

        provenance = {
            "tm": d["tm"],
            "edition": d["edition"],
            "figure": f"Figure {d['figure']}. {d['title']}",
            "page": d["figurePage"],
            "sourceUrl": frec["sourceUrl"],
            "documentSha256": frec["sha256"],
            "publicDomain": {
                "distribution": v["checks"]["distribution"]["why"],
                "preparer": v["checks"]["preparer"]["why"],
                "reprint": v["checks"]["reprint"]["why"],
                "exportMarking": v["checks"]["exportMarking"]["why"],
                "verifiedBy": "tools/plates/verify.py",
            },
        }

        for r in rows:
            rec = {
                "row": r["id"],
                "plateId": d["plateId"],
                "title": d["title"],
                "image": f"plates/img/{img_name}",
                "imageWidth": w, "imageHeight": h,
                "imageSha256": sha,
                "labels": labels,
                "labelsNote": ("The callout numbers are already drawn on the image — never "
                               "re-draw them. x/y are normalised centres within THIS image, "
                               "for interaction only (tap a number, highlight its legend "
                               "row).") if has_pos else
                              ("No x/y: this plate's callout numbers are part of the scanned "
                               "drawing and have no text layer, so their positions cannot be "
                               "known. None is emitted rather than a guess. Render the legend "
                               "beside the image."),
                "provenance": provenance,
                "rowTest": d["rowTest"],
            }
            io.open(os.path.join(PLATES, r["id"] + ".json"), "w", encoding="utf-8").write(
                json.dumps(rec, indent=1, ensure_ascii=False) + "\n")
            written += 1

        mapping["plates"].append({
            "plateId": d["plateId"], "tm": d["tm"], "figure": d["figure"], "title": d["title"],
            "page": d["figurePage"], "image": f"plates/img/{img_name}",
            "imagePx": [w, h], "labels": len(labels),
            "rowsMapped": len(rows), "rows": [r["id"] for r in rows],
            "select": sel, "excludeFamilies": d["excludeFamilies"],
            "excludeReason": d["excludeReason"],
            "rowTest": d["rowTest"],
            "rejectedAlternatives": d["rejectedAlternatives"],
        })
        print(f"  ✅ {d['plateId']}: {w}x{h}px, {len(labels)} labels -> {len(rows)} rows")
        doc.close()

    io.open(MAPPING, "w", encoding="utf-8").write(json.dumps(mapping, indent=1, ensure_ascii=False))
    print(f"\n  {written} plate record(s) written to plates/")
    print(f"  -> {os.path.relpath(MAPPING, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
