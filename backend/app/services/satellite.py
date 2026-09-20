"""
Satellite scene metadata.

What this module does: queries the Earth Search STAC API (Element 84) for real
Sentinel-2 L2A acquisitions over a point.

What it deliberately no longer does: the previous implementation issued a
GetCapabilities request to Bhuvan, **discarded the response entirely**, and
then returned hand-constructed identifiers such as
`RS2A_L4F_20260820_P102R058`, `EOS04_SAR_...`, `CART3_PAN_...` together with
"latest_pass" timestamps computed as `now - 2 days` and fixed "telemetry
metrics". None of that came from ISRO; it was presented as a constellation
catalogue query. It has been removed rather than relabelled.

No ISRO catalogue API is integrated. Bhuvan's public WMS serves map tiles, not
a searchable scene catalogue, and MOSDAC requires credentials. If ISRO scene
search is added later it must return values parsed from a real response.

Guardrail: Sentinel-2 is surface reflectance. Scene metadata is surface and
atmospheric context only and carries no subsurface information.
"""
from datetime import datetime, timedelta, timezone

import httpx

STAC_ENDPOINT = "https://earth-search.aws.element84.com/v1/search"
PROVIDER = "Copernicus Sentinel-2 L2A via Earth Search STAC (Element 84)"


def _bbox(latitude: float, longitude: float, buffer_deg: float):
    return [
        round(longitude - buffer_deg, 4),
        round(latitude - buffer_deg, 4),
        round(longitude + buffer_deg, 4),
        round(latitude + buffer_deg, 4),
    ]


async def query_sentinel_stac(
    latitude: float, longitude: float, buffer_deg: float = 0.05
) -> dict:
    """
    Return recent Sentinel-2 L2A scenes covering a point.

    Every field comes from the STAC response. On failure the scene list is
    empty and `error` explains why — identifiers are never fabricated to fill
    the gap, and the result is never labelled live.
    """
    bbox = _bbox(latitude, longitude, buffer_deg)
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=45)

    payload = {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "datetime": (
            f"{start_date.strftime('%Y-%m-%dT00:00:00Z')}/"
            f"{end_date.strftime('%Y-%m-%dT23:59:59Z')}"
        ),
        "limit": 5,
        "sortby": [{"field": "properties.datetime", "direction": "desc"}],
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(STAC_ENDPOINT, json=payload)
            res.raise_for_status()
            data = res.json()

        features = data.get("features", []) or []
        items = []
        for f in features[:3]:
            props = f.get("properties", {}) or {}
            cloud = props.get("eo:cloud_cover")
            items.append(
                {
                    "id": f.get("id"),
                    "datetime": props.get("datetime"),
                    "cloud_cover_pct": round(cloud, 1) if isinstance(cloud, (int, float)) else None,
                    "platform": props.get("platform", "sentinel-2"),
                    "collection": f.get("collection", "sentinel-2-l2a"),
                    "thumbnail_url": (f.get("assets", {}) or {})
                    .get("thumbnail", {})
                    .get("href", ""),
                }
            )

        return {
            "provider": PROVIDER,
            "bbox": bbox,
            "scene_count": len(features),
            "recent_scenes": items,
            "is_live": True,
            "queried_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
            "guardrail": (
                "Surface reflectance only. Scene metadata does not indicate "
                "subsurface ore and is not a reserve statement."
            ),
            # Band indices (NDVI/NDWI/alteration ratios) require downloading and
            # processing the raster assets. That is the Phase 5 feature
            # pipeline; until it exists these are not reported. They were
            # previously hardcoded constants presented as measurements.
            "surface_indices": None,
            "surface_indices_note": (
                "Not computed. Requires raster processing of the scene assets."
            ),
        }
    except Exception as exc:
        return {
            "provider": PROVIDER,
            "bbox": bbox,
            "scene_count": 0,
            "recent_scenes": [],
            "is_live": False,
            "queried_at": datetime.now(timezone.utc).isoformat(),
            "error": f"{type(exc).__name__}: {exc}",
            "guardrail": (
                "Surface reflectance only. Scene metadata does not indicate "
                "subsurface ore and is not a reserve statement."
            ),
            "surface_indices": None,
            "surface_indices_note": "Not computed; STAC query failed.",
        }
