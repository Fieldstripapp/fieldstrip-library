"""fetch.py — pull candidate documents into the local cache.

⛔ THE CACHE IS NOT THE REPOSITORY. Downloads land in .plate-cache/, which is
gitignored, and NOTHING here ever writes into the published tree. Public-domain
status makes a TM publishable in principle; it does not make it our job to
redistribute an entire book. We publish the PLATE — verified, provenanced, one
page — not the document it came out of.

⛔ A DOWNLOAD IS NOT AN ACCEPTANCE. Nothing in this file reads a distribution
statement, identifies a preparer or looks at a single plate. That is verify.py,
and it runs before any page is extracted. Fetching only makes the bytes readable.

⛔ AND THE SHA256 IS TAKEN HERE, AT THE MOMENT OF RECEIPT. Provenance that is
computed later, from a file that has since been through a tool, records the tool
rather than the source. The digest in the ledger is the digest of what the server
actually sent.

Usage:  python tools/plates/fetch.py <identifier> [<identifier> ...]
        python tools/plates/fetch.py --from-plan
"""
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(ROOT, ".plate-cache")
LEDGER = os.path.join(ROOT, "plate-sourcing", "FETCH-LEDGER.json")

UA = "FieldstripPlateHunt/1.0 (+https://library.fieldstripapp.com) public-domain TM recovery"

# ⛔ A DJVU/ABBYY SIDECAR IS NOT THE BOOK. archive.org items carry derived files
#    alongside the original; picking by "first PDF" can land on a 40-page OCR
#    artefact instead of the scan. Prefer the largest real PDF, and record which
#    file was taken so the choice is auditable.
def pick_pdf(files):
    cands = []
    for f in files:
        n = f.get("name", "")
        if not n.lower().endswith(".pdf"):
            continue
        if "_text" in n.lower():
            continue
        try:
            size = int(f.get("size") or 0)
        except (TypeError, ValueError):
            size = 0
        cands.append((size, n))
    if not cands:
        return None, None
    cands.sort(reverse=True)
    return cands[0][1], cands[0][0]


def meta(identifier):
    url = f"https://archive.org/metadata/{identifier}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def download(identifier, name, dest):
    url = f"https://archive.org/download/{identifier}/{urllib.parse.quote(name)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    h = hashlib.sha256()
    total = 0
    with urllib.request.urlopen(req, timeout=300) as r, io.open(dest, "wb") as out:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            h.update(chunk)
            out.write(chunk)
            total += len(chunk)
    return h.hexdigest(), total, url


def load_ledger():
    if os.path.exists(LEDGER):
        try:
            return json.load(io.open(LEDGER, encoding="utf-8"))
        except Exception:                                        # noqa: BLE001
            pass
    return {"_doc": "Documents pulled into .plate-cache/. A fetch is not an acceptance — "
                    "verify.py applies the public-domain checks before any plate is built.",
            "documents": {}}


def main():
    """Args are identifiers, or `identifier::filename` to take ONE file out of a
    multi-document item.

    ⛔ A COMPILATION IS A SHELF, NOT A BOOK. The largest archive.org hits in this
    lane are Italian-uploaded compilations holding dozens of separate manuals as
    separate PDFs. Taking "the biggest PDF" from one of those lands on whatever
    happens to be longest — a 1945 Browning manual — rather than the TM being
    hunted. So a specific file can be named, and the name is recorded."""
    ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not ids:
        print("usage: fetch.py <identifier>[::<filename>] ...")
        return 2

    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    ledger = load_ledger()

    for spec in ids:
        ident, _, want = spec.partition("::")
        key = spec
        rec = {"identifier": ident, "fetchedOn": time.strftime("%Y-%m-%d")}
        if want:
            rec["fileRequested"] = want
        try:
            m = meta(ident)
        except Exception as e:                                   # noqa: BLE001
            print(f"  ⛔ {ident}: metadata unreachable — {e}")
            rec["error"] = f"metadata: {e}"
            ledger["documents"][key] = rec
            continue

        md = m.get("metadata") or {}
        rec["title"] = md.get("title")
        rec["date"] = md.get("date") or md.get("year")
        rec["publisher"] = md.get("publisher")
        rec["archiveLicense"] = md.get("licenseurl") or md.get("rights") or None
        # ⛔ THE UPLOADER IS A PERSON AND THIS LEDGER IS PUBLIC. archive.org's
        #    `uploader` field is a real email address — six of them were recorded
        #    here before this was caught, in a repo that is public from birth.
        #    Provenance means WHERE THE DOCUMENT CAME FROM: the archive, the item,
        #    the URL, the digest. It has never meant who uploaded it.

        if want:
            names = [f.get("name", "") for f in (m.get("files") or [])]
            hit = [n for n in names if n == want] or [n for n in names if want.lower() in n.lower()]
            if not hit:
                print(f"  ⛔ {ident}: no file matching {want!r}")
                rec["error"] = f"no file matching {want!r}"
                ledger["documents"][key] = rec
                continue
            name = hit[0]
        else:
            name, _size = pick_pdf(m.get("files") or [])
        if not name:
            print(f"  ⛔ {ident}: no PDF in item")
            rec["error"] = "no PDF in item"
            ledger["documents"][key] = rec
            continue

        slug = re.sub(r"[^A-Za-z0-9._-]+", "_", (want or ident))[:110]
        dest = os.path.join(CACHE, f"{slug}.pdf")
        if os.path.exists(dest) and ledger["documents"].get(key, {}).get("sha256"):
            print(f"  · {key}: already cached")
            continue

        try:
            sha, got, url = download(ident, name, dest)
        except Exception as e:                                   # noqa: BLE001
            print(f"  ⛔ {ident}: download failed — {e}")
            rec["error"] = f"download: {e}"
            ledger["documents"][key] = rec
            continue

        # ⛔ A FILE THAT IS NOT A PDF IS NOT A PDF WHATEVER IT IS CALLED. SIG served
        #    this lane a placeholder JPEG at HTTP 200; the header is the only thing
        #    that settles it.
        head = io.open(dest, "rb").read(5)
        if not head.startswith(b"%PDF"):
            print(f"  ⛔ {ident}: served {head!r}, not a PDF — discarded")
            os.remove(dest)
            rec["error"] = f"not a PDF (header {head!r})"
            ledger["documents"][key] = rec
            continue

        rec.update({"file": name, "bytes": got, "sha256": sha, "sourceUrl": url,
                    "cachedAs": os.path.relpath(dest, ROOT).replace(os.sep, "/")})
        print(f"  ✅ {key[:70]}: {got/1048576:.1f} MiB  sha256 {sha[:16]}…")
        ledger["documents"][key] = rec
        time.sleep(0.5)

    io.open(LEDGER, "w", encoding="utf-8").write(json.dumps(ledger, indent=1, ensure_ascii=False))
    print(f"\nledger -> {os.path.relpath(LEDGER, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
