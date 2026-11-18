// Turn the Indian data in india-data.json into the target moments in targets.json.
// Every number used is listed with its source in india-data.json. Run: node build-targets.js
'use strict';
const fs = require('fs');
const path = require('path');
const { mean, sd, ac1 } = require('./moments.js');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'india-data.json'), 'utf8')).series;

const vals = (name, from, to) => {
  const s = D[name];
  if (!s) throw new Error('missing series ' + name);
  return Object.entries(s.values).filter(([k, v]) => v != null && k.slice(0, 4) >= from && k.slice(0, 4) <= to).sort().map(([, v]) => v);
};

// Repo rate: average of the daily rate in each calendar year, from the list of policy changes
function repoAnnual(from, to) {
  const ev = Object.entries(D.rbi_policy_repo_rate.values).map(([d, v]) => [new Date(d), v]).sort((a, b) => a[0] - b[0]);
  const out = {};
  for (let y = from; y <= to; y++) {
    let tot = 0, days = 0;
    for (let t = new Date(Date.UTC(y, 0, 1)); t < new Date(Date.UTC(y + 1, 0, 1)); t = new Date(t.getTime() + 864e5)) {
      let r = null; for (const [d, v] of ev) if (d <= t) r = v;
      if (r != null) { tot += r; days++; }
    }
    out[y] = tot / days;
  }
  return out;
}

const Y0 = '2015', Y1 = '2024';
const infl = vals('cpi_inflation', Y0, Y1).map(x => x / 100);
const food = vals('cfpi_food_inflation', Y0, Y1).map(x => x / 100);
const core = D.core_cpi_inflation_ex_food_fuel ? vals('core_cpi_inflation_ex_food_fuel', Y0, Y1).map(x => x / 100) : [];
const er = vals('inr_per_usd', '2014', Y1);
const erChg = er.slice(1).map((x, i) => x / er[i] - 1);
const ca = vals('current_account_pct_gdp', Y0, Y1).map(x => x / 100);
const imp = vals('imports_goods_services_pct_gdp', Y0, Y1).map(x => x / 100);
const gdpG = Object.entries(D.real_gdp_growth.values).filter(([k, v]) => v != null && k >= Y0 && k <= Y1 && !['2020', '2021'].includes(k.slice(0, 4))).map(([, v]) => v / 100);
const ur = vals('plfs_unemployment_rate_usual_status_15plus', '2017', Y1).map(x => x / 100);
const repo = Object.values(repoAnnual(+Y0, +Y1)).map(x => x / 100);
const informal = mean(vals('informal_sector_share_nonagri_workers', '2021', '2023')) / 100;

const m = (value, scale, weight, note) => ({ value, scale, weight, note });
const T = {
  period: `${Y0}–${Y1} (annual)`,
  moments: {
    inflMean: m(mean(infl), 0.005, 1, 'CPI (combined) inflation, mean'),
    inflSd: m(sd(infl), 0.004, 1, 'CPI inflation, standard deviation across years'),
    foodSd: m(sd(food), 0.008, 1, 'Food (CFPI) inflation, standard deviation'),
    coreSd: core.length > 3 ? m(sd(core), 0.005, 0, 'Core inflation, standard deviation (not targeted: used to check the model)') : undefined,
    inflAc1: m(ac1(infl), 0.15, 1, 'CPI inflation, year-to-year persistence (autocorrelation)'),
    uMean: m(mean(ur), 0.005, 1, 'PLFS unemployment, usual status, age 15+, mean'),
    repoMean: m(mean(repo), 0.004, 1, 'RBI repo rate, mean'),
    repoSd: m(sd(repo), 0.004, 0, 'RBI repo rate, standard deviation (not targeted)'),
    erChgMean: m(mean(erChg), 0.005, 1, 'Rupee per US$, average yearly change'),
    erChgSd: m(sd(erChg), 0.01, 1, 'Rupee per US$, standard deviation of yearly change'),
    tbMean: m(mean(ca), 0.005, 0, 'Current account, % of GDP (not targeted: the model has no remittances or foreign investment)'),
    importsGdp: m(mean(imp), 0.02, 1, 'Imports of goods and services, % of GDP'),
    informal: m(informal, 0.03, 1, 'Informal sector share of non-farm jobs (PLFS 2021-22 to 2023-24)'),
    growthSd: m(sd(gdpG), 0.008, 1, 'Real GDP growth, standard deviation (excluding the 2020–21 pandemic years)'),
  },
};
for (const k of Object.keys(T.moments)) if (!T.moments[k]) delete T.moments[k];
fs.writeFileSync(path.join(__dirname, 'targets.json'), JSON.stringify(T, null, 1));
console.table(Object.fromEntries(Object.entries(T.moments).map(([k, v]) => [k, { value: +v.value.toFixed(4), targeted: !!v.weight }])));
