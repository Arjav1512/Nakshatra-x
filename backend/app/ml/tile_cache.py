"""
A local copy of the map's raster tiles, so a demo survives the network.

    python -m app.api.batch tiles            # fetch z6-z12 for every layer
    python -m app.api.batch tiles --zmax 11  # smaller
    python -m app.api.batch tiles --force    # refetch what is already there

WHY
---
The three raster layers are served by Planetary Computer's tiler. That is the
honest way to serve them — the pixels come from the source, not from something
this repo drew — but it means a hall with bad wifi, a rate limit, or an evicted
mosaic registration takes the imagery off the map in front of an audience.

So the tiles are fetched ahead of time and kept. The map still asks the live
tiler first; the cache is what it falls back to, and a layer served from cache
says so on screen with the date it was fetched. A cached tile presented as live
would be the same class of claim this project has spent several phases removing.

WHY z6-z12
----------
That is the range the map actually uses: it opens at 8.5, "zoom to belt" is 8,
"national" is 5.5, a search result is 10.5, selecting a mine is 11 and clicking
one is 12. Past z12 the user has zoomed in further than any default view and the
layer stays live-only — the next level alone is ~140 MB, which is not a sensible
thing to keep in a working tree.

Counted over the study bbox: 875 tiles per layer, 2,625 in all. The run reports
the measured size rather than this estimate.

WHERE
-----
`backend/.tile-cache/`, gitignored. These are bytes from someone else's service
under the Copernicus licence; they are a local convenience, not repository
content, and committing a few hundred megabytes of them would be wrong on both
counts. The manifest records exactly what was fetched and when.
"""
from __future__ import annotations

import json
import math
import ssl
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Iterator

import certifi

from app.ml.map_layers import BBOX, tile_layers

CACHE_DIR = Path(__file__).resolve().parents[2] / ".tile-cache"
MANIFEST = CACHE_DIR / "_manifest.json"
DEFAULT_ZMIN = 6
DEFAULT_ZMAX = 12
#: Polite: this is someone else's service and the whole run is a few thousand
#: requests. Six at a time finishes in a couple of minutes without hammering it.
WORKERS = 6
TIMEOUT_SECONDS = 30
#: A hard stop, so a mistaken zoom range cannot quietly download gigabytes.
BUDGET_BYTES = 60 * 1024 * 1024

_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _ctx() -> ssl.SSLContext:
    return ssl.create_default_context(cafile=certifi.where())


