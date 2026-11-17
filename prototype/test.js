// Headless checks for the prototype engine. Run: node test.js
const { Sim, Game, MONSOON } = require('./engine.js');

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
function play(path) {
  const g = new Game();
  while (!g.done) g.meeting(path(g.month));
  return g;
}
const r0 = new Game().startRepo;
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

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
