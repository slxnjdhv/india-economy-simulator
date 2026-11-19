const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'runs');
const rows = fs.readdirSync(dir).flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f))));
console.log('runs', rows.length, 'all balanced', rows.every(r => r.balanced));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const key = t => t.toFixed(3);
const result = {};
for (const v of ['shift', 'engine']) {
  const x = rows.filter(r => r.variant === v);
  const targets = [...new Set(x.map(r => key(r.target)))].sort((a, b) => a - b);
  const seeds = [...new Set(x.map(r => r.seed))].sort((a, b) => a - b);
  const by = {}; for (const r of x) by[key(r.target) + '|' + r.seed] = r;
  const agg = (idx, f) => Object.fromEntries(targets.map(t => [t, mean(idx.map(s => f(by[t + '|' + s])))]));
  const all = seeds;
  const summary = idx => {
    const o = agg(idx, r => r.outVar), d = agg(idx, r => r.disp);
    const loss = Object.fromEntries(targets.map(t => [t, 0.5 * o[t] / o['0.040'] + 0.5 * d[t] / d['0.040']]));
    return { o, d, loss };
  };
  const S = summary(all);
  const tab = targets.map(t => ({
    target: +t * 100,
    infl: 100 * agg(all, r => r.meanInfl)[t], sdInfl: 100 * agg(all, r => r.sdInfl)[t],
    outN: S.o[t] / S.o['0.040'], dispN: S.d[t] / S.d['0.040'], loss: S.loss[t],
    u: 100 * agg(all, r => r.meanU)[t], Ylevel: 100 * (agg(all, r => r.meanY)[t] - agg(all, r => r.meanY)['0.040']),
    zlb: 100 * agg(all, r => r.zlbShare)[t],
  }));
  // bootstrap over economies: where does the equal-weight loss bottom out?
  let st = 12345; const rnd = () => (st = (st * 1103515245 + 12345) % 2147483648) / 2147483648;
  const am = [];
  for (let b = 0; b < 2000; b++) {
    const idx = seeds.map(() => seeds[Math.floor(rnd() * seeds.length)]);
    const L = summary(idx).loss; am.push(+targets.reduce((a, t) => (L[t] < L[a] ? t : a)));
  }
  am.sort((a, b) => a - b);
  const q = p => 100 * am[Math.floor(p * (am.length - 1))];
  const argmin = obj => 100 * +targets.reduce((a, t) => (obj[t] < obj[a] ? t : a));
  console.log(`\n== ${v}`);
  console.table(tab.map(r => Object.fromEntries(Object.entries(r).map(([k, val]) => [k, +val.toFixed(3)]))));
  console.log('loss minimised at', argmin(S.loss), '% | output volatility minimised at', argmin(S.o), '% | bootstrap 5/50/95%:', q(0.05), q(0.5), q(0.95));
  result[v] = { tab, argminLoss: argmin(S.loss), argminOut: argmin(S.o), boot: [q(0.05), q(0.5), q(0.95)], seeds: seeds.length };
}
fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify(result, null, 1));
