"""verify.py — the three public-domain checks, plus the export-marking sweep.

⛔ NOTHING BECOMES A PLATE WITHOUT PASSING EVERY CHECK HERE. This runs before a
single page is rendered. A document that fails any check is RECORDED AS REFUSED
WITH ITS REASON — never quietly dropped, because a quiet drop is indistinguishable
from "not looked at yet" and next session someone looks again.

──────────────────────────────────────────────────────────────────────────────
CHECK 1 — DISTRIBUTION STATEMENT
──────────────────────────────────────────────────────────────────────────────
Distribution A ships. B through F do not, WHATEVER their copyright status: a
distribution statement is a RELEASE control, and "this is public domain" is no
answer to "the issuing authority restricted who may have it".

⛔⛔ THE MOST RELEASABLE DOCUMENT IN THE CORPUS SAYS "RESTRICTION" ON ITS COVER.
FM 3-22.9 is marked:

    DISTRIBUTION RESTRICTION: Approved for public release; distribution is unlimited.

That is Distribution A stated in the affirmative — the restriction is that there
is none. A keyword filter for "restriction", or for "DISTRIBUTION STATEMENT A"
literally, gets this exactly backwards: the first refuses the most clearly
releasable book in the lane, the second fails to find it at all. So the test is
on the SUBSTANCE — approved for public release, distribution unlimited — and the
B–F test is anchored to the phrase those statements actually use, "Distribution
authorized to…", never to the bare word "restriction".

⚠ AND ABSENCE IS NOT PERMISSION. Distribution statements only became standard
practice in the 1980s; a 1947 War Department TM carries none. That does NOT make
it Distribution A, it makes it UNMARKED, and UNMARKED is its own verdict that does
not ship. Whether a pre-1978 US Government publication with no marking and no
copyright notice may be published is a legal judgement about a product that ships
internationally through an app store — which is RULING FLAGS ARE ROUTING, exactly
like the SCCY export marking. This file measures and routes. It does not decide.

──────────────────────────────────────────────────────────────────────────────
CHECK 2 — PREPARER
──────────────────────────────────────────────────────────────────────────────
17 U.S.C. §105 puts works of US Government EMPLOYEES in the public domain. It says
nothing about contractors, who routinely retain copyright, and manuals for
commercially-derived weapons — the M9 is a Beretta 92, the M24 a Remington 700,
the M27 an HK416 — are the likeliest of all to carry maker-supplied artwork inside
a government cover. A copyright notice anywhere is fatal. An unclear preparer does
not ship.

──────────────────────────────────────────────────────────────────────────────
CHECK 3 — REPRINTS
──────────────────────────────────────────────────────────────────────────────
A commercial reprint's government plates are free; the publisher's own foreword,
index and typesetting are not. Take the plate, never the surrounding matter.

⛔ AND "REPRINT" IS TWO DIFFERENT WORDS. Two documents here open with:

    "This copy is a reprint which includes current pages from Changes 1 and 2."

That is the GOVERNMENT reissuing its own manual with change pages merged — the
most ordinary thing a TM does, and no third party is involved. A bare /reprint/
match would flag those as commercial republications and refuse both. The
commercial test is therefore on PUBLISHER IDENTITY, not on the word.

Usage:  python tools/plates/verify.py            # sweep the cache, write the ledger
        python tools/plates/verify.py --selftest # fire every check at a fixture
"""
import glob
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
OUT = os.path.join(ROOT, "plate-sourcing", "VERIFY-LEDGER.json")

# ---------------------------------------------------------------- check 1
DIST_A = re.compile(
    r"(?i)approved\s+for\s+public\s+release[;,.\s]*\s*distribution\s+(?:is\s+)?unlimited"
    r"|distribution\s+statement\s+a\b")
# ⛔ ANCHORED ON THE PHRASE A RESTRICTED STATEMENT ACTUALLY USES, never on the
#    bare word "restriction" — see the module docstring.
DIST_BF = re.compile(
    r"(?i)distribution\s+statement\s+([b-f])\b"
    r"|distribution\s+authorized\s+to\s+(?:u\.?s\.?\s+)?(?:government\s+agencies|dod|the\s+department)"
    r"|export[- ]control(?:led)?\s+.{0,40}\bdistribution\s+authorized")

# ---------------------------------------------------------------- check 2
COPYRIGHT = re.compile(r"(?i)(?:©|\(c\)\s*(?:copyright)?\s*\d{4}|copyright\s+(?:©\s*)?\d{4}"
                       r"|all\s+rights\s+reserved)")