def tile_range(z: int) -> tuple[int, int, int, int]:
    """(x0, x1, y0, y1) inclusive, covering the study bbox at this zoom."""
    def xy(lat: float, lon: float) -> tuple[int, int]:
        n = 2**z
        x = int((lon + 180.0) / 360.0 * n)
        lr = math.radians(lat)
        y = int((1.0 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2.0 * n)
        return x, y

    x0, y0 = xy(BBOX[3], BBOX[0])   # north-west
    x1, y1 = xy(BBOX[1], BBOX[2])   # south-east
    return x0, x1, y0, y1


def iter_tiles(zmin: int, zmax: int) -> Iterator[tuple[int, int, int]]:
    for z in range(zmin, zmax + 1):
        x0, x1, y0, y1 = tile_range(z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                yield z, x, y


def count_tiles(zmin: int, zmax: int) -> int:
    return sum(1 for _ in iter_tiles(zmin, zmax))


def tile_path(layer_id: str, z: int, x: int, y: int, ext: str = "jpg") -> Path:
    return CACHE_DIR / layer_id / str(z) / str(x) / f"{y}.{ext}"


def read_tile(layer_id: str, z: int, x: int, y: int) -> tuple[bytes, str] | None:
    """The cached tile and its content type, or None if it was never fetched."""
    for ctype, ext in _EXT.items():
        p = tile_path(layer_id, z, x, y, ext)
        if p.exists():
            return p.read_bytes(), ctype
    return None


def _fetch_one(url: str) -> tuple[bytes, str] | None:
    req = urllib.request.Request(url, headers={"User-Agent": "nakshatra-x-tile-cache"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, context=_ctx(), timeout=TIMEOUT_SECONDS) as r:
                return r.read(), r.headers.get("Content-Type", "image/jpeg").split(";")[0]
        except urllib.error.HTTPError as exc:
            # 404 over water or outside coverage is a real answer, not a failure.
            if exc.code == 404:
                return None
            if exc.code in (429, 502, 503, 504) and attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
        except urllib.error.URLError:
            if attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    return None


def fetch_all(
    zmin: int = DEFAULT_ZMIN,
    zmax: int = DEFAULT_ZMAX,
    force: bool = False,
    log=print,
) -> dict[str, Any]:
    """
    Fetch every tile for every available layer and write the manifest.

    A layer the tiler cannot produce is skipped and recorded as skipped — the
    cache never invents a layer that does not exist live.
    """
    live = tile_layers(force=True)
    tiles = list(iter_tiles(zmin, zmax))
    log(f"  study bbox {BBOX}, z{zmin}-z{zmax}: {len(tiles)} tiles per layer")

    entries: list[dict[str, Any]] = []
    total_bytes = 0
    skipped: list[dict[str, str]] = []

    for layer in live["layers"]:
        lid = layer["id"]
        if layer["status"] != "ok":
            skipped.append({"layer": lid, "reason": layer.get("reason", "unavailable")})
            log(f"  {lid:16} SKIPPED — {layer.get('reason')}")
            continue

        got = missing = reused = 0
        layer_bytes = 0
        t0 = time.time()

        def work(t: tuple[int, int, int]) -> tuple[int, int, int, int] | None:
            z, x, y = t
            if not force and read_tile(lid, z, x, y) is not None:
                return (z, x, y, -1)
            url = (layer["tile_url"].replace("{z}", str(z))
                   .replace("{x}", str(x)).replace("{y}", str(y)))
            res = _fetch_one(url)
            if res is None:
                return None
            body, ctype = res
            p = tile_path(lid, z, x, y, _EXT.get(ctype, "jpg"))
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(body)
            return (z, x, y, len(body))

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for res in pool.map(work, tiles):
                if res is None:
                    missing += 1
                elif res[3] < 0:
                    reused += 1
                else:
                    got += 1
                    layer_bytes += res[3]

        # Measure what is ON DISK, not what this run happened to download.
        #
        # The first version summed only freshly-fetched tiles, so a re-run that
        # reused everything wrote a manifest claiming 0.0 MB for a 39 MB cache —
        # and `cache_status` would have advertised an empty cache that was in
        # fact complete. The manifest describes the cache, not the run.
        files = [f for f in (CACHE_DIR / lid).rglob("*") if f.is_file()]
        on_disk = sum(f.stat().st_size for f in files)
        total_bytes += on_disk

        # WHEN THE TILES WERE FETCHED, from the tiles themselves.
        #
        # The first version stamped `fetched_at` with the time the manifest was
        # written. A re-run that reused every tile then claimed tiles from
        # 2026-10-01 14:06 had been fetched on 2026-10-02 16:22 — and the map
        # labels a cached layer "cached · fetched <date>", so the label would
        # have overstated freshness by a day. Same class of error as calling a
        # cached tile live, one step removed.
        #
        # So the date comes from the files' modification times. The OLDEST is
        # what the label shows: a cache can mix tiles from several runs, and a
        # label must never claim the whole layer is fresher than its stalest
        # tile. The newest is kept beside it so a mixed cache is visible.
        mtimes = [f.stat().st_mtime for f in files]
        oldest = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(min(mtimes))) if mtimes else None
        newest = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(max(mtimes))) if mtimes else None
        entries.append({
            "layer": lid,
            "name": layer["name"],
            "zoom_min": zmin,
            "zoom_max": zmax,
            "n_fetched": got,
            "n_reused": reused,
            "n_missing": missing,
            "bytes": on_disk,
            "bytes_fetched_this_run": layer_bytes,
            "fetched_at": oldest,
            "fetched_latest_at": newest,
            "fetched_at_note": (
                "Oldest tile's modification time — what the cached label shows, so "
                "it never claims the layer is fresher than its stalest tile."
            ),
            "tile_url": layer["tile_url"],
            "tilejson_url": layer["tilejson_url"],
            "provenance": layer["provenance"],
            "legend_facts": layer["legend_facts"],
            # The licence travels with the bytes. These tiles are redistributed
            # from a local cache, so the notice the licensor requires has to be
            # recorded next to them rather than looked up later from a live
            # response that may not exist when the cache is being served.
            "attribution": layer["attribution"],
            # Flat, named fields as well as the nested object, so the licence
            # terms are greppable in the manifest without knowing its shape.
            "licence": layer["attribution"]["licence_name"],
            "licence_url": layer["attribution"]["licence_url"],
            "attribution_required": layer["attribution"]["required"],
            "source_of_wording": layer["attribution"]["source_of_wording"],
        })
        log(
            f"  {lid:16} {got:5} fetched  {reused:5} reused  {missing:4} none  "
            f"{on_disk / 1048576:7.1f} MB on disk  {time.time() - t0:5.1f}s"
        )
        if total_bytes > BUDGET_BYTES:
            raise RuntimeError(
                f"tile cache exceeded its {BUDGET_BYTES / 1048576:.0f} MB budget at "
                f"{total_bytes / 1048576:.1f} MB — lower --zmax"
            )

    manifest = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "bbox": BBOX,
        "zoom_min": zmin,
        "zoom_max": zmax,
        "tiles_per_layer": len(tiles),
        "total_bytes": total_bytes,
        "total_mb": round(total_bytes / 1048576, 1),
        "tiler": live["tiler"],
        "layers": entries,
        "skipped": skipped,
        "note": (
            "Tiles fetched from Planetary Computer for offline demo resilience. "
            "The map asks the live tiler first and falls back to these, labelled "
            "with the date they were fetched. Past zoom_max the layer is "
            "live-only."
        ),
        "licence_note": (
            "Each layer entry carries the licensor's required attribution. It is "
            "shown with the cached tiles exactly as it is with live ones — a "
            "local copy does not change what the licence asks for."
        ),
    }
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2))
    return manifest


def manifest() -> dict[str, Any] | None:
    if not MANIFEST.exists():
        return None
    try:
        return json.loads(MANIFEST.read_text())
    except (OSError, json.JSONDecodeError):
        return None


def cache_status() -> dict[str, Any]:
    """
    What the cache holds, per layer, for the layers route to advertise.

    The map needs this before it needs a tile: it decides whether a fallback is
    even possible, and it supplies the date the label has to show.
    """
    m = manifest()
    if not m:
        return {"available": False, "layers": {},
                "reason": "no tile cache on disk — run `python -m app.api.batch tiles`"}
    by_layer = {
        e["layer"]: {
            "available": e["n_fetched"] + e["n_reused"] > 0,
            "fetched_at": e["fetched_at"],
            "n_tiles": e["n_fetched"] + e["n_reused"],
            "zoom_min": e["zoom_min"],
            "zoom_max": e["zoom_max"],
            "bytes": e["bytes"],
            "attribution": e.get("attribution"),
        }
        for e in m.get("layers", [])
    }
    return {
        "available": any(v["available"] for v in by_layer.values()),
        "generated_at": m.get("generated_at"),
        "zoom_min": m.get("zoom_min"),
        "zoom_max": m.get("zoom_max"),
        "total_mb": m.get("total_mb"),
        "layers": by_layer,
    }
