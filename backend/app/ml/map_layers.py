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

REGISTRATION LIFETIME — WHAT WAS MEASURED
-----------------------------------------
A mosaic is a registered search: POST the search, get an id, build tile URLs from
it. Whether that id is durable decided the design, so it was tested rather than
assumed:

  1. The same search body registered three times returned the SAME id
     (823ed285...d88d each time). The id is a content hash of the search, not a
     random token, so registering is idempotent and re-registering is free.
  2. Changing one filter (cloud < 5 to < 6) returned a different id. Confirms
     the hash.
  3. GET /mosaic/<id>/info returns `search.hash`, `lastused` and `usecount`.
     A server that tracks `lastused` is running a cache with eviction, not a
     permanent store.
  4. GET /mosaic/<unregistered-id>/info answers 404
     {"detail":"SearchId `000...0` not found"}.
  5. A TILE request against an unregistered id answers the same 404, not a blank
     image. So eviction is detectable from the client, loudly.

So an id must never be treated as permanent. Two defences, because the browser
fetches the tiles and the backend cannot see their 404s:

  * the backend re-registers on a TTL and at startup — idempotent, so this costs
    one round trip and cannot produce a different mosaic;
  * the map watches for tile errors and asks this module to re-register
    (`force=True`), then swaps the layer's URL. Finding (5) is what makes that
    possible: an evicted mosaic fails visibly rather than silently.

MOSAIC METHOD
-------------
These are mosaics, not scenes, so no single scene id applies and the legend must
not imply one. Items are sorted by increasing cloud cover and the first valid
pixel wins, which is stated on screen: a reader can tell that a pixel came from
whichever acceptable scene was clearest, not from one dated acquisition.
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
#: Sorting is what makes the mosaic method stateable. titiler-pgstac composites
#: by taking the first valid pixel in the search's sort order, so ordering by
#: increasing cloud cover means every pixel comes from the clearest acceptable
#: scene covering it. Without an explicit sort the order is the API's default and
#: the legend could only say "some scene".
S2_SORTBY = [{"field": "eo:cloud_cover", "direction": "asc"}]
MOSAIC_METHOD = "scenes sorted by increasing cloud cover; first valid pixel wins"

# ---------------------------------------------------------------------------
# LICENCE ATTRIBUTION — the licensor's words, not ours
# ---------------------------------------------------------------------------
# These strings are quoted from the primary documents, because an attribution
# written from memory is a licence term we invented.
#
# The STAC collections themselves do NOT carry an attribution sentence: they give
# `license: "proprietary"`, the licensors (ESA for both) and a link to the licence
# document. Both linked documents are unreachable — scihub.copernicus.eu is
# decommissioned and the spacedata.copernicus.eu annex times out — so the wording
# was taken from these instead, and where each came from is recorded here so it
# can be rechecked:
#
#   Sentinel-2: European Commission, DG GROW, "Legal notice on the use of
#   Copernicus Sentinel Data and Service Information", page 2, the notice
#   required "[w]here the Copernicus Sentinel Data and Service Information have
#   been adapted or modified" (footnote: Art. 8 of Regulation 1159/2013).
#   Retrieved 2026-10-01 from
#   https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice
#
#   These layers ARE modified — mosaicked, band-ratioed, colour-mapped — so the
#   "Contains modified ..." form applies rather than the plain "Copernicus
#   Sentinel data [Year]" form used for unaltered data.
#
#   Copernicus DEM: the "Use License" field on the dataset record at
#   https://doi.org/10.5069/G9028PQB — OpenTopography, which the STAC collection
#   itself lists as a provider with role `host`. Retrieved 2026-10-01.
SENTINEL_ATTRIBUTION_TEMPLATE = "Contains modified Copernicus Sentinel data {years}"
COPERNICUS_DEM_ATTRIBUTION = (
    "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 "
    "provided under COPERNICUS by the European Union and ESA; all rights reserved"
)
TILER_ATTRIBUTION = "Tiles: Microsoft Planetary Computer"