GOV_ISSUER = re.compile(
    r"(?i)headquarters,?\s+department\s+of\s+the\s+army"
    r"|war\s+department"
    r"|department\s+of\s+the\s+(?:navy|air\s+force)"
    r"|u\.?\s?s\.?\s+government\s+printing\s+office"
    r"|commandant,?\s+u\.?s\.?\s+(?:marine\s+corps|coast\s+guard)"
    r"|by\s+order\s+of\s+the\s+secretary\s+of\s+the\s+army")
CONTRACTOR = re.compile(
    r"(?i)prepared\s+(?:by|under\s+contract)\s+(?!the\s+(?:secretary|department))"
    r"|under\s+contract\s+(?:no\.?|number)"
    r"|proprietary\s+(?:data|information)")

# ---------------------------------------------------------------- check 3
COMMERCIAL_REPRINT = re.compile(
    r"(?i)\b(paladin\s+press|periscope\s+film|desert\s+publications|normount"
    r"|firepower\s+publications|delta\s+press|lancer\s+militaria"
    r"|reprinted\s+by\s+(?!the\s+(?:government|department))"
    r"|this\s+edition\s+published\s+by)\b")
# The government's own change-page reissue. Recognised so it is never mistaken
# for the above.
GOV_REPRINT = re.compile(r"(?i)reprint\s+which\s+includes\s+current\s+pages")

# ⛔⛔ A NAMED-PUBLISHER LIST CANNOT CATCH A REDISTRIBUTOR NOBODY HAS HEARD OF, AND
#    THE ONE IN THIS CORPUS WAS NOT ON ANY LIST. The 2005 Mossberg TM carries
#    "emilitarymanuals.com" stamped on ALL 164 OF ITS PAGES — so every plate cut
#    from it would carry a third party's mark, which is precisely the surrounding
#    matter rule 3 says never to take. The named list found nothing; this did.
#
#    The discriminator is structural rather than nominal: a US Government manual
#    cites .gov and .mil, and a commercial domain printed on its pages did not come
#    from the issuing authority. Counted per page, because a single .com mentioned
#    once in a body paragraph is a citation, while one on every page is a watermark.
#    ⚠ AND THE FIRST BUILD OF THIS PATTERN MATCHED NOTHING AT ALL. A shell heredoc
#    turned the intended word-boundary escape into a literal 0x08 BACKSPACE byte, so the
#    regex demanded an unprintable character and found zero watermarks — while the
#    ledger reported the document clean. The selftest missed it too, because it fed
#    check_reprint a pre-computed tuple and so tested the decision logic rather than
#    the scan. That is testing the fixture instead of the guard. scan_watermark() is
#    now fired at a real cached document, with a known true positive.
REDISTRIBUTOR_DOMAIN = re.compile(
    r"(?i)\b(?:https?://)?(?:www\.)?([a-z0-9-]+\.(?:com|net|org|info|biz|co\.uk))\b")

# ---------------------------------------------------------------- export markings
# Ported from the app repo's check_export_markings.py, whose reasoning holds here:
# token-bounded (unbounded "itar" lives inside evitar/limitar/militar), and the
# positive and the disclaimer are one word apart.
ITAR_TOKEN = re.compile(r"(?<![A-Za-z])ITAR(?![A-Za-z])")
EXPORT_POS = re.compile(
    r"(?i)(?:contains?|includes?)\s+\"?ITAR\"?[- ]?restricted"
    r"|subject\s+to\s+the\s+International\s+Traffic\s+in\s+Arms\s+Regulations"
    r"|diversion\s+contrary\s+to\s+u\.?s\.?\s+law\s+is\s+prohibited")
EXPORT_NEG = re.compile(r"(?i)free\s+of\s+\"?ITAR\"?[- ]?restricted")


def flat(text):
    return re.sub(r"\s+", " ", text)


def ev(rx, t, before=80, after=140):
    m = rx.search(t)
    if not m:
        return None
    return t[max(0, m.start() - before):m.end() + after].strip()


def check_distribution(t):
    a, bf = DIST_A.search(t), DIST_BF.search(t)
    if bf and not a:
        return "REFUSED", f"Distribution {(bf.group(1) or '?').upper()} — a release control", ev(DIST_BF, t)
    if a and bf:
        # ⛔ BOTH PRESENT ROUTES TO A HUMAN. A book that states A somewhere and a
        #    restricted statement elsewhere is not one a regex may resolve.
        return "ROUTE", "states Distribution A AND a restricted statement", ev(DIST_BF, t)
    if a:
        return "PASS", "Distribution A — approved for public release, unlimited", ev(DIST_A, t)
    return "ROUTE", "UNMARKED — no distribution statement (pre-dates the convention)", ""


