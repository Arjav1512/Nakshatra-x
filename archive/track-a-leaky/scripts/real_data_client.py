"""
Real live-data client for the NAKSHATRA-X reserve/prospectivity pipeline.

Fetches genuine per-coordinate terrain + climate data from NASA POWER
(https://power.larc.nasa.gov), a keyless public API backed by satellite
and reanalysis products (real elevation, real 1981-2020 climatology for
air temperature, land skin temperature, precipitation, and soil wetness).

There is no keyless public source for Sentinel-2 spectral bands
(iron oxide index, SWIR reflectance) or raw NDVI, so those remain
downstream geology/vegetation proxies derived from this real data.
"""

import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import requests

_cache_lock = threading.Lock()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_PATH = os.path.join(BASE_DIR, "data", "real_data_cache.json")

NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
MONSOON_MONTHS = ["JUN", "JUL", "AUG", "SEP"]

_cache = None


def _load_cache():
    global _cache
    if _cache is not None:
        return _cache
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r") as f:
                _cache = json.load(f)
        except Exception:
            _cache = {}
    else:
        _cache = {}
    return _cache


def _save_cache():
    if _cache is None:
        return
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w") as f:
        json.dump(_cache, f)


def _cache_key(lat, lng):
    return f"{round(lat, 3)},{round(lng, 3)}"


def _fallback(lat, lng):
    """Regional Central-India climatology fallback used only if NASA POWER is unreachable."""
    return {
        "elevation_m": 300.0,
        "temp_c": 26.5,
        "land_temp_c": 27.5,
        "rainfall_mm_monsoon": 6.5,
        "soil_moisture": 0.55,
        "is_live": False,
    }


def fetch_nasa_power(lat, lng, timeout=10.0, retries=3):
    """
    Returns real terrain + climatology for (lat, lng):
      elevation_m, temp_c (annual mean T2M), land_temp_c (annual mean TS),
      rainfall_mm_monsoon (avg daily precip, Jun-Sep), soil_moisture (annual mean GWETTOP 0-1),
      is_live (True if this call/hit came from the live API at some point).
    Disk-cached by rounded coordinate so repeated pipeline runs and dense grids
    don't re-hit the API for the same location.
    """
    cache = _load_cache()
    key = _cache_key(lat, lng)
    with _cache_lock:
        if key in cache:
            return cache[key]

    for attempt in range(retries + 1):
        try:
            resp = requests.get(
                NASA_POWER_URL,
                params={
                    "parameters": "T2M,PRECTOTCORR,GWETTOP,TS",
                    "community": "AG",
                    "longitude": lng,
                    "latitude": lat,
                    "format": "JSON",
                },
                timeout=timeout,
            )
            if resp.status_code == 429:
                time.sleep(2.0 * (attempt + 1))
                raise RuntimeError("HTTP 429 rate limited")
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}")

            data = resp.json()
            elevation_m = float(data["geometry"]["coordinates"][2])
            params = data["properties"]["parameter"]

            monsoon_precip = [params["PRECTOTCORR"][m] for m in MONSOON_MONTHS]

            result = {
                "elevation_m": round(elevation_m, 1),
                "temp_c": round(float(params["T2M"]["ANN"]), 2),
                "land_temp_c": round(float(params["TS"]["ANN"]), 2),
                "rainfall_mm_monsoon": round(sum(monsoon_precip) / len(monsoon_precip), 2),
                "soil_moisture": round(float(params["GWETTOP"]["ANN"]), 3),
                "is_live": True,
            }
            with _cache_lock:
                cache[key] = result
            return result
        except Exception:
            if attempt < retries:
                time.sleep(0.6)
                continue
            # Do not persist fallback results to disk cache: a point that failed under
            # load (rate limiting / transient timeout) should be retried live next run
            # rather than being stuck as a fallback forever.
            return _fallback(lat, lng)


def fetch_many(points, max_workers=3, progress_label="points"):
    """
    Concurrently fetches real NASA POWER data for a list of (lat, lng) tuples.
    Returns a list of result dicts in the same order as `points`. Saves the
    disk cache once at the end (not per-request) to avoid file contention.
    """
    results = [None] * len(points)
    live_count = 0

    def _worker(i, lat, lng):
        return i, fetch_nasa_power(lat, lng)

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(_worker, i, lat, lng) for i, (lat, lng) in enumerate(points)]
        done = 0
        for fut in futures:
            i, res = fut.result()
            results[i] = res
            if res["is_live"]:
                live_count += 1
            done += 1
            if done % 200 == 0 or done == len(points):
                print(f"  ...fetched real data for {done}/{len(points)} {progress_label} "
                      f"({live_count} live, {done - live_count} fallback)")

    _save_cache()
    return results
