/*
 * Economy Lab — prototype engine
 * A small agent-based model of an Indian-style economy:
 * 1,000 households, 100 firms (30 food, 70 non-food), a banking sector, the RBI and the government.
 * Every rupee moves between accounts, and an accounting check runs every month.
 * Runs in the browser (window.EconEngine) and in Node (require('./engine.js')).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EconEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- deterministic randomness: one stream per (seed, month, phase) ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mix(a, b, c) {
    let h = 2166136261 >>> 0;
    for (const x of [a, b, c]) {
      h ^= x >>> 0; h = Math.imul(h, 16777619) >>> 0;
      h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
    }
    return h;
  }
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  const DEFAULTS = {
    seed: 28,
    households: 1000, firms: 100, foodFirms: 30,
    foodWeight: 0.46,          // food share of household budgets and of CPI (India CPI ≈ 46%)
    productivity: 3, wage0: 100, markup: 0.3,
    burnIn: 120,                // months simulated before the game starts
    target: 0.04,              // RBI inflation target
    neutralRepo: 0.06, repo0: 0.06, rStarLearn: 0.05,
    loanSpread: 0.03, depSpread: 0.005,
    anchor: 0.5,               // how strongly expectations stick to the 4% target
    expLearn: 0.12,            // how fast expectations follow actual inflation
    phillips: 0.6, uNatural: 0.07, vacPremium: 0.001,
    calvo: 0.35, priceCut: 0.5,               // share of firms that reprice each month
    invTarget: 0.5, muInv: 0.05, invAdj: 0.2,
    fireCap: 0.25, quitRate: 0.01, searchTries: 6, resDecay: 0.95,
    taxRate: 0.10, transferRatio: 0.3, govShare: 0.06,
    aInc: 0.9, aW: 0.05, cSens: 1.0,   // consumption out of income and wealth; sensitivity to real interest
    iShare: 0.10, iSens: 7,            // investment spending and its sensitivity to real loan rates
    foodDecay: 0.10, goodsDecay: 0.02,
    switchProb: 0.05,
    shocks: [],
  };

  // RBI-style rule: respond to inflation and unemployment around a neutral rate that is re-estimated over time
  function taylorRule(sim, lo = 0.04, hi = 0.09) {
    const h = sim.hist[sim.hist.length - 1];
    if (!h) return sim.P.neutralRepo;
    sim.rStar += sim.P.rStarLearn * ((h.infl - sim.P.target) - 0.5 * (h.u - sim.P.uNatural));
    sim.rStar = clamp(sim.rStar, 0.02, 0.10);
    const x = sim.rStar + 1.5 * (h.infl - sim.P.target) - 0.5 * (h.u - sim.P.uNatural);
    return Math.round(clamp(x, lo, hi) * 400) / 400;
  }

  class Sim {
    constructor(opts) {
      const P = this.P = Object.assign({}, DEFAULTS, opts || {});
      const H = this.H = P.households, F = this.F = P.firms;
      this.t = -P.burnIn;
      this.repo = P.repo0;
      this.rStar = P.neutralRepo;
      this.policyRule = null;

      this.emp = new Int32Array(H).fill(-1);
      this.m = new Float64Array(H);
      this.resW = new Float64Array(H);
      this.yhat = new Float64Array(H);
      this.inc = new Float64Array(H);
      this.partners = new Int32Array(H * 5); // 2 food + 3 non-food sellers per household

      this.isFood = new Uint8Array(F);
      this.p = new Float64Array(F); this.w = new Float64Array(F);
      this.lam = new Float64Array(F); this.lamEff = new Float64Array(F);
      this.inv = new Float64Array(F); this.ed = new Float64Array(F);
      this.sales = new Float64Array(F); this.rev = new Float64Array(F);
      this.d = new Float64Array(F); this.L = new Float64Array(F);
      this.n = new Int32Array(F); this.vac = new Int32Array(F); this.unfilled = new Int32Array(F);
      this.invest = new Float64Array(F); this.investSpent = new Float64Array(F);
      this.gov = 0; this.bankEq = 0;

      const nEmp = Math.round(H * (1 - P.uNatural));
      const nFoodW = Math.round(nEmp * 0.39);
      const nNon = F - P.foodFirms;
      for (let i = 0; i < nEmp; i++) {
        this.emp[i] = i < nFoodW ? i % P.foodFirms : P.foodFirms + ((i - nFoodW) % nNon);
      }
      for (let i = 0; i < H; i++) if (this.emp[i] >= 0) this.n[this.emp[i]]++;
      for (let f = 0; f < F; f++) {
        this.isFood[f] = f < P.foodFirms ? 1 : 0;
        this.lam[f] = this.lamEff[f] = P.productivity;
        this.w[f] = P.wage0;
        this.p[f] = (1 + P.markup) * P.wage0 / P.productivity;
        this.ed[f] = this.sales[f] = this.n[f] * P.productivity;
        this.inv[f] = P.invTarget * this.ed[f];
        this.rev[f] = this.sales[f] * this.p[f];
        this.d[f] = 1.5 * this.n[f] * this.w[f];
      }
      const r = mulberry32(mix(P.seed, 0, 99));
      for (let i = 0; i < H; i++) {
        const y = this.emp[i] >= 0 ? P.wage0 * (1 - P.taxRate) : P.transferRatio * P.wage0;
        this.yhat[i] = y; this.m[i] = (1 - P.aInc) / P.aW * y; this.resW[i] = P.wage0;
        for (let k = 0; k < 5; k++) this.partners[i * 5 + k] = this.randFirm(r, k < 2);
      }
      let money = 0;
      for (let i = 0; i < H; i++) money += this.m[i];
      for (let f = 0; f < F; f++) money += this.d[f];
      this.gov = -money; // the starting money stock is treated as past government spending

      this.gUnits = P.govShare * nEmp * P.productivity;
      this.p0 = (1 + P.markup) * P.wage0 / P.productivity;
      this.pf = this.pn = this.p0;
      this.uLast = P.uNatural;
      this.piE = this.piAd = P.target;
      this.lastY = nEmp * P.productivity;
      this.hist = [];
    }

    randFirm(r, food) {
      const P = this.P;
      return food ? Math.floor(r() * P.foodFirms) : P.foodFirms + Math.floor(r() * (this.F - P.foodFirms));
    }
    perm(r) {
      const a = new Int32Array(this.H);
      for (let i = 0; i < a.length; i++) a[i] = i;
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
      return a;
    }
    shockFactor(f, t) {
      let k = 1;
      for (const s of this.P.shocks) {
        if (s.sector === 'food' && !this.isFood[f]) continue;
        const end = s.start + s.months, rec = s.recover || 0;
        if (t >= s.start && t < end) k *= 1 - s.depth;
        else if (t >= end && t < end + rec) k *= 1 - s.depth * (1 - (t - end + 1) / (rec + 1));
      }
      return k;
    }
    rates() {
      const P = this.P;
      return { repo: this.repo, loan: this.repo + P.loanSpread, deposit: Math.max(0, this.repo - P.depSpread) };
    }

    // buy goods from a list of sellers, cheapest first; returns money spent
    buyFrom(sellers, budget) {
      sellers.sort((a, b) => this.p[a] - this.p[b]);
      let spent = 0;
      for (const f of sellers) {
        if (budget - spent <= 1e-9) break;
        const q = Math.min((budget - spent) / this.p[f], this.inv[f]);
        if (q <= 0) continue;
        const v = q * this.p[f];
        this.inv[f] -= q; this.sales[f] += q; this.rev[f] += v; this.d[f] += v; spent += v;
      }
      return spent;
    }

    step() {
      const P = this.P, H = this.H, F = this.F, t = this.t;
      const R = k => mulberry32(mix(P.seed, t + 1000003, k));
      const { p, w, lamEff, inv, ed, sales, rev, d, L, n, vac, unfilled, invest, investSpent, emp, m, inc } = this;

      // 1. shocks
      for (let f = 0; f < F; f++) lamEff[f] = this.lam[f] * this.shockFactor(f, t);

      // 2. policy: during warm-up an RBI-style rule steers the economy; from month 0 the player decides
      if (t < 0 && t % 2 === 0) { // warm-up MPC: meets every two months, moves at most 50 basis points
        const want = taylorRule(this, 0.02, 0.14);
        this.repo = Math.round((this.repo + clamp(want - this.repo, -0.005, 0.005)) * 400) / 400;
      }
      else if (this.policyRule) this.repo = this.policyRule(this);
      const rt = this.rates();
      const piE = this.piE, pim = Math.pow(1 + piE, 1 / 12) - 1;
      const nRealLoan = P.neutralRepo + P.loanSpread - P.target;
      const nRealDep = P.neutralRepo - P.depSpread - P.target;
      const iFactor = clamp(1 - P.iSens * (rt.loan - piE - nRealLoan), 0.3, 1.5);
      const aInc = clamp(P.aInc - P.cSens * (rt.deposit - piE - nRealDep), 0.75, 0.98);

      // 3. firms plan output, wages and prices
      let r = R(1);
      const fire = new Int32Array(F);
      for (let f = 0; f < F; f++) {
        ed[f] = 0.6 * ed[f] + 0.4 * sales[f];
        const want = Math.max(this.lam[f], ed[f] + P.invAdj * (P.invTarget * ed[f] - inv[f]));
        const nStar = Math.max(1, Math.round(want / this.lam[f])); // a bad harvest cannot be fixed by hiring more
        w[f] *= 1 + pim + P.phillips * (P.uNatural - this.uLast) / 12 + (unfilled[f] > 0 ? P.vacPremium : 0);
        const ratio = inv[f] / Math.max(ed[f], 1e-9);
        const mu = clamp(P.markup + P.muInv * (P.invTarget - ratio), 0.02, 0.6);
        if (r() < P.calvo) {
          const target = (1 + mu) * w[f] / lamEff[f];
          p[f] = target >= p[f] ? target : p[f] - P.priceCut * (p[f] - target); // prices fall more slowly than they rise
        }
        vac[f] = Math.max(0, nStar - n[f]);
        fire[f] = Math.max(0, Math.min(n[f] - nStar, Math.ceil(P.fireCap * n[f])));
        invest[f] = P.iShare * rev[f] * iFactor;
      }

      // layoffs and quits
      r = R(2);
      let order = this.perm(r);
      for (let k = 0; k < H; k++) {
        const i = order[k], f = emp[i];
        if (f < 0) continue;
        if (fire[f] > 0) { emp[i] = -1; fire[f]--; n[f]--; }
        else if (r() < P.quitRate) { emp[i] = -1; n[f]--; }
      }

      // 4. credit: firms borrow to cover wages and investment
      for (let f = 0; f < F; f++) {
        const need = (n[f] + vac[f]) * w[f] + invest[f];
        if (d[f] < need) { const b = need - d[f] + 0.1 * n[f] * w[f]; L[f] += b; d[f] += b; }
      }

      // 5. labour market: the unemployed visit random firms
      r = R(3);
      for (let k = 0; k < H; k++) {
        const i = order[k];
        if (emp[i] >= 0) continue;
        let hired = false;
        for (let s = 0; s < P.searchTries; s++) {
          const f = Math.floor(r() * F);
          if (vac[f] > 0 && w[f] >= this.resW[i]) { emp[i] = f; n[f]++; vac[f]--; this.resW[i] = w[f]; hired = true; break; }
        }
        if (!hired) this.resW[i] *= P.resDecay;
      }
      for (let f = 0; f < F; f++) unfilled[f] = vac[f];

      // 6. production
      let Y = 0;
      for (let f = 0; f < F; f++) { const y = lamEff[f] * n[f]; inv[f] += y; Y += y; }

      // 7. wages, taxes and transfers
      let wages = 0, employed = 0;
      for (let i = 0; i < H; i++) {
        const f = emp[i];
        if (f < 0) continue;
        const pay = w[f], tax = pay * P.taxRate;
        d[f] -= pay; this.gov += tax; m[i] += pay - tax; inc[i] += pay - tax;
        wages += pay; employed++;
      }
      const transfer = P.transferRatio * (employed ? wages / employed : P.wage0);
      for (let i = 0; i < H; i++) if (emp[i] < 0) { this.gov -= transfer; m[i] += transfer; inc[i] += transfer; }

      // 8. goods market
      sales.fill(0); rev.fill(0); investSpent.fill(0);
      r = R(4);
      order = this.perm(r);
      let consumption = 0;
      const food = [0, 0], non = [0, 0, 0];
      for (let k = 0; k < H; k++) {
        const i = order[k], b = i * 5;
        this.yhat[i] = 0.7 * this.yhat[i] + 0.3 * inc[i]; inc[i] = 0;
        // occasionally compare prices with a random seller and switch away from the dearest one
        for (let s = 0; s < 2; s++) {
          if (r() >= P.switchProb) continue;
          const isF = s === 0, lo = isF ? 0 : 2, hi = isF ? 2 : 5;
          const cand = this.randFirm(r, isF);
          let worst = lo, dup = false;
          for (let j = lo; j < hi; j++) {
            if (this.partners[b + j] === cand) dup = true;
            if (p[this.partners[b + j]] > p[this.partners[b + worst]]) worst = j;
          }
          if (!dup && p[cand] < 0.98 * p[this.partners[b + worst]]) this.partners[b + worst] = cand;
        }
        const C = Math.min(m[i], aInc * this.yhat[i] + P.aW * m[i]);
        food[0] = this.partners[b]; food[1] = this.partners[b + 1];
        non[0] = this.partners[b + 2]; non[1] = this.partners[b + 3]; non[2] = this.partners[b + 4];
        const spent = this.buyFrom(food, C * P.foodWeight) + this.buyFrom(non, C * (1 - P.foodWeight));
        m[i] -= spent; consumption += spent;
      }
      // government buys non-food goods and services
      const G = this.gUnits * this.pn;
      let gSpent = 0;
      for (let s = 0; s < 40 && G - gSpent > 1e-6; s++) gSpent += this.buyFrom([this.randFirm(r, false)], G - gSpent);
      this.gov -= gSpent;
      // firms buy capital goods from non-food firms
      let I = 0;
      for (let f = 0; f < F; f++) {
        let spent = 0;
        for (let s = 0; s < 6 && invest[f] - spent > 1e-6; s++) {
          const g = this.randFirm(r, false);
          if (g === f) continue;
          spent += this.buyFrom([g], invest[f] - spent);
        }
        d[f] -= spent; investSpent[f] = spent; I += spent;
      }

      // 9. interest, loan repayment, dividends
      let pool = 0;
      for (let f = 0; f < F; f++) {
        const interest = L[f] * rt.loan / 12;
        d[f] -= interest; this.bankEq += interest;
        const wb = n[f] * w[f];
        const profit = rev[f] - wb - interest - investSpent[f];
        if (L[f] > 0 && d[f] > 1.2 * wb) { const x = Math.min(L[f], d[f] - 1.2 * wb); L[f] -= x; d[f] -= x; }
        if (L[f] === 0 && profit > 0 && d[f] > 1.2 * wb) { const x = Math.min(0.9 * profit, d[f] - 1.2 * wb); d[f] -= x; pool += x; }
        if (d[f] < 0) { L[f] -= d[f]; d[f] = 0; }
        inv[f] *= 1 - (this.isFood[f] ? P.foodDecay : P.goodsDecay);
      }
      // the bank passes the interest it earns on loans to depositors, in proportion to their deposits
      if (this.bankEq > 0) {
        let dep = 0;
        for (let i = 0; i < H; i++) dep += m[i];
        const rate = Math.min(this.bankEq / Math.max(dep, 1e-9), rt.deposit / 12);
        for (let i = 0; i < H; i++) { const x = m[i] * rate; m[i] += x; inc[i] += x; this.bankEq -= x; }
        pool += this.bankEq; this.bankEq = 0;
      }
      const share = pool / H;
      for (let i = 0; i < H; i++) { m[i] += share; inc[i] += share; }

      // 10. accounting check: every rupee is someone's asset and someone's liability
      let money = this.gov + this.bankEq, loans = 0;
      for (let i = 0; i < H; i++) money += m[i];
      for (let f = 0; f < F; f++) { money += d[f]; loans += L[f]; }
      const residual = money - loans;

      // 11. statistics
      // price index like CPI: posted prices weighted by each firm's usual sales
      let fq = 0, fv = 0, nq = 0, nv = 0;
      for (let f = 0; f < F; f++) {
        if (this.isFood[f]) { fq += ed[f]; fv += ed[f] * p[f]; } else { nq += ed[f]; nv += ed[f] * p[f]; }
      }
      if (fq > 0) this.pf = fv / fq;
      if (nq > 0) this.pn = nv / nq;
      const cpi = P.foodWeight * this.pf / this.p0 + (1 - P.foodWeight) * this.pn / this.p0;
      const u = 1 - employed / H;
      const prev = this.hist.length >= 12 ? this.hist[this.hist.length - 12] : null;
      const infl = prev ? cpi / prev.cpi - 1 : P.target;
      const foodInfl = prev ? (this.pf / this.p0) / prev.pfi - 1 : P.target;
      const coreInfl = prev ? (this.pn / this.p0) / prev.pni - 1 : P.target;
      this.piAd += P.expLearn * (infl - this.piAd);
      this.piE = P.anchor * P.target + (1 - P.anchor) * this.piAd;
      this.uLast = u;
      const rec = {
        t, repo: this.repo, loanRate: rt.loan, cpi, pfi: this.pf / this.p0, pni: this.pn / this.p0,
        infl, foodInfl, coreInfl, u, Y, C: consumption, I, G: gSpent, piE: this.piE, aInc, iFactor,
        wage: employed ? wages / employed : 0, residual, loans, money: money - this.gov - this.bankEq,
      };
      this.hist.push(rec);
      this.t++;
      return rec;
    }

    run(months) { let r; for (let k = 0; k < months; k++) r = this.step(); return r; }

    hash() {
      let h = 2166136261 >>> 0;
      const buf = new Float64Array(1), u32 = new Uint32Array(buf.buffer);
      const eat = x => { buf[0] = x; h = Math.imul(h ^ u32[0], 16777619) >>> 0; h = Math.imul(h ^ u32[1], 16777619) >>> 0; };
      for (let f = 0; f < this.F; f++) { eat(this.p[f]); eat(this.w[f]); eat(this.d[f]); eat(this.L[f]); }
      for (let i = 0; i < this.H; i++) { eat(this.m[i]); eat(this.emp[i]); }
      return h.toString(16).padStart(8, '0');
    }
  }

  // ---------- the RBI Governor scenario ----------
  const MONSOON = {
    id: 'rbi-monsoon',
    title: 'RBI Governor: The Failed Monsoon',
    months: 24, meetingEvery: 2,
    shocks: [{ sector: 'food', start: 3, months: 9, recover: 12, depth: 0.06 }],
  };

  // The game keeps two economies with identical households, firms and luck:
  // one follows the player's repo decisions, the other keeps the repo rate unchanged.
  class Game {
    constructor(opts) {
      const o = Object.assign({ shocks: MONSOON.shocks }, opts || {});
      this.scenario = MONSOON;
      this.player = new Sim(o);
      this.hold = new Sim(o);
      this.player.run(this.player.P.burnIn);
      this.hold.run(this.hold.P.burnIn);
      this.startRepo = this.player.repo;
    }
    get month() { return this.player.t; }
    get done() { return this.player.t >= this.scenario.months; }
    meeting(repo) {
      this.player.repo = repo;
      for (let k = 0; k < this.scenario.meetingEvery && !this.done; k++) { this.player.step(); this.hold.step(); }
    }
    score() {
      const h = this.player.hist.filter(r => r.t >= 0);
      if (!h.length) return null;
      const inflGap = h.reduce((s, r) => s + Math.abs(r.infl - 0.04), 0) / h.length;
      const uGap = h.reduce((s, r) => s + Math.max(0, r.u - 0.07), 0) / h.length;
      const inBand = h.filter(r => r.infl >= 0.02 && r.infl <= 0.06).length / h.length;
      const loss = inflGap * 100 + 0.5 * uGap * 100;
      const grade = loss < 2.0 ? 'A' : loss < 2.4 ? 'B' : loss < 2.9 ? 'C' : 'D';
      return { inflGap, uGap, inBand, loss, grade };
    }
  }

  return { Sim, Game, MONSOON, DEFAULTS, taylorRule, mulberry32 };
});
