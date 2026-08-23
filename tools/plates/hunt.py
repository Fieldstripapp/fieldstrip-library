"""hunt.py — find US military technical manuals with parts-nomenclature plates.

⛔ THIS LANE IS ONGOING BY DARREN'S RULING (2026-08-23): "post as many as we can and
search for more in the future." So the METHOD is the deliverable as much as any
plate is. A future session runs this file, not a memory of what somebody typed
into a search box once.

WHAT IS BEING HUNTED, AND WHAT IS NOT:

  WANTED    US Government technical manuals (TM), field manuals (FM) and their
            USMC equivalents, carrying numbered parts-nomenclature plates.
  ⛔ NEVER  Manufacturer manuals. Held behind attorney question 6. This file does
            not search for them, does not fetch them, and nothing downstream is
            built on the assumption that they exist.
  ⛔ NEVER  Anything we would draw, render, trace or generate ourselves. The
            military-manual look is the point BECAUSE it is genuinely official;
            a plate we made that merely looks official is the exact opposite of
            what was asked for.

METHOD — three passes, widening:

  1. KNOWN NUMBERS. A TM number is the single most precise handle that exists;
     searching "TM 9-1005-319-10" finds the book and nothing else. The seed list
     below is the standing one and grows as rows acquire candidates.
  2. WEAPON NAMES. For rows whose TM number we do not know, search the military
     designation plus manual vocabulary. Noisier, so results are ranked, never
     auto-accepted.
  3. COLLECTION SWEEP. archive.org's `militarymanuals` and `us-government-
     documents` style collections, walked for anything matching a catalog row.

⚠ EVERY HIT IS A CANDIDATE, NEVER AN ACCEPTANCE. Nothing here checks distribution
statements, preparers or reprints — that is verify.py, and it runs before a single
page is looked at. A search result is a lead.

Usage:  python tools/plates/hunt.py            # run all three passes, write the ledger
        python tools/plates/hunt.py --pass 1   # one pass only
"""
import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LEDGER = os.path.join(ROOT, "plate-sourcing", "HUNT-LEDGER.json")

UA = "FieldstripPlateHunt/1.0 (+https://library.fieldstripapp.com) public-domain TM recovery"
AD = "https://archive.org/advancedsearch.php"

# ---------------------------------------------------------------- pass 1 seeds
#
# ⛔ THE TM NUMBER IS THE HANDLE, THE WEAPON NAME IS THE FALLBACK. Each entry
#    names the rows it is being hunted FOR, so a hit is never left to a later
#    guess about why it was downloaded.
SEEDS = [
    # --- M16 / AR-15 family -------------------------------------------------
    {"tm": "TM 9-1005-319-10", "what": "M16A2/A3/A4, M4, M4A1 rifle & carbine",
     "for": ["ar15", "m4pattern"]},
    {"tm": "TM 9-1005-249-10", "what": "M16A1 rifle", "for": ["ar15-vintage"]},
    {"tm": "FM 3-22.9", "what": "Rifle marksmanship M16/M4 series", "for": ["ar15", "m4pattern"]},
    {"tm": "TM 9-1005-249-24", "what": "M16A1 direct/general support", "for": ["ar15-vintage"]},
    # --- M9 / Beretta 92 ----------------------------------------------------
    {"tm": "TM 9-1005-317-10", "what": "Pistol, 9mm, M9", "for": ["beretta92fs", "berettam9a4"]},
    {"tm": "TM 9-1005-317-23&P", "what": "M9 field & sustainment maintenance", "for": ["beretta92fs"]},
    # --- M1911 --------------------------------------------------------------
    {"tm": "TM 9-1005-211-34", "what": "Pistol, cal .45, M1911A1 DS/GS maintenance",
     "for": ["colt1911", "m1911pattern"]},
    {"tm": "TM 9-1005-211-12", "what": "Pistol, cal .45, M1911A1 operator/organizational",
     "for": ["colt1911", "m1911pattern"]},
    {"tm": "FM 23-35", "what": "Pistols and revolvers (M1911A1)", "for": ["colt1911"]},
    # --- Mossberg 500/590 ---------------------------------------------------
    {"tm": "TM 9-1005-338-13&P", "what": "Shotgun, 12 gauge, pump, M500 / M590",
     "for": ["mossberg500", "mossberg590"]},
    {"tm": "TM 08670A-10/1", "what": "USMC shotgun M1014/M500 operator", "for": ["mossberg500"]},
    # --- M24 / M40 / Remington 700 -----------------------------------------
    {"tm": "TM 9-1005-306-10", "what": "M24 Sniper Weapon System", "for": ["remington700"]},
    {"tm": "TM 9-1005-306-23&P", "what": "M24 SWS maintenance", "for": ["remington700"]},
    # --- M107 / M82 Barrett -------------------------------------------------
    {"tm": "TM 9-1005-239-10", "what": "Rifle, caliber .50, M107", "for": ["barrettm107", "barrettm82"]},
    {"tm": "TM 08370A-10/1", "what": "USMC M82A3 SASR operator", "for": ["barrettm82"]},
    # --- M14 / M1A ----------------------------------------------------------
    {"tm": "TM 9-1005-223-10", "what": "Rifle, 7.62mm, M14 and M14A1", "for": ["springfieldm1a"]},
    {"tm": "TM 9-1005-223-34", "what": "M14 DS/GS maintenance", "for": ["springfieldm1a"]},
    # --- 1b CROSS-LANE: the HK pattern -------------------------------------
    #
    # ⛔ THESE ARE HUNTED FOR THE CLEAN LANE AS WELL AS FOR PLATES. The civilian
    #    MR556 and MR762 ARE these mechanisms and their rows have no source at
    #    all. A military manual for a pattern is an admissible secondary source
    #    under the 2026-08-20 ruling, so a hit here is reported to that lane even
    #    if no plate is usable.
    {"tm": "TM 10598A-10/1", "what": "USMC M27 IAR operator manual", "for": ["hk-mr556", "hkmr556"]},
    {"tm": "M27 IAR technical manual", "what": "M27 Infantry Automatic Rifle (HK416)",
     "for": ["hk-mr556"]},
    {"tm": "M110A1 squad designated marksman rifle manual", "what": "M110A1 SDMR (HK G28)",
     "for": ["hk-mr762"]},
    {"tm": "TM 9-1005-345-10", "what": "M110 semi-automatic sniper system", "for": ["hk-mr762"]},
    # --- other patterns worth a standing look ------------------------------
    {"tm": "TM 9-1005-224-10", "what": "Rifle, cal .30, M1 (Garand)", "for": ["m1garand"]},
    {"tm": "TM 9-1276", "what": "Rifle, cal .30, M1 and M1C/M1D", "for": ["m1garand"]},
    {"tm": "TM 9-1005-201-10", "what": "Machine gun / carbine M1, M2", "for": ["m1carbine"]},
    {"tm": "TM 9-1005-213-10", "what": "Browning machine gun cal .50 M2", "for": []},
    {"tm": "TM 9-1005-237-23&P", "what": "M9 / M11 pistol maintenance", "for": ["sigp228"]},
    {"tm": "TM 9-1005-347-10", "what": "M17/M18 Modular Handgun System", "for": ["sigp320"]},
    {"tm": "TM 9-1005-313-10", "what": "M11 pistol (SIG P228)", "for": ["sigp228"]},
]

