"""
Fetch real Sentinel-2 imagery of the study area, for use as page identity.

    python -m app.ml.fetch_identity_imagery

WHY
---
The landing and section anchors needed an image. The only honest one is a
picture of the ground this product is about, so this pulls Sentinel-2 L2A
true-colour previews of the Central India manganese belt from Microsoft
Planetary Computer and records exactly which scenes they are.

No stock photography and no illustrative space art: an invented image of a
place is the same class of claim as an invented number about it, and this
project has spent several phases removing those.

WHAT IT WRITES
--------------
  frontend/public/imagery/<tile>.webp        the picture
  frontend/public/imagery/_provenance.json   collection, scene id, datetime,
                                             cloud cover, renderer, bbox

Budget: the total is asserted under 3 MB and the run fails if it is exceeded.
Previews are used rather than raw bands because a true-colour COG mosaic of the
belt is gigabytes and this is a page background, not an analysis input — the
provenance file says so.
"""
from __future__ import annotations

import json
import ssl
import urllib.request
from pathlib import Path

import certifi

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
OUT = Path(__file__).resolve().parents[3] / "frontend" / "public" / "imagery"
BUDGET_BYTES = 3 * 1024 * 1024

# The study grid, same bounds the prospectivity surface uses.
BBOX = [78.6, 20.6, 80.8, 22.5]
MAX_CLOUD = 3.0
WINDOW = "2025-11-01/2026-03-31"   # dry season: the belt is not under monsoon cloud
WANT = 3


def _ctx() -> ssl.SSLContext:
    # The default store misses this chain in some environments; certifi has it.
    return ssl.create_default_context(cafile=certifi.where())


def search() -> list[dict]:
    body = json.dumps({
        "collections": ["sentinel-2-l2a"],
        "bbox": BBOX,
        "datetime": WINDOW,
        "query": {"eo:cloud_cover": {"lt": MAX_CLOUD}},
        "limit": 20,
    }).encode()
    req = urllib.request.Request(STAC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90, context=_ctx()) as r:
        return json.load(r)["features"]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    features = search()
    if not features:
        print("No scene under the cloud threshold in the window — nothing written.")
        print("A stand-in would not be a picture of this place, so none is drawn.")
        return 1

    # One scene per MGRS tile, so the set covers ground rather than repeating it.
    chosen, seen = [], set()
    for f in features:
        tile = f["properties"].get("s2:mgrs_tile") or f["id"].split("_")[-2]
        if tile in seen or "rendered_preview" not in f["assets"]:
            continue
        seen.add(tile)
        chosen.append((tile, f))
        if len(chosen) == WANT:
            break

    records, total = [], 0
    for tile, f in chosen:
        href = f["assets"]["rendered_preview"]["href"]
        with urllib.request.urlopen(href, timeout=120, context=_ctx()) as r:
            raw = r.read()
        png = OUT / f"belt-{tile}.png"
        png.write_bytes(raw)

        # Prefer WebP; keep the PNG only if conversion is unavailable.
        out_path = png
        try:
            from PIL import Image

            with Image.open(png) as im:
                webp = OUT / f"belt-{tile}.webp"
                im.convert("RGB").save(webp, "WEBP", quality=82, method=6)
            png.unlink()
            out_path = webp
        except ImportError:
            print("  Pillow not installed — keeping PNG, which is larger than the budget allows")

        size = out_path.stat().st_size
        total += size
        p = f["properties"]
        records.append({
            "file": f"/imagery/{out_path.name}",
            "bytes": size,
            "collection": "sentinel-2-l2a",
            "scene_id": f["id"],
            "mgrs_tile": tile,
            "datetime": p["datetime"],
            "eo_cloud_cover_pct": p.get("eo:cloud_cover"),
            "platform": p.get("platform"),
            "processing": "L2A surface reflectance, true colour (B04/B03/B02), rendered by the Planetary Computer data API",
            "source": "Microsoft Planetary Computer",
        })
        print(f"  {tile}  {f['id']}  {p['datetime'][:10]}  cloud {p.get('eo:cloud_cover')}  {size/1024:.0f} KB")

    (OUT / "_provenance.json").write_text(json.dumps({
        "generated_by": "app.ml.fetch_identity_imagery",
        "bbox": BBOX,
        "search_window": WINDOW,
        "max_cloud_cover_pct": MAX_CLOUD,
        "note": (
            "Rendered previews, not analysis inputs. A true-colour COG mosaic of "
            "the belt is gigabytes; these are page backgrounds and are labelled "
            "as such wherever they appear."
        ),
        "images": records,
    }, indent=2) + "\n")

    print(f"\nTotal {total/1024:.0f} KB of {BUDGET_BYTES/1024:.0f} KB budget")
    if total > BUDGET_BYTES:
        print("OVER BUDGET — imagery must stay under 3 MB")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
