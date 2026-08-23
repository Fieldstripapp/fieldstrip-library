"""hunt_hk.py — the cross-lane hunt: military manuals for the HK pattern.

⛔ THIS ONE IS NOT PRIMARILY ABOUT PLATES. `hkmr556` and `hkmr762` are on
ROWS-AWAITING-DOCUMENT.md with NO source of any kind, and the civilian MR556 and
MR762 ARE the M27 IAR and G28/M110A1 mechanisms. Under the 2026-08-20 ruling a
military manual for a pattern is an admissible SECONDARY source, so a hit here is
worth more to the Clean lane than it is to this one. Reported either way.

⚠ AND A NULL RESULT IS A RESULT. If these documents are not publicly posted, that
is a finding the Clean lane needs — it stops them waiting on something that is not
coming, and it is the difference between "not searched" and "searched, not there".
So this file records what was tried, in full, including the misses.

Searched three ways because a TM can be catalogued under any of them:
  the TM/TO number · the military designation · the maker's own designation.
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
OUT = os.path.join(ROOT, "plate-sourcing", "HK-PATTERN-SEARCH.json")

UA = "FieldstripPlateHunt/1.0 (+https://library.fieldstripapp.com) public-domain TM recovery"

QUERIES = [
    # M27 IAR (HK416) -> hkmr556
    ('"TM 10598A-10/1"', "USMC M27 IAR operator TM", "hkmr556"),
    ('"10598A-10"', "USMC M27 IAR TM, loose form", "hkmr556"),
    ('"M27 IAR"', "designation", "hkmr556"),
    ('"Infantry Automatic Rifle" AND manual', "spelled-out designation", "hkmr556"),
    ('"HK416" AND (manual OR technical)', "maker designation", "hkmr556"),
    ('title:(M27) AND title:(automatic)', "title-scoped", "hkmr556"),
    # M110A1 / G28 -> hkmr762
    ('"M110A1"', "designation", "hkmr762"),
    ('"squad designated marksman rifle"', "spelled-out designation", "hkmr762"),
    ('"HK G28"', "maker designation", "hkmr762"),
    ('"G28E"', "maker variant", "hkmr762"),
    ('"TM 9-1005-346"', "plausible TM series", "hkmr762"),
    ('"M110" AND "sniper system" AND manual', "predecessor M110 SASS", "hkmr762"),
    # the other AR-PISTON rows, same logic
    ('"Primary Weapons" AND (MK116 OR "long stroke")', "PWS MK116", "pwsmk116"),
    ('"Adams Arms" AND piston AND manual', "Adams Arms P2", "adamsarmsp2"),
    ('"Fightlite" OR "Ares SCR"', "Fightlite SCR", "fightlitescr"),
]


def search(query, rows=20):
    q = urllib.parse.urlencode({"q": query, "rows": rows, "page": 1, "output": "json"}, doseq=True)
    fl = "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year"
    url = f"https://archive.org/advancedsearch.php?{q}{fl}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as r:
            d = json.loads(r.read().decode("utf-8", "replace"))
        return (d.get("response") or {}).get("docs") or [], None
    except Exception as e:                                        # noqa: BLE001
        return [], str(e)


def main():
    out = {
        "_doc": "Cross-lane search for military manuals covering the HK and piston-AR patterns. "
                "A null result here is itself the finding: it distinguishes 'searched, not "
                "publicly posted' from 'not searched'.",
        "ruling": "2026-08-20 — a military manual for a pattern is an admissible secondary source.",
        "searchedOn": time.strftime("%Y-%m-%d"),
        "queries": [],
    }
    for q, why, row in QUERIES:
        docs, err = search(q)
        print(f"  {row:14} {q[:44]:46} {('ERR ' + err[:20]) if err else str(len(docs)) + ' hit(s)'}")
        for d in docs[:5]:
            print(f"        {d.get('identifier')} | {str(d.get('title'))[:66]}")
        out["queries"].append({
            "row": row, "query": q, "why": why, "error": err,
            "results": [{"identifier": d.get("identifier"), "title": d.get("title"),
                         "year": d.get("year")} for d in docs],
        })
        time.sleep(0.4)

    io.open(OUT, "w", encoding="utf-8").write(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"\n-> {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