# ---------------------------------------------------------------------------
# COLORMAP STOPS — sampled from the tiler's own legend
# ---------------------------------------------------------------------------
# A legend bar is only honest if its colours are the ones the tiles were drawn
# with. Rather than recall what "magma" and "terrain" look like, these were
# sampled from the tiler's legend endpoint for the exact colormaps it renders:
#
#   https://planetarycomputer.microsoft.com/api/data/v1/legend/colormap/magma
#   https://planetarycomputer.microsoft.com/api/data/v1/legend/colormap/terrain
#
# Each is a 387x11 horizontal gradient with no border; nine evenly spaced stops
# were read from the middle row on 2026-10-02. Named matplotlib colormaps are
# fixed definitions, so recording them costs nothing at runtime and keeps the
# legend correct offline.
COLORMAP_STOPS = {
    "magma": ["#010103", "#1b1044", "#4f117b", "#802580", "#b43679",
              "#e34e64", "#fa8560", "#fdbf84", "#faf9bc"],
    "terrain": ["#333398", "#0984ea", "#01c96a", "#7de47f", "#fcfd97",
                "#c1af78", "#7f5c54", "#bca9a5", "#fcfbfb"],
}
COLORMAP_SOURCE = (
    "sampled from Planetary Computer's /legend/colormap/<name> on 2026-10-02"
)


def _sentinel_years(datetime_range: str) -> str:
    """
    The year or year range the mosaic's scenes actually come from.

    Derived from the search window rather than written down, so moving the window
    cannot leave the attribution claiming a year that is no longer in the data.
    """
    start, _, stop = datetime_range.partition("/")
    y0, y1 = start[:4], (stop[:4] or start[:4])
    return y0 if y0 == y1 else f"{y0}\u2013{y1}"
#: Registrations are cheap but not free, and the tiler keeps them a while.
TTL_SECONDS = 1800
#: A result with a failed layer is retried much sooner, so a layer that was down
#: because the network blipped comes back within a minute rather than half an
#: hour.
TTL_DEGRADED_SECONDS = 60
#: A forced re-register is what the map asks for when a tile 404s. Many tiles
#: 404 together when a mosaic is evicted, so the map dedupes on its side and this
#: is the backstop on ours: one real re-register per window, however many ask.
FORCE_MIN_INTERVAL_SECONDS = 10
TIMEOUT_SECONDS = 10

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


def _tilejson_url(search_id: str, query: str) -> str:
    """
    The tilejson document for this layer, which is what a reader opens to check
    a layer against its source: it states the tile template, the bounds and the
    zoom range the tiler will actually serve.
    """
    return f"{PC_DATA}/mosaic/{search_id}/tilejson.json?{query}"


