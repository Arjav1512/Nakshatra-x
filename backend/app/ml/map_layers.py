"""
Raster tile layers from Microsoft Planetary Computer, with provenance (PRD A-3).

WHAT THIS IS
------------
Three real raster layers over the Central India manganese belt, each served by
Planetary Computer's own tiler and each carrying the collection, the date range
and the exact rendering expression it was produced with:

  s2-true-colour   Sentinel-2 L2A, bands B04/B03/B02
  iron-oxide       Sentinel-2 L2A, the band ratio B04/B02
  dem              Copernicus DEM GLO-30, elevation

NO STAND-INS
------------
If a layer cannot be produced, it is returned with `status: "unavailable"` and
the upstream's own words in `reason`. It is never replaced by a drawn surface,
a cached picture or a neighbouring collection. This map has carried fabricated
overlays before — six of them, drawing sin()/cos() grids captioned as ISRO
measurements — and the lesson recorded at the removal site is that a layer which
quietly substitutes something is worse than a layer that is missing.

WHAT THE IRON-OXIDE LAYER IS AND IS NOT
---------------------------------------
B04/B02 (red over blue) is the standard Landsat/Sentinel iron-oxide ratio: ferric
iron absorbs strongly in the blue and reflects in the red, so the ratio rises
over gossans and lateritic, iron-stained ground. Manganese ore in this belt is
associated with such ground, which is why it is worth looking at.

It is NOT a manganese detector. It responds to iron, to bare soil and to red
roofing equally, it says nothing about what is under the surface, and the model
in this product uses it as one feature among several rather than as evidence on
its own. The legend says this on screen; see also PRD 2.4 on surface signals.

A NOTE ON `asset_as_band`
-------------------------
The expression first went up as `expression=B04/B02` and every tile returned
HTTP 500: "Could not find any valid assets in 'B04/B02' expression, maybe try
with `asset_as_band=True`". Without that flag the tiler reads `B04` as an asset
with its own band index rather than as a band name inside the expression. The
flag is set below and the tiles render; the error is recorded here because the
next person to write a band expression against this API will hit it too.

CACHING
-------
A mosaic is a registered search: POST the search, get an id, build tile URLs from
it. Registration costs a round trip, so the ids are cached in-process with a TTL
and re-registered when stale. Nothing here runs on a page render — the route
serves the cache and reports what it has.
"""
from __future__ import annotations

import json
import os
import ssl
import threading
import time
import urllib.error
import urllib.request
from typing import Any

import certifi

PC_DATA = os.environ.get(
    "NAKSHATRA_PC_DATA_URL", "https://planetarycomputer.microsoft.com/api/data/v1"
).rstrip("/")

#: The study area, matching `prospectivity.study_grid` and the identity imagery.
BBOX = [78.6, 20.6, 80.8, 22.5]
#: Dry season: the belt is under cloud through the monsoon, so a mosaic built
#: across the whole year is mostly cloud over exactly the ground of interest.
S2_DATETIME = "2025-11-01/2026-03-31"
S2_MAX_CLOUD = 5
#: Registrations are cheap but not free, and the tiler keeps them a while.
TTL_SECONDS = 1800
TIMEOUT_SECONDS = 20

_LOCK = threading.Lock()
_CACHE: dict[str, Any] = {}


def _ctx() -> ssl.SSLContext:
    # certifi, not the system store: the system store is missing the chain in
    # some container images and the failure looks like a network outage.
    return ssl.create_default_context(cafile=certifi.where())


def _post_json(url: str, body: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json",
                 "User-Agent": "nakshatra-x"},
        method="POST",
    )
    with urllib.request.urlopen(req, context=_ctx(), timeout=TIMEOUT_SECONDS) as r:
        return json.loads(r.read())


def _register(collections: list[str], extra: dict | None = None) -> str:
    body: dict[str, Any] = {"collections": collections, "bbox": BBOX}
    body.update(extra or {})
    data = _post_json(f"{PC_DATA}/mosaic/register", body)
    # The API has returned this under both names across versions; accept either
    # rather than depending on which one is current.
    search_id = data.get("searchid") or data.get("id")
    if not search_id:
        raise RuntimeError(f"register returned no search id: {sorted(data)}")
    return str(search_id)


def _tiles_url(search_id: str, query: str) -> str:
    return f"{PC_DATA}/mosaic/{search_id}/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}?{query}"


