// Headless checks for the prototype engine. Run: node test.js
const { Sim, Game, SCENARIOS } = require('./engine.js');

let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };
const pct = x => (100 * x).toFixed(2) + '%';
const avg = (a, k) => a.reduce((s, r) => s + r[k], 0) / a.length;

// 1. Baseline: no shocks, repo held at 6%, ten years after burn-in
const { taylorRule } = require('./engine.js');
const base = new Sim({ shocks: [] });
base.policyRule = s => taylorRule(s, 0.02, 0.14); // an RBI that keeps following its usual rule
base.run(base.P.burnIn + 120);
const h = base.hist.filter(r => r.t >= 0);
for (let y = 0; y < 10; y++) {
  const yr = h.slice(y * 12, y * 12 + 12);
  console.log(`year ${y + 1}: inflation ${pct(avg(yr, 'infl'))}  food ${pct(avg(yr, 'foodInfl'))}  core ${pct(avg(yr, 'coreInfl'))}  unemployment ${pct(avg(yr, 'u'))}  output ${avg(yr, 'Y').toFixed(0)}`);
}
check(Math.abs(avg(h, 'infl') - 0.04) < 0.015, 'baseline inflation stays near 4% (' + pct(avg(h, 'infl')) + ')');
check(avg(h, 'u') > 0.03 && avg(h, 'u') < 0.12, 'baseline unemployment is plausible (' + pct(avg(h, 'u')) + ')');
const maxRes = Math.max(...base.hist.map(r => Math.abs(r.residual)));
check(maxRes < 1e-6 * base.hist[base.hist.length - 1].money, 'accounting balances every month (max residual ' + maxRes.toExponential(2) + ')');

// 2. Determinism
const a = new Sim({ seed: 7 }), b = new Sim({ seed: 7 }), c = new Sim({ seed: 8 });
a.run(80); b.run(80); c.run(80);
check(a.hash() === b.hash(), 'same seed gives identical economy (' + a.hash() + ')');
check(a.hash() !== c.hash(), 'different seed gives a different economy');

// 3. Monsoon scenario: hold vs hike
function play(path, id = 'monsoon') {
  const g = new Game(id);
  while (!g.done) g.meeting({ repo: path(g.month) });
  return g;
}
const r0 = new Game('monsoon').startRepo;
const hold = play(() => r0);
const hike = play(m => (m >= 4 ? r0 + 0.01 : r0));
console.log('starting repo', pct(r0));
const show = (name, g) => {
  const r = g.player.hist.filter(x => x.t >= 0);
  console.log(name.padEnd(6), r.filter((_, i) => i % 3 === 2).map(x => `m${x.t + 1}:${pct(x.infl)}/${pct(x.u)}`).join(' '));
};
show('hold', hold); show('hike', hike);
const H = hold.player.hist.filter(x => x.t >= 0), K = hike.player.hist.filter(x => x.t >= 0);
const peak = Math.max(...H.map(x => x.infl));
check(peak > 0.06, 'failed monsoon pushes inflation above 6% (peak ' + pct(peak) + ')');
const late = (arr, k) => avg(arr.slice(12), k);
check(late(K, 'infl') < late(H, 'infl') - 0.002, `hiking lowers inflation in year 2 (${pct(late(H, 'infl'))} → ${pct(late(K, 'infl'))})`);
check(late(K, 'u') > late(H, 'u'), `hiking raises unemployment in year 2 (${pct(late(H, 'u'))} → ${pct(late(K, 'u'))})`);
check(hike.hold.hash() === hold.player.hash(), 'the "no change" economy matches a hold-only run');
console.log('scores: hold', hold.score().grade, hold.score().loss.toFixed(2), ' hike', hike.score().grade, hike.score().loss.toFixed(2));

// 4. Other scenarios behave as their stories say
const late2 = (g, k) => avg(g.player.hist.filter(x => x.t >= 12), k);
const oilHold = play(() => r0, 'oil');
check(Math.max(...oilHold.player.hist.filter(x => x.t >= 0).map(x => x.coreInfl)) > 0.055, 'oil shock raises core inflation, not just food');
const budget = (tax, spend) => { const g = new Game('budget'); while (!g.done) g.meeting({ tax, spend }); return g; };
const bHold = budget(0.10, 0.06), bStim = budget(0.08, 0.09);
check(late2(bStim, 'u') < late2(bHold, 'u'), `fiscal stimulus lowers unemployment in the slowdown (${pct(late2(bHold, 'u'))} → ${pct(late2(bStim, 'u'))})`);
check(late2(bStim, 'defRatio') > late2(bHold, 'defRatio'), `stimulus widens the deficit (${pct(late2(bHold, 'defRatio'))} → ${pct(late2(bStim, 'defRatio'))} of GDP)`);
const sb = new Game('sandbox'); sb.meeting({ shock: 'monsoon' }); sb.meeting({});
check(sb.player.shocks.length === 1 && sb.hold.shocks.length === 1, 'sandbox shocks hit both the player and comparison economies');

// 5. A large economy behaves like the standard one
const big = new Sim({ households: 10000, firms: 1000, foodFirms: 300, shocks: [] });
big.run(big.P.burnIn + 60);
const bh = big.hist.slice(-60);
check(Math.abs(avg(bh, 'infl') - 0.04) < 0.02 && avg(bh, 'u') < 0.12, `10,000-household economy is stable (inflation ${pct(avg(bh, 'infl'))}, unemployment ${pct(avg(bh, 'u'))})`);

