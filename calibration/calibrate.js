// Calibrate the Economy Lab model to Indian data by the simulated method of moments.
// For each candidate set of parameters, simulate several 20-year economies (same seeds every time,
// so the objective is smooth), compute the same summary statistics as in the data, and minimise
// the weighted distance with Nelder–Mead. Run: node calibrate.js [maxEvals]
'use strict';
const { Worker, isMainThread, parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const os = require('os');

if (!isMainThread) {
  const { simulate } = require('./moments.js');
  parentPort.on('message', ({ id, params, seed, years }) => {
    const r = simulate(params, seed, years);
    parentPort.postMessage({ id, r });
  });
  return;
}

const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'targets.json'), 'utf8'));
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const YEARS = 20;

// Parameters being calibrated: name, lower bound, upper bound, starting value
// the original hand-tuned model, shown as the "before" column in the report
const HAND = { foodSd: 0, foodRho: 0.9, oilSd: 0, oilRho: 0.9, demSd: 0, erNoise: 0.004, erRho: 0, worldInfl: 0.02, importShare: 0.15,
  informal: 0.4, uNatural: 0.07, gstAuto: 1.3, anchor: 0.5, calvo: 0.35, wageIndex: 0, ruleSmooth: 0 };
// starting point: the current defaults, with the new persistence settings set to plausible values
const START = Object.assign({ foodRho: 0.97, oilRho: 0.97, erRho: 0.98, erNoise: 0.004, wageIndex: 0.5, ruleSmooth: 0.3 },
  process.env.START ? JSON.parse(process.env.START) : {});
const D0 = require('../prototype/engine.js').DEFAULTS;
const SPACE = [
  ['foodSd', 0, 0.10], ['foodRho', 0.7, 0.995],
  ['oilSd', 0, 0.20], ['oilRho', 0.7, 0.995],
  ['demSd', 0, 0.03],
  ['erNoise', 0, 0.03], ['erRho', 0.5, 0.995],
  ['worldInfl', 0, 0.05],
  ['importShare', 0.05, 0.40],
  ['informal', 0.1, 1.0],
  ['uNatural', 0.02, 0.10],
  ['gstAuto', 0.9, 1.7],
  ['anchor', 0, 0.95],
  ['calvo', 0.1, 0.7],
  ['wageIndex', 0, 0.9],
  ['ruleSmooth', 0, 0.8],
].map(([k, lo, hi]) => [k, lo, hi, Math.min(hi - 0.02 * (hi - lo), Math.max(lo + 0.02 * (hi - lo), START[k] != null ? START[k] : D0[k]))]);
// map an unbounded vector to the box with a logistic transform, so Nelder–Mead needs no constraints
const toParams = x => Object.fromEntries(SPACE.map(([k, lo, hi], i) => [k, lo + (hi - lo) / (1 + Math.exp(-x[i]))]));
const fromParams = p => SPACE.map(([k, lo, hi]) => { const z = (p[k] - lo) / (hi - lo); return Math.log(z / (1 - z)); });

// ---- worker pool ----
const N = Math.max(1, Math.min(SEEDS.length, os.cpus().length - 1));
const workers = Array.from({ length: N }, () => new Worker(__filename));
let nextId = 0; const pending = new Map();
workers.forEach(w => w.on('message', ({ id, r }) => { pending.get(id)(r); pending.delete(id); }));
let rr = 0;
const runOne = (params, seed) => new Promise(res => { const id = nextId++; pending.set(id, res); workers[rr++ % N].postMessage({ id, params, seed, years: YEARS }); });

async function modelMoments(params) {
  const rs = await Promise.all(SEEDS.map(s => runOne(params, s)));
  const keys = Object.keys(rs[0].m);
  const m = Object.fromEntries(keys.map(k => [k, rs.reduce((s, r) => s + r.m[k], 0) / rs.length]));
  return { m, balanced: rs.every(r => r.balanced) };
}
function loss(m) {
  let L = 0;
  for (const [k, t] of Object.entries(T.moments)) if (t.weight) L += t.weight * ((m[k] - t.value) / t.scale) ** 2;
  return L;
}

