"""Runs the Economy Lab engine (the same JavaScript file the website uses) inside an embedded V8.

Every process gets its own JavaScript context, created on first use. The engine computes
exp, log, pow and cos with portable code, so results match the website bit for bit.
"""
from __future__ import annotations

import json
from importlib import resources
from typing import Any

_CTX = None

_HELPERS = r"""
var __objs = {}, __next = 1;
var __moments = (function () {
  var module = { exports: {} };
  var require = function () { return EconEngine; };
  %MOMENTS%
  return module.exports;
})();
function __maxRes(hist) {
  var m = 0;
  for (var i = 0; i < hist.length; i++) m = Math.max(m, Math.abs(hist[i].residual) / Math.max(hist[i].money, 1));
  return m;
}
function __run(cfgJson) {
  var cfg = JSON.parse(cfgJson);
  var sim = EconEngine.labSim(cfg);
  var start = sim.hist[sim.hist.length - 1];
  var recs = [], warm = cfg.includeWarmup ? sim.hist.slice() : [];
  for (var i = 0; i < cfg.months; i++) recs.push(sim.step());
  var all = warm.concat(recs);
  return JSON.stringify({ records: all, start: { Y: start.Y, gdp: start.gdp }, startRepo: recs.length ? recs[0].repo : sim.repo,
    fingerprint: sim.hash(), balanced: __maxRes(recs) < 1e-9, params: sim.P });
}
function __new(kind, argsJson) {
  var a = JSON.parse(argsJson), o;
  if (kind === 'sim') o = new EconEngine.Sim(a.params);
  else o = new EconEngine.Game(a.scenario, a.opts);
  var id = __next++; __objs[id] = o; return id;
}
function __free(id) { delete __objs[id]; return true; }
function __simCall(id, method, argsJson) {
  var s = __objs[id], a = JSON.parse(argsJson);
  if (method === 'run') { var n0 = s.hist.length; s.run(a.months); return JSON.stringify(s.hist.slice(n0)); }
  if (method === 'set') {
    if (a.repo != null) s.repo = a.repo;
    if (a.tax != null) s.taxRate = a.tax;
    if (a.spend != null) s.govShare = a.spend;
    if (a.policy !== undefined) s.policyRule = a.policy;
    if (a.params) Object.assign(s.P, a.params);
    if (a.shock) s.shocks.push(Object.assign({}, EconEngine.SHOCKS[a.shock.key], a.shock, { start: a.shock.start != null ? a.shock.start : s.t }));
    return 'true';
  }
  if (method === 'state') return JSON.stringify({ t: s.t, repo: s.repo, tax: s.taxRate, spend: s.govShare, fingerprint: s.hash(),
    balanced: __maxRes(s.hist) < 1e-9, params: s.P, hist: a.hist ? s.hist : undefined });
  throw new Error('unknown method ' + method);
}
function __gameCall(id, method, argsJson) {
  var g = __objs[id], a = JSON.parse(argsJson);
  if (method === 'meeting') { g.meeting(a); return 'true'; }
  if (method === 'shock') { g.addShock(a.key); return 'true'; }
  if (method === 'state') {
    var h = function (s) { return s ? s.hist : null; };
    return JSON.stringify({ month: g.month, done: g.done, scenario: g.scenario, start: g.start, decisions: g.decisions,
      score: g.done ? g.score() : null, player: h(g.player), hold: h(g.hold), auto: h(g.auto), fingerprint: g.player.hash() });
  }
  throw new Error('unknown method ' + method);
}
function __moment(paramsJson, seed, years) {
  return JSON.stringify(__moments.simulate(JSON.parse(paramsJson), seed, years));
}
"""


def _read(name: str) -> str:
    return resources.files("indiasim").joinpath("data", name).read_text(encoding="utf-8")


def ctx():
    """The JavaScript context for this process, with the engine loaded."""
    global _CTX
    if _CTX is None:
        from py_mini_racer import MiniRacer
        c = MiniRacer()
        c.eval(_read("engine.js"))
        c.eval(_HELPERS.replace("%MOMENTS%", _read("moments.js")))
        _CTX = c
    return _CTX


def call(fn: str, *args: Any) -> Any:
    """Call a helper function and decode its JSON result."""
    out = ctx().call(fn, *args)
    return json.loads(out) if isinstance(out, str) else out


def engine_value(expr: str) -> Any:
    return json.loads(ctx().eval(f"JSON.stringify({expr})"))
