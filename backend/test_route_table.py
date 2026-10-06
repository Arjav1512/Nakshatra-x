"""
No endpoint may return a fixed timestamp or a report ID.

Fabrication regression (docs/READINESS.md §3.2). Two legacy endpoints did, and
no screen called either, so every sweep that checked the rendered page missed
them — FastAPI still published both at /docs:

- GET /mines/{id}/risk: an "audit" block with `last_evaluated` fixed at
  2026-08-30T01:45:00Z and a model version that named no code;
- GET /mines/{id}/export-compliance-report: a "Ministry of Steel" report with a
  GOI-styled `report_id`, a fixed `evaluation_timestamp`, and
  `compliance_status: APPROVED_FOR_DIRECTOR_REVIEW`.

Removed in the readiness pass. These check the route table itself, so a new
endpoint of the same kind fails here whether or not anything renders it.
"""
from __future__ import annotations

import ast
import inspect
import re
import textwrap
from pathlib import Path

from fastapi.routing import APIRoute

from app.main import app

#: An ISO-8601 date-time with a time part: what a "when it happened" field looks like.
ISO_DATETIME = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")
#: Keys whose value must describe this response, not be typed into the code.
#: Not every constant id: `problem_id: "26009"` is the problem statement's
#: number, a fact. A report id is a record of something that happened; a time is
#: when it happened. Neither may be typed in.
TIME_OR_ID_KEY = re.compile(r"(timestamp|evaluated|_at$|^at$)", re.I)

REMOVED = (
    "/api/v1/mines/{mine_id}/risk",
    "/api/v1/mines/{mine_id}/export-compliance-report",
)


def _routes() -> list[APIRoute]:
    return [r for r in app.routes if isinstance(r, APIRoute)]


def _handler_tree(route: APIRoute) -> ast.AST:
    return ast.parse(textwrap.dedent(inspect.getsource(route.endpoint)))


def _docstrings(tree: ast.AST) -> set[int]:
    """ids of string constants that are docstrings, which may quote a date."""
    out = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = getattr(node, "body", [])
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
                out.add(id(body[0].value))
    return out


def test_the_removed_endpoints_are_gone():
    paths = {r.path for r in _routes()}
    assert not paths & set(REMOVED), sorted(paths & set(REMOVED))


def test_no_route_handler_returns_a_fixed_timestamp_or_report_id():
    offenders = []
    for route in _routes():
        tree = _handler_tree(route)
        docs = _docstrings(tree)
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docs:
                if ISO_DATETIME.search(node.value):
                    offenders.append(f"{route.path}: date-time literal {node.value!r}")
            if isinstance(node, ast.Dict):
                for key, value in zip(node.keys, node.values):
                    if not (isinstance(key, ast.Constant) and isinstance(key.value, str)):
                        continue
                    if re.search(r"report_?id", key.value, re.I):
                        offenders.append(f"{route.path}: returns a {key.value!r}")
                    elif TIME_OR_ID_KEY.search(key.value) and isinstance(value, (ast.Constant, ast.JoinedStr)):
                        offenders.append(f"{route.path}: {key.value!r} is a constant in the code")
    assert not offenders, "\n".join(offenders)


def test_no_date_time_literal_anywhere_in_the_service_code():
    """Helpers too: a fixed timestamp is no more honest one call away from the route."""
    root = Path(__file__).resolve().parent / "app"
    offenders = []
    for path in sorted(root.rglob("*.py")):
        tree = ast.parse(path.read_text())
        docs = _docstrings(tree)
        for node in ast.walk(tree):
            if (isinstance(node, ast.Constant) and isinstance(node.value, str)
                    and id(node) not in docs and ISO_DATETIME.search(node.value)):
                offenders.append(f"{path.relative_to(root.parent)}:{node.lineno}: {node.value!r}")
    assert not offenders, "\n".join(offenders)
