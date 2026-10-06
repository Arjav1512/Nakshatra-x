"""
Every number a GET endpoint returns says where it came from, or why it need not.

The readiness pass found `/health` naming a model that does not exist and two
endpoints scoring invented inputs. No rendered-page check could see any of
them: nothing on screen called those endpoints, and the browser provenance
guard only reads what renders. This reads the API itself. It enumerates the
live FastAPI route table, calls every GET route with valid inputs, and walks
every JSON response.

A NUMBER IS COVERED when it sits inside one of the three shapes this codebase
uses to say where numbers come from (`header` below: a non-empty `source` and
a `source_kind` of measured / derived / synthetic / reference):

1. an envelope — `app.core.provenance.envelope()`, a header with a `value`;
2. an object whose `provenance` is a header, or a map of *named* headers
   (`{"forecast": …, "plan_target": …}`) — the object declares where every
   number in it comes from (`app/api/response_provenance.py`);
3. a field named by a *dotted* key of its parent's `provenance` map
   (`"weather.rainfall_14d_mm": envelope`) — that field only.

Anything else must match ALLOW: a route, a path, a category and the reason.
The categories are what a number may be without being data — an id, a count of
items returned, a version, an echo of the caller's own input, the extent of
the area a response describes, or the service's own state on /readyz.

A VERSION IS REAL when it is a version constant the code defines. Every string
shaped like a model version (`<name>-v<N>`) in any GET response must equal one
— so "random-forest-prospectivity-v1", which `/health` named until 5674bbf and
nothing defined, fails here.

A header may not call anything but a measurement live: `is_live: true` with any
`source_kind` other than measured fails.

Hermetic: the session's network block (conftest.py) is on, so live upstreams
answer with their labelled fallbacks, which are what CI serves too.
"""
from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi.routing import APIRoute

from app.main import app

APP_DIR = Path(__file__).resolve().parent / "app"
KINDS = {"measured", "derived", "synthetic", "reference"}

#: Every GET route, called with valid inputs. A route missing here fails
#: test_every_get_route_is_called, so a new endpoint cannot go unchecked.
CALLS: dict[str, tuple[dict, dict]] = {
    "/api/v1/health": ({}, {}),
    "/api/v1/healthz": ({}, {}),
    "/api/v1/readyz": ({}, {}),
    "/api/v1/mines": ({}, {}),
    "/api/v1/mines/{mine_id}/environment": ({"mine_id": 1}, {}),
    "/api/v1/mines/{mine_id}/telemetry": ({"mine_id": 1}, {}),
    "/api/v1/mines/{mine_id}/forecast": ({"mine_id": 1}, {}),
    # The pilot: the one mine whose backtest artifact is committed.
    "/api/v1/mines/{mine_id}/backtest": ({"mine_id": 1}, {}),
    "/api/v1/mines/{mine_id}/recommendations": ({"mine_id": 1}, {}),
    "/api/v1/mines/{mine_id}/satellite": ({"mine_id": 1}, {}),
    "/api/v1/prospectivity/predict": ({}, {"lat": 21.83, "lng": 80.19}),
    "/api/v1/prospectivity/drill-targets": ({}, {}),
    "/api/v1/prospectivity/grid": ({}, {}),
    "/api/v1/prospectivity/measured": ({}, {}),
    "/api/v1/prospectivity/metrics": ({}, {}),
    "/api/v1/map/tile-layers": ({}, {}),
    # Binary (a PNG) when the local tile cache holds it, a 404 when it does
    # not — the cache is gitignored, so CI has none. Neither carries JSON data.
    "/api/v1/map/cached-tiles/{layer_id}/{z}/{x}/{y}": ({"layer_id": "dem", "z": 9, "x": 368, "y": 226}, {}),
    "/api/v1/calibration/cumulative": ({}, {"mine_code": "MOIL-BAL-01"}),
    # Called after one alert is dispatched, so the list has a record to check.
    "/api/v1/alerts": ({}, {}),
}
STATUS = {"/api/v1/map/cached-tiles/{layer_id}/{z}/{x}/{y}": {200, 404}}


@dataclass(frozen=True)
class Allow:
    route: str
    path: str  # regex over the JSON path, e.g. $.mines[].artifact_age_hours
    category: str  # id | count | version | request | extent | service-state
    why: str


