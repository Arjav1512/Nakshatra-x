"""
Real surface-indicator features for Track A (PRD A-2).

This replaces `features.py`'s proxy formulas, in which every "spectral" value
was a linear function of distance to `KNOWN_FAULTS` — and `KNOWN_FAULTS` was the
list of MOIL mine coordinates, which are the positive labels. The features
encoded the target, so the reported ~0.98 AUC measured nothing
(`docs/INTEGRITY.md` §4).

What is real here
-----------------
* **Sentinel-2 L2A surface reflectance**, read pixel-by-pixel from Cloud
  Optimized GeoTIFFs via the Microsoft Planetary Computer STAC API. Band ratios
  are computed from actual measured reflectance.
* **SRTM 30 m elevation and DEM-derived slope**, from the OpenTopoData API.

What is NOT available
---------------------
* **GSI lithology.** PRD §8.3 names GSI Bhukosh as the source for regional
  geology and boreholes. Both `bhukosh.gsi.gov.in` and `geoportal.gsi.gov.in`
  are unreachable from this environment. Lithology is therefore **not a feature**
  — it is left out rather than substituted with something invented. When the
  portal is reachable, add it here; it is the single most valuable addition to
  this feature set.

The leakage rule
----------------
**No feature may be a function of distance to a known mine, and coordinates are
not features.** Negative samples are drawn away from known deposits, which
creates spatial separation; if latitude and longitude were fed to the model it
could rediscover the label from position alone. Only measured surface and
terrain properties are used.

Band ratios
-----------
Standard mineral-exploration indices over Sentinel-2 bands:

    iron_oxide      B04 / B02   ferric iron absorption in the blue
    ferrous         B11 / B08   ferrous iron, SWIR vs NIR
    clay_alteration B11 / B12   hydroxyl-bearing alteration minerals
    ndvi            (B08-B04)/(B08+B04)   vegetation, which masks bedrock

The Sausar Group gondite horizons that host MOIL's manganese outcrop at
surface, so surface spectra carry genuine signal about where to prospect.

Guardrail (PRD §2.2): these are surface measurements. They do not see
subsurface ore, and nothing here should be read as detecting ore at depth.
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import httpx
import numpy as np

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("GDAL_HTTP_MULTIRANGE", "YES")
os.environ.setdefault("GDAL_HTTP_TIMEOUT", "30")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")

PC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
PC_TOKEN = "https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-2-l2a"
DEM_API = "https://api.opentopodata.org/v1/srtm30m"

BANDS = ("B02", "B04", "B08", "B11", "B12")

#: Feature vector for the honest model. Note what is absent: no distance to a
#: mine, no latitude, no longitude.
FEATURE_COLS = [
    "iron_oxide_ratio",
    "ferrous_ratio",
    "clay_alteration_ratio",
    "ndvi",
    "elevation_m",
    "slope_deg",
    "swir_ratio_norm",
]

CACHE_DIR = Path(__file__).resolve().parents[1] / "outputs" / "feature_cache"


@dataclass
class SceneRef:
    scene_id: str
    cloud_cover: float | None
    datetime: str
    assets: dict


def _cache_path(lat: float, lng: float) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / f"{lat:.5f}_{lng:.5f}.json"


def find_scene(lat: float, lng: float, max_cloud: float = 12.0,
               client: httpx.Client | None = None) -> SceneRef | None:
    """Least-cloudy recent Sentinel-2 L2A scene covering a point."""
    own = client is None
    client = client or httpx.Client(timeout=45)
    try:
        r = client.post(PC_STAC, json={
            "collections": ["sentinel-2-l2a"],
            "bbox": [lng - 0.02, lat - 0.02, lng + 0.02, lat + 0.02],
            "datetime": "2025-10-01T00:00:00Z/2026-09-20T23:59:59Z",
            "query": {"eo:cloud_cover": {"lt": max_cloud}},
            "limit": 1,
            "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}],
        })
        r.raise_for_status()
        feats = r.json().get("features", [])
        if not feats:
            return None
        f = feats[0]
        return SceneRef(
            scene_id=f["id"],
            # A missing eo:cloud_cover defaulted to 0.0 — the BEST possible
            # value — so a scene whose cloud fraction was unknown passed any
            # cloud filter as if it were pristine. This project cites "max cloud
            # 1.0%" as evidence that its Sentinel-2 reads are clean, and that
            # claim is only meaningful if unknown is not silently counted as
            # zero. None propagates and the caller treats it as unusable.
            cloud_cover=(
                float(f["properties"]["eo:cloud_cover"])
                if f["properties"].get("eo:cloud_cover") is not None
                else None
            ),
            datetime=str(f["properties"].get("datetime", "")),
            assets={b: f["assets"][b]["href"] for b in BANDS if b in f["assets"]},
        )
    finally:
        if own:
            client.close()


# One SAS token covers every asset in the collection and is valid for about an
# hour. Signing per asset (the /sign endpoint) meant five requests per point and
# tripped Planetary Computer's rate limiter at 429 after two points.
_TOKEN_CACHE: dict[str, tuple[str, float]] = {}


def _collection_token(client: httpx.Client) -> str:
    tok, exp = _TOKEN_CACHE.get("sentinel-2-l2a", ("", 0.0))
    if tok and time.time() < exp - 120:
        return tok
    for attempt in range(6):
        r = client.get(PC_TOKEN)
        if r.status_code == 429:
            time.sleep(2 ** attempt)
            continue
        r.raise_for_status()
        tok = r.json()["token"]
        _TOKEN_CACHE["sentinel-2-l2a"] = (tok, time.time() + 3000)
        return tok
    raise RuntimeError("Planetary Computer SAS token unavailable after retries")


def _sign(href: str, client: httpx.Client) -> str:
    sep = "&" if "?" in href else "?"
    return f"{href}{sep}{_collection_token(client)}"


def read_reflectance(scene: SceneRef, lat: float, lng: float,
                     window_px: int = 5, client: httpx.Client | None = None) -> dict:
    """
    Mean surface reflectance in a small window around a point, per band.

    L2A products are scaled integers; dividing by 10000 gives reflectance.
    """
    import rasterio
    from rasterio.warp import transform as warp_transform

    own = client is None
    client = client or httpx.Client(timeout=45)
    out: dict[str, float] = {}
    try:
        half = window_px // 2
        for band, href in scene.assets.items():
            url = _sign(href, client)
            with rasterio.open(url) as ds:
                xs, ys = warp_transform("EPSG:4326", ds.crs, [lng], [lat])
                row, col = ds.index(xs[0], ys[0])
                win = rasterio.windows.Window(col - half, row - half, window_px, window_px)
                arr = ds.read(1, window=win).astype(float)
            arr = arr[np.isfinite(arr)]
            if arr.size == 0:
                return {}
            out[band] = float(np.mean(arr)) / 10000.0
        return out
    finally:
        if own:
            client.close()


def fetch_terrain(points: Sequence[tuple[float, float]],
                  client: httpx.Client | None = None) -> list[dict]:
    """
    Elevation and slope from SRTM 30 m.

    Slope is computed from a 3-point sample around each location — a finite
    difference in metres, not in degrees (PRD §8.4).
    """
    own = client is None
    client = client or httpx.Client(timeout=60)
    try:
        # ~90 m offsets in degrees; cos(lat) corrects the longitude step.
        d = 0.0008
        locs = []
        for lat, lng in points:
            locs += [(lat, lng), (lat + d, lng), (lat, lng + d)]
        out: list[dict] = []
        # The API caps locations per request.
        chunk = 90
        elev: list[float] = []
        for i in range(0, len(locs), chunk):
            part = locs[i:i + chunk]
            q = "|".join(f"{a:.6f},{b:.6f}" for a, b in part)
            r = client.get(DEM_API, params={"locations": q})
            r.raise_for_status()
            # `or 0.0` put a point at sea level when the DEM returned no
            # elevation. Balaghat works at roughly 383 m, and slope is derived
            # from three elevations per point, so one silent zero corrupts the
            # terrain features for that point rather than omitting it.
            for x in r.json()["results"]:
                if x.get("elevation") is None:
                    raise ValueError(
                        f"DEM returned no elevation for a queried point; "
                        f"terrain features are not computed from an assumed 0 m."
                    )
                elev.append(float(x["elevation"]))
            time.sleep(1.1)  # be polite to a free public API
        for i, (lat, lng) in enumerate(points):
            z0, zlat, zlng = elev[3 * i], elev[3 * i + 1], elev[3 * i + 2]
            # Metres per degree at this latitude.
            m_lat = 111_320.0
            m_lng = 111_320.0 * float(np.cos(np.radians(lat)))
            dz_dy = (zlat - z0) / (d * m_lat)
            dz_dx = (zlng - z0) / (d * m_lng)
            slope = float(np.degrees(np.arctan(np.hypot(dz_dx, dz_dy))))
            out.append({"elevation_m": z0, "slope_deg": round(slope, 3)})
        return out
    finally:
        if own:
            client.close()


def build_point_features(lat: float, lng: float, terrain: dict,
                         client: httpx.Client | None = None,
                         use_cache: bool = True) -> dict | None:
    """
    Full feature record for one location. Returns None when no usable scene
    exists — a gap is reported, never imputed (PRD §8.4).
    """
    cp = _cache_path(lat, lng)
    if use_cache and cp.exists():
        return json.loads(cp.read_text())

    scene = find_scene(lat, lng, client=client)
    if scene is None:
        return None
    if scene.cloud_cover is None:
        # Unknown cloud fraction. This used to default to 0.0 — the best
        # possible value — so the scene passed every cloud filter. The dataset's
        # "max cloud 1.0%" property, which test_track_a asserts, is only
        # meaningful if unknown is excluded rather than counted as pristine.
        return None
    sr = read_reflectance(scene, lat, lng, client=client)
    if not sr or any(b not in sr for b in BANDS):
        return None

    b02, b04, b08, b11, b12 = (sr["B02"], sr["B04"], sr["B08"], sr["B11"], sr["B12"])
    eps = 1e-6
    rec = {
        "lat": lat,
        "lng": lng,
        "iron_oxide_ratio": round(b04 / max(b02, eps), 4),
        "ferrous_ratio": round(b11 / max(b08, eps), 4),
        "clay_alteration_ratio": round(b11 / max(b12, eps), 4),
        "ndvi": round((b08 - b04) / max(b08 + b04, eps), 4),
        "swir_ratio_norm": round((b11 - b12) / max(b11 + b12, eps), 4),
        "elevation_m": terrain["elevation_m"],
        "slope_deg": terrain["slope_deg"],
        "reflectance": {k: round(v, 5) for k, v in sr.items()},
        "scene_id": scene.scene_id,
        "scene_datetime": scene.datetime,
        # A scene whose cloud fraction is unknown cannot support the "max cloud
        # 1.0%" claim that test_track_a asserts, so it is not used at all.
        "cloud_cover_pct": round(scene.cloud_cover, 2),
        "source": "Sentinel-2 L2A via Microsoft Planetary Computer; SRTM 30m via OpenTopoData",
        "is_synthetic": False,
        "is_live": True,
    }
    if use_cache:
        cp.write_text(json.dumps(rec, indent=2))
    return rec
