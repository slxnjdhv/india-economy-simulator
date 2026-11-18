"""Python interface to the Economy Lab model."""
from __future__ import annotations

import json
import os
from concurrent.futures import ProcessPoolExecutor
from typing import Any, Iterable, Mapping, Optional, Sequence, Union

import pandas as pd

from . import _bridge

RUPEE_START = 83.0  # ₹ per US dollar at the start of each experiment (month 0)

Policy = Union[str, Mapping[str, Any], None]
Shock = Union[str, Mapping[str, Any]]

# Columns that are money flows; the long-form output also gives them as % of starting monthly GDP.
_FLOWS = ("C", "I", "G", "X", "M", "gdp")


def defaults() -> dict:
    """The model's default settings. Those marked [cal] in engine.js are calibrated to Indian data."""
    return _bridge.engine_value("EconEngine.DEFAULTS")


def scenarios() -> dict:
    """The four scripted policy games, as on the website."""
    return _bridge.engine_value("EconEngine.SCENARIOS")


def shocks() -> dict:
    """Scripted shocks that experiments can switch on: 'monsoon', 'oil' and 'slowdown'."""
    return _bridge.engine_value("EconEngine.SHOCKS")


def _policy(policy: Policy) -> dict:
    if policy is None or policy == "rule":
        return {"mode": "rule"}
    if policy == "fixed":
        return {"mode": "fixed"}
    if isinstance(policy, Mapping):
        p = dict(policy)
        p.setdefault("mode", "fixed" if "repo" in p or "repoDelta" in p else "rule")
        return p
    raise ValueError("policy must be 'rule', 'fixed' or a dict such as {'repo': 0.07}")


def _shocks(items: Optional[Iterable[Shock]]) -> list:
    out = []
    for s in items or []:
        if isinstance(s, str):
            out.append({"key": s, "start": 3})
        else:
            d = dict(s)
            if "key" not in d:
                raise ValueError("each shock needs a 'key': 'monsoon', 'oil' or 'slowdown'")
            d.setdefault("start", 3)
            out.append(d)
    return out


def _frame(records: list, start: Optional[dict] = None) -> pd.DataFrame:
    df = pd.DataFrame.from_records(records)
    df.insert(0, "month", df["t"] + 1)
    df = df.drop(columns=["t"]).set_index("month")
    df["inr_per_usd"] = df["er"] * RUPEE_START
    if start:
        df["Y_index"] = 100 * df["Y"] / start["Y"]
        for k in _FLOWS:
            if k in df:
                df[k + "_pct_gdp0"] = 100 * df[k] / start["gdp"]
    return df


def run(months: int = 36, seed: Optional[int] = None, *, policy: Policy = "rule",
        shocks: Optional[Iterable[Shock]] = None, params: Optional[Mapping[str, Any]] = None,
        params_after: Optional[Mapping[str, Any]] = None, include_warmup: bool = False) -> pd.DataFrame:
    """Simulate one economy and return its monthly history.

    The economy is first warmed up (``burnIn`` months, 120 by default) under the RBI's usual rule.
    Then the experiment runs for ``months`` months.

    Args:
        months: length of the experiment after the warm-up.
        seed: economy number. The same number always gives the same economy (default: the website's).
        policy: ``'rule'`` (the RBI's usual rule sets the repo rate), ``'fixed'`` (the repo rate
            stays where the warm-up left it), or a dict such as ``{'repo': 0.07}``,
            ``{'repoDelta': 0.01}``, ``{'mode': 'rule', 'spendDelta': 0.02}`` or ``{'tax': 0.12}``.
        shocks: scripted shocks, e.g. ``['monsoon']`` or ``[{'key': 'oil', 'start': 2, 'depth': 1.0}]``.
        params: model settings that apply from the start, including the warm-up.
        params_after: model settings that change only when the experiment starts (month 1).
        include_warmup: also return the warm-up months (numbered 0 and below).

    Returns:
        A DataFrame indexed by month (1 = first month of the experiment). Rates are fractions
        (0.04 = 4%). ``attrs`` holds the fingerprint, whether the accounts balanced and the settings used.
    """
    cfg = {"months": int(months), "seed": int(seed if seed is not None else defaults()["seed"]),
           "policy": _policy(policy), "shocks": _shocks(shocks), "params": dict(params or {}),
           "includeWarmup": bool(include_warmup)}
    if params_after:
        cfg["paramsAfter"] = dict(params_after)
    out = _bridge.call("__run", json.dumps(cfg))
    df = _frame(out["records"], out["start"])
    df.attrs.update(seed=cfg["seed"], fingerprint=out["fingerprint"], balanced=out["balanced"], settings=out["params"])
    return df


def _run_one(kw: dict) -> pd.DataFrame:
    df = run(**kw)
    df = df.reset_index()
    df.insert(0, "seed", df.attrs["seed"])
    df["balanced"] = df.attrs["balanced"]
    return df