ALLOW: tuple[Allow, ...] = (
    # /readyz describes this service, for a load balancer and the pre-flight —
    # not data anyone reads as a measurement.
    Allow("/api/v1/readyz", r"^\$\.mines_(ready|failed|total)$", "count", "how many mines are in each readiness state"),
    Allow("/api/v1/readyz", r"^\$\.warm_workers$", "service-state", "size of the forecast-warming thread pool"),
    Allow("/api/v1/readyz", r"^\$\.(oldest_artifact_age_hours|mines\[\]\.artifact_age_hours)$", "service-state",
          "age of a served artifact, read from its own stamp"),
    Allow("/api/v1/readyz", r"^\$\.age_warn_after_hours$", "service-state", "the configured age above which /readyz warns"),
    Allow("/api/v1/readyz", r"\.generator_seed$", "id", "the synthetic dataset's seed, part of its identity"),
    # The tile-layer catalogue: which layers exist and whether each answered.
    # Each layer's own numbers sit under its provenance header.
    Allow("/api/v1/map/tile-layers", r"^\$\.n_(ok|unavailable)$", "count", "layers that did and did not answer"),
    Allow("/api/v1/map/tile-layers", r"^\$\.bbox\[\]$", "extent", "the study area the layers are requested for"),
    Allow("/api/v1/map/tile-layers", r"^\$\.age_seconds$", "service-state", "age of the cached layer registration"),
    # STAC when it did not answer: no scenes, so nothing to attribute. When it
    # does, the response carries a measured header and these are covered.
    Allow("/api/v1/mines/{mine_id}/satellite", r"^\$\.bbox\[\]$", "extent", "the search box around the mine's register coordinates"),
    Allow("/api/v1/mines/{mine_id}/satellite", r"^\$\.scene_count$", "count", "scenes returned"),
    # Telemetry: the reserve block is a pointer to the prospectivity endpoint
    # and carries no figures, only the mine it is for.
    Allow("/api/v1/mines/{mine_id}/telemetry", r"^\$\.reserve\.mine_id$", "id", "the mine's database id"),
    Allow("/api/v1/alerts", r"^\$\[\]\.mine_id$", "id", "the mine the alert was dispatched for"),
)

VERSION = re.compile(r"\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-v\d+\b")
VERSION_CONSTANT = re.compile(r"(?:^|_)VERSION$|^GENERATOR_SOURCE$")


def defined_versions() -> set[str]:
    """String values of the module-level version constants under backend/app."""
    out: set[str] = set()
    for py in APP_DIR.rglob("*.py"):
        for node in ast.parse(py.read_text()).body:
            targets = node.targets if isinstance(node, ast.Assign) else (
                [node.target] if isinstance(node, ast.AnnAssign) else [])
            value = getattr(node, "value", None)
            if not (isinstance(value, ast.Constant) and isinstance(value.value, str)):
                continue
            if any(isinstance(t, ast.Name) and VERSION_CONSTANT.search(t.id) for t in targets):
                out.add(value.value)
    return out


def is_header(node) -> bool:
    return (
        isinstance(node, dict)
        and isinstance(node.get("source"), str)
        and bool(node["source"].strip())
        and node.get("source_kind") in KINDS
    )


def walk(node, path: str, covered: bool, pending: tuple[tuple[str, ...], ...], found: dict) -> None:
    """
    Collect uncovered numbers, version strings and header problems.

    `pending` holds the dotted provenance keys of enclosing objects that have
    not yet been matched down to a field, as tuples of the remaining parts.
    """
    if isinstance(node, dict):
        if is_header(node):
            if node.get("is_live") is True and node["source_kind"] != "measured":
                found["headers"].append(f"{path}: is_live with source_kind {node['source_kind']!r}")
            covered = True
        prov = node.get("provenance")
        if is_header(prov):
            covered = True
        elif isinstance(prov, dict) and prov and all(is_header(v) for v in prov.values()):
            if any("." not in k for k in prov):
                covered = True  # named headers: what this object is
            pending = pending + tuple(tuple(k.split(".")) for k in prov if "." in k)
        for key, value in node.items():
            child = tuple(p[1:] for p in pending if p and p[0] == key)
            walk(value, f"{path}.{key}", covered or () in child, tuple(p for p in child if p), found)
    elif isinstance(node, list):
        for value in node:
            walk(value, f"{path}[]", covered, pending, found)
    elif isinstance(node, bool) or node is None:
        return
    elif isinstance(node, (int, float)):
        if not covered:
            found["numbers"].setdefault(path, node)
    elif isinstance(node, str):
        found["versions"].update(VERSION.findall(node))