// 6. Open economy and informal sector
{
  const E = require('./engine.js');
  const mean = (a, i, j) => { let x = 0; for (let k = i; k < j; k++) x += a[k]; return x / (j - i); };
  const F = ['infl', 'u', 'er', 'tradeBal', 'infShare'];
  const b = E.runLab({ seed: 28, months: 36, fields: F, policy: { mode: 'fixed' } });
  const o = E.runLab({ seed: 28, months: 36, fields: F, policy: { mode: 'fixed' }, shocks: [{ key: 'oil', start: 2 }] });
  const h = E.runLab({ seed: 28, months: 36, fields: F, policy: { mode: 'fixed', repoDelta: 0.02 } });
  check(Math.abs(mean(b.tradeBal, 0, 36)) < 0.01, `trade is roughly balanced without shocks (${pct(mean(b.tradeBal, 0, 36))} of GDP)`);
  check(o.er[11] > b.er[11] * 1.01 && mean(o.tradeBal, 2, 14) < mean(b.tradeBal, 2, 14) - 0.01,
    `oil shock weakens the rupee (${pct(o.er[11] / b.er[11] - 1)}) and opens a trade deficit`);
  check(h.er[5] < b.er[5] * 0.99, `a rate hike strengthens the rupee (${pct(h.er[5] / b.er[5] - 1)})`);
  const s0 = mean(b.infShare, 0, 12), s1 = mean(b.infShare, 24, 36);
  check(s0 > 0.5 && s0 < 0.9 && Math.abs(s1 - s0) < 0.03, `informal share of jobs is stable (${pct(s0)} → ${pct(s1)})`);
  let dLo = 0, dHi = 0;
  for (const seed of [28, 3, 57, 90, 11]) {
    for (const [inf, add] of [[0.1, x => { dLo += x; }], [0.6, x => { dHi += x; }]]) {
      const P = { informal: inf };
      const x = E.runLab({ seed, months: 24, params: P, fields: ['infl'], policy: { mode: 'fixed' } });
      const y = E.runLab({ seed, months: 24, params: P, fields: ['infl'], policy: { mode: 'fixed', repoDelta: 0.02 } });
      add(mean(x.infl, 12, 24) - mean(y.infl, 12, 24));
    }
  }
  check(dHi < dLo, `a larger informal sector weakens the effect of a rate hike on inflation (${pct(dLo / 5)} → ${pct(dHi / 5)})`);
}

// 7. Calibration: the default model still matches the Indian data it was calibrated to
{
  const path = require('path'), fs = require('fs');
  const tp = path.join(__dirname, '..', 'calibration', 'targets.json');
  if (fs.existsSync(tp)) {
    const T = JSON.parse(fs.readFileSync(tp, 'utf8')).moments;
    const { simulate } = require('../calibration/moments.js');
    const rs = [1, 2, 3, 4].map(seed => simulate({}, seed, 20).m);
    const off = Object.entries(T).filter(([, t]) => t.weight).filter(([k, t]) => Math.abs(rs.reduce((x, m) => x + m[k], 0) / rs.length - t.value) > 3 * t.scale).map(([k]) => k);
    check(off.length <= 1, `calibrated model matches Indian data on the targeted features${off.length ? ' (off: ' + off.join(', ') + ')' : ''}`);
  }
}

// 8. The Python package carries an exact copy of this engine
{
  const fs = require('fs'), path = require('path');
  const py = path.join(__dirname, '..', 'python', 'src', 'indiasim', 'data', 'engine.js');
  if (fs.existsSync(py)) check(fs.readFileSync(py, 'utf8') === fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'), 'Python package engine is in sync (run python/sync_engine.py if not)');
}

// 9. Guided lessons: every lesson teaches the intended result in several students' economies
globalThis.EconEngine = require('./engine.js');
require('./lessons-data.js');
const { LESSONS, grade } = globalThis.EconLessons;
const expect = { monsoon: 0, phillips: 0, transmission: 0, anchor: null, multiplier: null, rupee: 0, luck: null };
(async () => {
  for (const L of LESSONS) {
    let ok = true, why = '';
    for (const seed of [17, 404, 2025]) {
      const d = await L.run(seed, async () => {});
      const act = L.predict.actual(d);
      if (expect[L.id] !== null && act !== expect[L.id]) { ok = false; why = `seed ${seed}: outcome ${act}`; }
      for (const q of L.questions) {
        const a = q.answer(d);
        if (q.type === 'num' && !isFinite(a)) { ok = false; why = `seed ${seed}: answer not a number`; }
        if (!grade(q, d, q.type === 'mcq' ? a : a.toFixed(2)).ok) { ok = false; why = `seed ${seed}: correct answer graded wrong`; }
      }
    }
    check(ok, `lesson "${L.title}" gives the intended result and grades correctly${why ? ' (' + why + ')' : ''}`);
  }
  // trust in the target: with random shocks the effect is clear in most economies, not every one
  const A = LESSONS.find(l => l.id === 'anchor');
  let hits = 0;
  for (let k = 1; k <= 12; k++) if (A.predict.actual(await A.run(k * 97, async () => {})) === 1) hits++;
  check(hits >= 8, `trust lesson: high inflation lasts longer without trust in most economies (${hits} of 12)`);
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