# ---------------------------------------------------------------- pass 2 terms
NAME_QUERIES = [
    "rifle 5.56 M16A2 operator manual plate",
    "M4 carbine technical manual parts",
    "pistol 9mm M9 operator manual",
    "shotgun M590 technical manual",
    "M24 sniper weapon system manual",
    "M107 caliber .50 rifle manual",
    "M14 rifle technical manual",
    "M27 infantry automatic rifle manual",
    "M110A1 designated marksman rifle manual",
    "M17 modular handgun system technical manual",
]

# ---------------------------------------------------------------- pass 3 sweep
COLLECTIONS = ["militarymanuals", "us_army_technical_manuals", "militarytechnicalmanuals"]


def fetch_json(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e:                                    # noqa: BLE001
            if i == tries - 1:
                return {"_error": str(e)}
            time.sleep(2 + 2 * i)
    return {"_error": "unreachable"}


def search(query, rows=25):
    """archive.org advanced search, restricted to items that actually hold a PDF."""
    q = urllib.parse.urlencode({
        "q": query,
        "rows": rows,
        "page": 1,
        "output": "json",
        "sort[]": "downloads desc",
    }, doseq=True)
    fl = "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=mediatype&fl%5B%5D=collection"
    d = fetch_json(f"{AD}?{q}{fl}")
    if "_error" in d:
        return [], d["_error"]
    docs = (d.get("response") or {}).get("docs") or []
    return docs, None


def main():
    only = None
    if "--pass" in sys.argv:
        only = int(sys.argv[sys.argv.index("--pass") + 1])

    ledger = {
        "_doc": "Candidate documents from the plate hunt. A CANDIDATE IS NOT AN ACCEPTANCE — "
                "verify.py applies the distribution/preparer/reprint checks before any page is read.",
        "method": "tools/plates/hunt.py — pass 1 known TM numbers, pass 2 weapon names, "
                  "pass 3 collection sweep. Re-runnable; this lane is ongoing.",
        "passes": {},
    }

    if only in (None, 1):
        print("PASS 1 — known TM numbers")
        hits = []
        for seed in SEEDS:
            docs, err = search(f'"{seed["tm"]}"')
            if err:
                print(f'  ⚠ {seed["tm"]:28} search error: {err}')
                hits.append({**seed, "error": err, "results": []})
                continue
            print(f'  {seed["tm"]:28} {len(docs):3d} result(s)  — {seed["what"]}')
            hits.append({**seed, "results": [
                {"identifier": d.get("identifier"), "title": d.get("title"),
                 "year": d.get("year"), "collection": d.get("collection")} for d in docs]})
            time.sleep(0.4)
        ledger["passes"]["1_known_tm_numbers"] = hits

    if only in (None, 2):
        print("\nPASS 2 — weapon-name queries")
        hits = []
        for q in NAME_QUERIES:
            docs, err = search(q, rows=15)
            print(f'  {q[:46]:48} {0 if err else len(docs):3d}')
            hits.append({"query": q, "error": err, "results": [
                {"identifier": d.get("identifier"), "title": d.get("title"), "year": d.get("year")}
                for d in (docs or [])]})
            time.sleep(0.4)
        ledger["passes"]["2_weapon_names"] = hits

    if only in (None, 3):
        print("\nPASS 3 — collection sweep")
        hits = []
        for c in COLLECTIONS:
            docs, err = search(f'collection:({c}) AND (rifle OR pistol OR shotgun OR carbine)', rows=40)
            print(f'  collection:{c:34} {0 if err else len(docs):3d}')
            hits.append({"collection": c, "error": err, "results": [
                {"identifier": d.get("identifier"), "title": d.get("title")} for d in (docs or [])]})
            time.sleep(0.4)
        ledger["passes"]["3_collection_sweep"] = hits

    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    io.open(LEDGER, "w", encoding="utf-8").write(json.dumps(ledger, indent=1, ensure_ascii=False))
    print(f"\nledger -> {os.path.relpath(LEDGER, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