def _workers(n_jobs: Optional[int], tasks: int) -> int:
    if n_jobs is None:
        n_jobs = max(1, (os.cpu_count() or 2) - 1)
    return max(1, min(int(n_jobs), tasks))


def run_many(seeds: Iterable[int] = range(1, 41), months: int = 36, *, n_jobs: Optional[int] = None,
             **kwargs: Any) -> pd.DataFrame:
    """Run the same experiment on many economies (same rules, different luck), in parallel.

    Takes the same keyword arguments as :func:`run`. Returns one long DataFrame with a ``seed``
    column, a ``month`` column and one row per economy and month.
    """
    tasks = [dict(kwargs, months=months, seed=int(s)) for s in seeds]
    n = _workers(n_jobs, len(tasks))
    if n == 1:
        parts = [_run_one(t) for t in tasks]
    else:
        with ProcessPoolExecutor(max_workers=n) as ex:
            parts = list(ex.map(_run_one, tasks, chunksize=max(1, len(tasks) // (4 * n))))
    return pd.concat(parts, ignore_index=True)


_POLICY_KEYS = {"repo", "repoDelta", "tax", "spend", "spendDelta"}


def sweep(setting: str, values: Sequence[Any], seeds: Iterable[int] = range(1, 41), months: int = 36, *,
          when: str = "start", n_jobs: Optional[int] = None, **kwargs: Any) -> pd.DataFrame:
    """Vary one setting across ``values`` and run every value on the same economies.

    ``setting`` can be any model setting (e.g. ``'anchor'``, ``'informal'``) or a policy key
    (``'repo'``, ``'repoDelta'``, ``'tax'``, ``'spend'``, ``'spendDelta'``). With ``when='start'``
    a model setting applies from the warm-up on; with ``when='after'`` it changes only at month 1.
    The result has a column named after the setting.
    """
    seeds = list(seeds)
    tasks = []
    for v in values:
        kw = dict(kwargs, months=months)
        if setting in _POLICY_KEYS:
            pol = _policy(kw.get("policy", "rule"))
            pol[setting] = v
            if setting in ("repo", "repoDelta") and "mode" not in (kw.get("policy") or {}):
                pol["mode"] = "fixed"
            kw["policy"] = pol
        else:
            key = "params" if when == "start" else "params_after"
            kw[key] = dict(kw.get(key) or {}, **{setting: v})
        for s in seeds:
            tasks.append((v, dict(kw, seed=int(s))))
    n = _workers(n_jobs, len(tasks))
    if n == 1:
        parts = [_run_one(kw) for _, kw in tasks]
    else:
        with ProcessPoolExecutor(max_workers=n) as ex:
            parts = list(ex.map(_run_one, [kw for _, kw in tasks], chunksize=max(1, len(tasks) // (4 * n))))
    for (v, _), df in zip(tasks, parts):
        df.insert(0, setting, v)
    return pd.concat(parts, ignore_index=True)


class Economy:
    """A single economy you can step through month by month and steer.

    >>> e = Economy(seed=74)
    >>> e.warm_up()            # 120 months under the RBI's usual rule, which then stays on
    >>> e.set(repo=0.07)       # raise the repo rate; the RBI rule is switched off
    >>> e.run(12)
    >>> e.history.tail()
    """

    def __init__(self, seed: Optional[int] = None, **params: Any):
        p = dict(params)
        if seed is not None:
            p["seed"] = int(seed)
        self._id = _bridge.call("__new", "sim", json.dumps({"params": p}))

    def __del__(self):
        try:
            _bridge.call("__free", self._id)
        except Exception:
            pass

    def _call(self, method: str, **args: Any) -> Any:
        return _bridge.call("__simCall", self._id, method, json.dumps(args))

    def warm_up(self, rule: bool = True) -> "Economy":
        """Run the warm-up months (until month 0) under the RBI's rule, as every experiment does.

        Afterwards the RBI's rule keeps setting the repo rate if ``rule`` is True; otherwise the
        repo rate stays where the warm-up left it until you change it with :meth:`set`.
        """
        t = int(self._call("state")["t"])
        if t < 0:
            self._call("run", months=-t)
        self._call("set", policy="auto" if rule else None)
        return self

    def run(self, months: int = 1) -> pd.DataFrame:
        """Advance the economy and return the new months."""
        return _frame(self._call("run", months=int(months)))

    def set(self, *, repo: Optional[float] = None, tax: Optional[float] = None, spend: Optional[float] = None,
            rule: Optional[bool] = None, **params: Any) -> "Economy":
        """Change policy or settings from now on.

        Setting ``repo`` switches the RBI's rule off unless ``rule=True`` is also given.
        ``rule=True`` lets the RBI's usual rule set the repo rate each meeting.
        Other keyword arguments change model settings, e.g. ``anchor=0.9``.
        """
        args: dict = {}
        if repo is not None:
            args["repo"] = repo
            args["policy"] = "auto" if rule else None
        elif rule is not None:
            args["policy"] = "auto" if rule else None
        if tax is not None:
            args["tax"] = tax
        if spend is not None:
            args["spend"] = spend
        if params:
            args["params"] = params
        self._call("set", **args)
        return self

    def shock(self, key: str, **opts: Any) -> "Economy":
        """Start a scripted shock now ('monsoon', 'oil' or 'slowdown'); options such as depth=1.0."""
        self._call("set", shock=dict(opts, key=key))
        return self

    @property
    def history(self) -> pd.DataFrame:
        """Every month so far, warm-up included (warm-up months are numbered 0 and below)."""
        return _frame(self._call("state", hist=True)["hist"])

    @property
    def month(self) -> int:
        return int(self._call("state")["t"])

    @property
    def fingerprint(self) -> str:
        """A short code that identifies the economy's exact state; equal runs give equal codes."""
        return self._call("state")["fingerprint"]

    @property
    def accounts_balanced(self) -> bool:
        return bool(self._call("state")["balanced"])

    @property
    def settings(self) -> dict:
        return self._call("state")["params"]


class Game:
    """One of the website's policy games, with the "nothing changed" and "RBI rule" comparison economies."""

    def __init__(self, scenario: str = "monsoon", seed: Optional[int] = None, **params: Any):
        opts = dict(params)
        if seed is not None:
            opts["seed"] = int(seed)
        self._id = _bridge.call("__new", "game", json.dumps({"scenario": scenario, "opts": opts}))

    def __del__(self):
        try:
            _bridge.call("__free", self._id)
        except Exception:
            pass

    def _state(self) -> dict:
        return _bridge.call("__gameCall", self._id, "state", "{}")

    def meeting(self, *, repo: Optional[float] = None, tax: Optional[float] = None,
                spend: Optional[float] = None, shock: Optional[str] = None) -> "Game":
        """Make one decision and advance to the next meeting. Unspecified levers stay unchanged."""
        d = {k: v for k, v in dict(repo=repo, tax=tax, spend=spend, shock=shock).items() if v is not None}
        _bridge.call("__gameCall", self._id, "meeting", json.dumps(d))
        return self

    def play(self, decisions: Iterable[Mapping[str, Any]]) -> "Game":
        for d in decisions:
            if self.done:
                break
            self.meeting(**d)
        return self

    @property
    def done(self) -> bool:
        return bool(self._state()["done"])

    @property
    def month(self) -> int:
        return int(self._state()["month"])

    @property
    def start(self) -> dict:
        return self._state()["start"]

    def score(self) -> Optional[dict]:
        """The end-of-term scorecard (None until the game is over)."""
        return self._state()["score"]

    def history(self, which: str = "player") -> Optional[pd.DataFrame]:
        """Monthly history of ``'player'``, ``'hold'`` (nothing changed) or ``'auto'`` (RBI rule)."""
        h = self._state()[which]
        return None if h is None else _frame(h)


def calibration_targets() -> pd.DataFrame:
    """The Indian data the model was calibrated to (2015–2024), with notes on each statistic."""
    t = json.loads(_bridge._read("targets.json"))["moments"]
    return pd.DataFrame([{"statistic": k, "india": v["value"], "targeted": bool(v["weight"]), "scale": v["scale"],
                          "description": v["note"]} for k, v in t.items()]).set_index("statistic")


def india_data() -> dict:
    """The Indian data series behind the calibration, each with its official source."""
    return json.loads(_bridge._read("india-data.json"))["series"]


def _moment_one(args: tuple) -> dict:
    params, seed, years = args
    return _bridge.call("__moment", json.dumps(params), int(seed), int(years))


def moments(params: Optional[Mapping[str, Any]] = None, seeds: Iterable[int] = range(1, 11), years: int = 20,
            n_jobs: Optional[int] = None) -> pd.DataFrame:
    """Compare the model with India on the calibration statistics.

    Simulates each economy for ``years`` years under the RBI's rule (after the warm-up) and returns,
    for each statistic, the Indian value, the model's average across economies and its 10th–90th
    percentile range. Pass ``params`` to test alternative settings.
    """
    seeds = list(seeds)
    tasks = [(dict(params or {}), s, years) for s in seeds]
    n = _workers(n_jobs, len(tasks))
    if n == 1:
        res = [_moment_one(t) for t in tasks]
    else:
        with ProcessPoolExecutor(max_workers=n) as ex:
            res = list(ex.map(_moment_one, tasks))
    sims = pd.DataFrame([r["m"] for r in res])
    t = calibration_targets()
    out = pd.DataFrame({"india": t["india"], "model": sims.mean(), "model_p10": sims.quantile(0.1),
                        "model_p90": sims.quantile(0.9), "targeted": t["targeted"]}).loc[t.index]
    out["gap_in_scales"] = (out["model"] - out["india"]) / t["scale"]
    out.attrs["balanced"] = all(r["balanced"] for r in res)
    return out
