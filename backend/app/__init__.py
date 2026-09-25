"""
Nakshatra-X backend package.

The only thing that happens at package import is capping the number of threads
numpy, scikit-learn and the BLAS underneath them will use.

WHY IT IS HERE AND NOT SOMEWHERE MORE OBVIOUS
---------------------------------------------
OpenMP and the BLAS read these variables when the shared library is loaded,
which happens on `import numpy`. Setting them afterwards has no effect — the
call succeeds, the variable is set, and nothing changes.

They were originally set at the top of `app/api/forecast_store.py`, which
`app.main` imports first, so the API was capped. Nothing else was:
`app/api/track_b.py` imports the generator (and through it numpy) at line 18 and
`forecast_store` at line 192, so `python -m app.api.batch forecast` and
`pytest test_track_b.py` both loaded numpy uncapped. Measured: one pytest
process at **849% CPU** on an 8-core laptop, which is the same oversubscription
that once took a 42 s fit to 300 s.

A package `__init__` is the one place that is guaranteed to run before any
`app.*` submodule, whatever the entry point. That is the whole reason for it.

Override with NAKSHATRA_FIT_THREADS. Values already in the environment win, so a
deployment can still tune this from outside.
"""

import os

FIT_THREADS = os.environ.get("NAKSHATRA_FIT_THREADS", "2")

THREAD_ENV_VARS = (
    "OMP_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "MKL_NUM_THREADS",
    "NUMEXPR_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
)

for _var in THREAD_ENV_VARS:
    os.environ.setdefault(_var, FIT_THREADS)
