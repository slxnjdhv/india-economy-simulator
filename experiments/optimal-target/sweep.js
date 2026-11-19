// Optimal inflation target sweep, replicating the RBI RCF 2020-21 Annex II.2 exercise in Economy Lab.
// Usage: node sweep.js <target> <seedFrom> <seedTo> <years> <variant>
// variant "shift": neutral rate, rule bounds and moneylender rate move one-for-one with the target
//                  (only the nominal anchor changes; the floor on the repo is the zero lower bound).
// variant "engine": the engine's own rule unchanged (repo bounds 2-14%, r* bounds 2-10%), neutral rate shifted.
const E = require(require('path').join(__dirname, '..', '..', 'prototype', 'engine.js'));
const [target, s0, s1, years, variant] = [parseFloat(process.argv[2]), +process.argv[3], +process.argv[4], +process.argv[5], process.argv[6] || 'shift'];
const D = E.DEFAULTS, shift = target - D.target;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function shiftedRule(sim) {
  const P = sim.P, h = sim.hist[sim.hist.length - 1];
  if (!h) return P.neutralRepo;
  const pi = (1 - P.ruleCore) * h.infl + P.ruleCore * h.coreInfl;
  sim.rStar += P.rStarLearn * ((pi - P.target) - 0.5 * (h.u - P.uNatural));
  sim.rStar = clamp(sim.rStar, 0.02 + shift, 0.10 + shift);
  const x = sim.rStar + P.ruleInfl * (pi - P.target) - P.ruleU * (h.u - P.uNatural);
  return Math.round(clamp(x, Math.max(0, 0.02 + shift), 0.14 + shift) * 400) / 400;
}

const out = [];
for (let seed = s0; seed <= s1; seed++) {
  const params = { seed, target, neutralRepo: D.neutralRepo + shift, repo0: D.repo0 + shift };
  if (variant === 'shift') params.infRate = D.infRate + shift;
  const sim = new E.Sim(params);
  if (variant === 'shift') {
    sim.ruleStep = function () {
      if (this.t % 2 !== 0) return;
      const want = this.P.ruleSmooth * this.repo + (1 - this.P.ruleSmooth) * shiftedRule(this);
      this.repo = Math.max(0, Math.round((this.repo + clamp(want - this.repo, -0.005, 0.005)) * 400) / 400);
    };
  }
  sim.run(sim.P.burnIn);
  sim.policyRule = 'auto';
  const lnY = [], infl = [], u = [], disp = [], repo = [];
  let maxRes = 0;
  for (let m = 0; m < 12 * years; m++) {
    const r = sim.step();
    lnY.push(Math.log(r.Y)); infl.push(r.infl); u.push(r.u); repo.push(r.repo);
    maxRes = Math.max(maxRes, Math.abs(r.residual) / Math.max(r.money, 1));
    // cross-firm price dispersion: std of log prices within each sector, CPI-weighted
    const sd = food => {
      const xs = [];
      for (let f = 0; f < sim.F; f++) if (!!sim.isFood[f] === food) xs.push(Math.log(sim.p[f]));
      const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length);
    };
    disp.push(D.foodWeight * sd(true) + (1 - D.foodWeight) * sd(false));
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const vari = a => { const m = mean(a); return mean(a.map(x => (x - m) ** 2)); };
  out.push({
    target, seed, variant,
    outVar: vari(lnY),                 // variance of log output around its mean (output volatility)
    meanY: mean(lnY),                  // average log output (level)
    meanU: mean(u), meanInfl: mean(infl), sdInfl: Math.sqrt(vari(infl)),
    disp: mean(disp),                  // average cross-firm price dispersion
    zlbShare: mean(repo.map(r => (r <= 0.0001 ? 1 : 0))),
    balanced: maxRes < 1e-9,
  });
}
process.stdout.write(JSON.stringify(out));