#: Each entry is everything a reader needs to check the layer against the source.
_SPECS: list[dict[str, Any]] = [
    {
        "id": "s2-true-colour",
        "name": "Sentinel-2 true colour",
        "collections": ["sentinel-2-l2a"],
        "register_extra": {
            "datetime": S2_DATETIME,
            "query": {"eo:cloud_cover": {"lt": S2_MAX_CLOUD}},
            "sortby": S2_SORTBY,
        },
        "query": (
            "collection=sentinel-2-l2a&assets=B04&assets=B03&assets=B02"
            "&color_formula=Gamma%20RGB%203.2%20Saturation%200.8%20Sigmoidal%20RGB%2025%200.35"
        ),
        "quantity": "surface reflectance, red/green/blue",
        "licence": "sentinel",
        "rendering": "assets B04,B03,B02; Gamma RGB 3.2, Saturation 0.8, Sigmoidal RGB 25 0.35",
        "legend": "What the ground looks like. Cloud-filtered dry-season mosaic.",
        "scale": None,
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
            "sortby": S2_SORTBY,
        },
        "query": (
            "collection=sentinel-2-l2a&expression=B04%2FB02&asset_as_band=True"
            "&rescale=0.8,2.5&colormap_name=magma"
        ),
        "quantity": "band ratio, dimensionless",
        "licence": "sentinel",
        "rendering": "expression B04/B02, asset_as_band=True, rescale 0.8-2.5, colormap magma",
        "legend": "Iron staining at the surface. Bright = higher red-over-blue ratio.",
        # The colours mean nothing without these two, so they are first-class
        # legend facts rather than buried in the rendering string.
        "scale": {"rescale": [0.8, 2.5], "colormap": "magma",
                  "low_label": "0.8 (low)", "high_label": "2.5 (high)",
                  "stops": COLORMAP_STOPS["magma"], "stops_source": COLORMAP_SOURCE},
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
        "licence": "cop-dem",
        "rendering": "asset data, rescale 200-900 m, colormap terrain",
        "legend": "Ground elevation, 30 m posting. Terrain is a model feature.",
        "scale": {"rescale": [200, 900], "colormap": "terrain",
                  "low_label": "200 m", "high_label": "900 m",
                  "stops": COLORMAP_STOPS["terrain"], "stops_source": COLORMAP_SOURCE},
        "caveat": (
            "Elevation only. Slope is derived from this inside the model and is not "
            "what is drawn here."
        ),
    },
]


def _attribution(spec: dict[str, Any]) -> dict[str, Any]:
    """The licensor's required notice for this layer, plus who served the tiles."""
    if spec.get("licence") == "sentinel":
        years = _sentinel_years(spec["register_extra"]["datetime"])
        required = SENTINEL_ATTRIBUTION_TEMPLATE.format(years=years)
        return {
            "required": required,
            "licensor": "European Space Agency",
            "licence_name": "Copernicus Sentinel Data Terms",
            "licence_url": (
                "https://sentinels.copernicus.eu/documents/247904/690755/"
                "Sentinel_Data_Legal_Notice"
            ),
            "source_of_wording": (
                "European Commission, Legal notice on the use of Copernicus "
                "Sentinel Data and Service Information, p. 2 (notice for adapted "
                "or modified data)"
            ),
            "tiler": TILER_ATTRIBUTION,
            "html": f"{required} | {TILER_ATTRIBUTION}",
        }
    return {
        "required": COPERNICUS_DEM_ATTRIBUTION,
        "licensor": "European Space Agency",
        "licence_name": "Copernicus DEM Licence",
        "licence_url": "https://doi.org/10.5069/G9028PQB",
        "source_of_wording": (
            "\"Use License\" field of the Copernicus Global DEM record at "
            "OpenTopography, the provider the STAC collection lists as host"
        ),
        "tiler": TILER_ATTRIBUTION,
        "html": f"{COPERNICUS_DEM_ATTRIBUTION} | {TILER_ATTRIBUTION}",
    }


def _legend_facts(spec: dict[str, Any]) -> list[dict[str, str]]:
    """
    What the legend states, as fields rather than prose.

    These are mosaics. There is no scene id to show and showing one would be a
    lie about how the pixels were chosen, so the method is stated instead.
    """
    extra = spec.get("register_extra", {})
    facts = [{"label": "Collection", "value": spec["collections"][0]}]
    if extra.get("datetime"):
        start, _, stop = str(extra["datetime"]).partition("/")
        facts.append({"label": "Dates", "value": f"{start} to {stop}"})
    cloud = extra.get("query", {}).get("eo:cloud_cover", {}).get("lt")
    if cloud is not None:
        facts.append({"label": "Cloud filter", "value": f"scene cloud cover < {cloud}%"})
    else:
        facts.append({"label": "Cloud filter", "value": "none — this collection is not optical"})
    facts.append({
        "label": "Mosaic",
        "value": MOSAIC_METHOD if extra.get("sortby") else "single-collection mosaic; first valid pixel wins",
    })
    scale = spec.get("scale")
    if scale:
        facts.append({
            "label": "Scale",
            "value": (
                f"{scale['rescale'][0]}-{scale['rescale'][1]} rendered with the "
                f"{scale['colormap']} colormap"
            ),
        })
    facts.append({"label": "Quantity", "value": spec["quantity"]})
    facts.append({"label": "Attribution", "value": _attribution(spec)["required"]})
    return facts