def _get_routes() -> list[str]:
    return sorted({r.path for r in app.routes if isinstance(r, APIRoute) and "GET" in r.methods})


def test_every_get_route_is_called():
    routes = set(_get_routes())
    assert routes - CALLS.keys() == set(), f"GET routes with no call here: {sorted(routes - CALLS.keys())}"
    assert CALLS.keys() - routes == set(), f"calls for routes that no longer exist: {sorted(CALLS.keys() - routes)}"


@pytest.fixture(scope="module")
def responses(client):
    # One alert, so /alerts returns a record rather than an empty list.
    res = client.post("/api/v1/dispatch-operational-alert", json={
        "mine_id": 1, "mine_name": "Balaghat", "alert_type": "provenance-guard",
        "trigger_metric": "test", "action_directive": "none",
    })
    assert res.status_code == 200, res.text
    out = {}
    for route in _get_routes():
        params, query = CALLS[route]
        res = client.get(route.format(**params), params=query)
        assert res.status_code in STATUS.get(route, {200}), f"{route} -> {res.status_code}: {res.text[:300]}"
        out[route] = res.json() if "json" in res.headers.get("content-type", "") else None
    return out


def _scan(responses) -> dict[str, dict]:
    scans = {}
    for route, body in responses.items():
        found = {"numbers": {}, "versions": set(), "headers": []}
        if body is not None:
            walk(body, "$", False, (), found)
        scans[route] = found
    return scans


def test_every_number_has_a_provenance_or_a_stated_reason(responses):
    used: set[Allow] = set()
    unexplained = []
    for route, found in _scan(responses).items():
        for path, value in found["numbers"].items():
            hit = next((a for a in ALLOW if a.route == route and re.search(a.path, path)), None)
            if hit:
                used.add(hit)
            else:
                unexplained.append(f"{route}  {path} = {value!r}")
    assert not unexplained, (
        f"{len(unexplained)} number(s) with no provenance and no allowlist entry:\n  "
        + "\n  ".join(unexplained)
    )
    unused = [a for a in ALLOW if a not in used]
    assert not unused, "allowlist entries that matched nothing (remove them): " + "; ".join(
        f"{a.route} {a.path}" for a in unused)


def test_every_version_named_is_one_the_code_defines(responses):
    defined = defined_versions()
    unknown = sorted(
        f"{route}: {v}"
        for route, found in _scan(responses).items()
        for v in found["versions"] - defined
    )
    assert not unknown, (
        "version names no constant in backend/app defines (a *_VERSION or "
        f"GENERATOR_SOURCE assignment):\n  " + "\n  ".join(unknown)
    )


def test_no_header_calls_anything_but_a_measurement_live(responses):
    problems = [f"{route}  {p}" for route, found in _scan(responses).items() for p in found["headers"]]
    assert not problems, "\n".join(problems)


def test_the_walker_sees_what_it_should():
    """The rules above, on small cases, so a change to `walk` cannot quietly widen them."""
    h = {"source": "s", "source_kind": "derived", "is_live": False, "is_synthetic": False}

    def bare(body):
        found = {"numbers": {}, "versions": set(), "headers": []}
        walk(body, "$", False, (), found)
        return found

    assert bare({"x": 1})["numbers"] == {"$.x": 1}
    assert bare({**h, "value": 3})["numbers"] == {}                       # envelope
    assert bare({"provenance": h, "a": {"b": [1, 2]}})["numbers"] == {}  # scope header
    assert bare({"provenance": {"forecast": h}, "x": 1})["numbers"] == {}  # named headers
    dotted = bare({"provenance": {"w.r": {**h, "value": 1}}, "w": {"r": 1, "t": 2}})
    assert dotted["numbers"] == {"$.w.t": 2}                             # dotted: that field only
    assert bare({"provenance": {"x": "not a header"}, "y": 1})["numbers"] == {"$.y": 1}
    assert bare({"provenance": {**h, "is_live": True}})["headers"]       # derived, labelled live
    assert bare({"m": "random-forest-prospectivity-v1 (RF)"})["versions"] == {"random-forest-prospectivity-v1"}
    assert bare({"ok": True, "n": None})["numbers"] == {}                # not numbers