def check_preparer(t):
    if COPYRIGHT.search(t):
        return "REFUSED", "carries a copyright notice", ev(COPYRIGHT, t)
    if CONTRACTOR.search(t):
        return "ROUTE", "names a contractor preparer — §105 does not reach contractors", ev(CONTRACTOR, t)
    if GOV_ISSUER.search(t):
        return "PASS", "issued by a US Government authority", ev(GOV_ISSUER, t, 40, 90)
    return "ROUTE", "preparer unclear — does not ship", ""


def check_reprint(t, watermark=None):
    """watermark: (domain, pagesCarryingIt, totalPages) measured over the whole
    document, or None when only front matter is available.

    ⛔ THE WATERMARK TEST OUTRANKS THE NAME TEST BECAUSE IT IS THE ONE THAT WORKED.
    The named-publisher list matched nothing in this corpus; the page-count test
    found emilitarymanuals.com on all 164 pages of the Mossberg TM."""
    if watermark:
        dom, npages, total = watermark
        # On most pages = stamped by a redistributor. On one = cited in the text.
        if total and npages >= max(3, 0.5 * total):
            return "REFUSED", (f"redistributor watermark '{dom}' on {npages} of {total} pages — "
                               "every plate cut from this book would carry a third party's mark"), dom
        if npages:
            return "ROUTE", f"commercial domain '{dom}' printed on {npages} of {total} pages", dom
    if COMMERCIAL_REPRINT.search(t):
        return "ROUTE", "commercial reprint — take the plate only, never the publisher's matter", \
               ev(COMMERCIAL_REPRINT, t)
    if GOV_REPRINT.search(t):
        return "PASS", "government change-page reissue, not a commercial reprint", ev(GOV_REPRINT, t)
    return "PASS", "no commercial reprint matter found", ""


def check_export(t):
    pos, neg = EXPORT_POS.search(t), EXPORT_NEG.search(t)
    if pos and not neg:
        return "REFUSED", "publisher marks the document export-restricted", ev(EXPORT_POS, t)
    if pos and neg:
        return "ROUTE", "asserts AND disclaims an export restriction", ev(EXPORT_POS, t)
    if ITAR_TOKEN.search(t) and not neg:
        return "ROUTE", "names ITAR without a clear assertion or disclaimer", ev(ITAR_TOKEN, t)
    return "PASS", "no export-control marking on the document", ""


CHECKS = [("distribution", check_distribution), ("preparer", check_preparer),
          ("reprint", check_reprint), ("exportMarking", check_export)]


def verdict_for(results):
    """REFUSED beats ROUTE beats PASS. A document ships only if every check passes."""
    if any(r["verdict"] == "REFUSED" for r in results.values()):
        return "REFUSED"
    if any(r["verdict"] == "ROUTE" for r in results.values()):
        return "ROUTE"
    return "SHIP"


def scan_watermark(path):
    """The most-repeated commercial domain in the document, and how many pages carry it."""
    d = pymupdf.open(path)
    per = {}
    for i in range(d.page_count):
        for m in REDISTRIBUTOR_DOMAIN.finditer(d[i].get_text()):
            per.setdefault(m.group(1).lower(), set()).add(i)
    total = d.page_count
    d.close()
    if not per:
        return None
    dom, pgs = max(per.items(), key=lambda kv: len(kv[1]))
    return (dom, len(pgs), total)


def read_text(path, pages=6):
    """Front matter plus a tail sample. Distribution statements live on the cover
    or the title page; copyright notices hide on the last page as often as the
    first, so both ends are read."""
    d = pymupdf.open(path)
    n = d.page_count
    idx = list(range(min(pages, n))) + [i for i in (n - 2, n - 1) if i >= pages]
    t = flat("\n".join(d[i].get_text() for i in sorted(set(idx))))
    d.close()
    return t, n


