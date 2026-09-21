"""
NASA POWER daily meteorology client.

PRD B-4: ingest rainfall, soil moisture, LST and NDVI, observed and forecast.
This client covers the observed rainfall/temperature/humidity half.
"""
from datetime import date, timedelta
import httpx
from app.core.config import settings
from app.core.synthetic import mine_stream, rnd


async def fetch_weather_signal(
    latitude: float, longitude: float, mine_id: str = "unknown"
) -> dict:
    end_date = date.today() - timedelta(days=2)
    start_date = end_date - timedelta(days=13)
    params = {
        "parameters": "PRECTOTCORR,T2M,RH2M",
        "community": "AG",
        "longitude": longitude,
        "latitude": latitude,
        "start": start_date.strftime("%Y%m%d"),
        "end": end_date.strftime("%Y%m%d"),
        "format": "JSON",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{settings.nasa_power_base_url}/temporal/daily/point",
                params=params,
            )
            response.raise_for_status()
            payload = response.json()
            values = payload["properties"]["parameter"]
            rainfall = list(values.get("PRECTOTCORR", {}).values())
            temperatures = list(values.get("T2M", {}).values())
            humidity = list(values.get("RH2M", {}).values())

            rain_valid = [v for v in rainfall if v >= 0]
            temp_valid = [v for v in temperatures if v >= -50]
            hum_valid = [v for v in humidity if v >= 0]

            # If the response carried no usable values there is nothing
            # measured to report; fall through to the synthetic path rather
            # than mixing invented constants into a "live" payload.
            if not rain_valid and not temp_valid and not hum_valid:
                raise ValueError("NASA POWER returned no valid values for this point")

            return {
                "rainfall_14d_mm": round(sum(rain_valid), 2),
                "avg_temperature_c": round(sum(temp_valid) / len(temp_valid), 2) if temp_valid else None,
                "avg_humidity_pct": round(sum(hum_valid) / len(hum_valid), 2) if hum_valid else None,
                "source": "NASA POWER Analysis-Ready API",
                "is_live": True,
                "is_synthetic": False,
                "window_start": start_date.isoformat(),
                "window_end": end_date.isoformat(),
            }
    except Exception as e:
        # Degraded path. These values were previously fixed constants labelled
        # "NASA POWER (Cached/Interpolated)" — nothing was cached and nothing
        # was interpolated; they were invented. They are now a seeded draw,
        # reproducible for a given mine and day, and labelled synthetic.
        # PRD N-6: state staleness, never silently extrapolate.
        s = mine_stream(mine_id, "nasa-power-fallback")
        return {
            "rainfall_14d_mm": rnd(s.bounded_normal(70.0, 25.0, 0.0, 320.0), 2),
            "avg_temperature_c": rnd(s.bounded_normal(31.0, 3.0, 12.0, 48.0), 2),
            "avg_humidity_pct": rnd(s.bounded_normal(62.0, 12.0, 10.0, 100.0), 2),
            "source": "SYNTHETIC FALLBACK — NASA POWER unreachable. Not observed data.",
            "is_live": False,
            "is_synthetic": True,
            "degraded_reason": str(e),
        }