// ---- Nelder–Mead ----
async function nelderMead(f, x0, step, maxEvals) {
  const n = x0.length;
  let evals = 0;
  const F = async x => { evals++; return f(x); };
  let simplex = [x0];
  for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += step; simplex.push(x); }
  let vals = [];
  for (const x of simplex) vals.push(await F(x));
  while (evals < maxEvals) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    simplex = order.map(i => simplex[i]); vals = order.map(i => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < 1e-4 * (Math.abs(vals[0]) + 1e-9)) break;
    const c = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    const pt = a => c.map((cj, j) => cj + a * (simplex[n][j] - cj));
    const xr = pt(-1), fr = await F(xr);
    if (fr < vals[0]) {
      const xe = pt(-2), fe = await F(xe);
      if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; }
    else {
      const xc = fr < vals[n] ? pt(-0.5) : pt(0.5), fc = await F(xc);
      if (fc < Math.min(fr, vals[n])) { simplex[n] = xc; vals[n] = fc; }
      else {
        for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); vals[i] = await F(simplex[i]); }
      }
    }
    if (evals % 25 < n + 2) console.log(`  ${evals} evaluations, best loss ${vals[0].toFixed(3)}`);
  }
  return { x: simplex[0], fx: vals[0], evals };
}

(async () => {
  const maxEvals = +process.argv[2] || 500;
  const D = require('../prototype/engine.js').DEFAULTS;
  const start = Object.fromEntries(SPACE.map(([k, , , v]) => [k, v]));
  const before = await modelMoments(HAND);
  console.log(`Hand-tuned model: loss ${loss(before.m).toFixed(2)}`);
  const f = async x => loss((await modelMoments(toParams(x))).m);
  const t0 = Date.now();
  // two restarts: Nelder–Mead can stall, so restart from the best point with a fresh simplex
  let best = { x: fromParams(start), fx: Infinity };
  for (const step of [1.0, 0.4]) {
    const r = await nelderMead(f, best.x, step, Math.round(maxEvals / 2));
    if (r.fx < best.fx) best = r;
    console.log(`Round done: loss ${best.fx.toFixed(3)} after ${r.evals} evaluations`);
  }
  const params = toParams(best.x);
  const after = await modelMoments(params);
  // more seeds for an honest final comparison, with spread across economies
  const check = await Promise.all([11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(s => runOne(params, s)));
  const spread = Object.fromEntries(Object.keys(after.m).map(k => { const v = check.map(r => r.m[k]).sort((a, b) => a - b); return [k, [v[1], v[8]]]; }));
  const out = {
    date: new Date().toISOString().slice(0, 10), seeds: SEEDS, years: YEARS, evaluations: best.evals, seconds: Math.round((Date.now() - t0) / 1000),
    lossBefore: loss(before.m), lossAfter: loss(after.m), balanced: after.balanced && check.every(r => r.balanced),
    params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, +v.toPrecision(4)])),
    handTuned: Object.fromEntries(SPACE.map(([k]) => [k, HAND[k] != null ? HAND[k] : D[k]])),
    moments: Object.fromEntries(Object.entries(T.moments).map(([k, t]) => [k, { data: t.value, before: before.m[k], after: after.m[k], range: spread[k], targeted: !!t.weight }])),
  };
  fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify(out, null, 1));
  console.log(`Loss ${out.lossBefore.toFixed(2)} → ${out.lossAfter.toFixed(2)} in ${out.seconds}s`);
  console.table(Object.fromEntries(Object.entries(out.moments).map(([k, v]) => [k, { data: +v.data.toFixed(4), handTuned: +v.before.toFixed(4), calibrated: +v.after.toFixed(4), targeted: v.targeted }])));
  console.log(out.params);
  workers.forEach(w => w.terminate());
})();
