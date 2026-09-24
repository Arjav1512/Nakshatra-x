import os

# Imported first so its thread caps land before numpy/scikit-learn are loaded
# by anything below. Import order is load-bearing here.
from app.api import forecast_store as _forecast_store  # noqa: F401

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import Base, engine
from app.api.routes import router

if settings.environment != "production":
    Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """
    Warm any missing or stale forecast artifact, off the request path.

    Artifacts are committed to the repository, so a fresh checkout serves every
    mine immediately and this loop finds nothing to do. It exists for the cases
    that are not fresh: a changed model version, an artifact past its staleness
    window, or a mine added since the artifacts were generated.

    Warming is submitted to the same bounded pool the request path uses, so a
    cold start cannot spawn ten simultaneous fits. Set NAKSHATRA_SKIP_WARM=1 to
    skip it — the concurrency test does, so it can measure a genuinely cold
    backend.
    """
    if os.environ.get("NAKSHATRA_SKIP_WARM") == "1":
        # Test-only. It exists so the concurrency test can measure a genuinely
        # cold backend; startup warming would otherwise mask the behaviour the
        # test is meant to prove. test_demo_hardening asserts it is absent from
        # every demo and deploy config.
        print("[warm] NAKSHATRA_SKIP_WARM=1 — startup warming skipped (test mode)")
    else:
        from app.api.routes import DEFAULT_MINES
        from app.api.forecast_store import is_fresh, warm_lock
        from app.api.track_b import warm_forecast

        # One warmer per host, not per worker. With `--workers 4` every worker
        # would otherwise warm all ten mines: forty fits for ten artifacts, each
        # racing the others' write-then-rename. The lock is advisory and
        # non-blocking — losing it means another process is already warming, so
        # this one simply serves.
        with warm_lock() as got_lock:
            if not got_lock:
                print("[warm] another process holds the warm lock; serving only")
            else:
                missing = [m["mine_code"] for m in DEFAULT_MINES if not is_fresh(m["mine_code"], 14)]
                for code in missing:
                    warm_forecast(code, 14)
                if missing:
                    print(f"[warm] {len(missing)} artifact(s) missing or stale: {', '.join(missing)}")
                else:
                    print(f"[warm] all {len(DEFAULT_MINES)} forecast artifacts are fresh")

    yield

    from app.api.forecast_store import shutdown
    shutdown()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs" if settings.environment != "production" else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
