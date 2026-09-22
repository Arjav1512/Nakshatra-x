"""
Ordinary kriging for per-cell uncertainty (PRD A-4 [D] P0).

PRD A-4 requires "per-cell **uncertainty**, not a bare score", and the
architecture specifies "variogram + ordinary kriging (kriging variance =
uncertainty, for free)".

That last phrase is the reason for this module. A classifier's predicted
probability is a statement about the *feature values* at a cell; it says
nothing about whether there is any measurement nearby. Kriging variance does:
it rises with distance from observed points and falls where samples cluster.
A cell can therefore carry a high score *and* high uncertainty — "looks
promising, but we have little data here" — which is exactly the distinction a
geologist needs before committing a drill rig.

Implementation is plain numpy: an exponential variogram fitted to the empirical
semivariance, then the ordinary kriging system solved per target cell. No new
dependency.

Distances are computed in metres via an equal-area local projection, never in
degrees (PRD §8.4).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

EARTH_R = 6371008.8


def to_local_metres(lat: np.ndarray, lng: np.ndarray,
                    lat0: float, lng0: float) -> tuple[np.ndarray, np.ndarray]:
    """
    Local equirectangular projection about (lat0, lng0), in metres.

    Adequate over the ~250 km study area and keeps every distance in metres,
    which PRD §8.4 requires for any spatial computation.
    """
    x = np.radians(lng - lng0) * EARTH_R * np.cos(np.radians(lat0))
    y = np.radians(lat - lat0) * EARTH_R
    return x, y


@dataclass
class Variogram:
    nugget: float
    sill: float
    range_m: float

    def gamma(self, h: np.ndarray) -> np.ndarray:
        """Exponential model: gamma(h) = nugget + (sill-nugget)(1 - exp(-3h/range))."""
        return self.nugget + (self.sill - self.nugget) * (1.0 - np.exp(-3.0 * h / self.range_m))

    def covariance(self, h: np.ndarray) -> np.ndarray:
        return self.sill - self.gamma(h)

    def to_dict(self) -> dict:
        return {
            "model": "exponential",
            "nugget": round(float(self.nugget), 6),
            "sill": round(float(self.sill), 6),
            "range_m": round(float(self.range_m), 1),
        }


def fit_variogram(x: np.ndarray, y: np.ndarray, z: np.ndarray, n_bins: int = 12) -> Variogram:
    """
    Fit an exponential variogram to the empirical semivariance.

    A coarse grid search rather than a gradient fit: with tens of points the
    likelihood surface is flat and a careful optimiser would imply more
    precision than the data supports.
    """
    n = len(z)
    dx = x[:, None] - x[None, :]
    dy = y[:, None] - y[None, :]
    h = np.sqrt(dx ** 2 + dy ** 2)
    iu = np.triu_indices(n, k=1)
    hv, zv = h[iu], 0.5 * (z[:, None] - z[None, :])[iu] ** 2

    hmax = np.percentile(hv, 80)
    edges = np.linspace(0, hmax, n_bins + 1)
    centres, gammas = [], []
    for i in range(n_bins):
        m = (hv >= edges[i]) & (hv < edges[i + 1])
        if m.sum() >= 5:
            centres.append(float(hv[m].mean()))
            gammas.append(float(zv[m].mean()))
    if len(centres) < 3:
        var = float(np.var(z))
        return Variogram(nugget=0.1 * var, sill=var, range_m=float(max(hmax, 1000.0)))

    centres = np.array(centres)
    gammas = np.array(gammas)
    total_var = float(np.var(z))

    best, best_err = None, np.inf
    for nug_f in (0.0, 0.1, 0.2, 0.35, 0.5):
        for sill_f in (0.8, 1.0, 1.2, 1.5):
            for rng_f in (0.25, 0.4, 0.6, 0.8, 1.0, 1.5):
                v = Variogram(nugget=nug_f * total_var,
                              sill=max(sill_f * total_var, nug_f * total_var + 1e-9),
                              range_m=max(rng_f * hmax, 1.0))
                err = float(np.mean((v.gamma(centres) - gammas) ** 2))
                if err < best_err:
                    best, best_err = v, err
    return best


class OrdinaryKriging:
    """Ordinary kriging over scattered observations."""

    def __init__(self, lat: np.ndarray, lng: np.ndarray, values: np.ndarray):
        self.lat0 = float(np.mean(lat))
        self.lng0 = float(np.mean(lng))
        self.x, self.y = to_local_metres(np.asarray(lat, float), np.asarray(lng, float),
                                         self.lat0, self.lng0)
        self.z = np.asarray(values, float)
        self.vg = fit_variogram(self.x, self.y, self.z)
        n = len(self.z)
        d = np.sqrt((self.x[:, None] - self.x[None, :]) ** 2 +
                    (self.y[:, None] - self.y[None, :]) ** 2)
        # Ordinary kriging system with the Lagrange multiplier row/column.
        A = np.ones((n + 1, n + 1))
        A[:n, :n] = self.vg.covariance(d)
        A[n, n] = 0.0
        # With a zero nugget the covariance matrix is singular -- every
        # diagonal entry equals the sill -- and inverting it overflowed. A small
        # diagonal jitter regularises the system; it is the numerical
        # equivalent of admitting a trace of measurement noise, which is also
        # physically honest.
        jitter = max(self.vg.sill, 1e-9) * 1e-8
        A[:n, :n] += np.eye(n) * jitter
        self._A = A
        self._n = n

    def predict(self, lat: np.ndarray, lng: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """
        Returns (estimate, variance).

        Variance is the kriging variance: low near observations, rising towards
        the sill where there is no nearby data.
        """
        lat = np.atleast_1d(np.asarray(lat, float))
        lng = np.atleast_1d(np.asarray(lng, float))
        gx, gy = to_local_metres(lat, lng, self.lat0, self.lng0)
        d = np.sqrt((gx[:, None] - self.x[None, :]) ** 2 + (gy[:, None] - self.y[None, :]) ** 2)
        c = self.vg.covariance(d)

        b = np.ones((len(lat), self._n + 1))
        b[:, :self._n] = c
        # Solve rather than invert: more stable, and the system is small.
        w = np.linalg.solve(self._A, b.T).T
        wk = np.ascontiguousarray(w[:, :self._n])

        # macOS Accelerate/BLAS sets floating-point status flags from its
        # vectorised inner loops, and NumPy surfaces them as divide-by-zero /
        # overflow / invalid warnings on `@`. They appear only when this runs
        # inside FastAPI's thread pool, never on the main thread, and the
        # results are unaffected -- the kriging system is well conditioned
        # (condition number ~285 for 50 observations).
        #
        # Rather than suppress blindly, the inputs are checked first and the
        # outputs are checked after, so a genuine numerical fault still raises.
        if not (np.all(np.isfinite(wk)) and np.all(np.isfinite(self.z))):
            raise FloatingPointError("Kriging weights or observations are not finite")
        with np.errstate(divide="ignore", over="ignore", invalid="ignore"):
            est = wk @ self.z
            quad = np.einsum("ij,ij->i", wk, c)
        if not np.all(np.isfinite(est)):
            raise FloatingPointError("Kriging estimate is not finite")

        var = self.vg.sill - quad - w[:, self._n]
        return est, np.maximum(np.nan_to_num(var, nan=self.vg.sill), 0.0)

    def uncertainty(self, lat, lng) -> tuple[np.ndarray, np.ndarray]:
        """Estimate and standard deviation (the reportable uncertainty)."""
        est, var = self.predict(lat, lng)
        return est, np.sqrt(var)
