// Simulated moments: run one economy for many years under the RBI's rule and summarise it
// the same way the Indian data are summarised (annual averages and year-on-year changes).
'use strict';
const E = require('../prototype/engine.js');

const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const ac1 = a => { const m = mean(a); let n = 0, d = 0; for (let i = 0; i < a.length; i++) { d += (a[i] - m) ** 2; if (i) n += (a[i] - m) * (a[i - 1] - m); } return n / d; };

// Annual summaries of a monthly history (only months after the warm-up)
function annual(hist, years) {
  const h = hist.filter(r => r.t >= 0);
  const out = [];
  for (let y = 0; y < years; y++) {
    const m = h.slice(12 * y, 12 * y + 12);
    if (m.length < 12) break;
    const avg = k => mean(m.map(r => r[k]));
    out.push({
      infl: avg('infl'), food: avg('foodInfl'), core: avg('coreInfl'), u: avg('u'), repo: avg('repo'),
      er: avg('er'), tb: avg('tradeBal'), inf: avg('infShareNF'), Y: avg('Y'),
      M: m.reduce((s, r) => s + r.M, 0) / m.reduce((s, r) => s + r.gdp, 0),
      def: m.reduce((s, r) => s + r.deficit, 0) / m.reduce((s, r) => s + r.gdp, 0),
    });
  }
  return out;
}

// Moment definitions shared by the data and the model
function momentsFromAnnual(a) {
  const growth = (k) => a.slice(1).map((r, i) => r[k] / a[i][k] - 1);
  return {
    inflMean: mean(a.map(r => r.infl)),
    inflSd: sd(a.map(r => r.infl)),
    inflAc1: ac1(a.map(r => r.infl)),
    foodSd: sd(a.map(r => r.food)),
    coreSd: sd(a.map(r => r.core)),
    uMean: mean(a.map(r => r.u)),
    repoMean: mean(a.map(r => r.repo)),
    repoSd: sd(a.map(r => r.repo)),
    erChgMean: mean(growth('er')),
    erChgSd: sd(growth('er')),
    tbMean: mean(a.map(r => r.tb)),
    tbSd: sd(a.map(r => r.tb)),
    importsGdp: mean(a.map(r => r.M)),
    informal: mean(a.map(r => r.inf)),
    growthSd: sd(growth('Y')),
  };
}

function simulate(params, seed, years) {
  const s = new E.Sim(Object.assign({}, params, { seed }));
  s.run(s.P.burnIn);
  s.policyRule = 'auto';
  s.run(12 * years);
  const a = annual(s.hist, years);
  let maxRes = 0;
  for (const r of s.hist) maxRes = Math.max(maxRes, Math.abs(r.residual) / Math.max(r.money, 1));
  return { m: momentsFromAnnual(a), balanced: maxRes < 1e-9 };
}

module.exports = { simulate, momentsFromAnnual, mean, sd, ac1 };