def _build(spec: dict[str, Any]) -> dict[str, Any]:
    search_id = _register(spec["collections"], spec.get("register_extra"))
    return {
        "id": spec["id"],
        "name": spec["name"],
        "status": "ok",
        "tile_url": _tiles_url(search_id, spec["query"]),
        "tilejson_url": _tilejson_url(search_id, spec["query"]),
        "min_zoom": 6,
        "max_zoom": 14,
        "bbox": BBOX,
        "legend": spec["legend"],
        "legend_facts": _legend_facts(spec),
        "scale": spec.get("scale"),
        "caveat": spec["caveat"],
        "attribution": _attribution(spec),
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
            "mosaic_method": (
                MOSAIC_METHOD if spec.get("register_extra", {}).get("sortby")
                else "single-collection mosaic; first valid pixel wins"
            ),
            "sortby": spec.get("register_extra", {}).get("sortby"),
            "is_mosaic": True,
            "scene_id": None,
            "scene_id_note": (
                "A mosaic combines many scenes, so no single scene id applies. "
                "The method above says how pixels were chosen."
            ),
            "search_id": search_id,
            "bbox": BBOX,
            "licence": _attribution(spec)["licence_name"],
            "licence_url": _attribution(spec)["licence_url"],
            "attribution": _attribution(spec)["required"],
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
        "legend_facts": _legend_facts(spec),
        "scale": spec.get("scale"),
        "caveat": spec["caveat"],
        "attribution": _attribution(spec),
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
        if cached:
            age = now - cached["fetched_at"]
            ttl = TTL_DEGRADED_SECONDS if cached["payload"]["n_unavailable"] else TTL_SECONDS
            fresh = age < ttl
            # A forced refresh inside the minimum interval is answered from the
            # registration that was just made. Re-registering is idempotent, so
            # this changes nothing about the answer — it only stops a burst of
            # 404s turning into a burst of POSTs at someone else's service.
            recently_forced = force and age < FORCE_MIN_INTERVAL_SECONDS
            if (fresh and not force) or recently_forced:
                return {**cached["payload"], "cached": True, "age_seconds": round(age, 1),
                        "force_throttled": bool(recently_forced)}

    # Registered in parallel, so a dead network costs one timeout rather than
    # three in a row on the request that happens to arrive first.
    def _one(spec: dict[str, Any]) -> dict[str, Any]:
        try:
            return _build(spec)
        except Exception as exc:  # noqa: BLE001 — one layer must not kill the rest
            return _unavailable(spec, _reason_from(exc))

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=len(_SPECS)) as pool:
        layers = list(pool.map(_one, _SPECS))

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


def warm_tile_layers() -> None:
    """
    Register every mosaic at startup, off the request path.

    Registration is idempotent — the id is a hash of the search — so this cannot
    produce a different mosaic from the one the map would get later. What it buys
    is that the tiler's cache entry exists before the first visitor asks, and
    that an id evicted while the service was down is re-created rather than
    trusted. Runs in a daemon thread: an unreachable tiler must never hold up the
    service from starting.
    """
    def _run() -> None:
        try:
            r = tile_layers(force=True)
            print(
                f"[tiles] registered {r['n_ok']} of {r['n_ok'] + r['n_unavailable']} "
                f"tile layers at startup"
                + (f"; unavailable: {[l['id'] for l in r['layers'] if l['status'] != 'ok']}"
                   if r["n_unavailable"] else "")
            )
        except Exception as exc:  # noqa: BLE001 — startup must not die on this
            print(f"[tiles] startup registration failed: {type(exc).__name__}: {exc}")

    threading.Thread(target=_run, name="tile-layer-warm", daemon=True).start()
