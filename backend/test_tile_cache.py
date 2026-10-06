"""
`batch tiles` survives a slow network (docs/DEMO.md, the day before).

The cold-start rehearsal's tile fetch died after 796 s: one tile timed out while
its body was being read, the TimeoutError was not among the retried errors, it
ended the worker pool, and no manifest was written — so 1,900 good tiles sat on
disk unlabelled. These pin the fix with the network faked: one tile times out
every time, the rest answer.
"""
import json

import pytest

from app.ml import tile_cache as tc


class _Body:
    def __init__(self, data):
        self._data = data
        self.headers = {"Content-Type": "image/jpeg"}

    def read(self):
        return self._data

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture
def fake_tiler(monkeypatch, tmp_path):
    layer = {
        "id": "s2-true-colour", "name": "Sentinel-2 true colour", "status": "ok",
        "tile_url": "https://tiles.example/{z}/{x}/{y}.jpg",
        "tilejson_url": "https://tiles.example/tilejson.json",
        "provenance": {}, "legend_facts": {},
        "attribution": {"licence_name": "CC BY-SA 3.0 IGO", "licence_url": "https://example/licence",
                        "required": "Contains modified Copernicus Sentinel data", "source_of_wording": "test"},
    }
    monkeypatch.setattr(tc, "tile_layers", lambda force=False: {"layers": [layer], "tiler": "test"})
    monkeypatch.setattr(tc, "CACHE_DIR", tmp_path / ".tile-cache")
    monkeypatch.setattr(tc, "MANIFEST", tmp_path / ".tile-cache" / "_manifest.json")
    monkeypatch.setattr(tc.time, "sleep", lambda _s: None)  # no real back-off waits
    tiles = list(tc.iter_tiles(6, 7))
    slow = tiles[0]

    def urlopen(req, context=None, timeout=None):
        if req.full_url.endswith(f"/{slow[0]}/{slow[1]}/{slow[2]}.jpg"):
            raise TimeoutError("The read operation timed out")
        return _Body(b"\xff\xd8 tile")

    monkeypatch.setattr(tc.urllib.request, "urlopen", urlopen)
    return tiles


def test_one_timed_out_tile_does_not_end_the_run(fake_tiler):
    m = tc.fetch_all(zmin=6, zmax=7, log=lambda *_a: None)

    [entry] = m["layers"]
    assert entry["n_failed"] == 1
    assert entry["n_fetched"] == len(fake_tiler) - 1
    assert tc.MANIFEST.exists(), "the manifest must be written even when a tile failed"
    assert json.loads(tc.MANIFEST.read_text())["layers"][0]["n_failed"] == 1


def test_a_rerun_fetches_only_what_failed(fake_tiler, monkeypatch):
    tc.fetch_all(zmin=6, zmax=7, log=lambda *_a: None)
    monkeypatch.setattr(tc.urllib.request, "urlopen", lambda req, context=None, timeout=None: _Body(b"\xff\xd8 tile"))

    m = tc.fetch_all(zmin=6, zmax=7, log=lambda *_a: None)

    [entry] = m["layers"]
    assert (entry["n_fetched"], entry["n_failed"]) == (1, 0)
    assert entry["n_reused"] == len(fake_tiler) - 1


def test_the_tilers_404_is_not_a_failure(fake_tiler, monkeypatch):
    def urlopen(req, context=None, timeout=None):
        raise tc.urllib.error.HTTPError(req.full_url, 404, "Not Found", {}, None)

    monkeypatch.setattr(tc.urllib.request, "urlopen", urlopen)
    [entry] = tc.fetch_all(zmin=6, zmax=7, log=lambda *_a: None)["layers"]
    assert (entry["n_missing"], entry["n_failed"]) == (len(fake_tiler), 0)