#: Each entry is everything a reader needs to check the layer against the source.
_SPECS: list[dict[str, Any]] = [
    {
        "id": "s2-true-colour",
        "name": "Sentinel-2 true colour",
        "collections": ["sentinel-2-l2a"],
        "register_extra": {
            "datetime": S2_DATETIME,
            "query": {"eo:cloud_cover": {"lt": S2_MAX_CLOUD}},
        },
        "query": (
            "collection=sentinel-2-l2a&assets=B04&assets=B03&assets=B02"
            "&color_formula=Gamma%20RGB%203.2%20Saturation%200.8%20Sigmoidal%20RGB%2025%200.35"
        ),
        "quantity": "surface reflectance, red/green/blue",
        "rendering": "assets B04,B03,B02; Gamma RGB 3.2, Saturation 0.8, Sigmoidal RGB 25 0.35",
        "legend": "What the ground looks like. Cloud-filtered dry-season mosaic.",
        "caveat": (
            "A mosaic of many dates, not one scene, so it shows typical dry-season "
            "ground rather than a particular day."
        ),
    },
    {
        "id": "iron-oxide",
        "name": "Iron-oxide ratio (B04/B02)",
        "collections": ["sentinel-2-l2a"],
        "register_extra": {
            "datetime": S2_DATETIME,
            "query": {"eo:cloud_cover": {"lt": S2_MAX_CLOUD}},
        },
        "query": (
            "collection=sentinel-2-l2a&expression=B04%2FB02&asset_as_band=True"
            "&rescale=0.8,2.5&colormap_name=magma"
        ),
        "quantity": "band ratio, dimensionless",
        "rendering": "expression B04/B02, asset_as_band=True, rescale 0.8-2.5, colormap magma",
        "legend": "Iron staining at the surface. Bright = higher red-over-blue ratio.",
        "caveat": (
            "Responds to ferric iron, bare soil and red roofing alike. It is not a "
            "manganese detector and says nothing about what lies below the surface "
            "(PRD 2.4). The model uses it as one feature among several."
        ),
    },
    {
        "id": "dem",
        "name": "Copernicus DEM GLO-30",
        "collections": ["cop-dem-glo-30"],
        "register_extra": {},
        "query": "collection=cop-dem-glo-30&assets=data&rescale=200,900&colormap_name=terrain",
        "quantity": "elevation, metres",
        "rendering": "asset data, rescale 200-900 m, colormap terrain",
        "legend": "Ground elevation, 30 m posting. Terrain is a model feature.",
        "caveat": (
            "Elevation only. Slope is derived from this inside the model and is not "
            "what is drawn here."
        ),
    },
]


def _build(spec: dict[str, Any]) -> dict[str, Any]:
    search_id = _register(spec["collections"], spec.get("register_extra"))
    return {
        "id": spec["id"],
        "name": spec["name"],
        "status": "ok",
        "tile_url": _tiles_url(search_id, spec["query"]),
        "min_zoom": 6,
        "max_zoom": 14,
        "bbox": BBOX,
        "legend": spec["legend"],
        "caveat": spec["caveat"],
        "attribution": (
            "Microsoft Planetary Computer; Copernicus Sentinel data"
            if "sentinel-2-l2a" in spec["collections"]
            else "Microsoft Planetary Computer; Copernicus DEM"
        ),
        "provenance": {
            "source_kind": "measured",
            "is_live": True,
            "is_synthetic": False,
            "source": "Microsoft Planetary Computer tiler",
            "collection": spec["collections"][0],
            "date_range": spec.get("register_extra", {}).get("datetime"),
            "max_cloud_cover_pct": (
                spec.get("register_extra", {}).get("query", {})
                .get("eo:cloud_cover", {}).get("lt")
            ),
            "quantity": spec["quantity"],
            "rendering": spec["rendering"],
            "search_id": search_id,
            "bbox": BBOX,
        },
    }


def _unavailable(spec: dict[str, Any], reason: str) -> dict[str, Any]:
    """A layer that could not be produced says so, and says why, in the upstream's words."""
    return {
        "id": spec["id"],
        "name": spec["name"],
        "status": "unavailable",
        "tile_url": None,
        "reason": reason,
        "legend": spec["legend"],
        "caveat": spec["caveat"],
        "provenance": {
            "source_kind": "measured",
            "is_live": False,
            "is_synthetic": False,
            "source": "Microsoft Planetary Computer tiler",
            "collection": spec["collections"][0],
            "quantity": spec["quantity"],
            "rendering": spec["rendering"],
        },
    }


def _reason_from(exc: BaseException) -> str:
    """The upstream's own message, not a paraphrase."""
    if isinstance(exc, urllib.error.HTTPError):
        try:
            body = exc.read().decode("utf-8", "replace")[:400]
        except Exception:  # noqa: BLE001 — the body is best-effort
            body = ""
        detail = ""
        try:
            detail = json.loads(body).get("detail", "")
        except Exception:  # noqa: BLE001
            detail = body
        return f"HTTP {exc.code} from Planetary Computer: {detail or exc.reason}"
    if isinstance(exc, urllib.error.URLError):
        return f"cannot reach Planetary Computer: {exc.reason}"
    return f"{type(exc).__name__}: {exc}"


def tile_layers(force: bool = False) -> dict[str, Any]:
    """
    The three raster layers, each ok with a tile URL or unavailable with a reason.

    One failing layer does not take the others down: each is registered
    independently and reported independently, because "the map has no imagery"
    and "the DEM mosaic is refusing" are different facts and the screen should
    be able to say which.
    """
    now = time.time()
    with _LOCK:
        cached = _CACHE.get("layers")
        if cached and not force and now - cached["fetched_at"] < TTL_SECONDS:
            return {**cached["payload"], "cached": True,
                    "age_seconds": round(now - cached["fetched_at"], 1)}

    layers = []
    for spec in _SPECS:
        try:
            layers.append(_build(spec))
        except Exception as exc:  # noqa: BLE001 — one layer must not kill the rest
            layers.append(_unavailable(spec, _reason_from(exc)))

    payload = {
        "layers": layers,
        "n_ok": sum(1 for layer in layers if layer["status"] == "ok"),
        "n_unavailable": sum(1 for layer in layers if layer["status"] != "ok"),
        "bbox": BBOX,
        "tiler": PC_DATA,
        "note": (
            "Raster layers are served directly by Planetary Computer's tiler. A "
            "layer that cannot be produced is reported unavailable with the "
            "upstream's reason; nothing is substituted for it."
        ),
    }
    with _LOCK:
        _CACHE["layers"] = {"fetched_at": now, "payload": payload}
    return {**payload, "cached": False, "age_seconds": 0.0}
