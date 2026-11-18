"""Tests for the indiasim package. Run: pytest python/tests"""
import json
import shutil
import subprocess
from pathlib import Path

import pandas as pd
import pytest

import indiasim as isim

ROOT = Path(__file__).resolve().parents[2]


def test_defaults_are_calibrated():
    d = isim.defaults()
    assert d["households"] == 1000 and d["firms"] == 100
    assert 0 < d["informal"] <= 1 and 0 < d["importShare"] < 0.5


def test_run_shape_and_accounts():
    df = isim.run(months=24)
    assert list(df.index) == list(range(1, 25))
    for col in ["infl", "foodInfl", "coreInfl", "u", "repo", "inr_per_usd", "Y_index", "infShare", "gdp_pct_gdp0"]:
        assert col in df
    assert df.attrs["balanced"]
    assert df["u"].between(0, 0.3).all()
    assert abs(df["inr_per_usd"].iloc[0] - 83) < 3


def test_same_seed_same_economy_different_seed_different():
    a, b, c = isim.run(months=12, seed=5), isim.run(months=12, seed=5), isim.run(months=12, seed=6)
    assert a.attrs["fingerprint"] == b.attrs["fingerprint"]
    pd.testing.assert_frame_equal(a, b)
    assert a.attrs["fingerprint"] != c.attrs["fingerprint"]


@pytest.mark.skipif(shutil.which("node") is None or not (ROOT / "prototype" / "engine.js").exists(),
                    reason="needs Node.js and the website's engine")
def test_matches_the_website_engine_exactly():
    df = isim.run(months=36, seed=74, shocks=["monsoon"])
    js = ("const E=require(process.argv[1]);const r=E.runLab({seed:74,months:36,"
          "shocks:[{key:'monsoon',start:3}],policy:{mode:'rule'}});console.log(r.hash)")
    out = subprocess.run(["node", "-e", js, str(ROOT / "prototype" / "engine.js")], capture_output=True, text=True, check=True)
    assert df.attrs["fingerprint"] == out.stdout.strip()


def test_packaged_engine_is_in_sync_with_the_website():
    web = ROOT / "prototype" / "engine.js"
    if not web.exists():
        pytest.skip("not running from the repository")
    pkg = Path(isim.__file__).parent / "data" / "engine.js"
    assert pkg.read_text() == web.read_text(), "run python/sync_engine.py"


def test_include_warmup():
    d = isim.defaults()
    df = isim.run(months=6, include_warmup=True)
    assert df.index.min() == 1 - d["burnIn"] and df.index.max() == 6


def test_monsoon_raises_food_inflation_more_than_core():
    df = isim.run(months=24, shocks=["monsoon"], policy="fixed")
    assert df["foodInfl"].max() > df["coreInfl"].max() + 0.01


def test_rate_hike_cools_inflation_and_raises_unemployment():
    base = isim.run(months=24, seed=3, policy="fixed")
    hike = isim.run(months=24, seed=3, policy={"repoDelta": 0.02})
    assert hike["repo"].iloc[0] > base["repo"].iloc[0]
    assert hike["infl"].iloc[12:].mean() < base["infl"].iloc[12:].mean()
    assert hike["u"].iloc[12:].mean() > base["u"].iloc[12:].mean()


def test_params_after_leaves_the_warm_up_identical():
    a = isim.run(months=3, seed=9, params_after={"anchor": 0.95}, include_warmup=True)
    b = isim.run(months=3, seed=9, params_after={"anchor": 0.0}, include_warmup=True)
    pd.testing.assert_series_equal(a.loc[:0, "infl"], b.loc[:0, "infl"])


def test_run_many_parallel_equals_serial():
    par = isim.run_many(seeds=[1, 2, 3, 4], months=12, n_jobs=2)
    ser = isim.run_many(seeds=[1, 2, 3, 4], months=12, n_jobs=1)
    pd.testing.assert_frame_equal(par, ser)
    assert set(par["seed"]) == {1, 2, 3, 4} and len(par) == 48 and par["balanced"].all()


def test_sweep_policy_and_setting():
    sw = isim.sweep("repoDelta", [0.0, 0.02], seeds=[1, 2], months=18, n_jobs=1)
    m = sw[sw.month > 9].groupby("repoDelta")["infl"].mean()
    assert m[0.02] < m[0.0]
    sw2 = isim.sweep("informal", [0.3, 0.9], seeds=[1], months=6, n_jobs=1)
    share = sw2.groupby("informal")["infShare"].mean()
    assert share[0.9] > share[0.3]


def test_economy_step_by_step_matches_run():
    e = isim.Economy(seed=11).warm_up(rule=True)
    assert e.month == 0
    e.run(12)
    df = isim.run(months=12, seed=11)
    assert e.fingerprint == df.attrs["fingerprint"]
    e.set(repo=0.08)
    new = e.run(2)
    assert (new["repo"] == 0.08).all()
    e.shock("oil", depth=1.0)
    e.run(6)
    assert e.accounts_balanced
    assert e.history.index.max() == 20


def test_game_scores_and_comparisons():
    g = isim.Game("monsoon", seed=74)
    start = g.start["repo"]
    while not g.done:
        g.meeting(repo=start)
    s = g.score()
    assert s["grade"] in "ABCD"
    assert g.history("hold") is not None and g.history("auto") is not None
    pd.testing.assert_series_equal(g.history("player")["infl"], g.history("hold")["infl"])


def test_moments_and_targets():
    t = isim.calibration_targets()
    assert "inflMean" in t.index and t.loc["inflMean", "india"] == pytest.approx(0.05, abs=0.002)
    m = isim.moments(seeds=[1, 2], years=10, n_jobs=1)
    assert set(t.index) == set(m.index) and m.attrs["balanced"]
    assert "cfpi_food_inflation" in isim.india_data()