def selftest():
    """⛔ EVERY CHECK IS FIRED AT SOMETHING THAT MUST TRIP IT AND SOMETHING THAT
    MUST NOT. The must-not cases are the ones that matter: each is a real string
    from this corpus that an earlier draft of these patterns got wrong."""
    cases = [
        ("distribution", "DISTRIBUTION STATEMENT B: Distribution authorized to U.S. Government "
                         "agencies only.", "REFUSED"),
        ("distribution", "DISTRIBUTION RESTRICTION: Approved for public release; distribution is "
                         "unlimited.", "PASS"),
        ("distribution", "WAR DEPARTMENT TECHNICAL MANUAL January 1947", "ROUTE"),
        ("preparer", "Copyright © 1998 by the contractor. All rights reserved.", "REFUSED"),
        ("preparer", "HEADQUARTERS, DEPARTMENT OF THE ARMY WASHINGTON, D.C.", "PASS"),
        ("preparer", "This manual was prepared by Acme Defense Systems Inc.", "ROUTE"),
        ("reprint", "This edition published by Paladin Press.", "ROUTE"),
        # the measured case: a stamp on every page, which no name list would catch
        ("reprint-watermark", ("emilitarymanuals.com", 164, 165), "REFUSED"),
        ("reprint-watermark", ("ammo.com", 1, 300), "ROUTE"),
        ("reprint", "This copy is a reprint which includes current pages from Changes 1 and 2.",
         "PASS"),
        ("exportMarking", "This page contains ITAR-restricted data. Subject to the International "
                          "Traffic in Arms Regulations.", "REFUSED"),
        ("exportMarking", "Information contained in this publication is free of \"ITAR\" restricted "
                          "data", "PASS"),
        ("exportMarking", "Es necesario evitar limitar el militar.", "PASS"),
    ]
    fn = dict(CHECKS)
    bad = 0

    # ⛔ THE LIVE CONTROL. Every case below this line is a string; this one is a
    #    real document, and it is the one that would have caught the 0x08 bug.
    live = os.path.join(CACHE, "ARMY_TM_9-1005-338-13_P_Technical_Manual_for_Mossberg_"
                               "12-Gauge_Shotgun_Model_500_590_-_May_2005.pdf.pdf")
    if os.path.exists(live):
        wm = scan_watermark(live)
        ok = bool(wm) and wm[0] == "emilitarymanuals.com" and wm[1] > 100
        if not ok:
            bad += 1
        print(f"   {'✅' if ok else '⛔'} {'scan_watermark':14} REAL DOCUMENT -> {wm}"
              f"{'' if ok else '   ← expected emilitarymanuals.com on >100 pages'}")
    else:
        print("   ⚠ scan_watermark  live control skipped — document not cached")

    for check, text, want in cases:
        if check == "reprint-watermark":
            got = check_reprint("", text)[0]
            text = f"watermark {text}"
        else:
            got = fn[check](flat(text))[0]
        ok = got == want
        if not ok:
            bad += 1
        print(f"   {'✅' if ok else '⛔'} {check:14} expect {want:8} got {got:8}  {text[:56]}")
    print(f"\n{'✅ selftest passes' if not bad else '⛔ SELFTEST FAILED (' + str(bad) + ')'}")
    return 1 if bad else 0


def main():
    if "--selftest" in sys.argv:
        return selftest()

    pdfs = sorted(glob.glob(os.path.join(CACHE, "*.pdf")))
    if not pdfs:
        print("⛔ REFUSING — no documents in .plate-cache/. That is not a clean sweep, "
              "it is an empty one.")
        return 2

    seen_sha = {}
    out = {"_doc": "Public-domain verification per cached document. SHIP means every check "
                   "passed. ROUTE means a human must rule — it does NOT ship. REFUSED is final.",
           "checks": ["distribution", "preparer", "reprint", "exportMarking"],
           "documents": {}}

    for p in pdfs:
        name = os.path.basename(p)
        try:
            t, npages = read_text(p)
        except Exception as e:                                    # noqa: BLE001
            out["documents"][name] = {"verdict": "REFUSED",
                                      "why": f"unreadable — {e}"}
            print(f"  ⛔ {name[:58]:60} unreadable")
            continue

        wm = scan_watermark(p)
        results = {}
        for key, fn in CHECKS:
            v, why, evid = fn(t, wm) if key == "reprint" else fn(t)
            results[key] = {"verdict": v, "why": why, "evidence": (evid or "")[:400]}
        if wm:
            results["reprint"]["watermark"] = {"domain": wm[0], "pages": wm[1], "ofPages": wm[2]}
        v = verdict_for(results)
        out["documents"][name] = {"verdict": v, "pages": npages, "checks": results}

        mark = {"SHIP": "✅", "ROUTE": "⚠", "REFUSED": "⛔"}[v]
        detail = "; ".join(f"{k}:{r['verdict'][0]}" for k, r in results.items())
        print(f"  {mark} {name[:56]:58} {v:8} [{detail}]")

    io.open(OUT, "w", encoding="utf-8").write(json.dumps(out, indent=1, ensure_ascii=False))
    n_ship = sum(1 for d in out["documents"].values() if d["verdict"] == "SHIP")
    n_route = sum(1 for d in out["documents"].values() if d["verdict"] == "ROUTE")
    n_ref = sum(1 for d in out["documents"].values() if d["verdict"] == "REFUSED")
    print(f"\n  SHIP {n_ship} · ROUTE {n_route} · REFUSED {n_ref}")
    print(f"  -> {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
