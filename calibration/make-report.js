// Build prototype/calibration.html from result.json, targets.json and india-data.json.
// Run after calibrate.js: node make-report.js
'use strict';
const fs = require('fs');
const path = require('path');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'targets.json'), 'utf8'));
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'india-data.json'), 'utf8')).series;

const LABELS = {
  foodSd: ['Random harvest shocks', 'Monthly size of random changes in farm output (log points)'],
  oilSd: ['Random world oil-price shocks', 'Monthly size of random changes in the world price of imported inputs'],
  demSd: ['Random demand shocks', 'Monthly size of random changes in spending confidence'],
  erNoise: ['Capital-flow noise in the rupee', 'Monthly random movement in the rupee'],
  worldInfl: ['World inflation', 'Inflation in the rest of the world, per year'],
  importShare: ['Imported inputs', 'Share of imported inputs in firms’ unit costs'],
  informal: ['Informal sector size', 'Model setting; see the informal share of jobs below'],
  uNatural: ['Natural unemployment rate', 'Unemployment at which wages grow in line with expected inflation'],
  gstAuto: ['GST level', 'GST relative to the tax lost on informal wages'],
  anchor: ['Expectations anchoring', 'How strongly expected inflation sticks to the 4% target (0–1)'],
  calvo: ['Price flexibility', 'Share of firms that change their prices each month'],
  foodRho: ['Persistence of harvest shocks', 'Share of this month’s harvest shock still present next month'],
  oilRho: ['Persistence of oil-price shocks', 'Share of this month’s oil-price shock still present next month'],
  erRho: ['Persistence of capital-flow swings', 'How long swings in the rupee’s underlying value last'],
  wageIndex: ['Wage indexation', 'Share of wage rises linked to last year’s inflation rather than expected inflation'],
  ruleSmooth: ['RBI rate smoothing', 'Share of the previous repo rate the RBI keeps at each meeting'],
};
const PCT_P = new Set(['worldInfl', 'importShare', 'informal', 'uNatural', 'calvo', 'wageIndex']);
const fmtP = (k, v) => v == null ? '—' : PCT_P.has(k) ? (100 * v).toFixed(1) + '%' : (+v).toFixed(3);
const PCT_M = k => k !== 'inflAc1';
const fmtM = (k, v) => v == null || !isFinite(v) ? '—' : PCT_M(k) ? (100 * v).toFixed(1) + '%' : v.toFixed(2);

const rows = Object.entries(R.moments).map(([k, v]) => {
  const t = T.moments[k] || {};
  const err = Math.abs(v.after - v.data) / (t.scale || 1);
  const fit = err < 1 ? 'good' : err < 2 ? 'fair' : 'poor';
  return `<tr><th scope="row">${t.note || k}</th><td>${fmtM(k, v.data)}</td><td>${fmtM(k, v.before)}</td><td><b>${fmtM(k, v.after)}</b><span class="rng">${fmtM(k, v.range[0])} – ${fmtM(k, v.range[1])}</span></td><td><span class="fit ${fit}">${fit === 'good' ? 'Close' : fit === 'fair' ? 'Fair' : 'Off'}</span>${v.targeted ? '' : ' <span class="tag">check</span>'}</td></tr>`;
}).join('');
const prow = Object.entries(R.params).map(([k, v]) => `<tr><th scope="row">${LABELS[k] ? LABELS[k][0] : k}<span class="desc">${LABELS[k] ? LABELS[k][1] : ''}</span></th><td>${fmtP(k, R.handTuned[k])}</td><td><b>${fmtP(k, v)}</b></td></tr>`).join('');
const srcs = Object.entries(D).map(([k, s]) => `<li><b>${s.label || k.replace(/_/g, ' ')}</b>: ${s.url ? `<a href="${s.url}">${s.source || s.url}</a>` : (s.source || '')}${s.notes ? `. <span class="small">${s.notes}</span>` : ''}</li>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Economy Lab Calibration</title>
<link rel="stylesheet" href="shared.css">
<style>
  main.wrap { max-width: 1060px; display: flex; flex-direction: column; gap: 16px; }
  .lead p { max-width: 72ch; }
  .lead p { margin-bottom: 8px; }
  .big { font: 600 28px/1.2 var(--serif); color: var(--ink); margin: 4px 0 8px; text-wrap: balance; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .stat { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .stat .v { font: 600 24px/1.1 var(--serif); color: var(--ink); font-variant-numeric: tabular-nums; }
  .stat .k { font-size: 12.5px; color: var(--muted); }
  .tbl { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 13.5px; font-variant-numeric: tabular-nums; }
  th, td { padding: 7px 10px; border-bottom: 1px solid var(--line); text-align: right; vertical-align: top; }
  th[scope=row], thead th:first-child { text-align: left; font-weight: 500; color: var(--ink); min-width: 220px; }
  thead th { color: var(--muted); font-weight: 600; font-size: 12.5px; }
  .rng, .desc { display: block; font-size: 11.5px; color: var(--muted); font-weight: 400; }
  .fit { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
  .fit.good { color: var(--good); background: var(--chip); } .fit.fair { color: var(--accent); background: var(--chip); } .fit.poor { color: var(--bad); background: var(--chip); }
  .tag { font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 1px 6px; white-space: nowrap; }
  ul.src { padding-left: 18px; margin: 0; overflow-wrap: anywhere; } ul.src li { margin-bottom: 6px; } ul.src a { color: var(--accent); }
  code { overflow-wrap: anywhere; }
  header.top nav { flex-wrap: wrap; }
  ol.how { padding-left: 20px; margin: 0; max-width: 70ch; } ol.how li { margin-bottom: 6px; }
</style>
</head>
<body>
<header class="top">
  <h1>Economy Lab</h1>
  <nav aria-label="Pages"><a href="index.html">Play a scenario</a><a href="lessons.html">Lessons</a><a href="lab.html">Experiment Lab</a><a href="calibration.html" aria-current="page">Calibration</a></nav>
  <span class="tag" style="margin-left:auto;color:var(--accent-light);border:0;letter-spacing:1.5px;text-transform:uppercase">Working prototype</span>
</header>
<main class="wrap">
  <section class="card lead">
    <h3>Calibration report · ${R.date}</h3>
    <p class="big">How closely the model matches India, ${T.period.replace(' (annual)', '')}</p>
    <p>The model’s settings were chosen so that its economy reproduces key features of Indian data: how high and how variable inflation is, how much food prices swing, unemployment, the repo rate, the rupee, imports and the informal share of jobs.</p>
    <p class="small">Method: simulated method of moments. Each candidate set of settings was run on ${R.seeds.length} economies for ${R.years} years each. The program then adjusted the settings to minimise the gap to the data. In total it tried ${R.evaluations} sets of settings, in ${R.seconds} seconds.</p>
  </section>
  <section class="stats">
    <div class="stat"><div class="v">${R.lossBefore.toFixed(1)} → ${R.lossAfter.toFixed(1)}</div><div class="k">Distance from the data (lower is better), hand-tuned → calibrated</div></div>
    <div class="stat"><div class="v">${Object.values(R.moments).filter(v => v.targeted).length}</div><div class="k">Features of the data targeted</div></div>
    <div class="stat"><div class="v">${Object.values(R.moments).filter(v => !v.targeted).length}</div><div class="k">Features kept back to check the model</div></div>
    <div class="stat"><div class="v">${R.balanced ? '✓' : '✗'}</div><div class="k">Accounts balanced in every simulated month</div></div>
  </section>
  <section class="card">
    <h2>Model versus data</h2>
    <p class="small" style="margin-bottom:8px">Calibrated values are averages over ${R.seeds.length} economies. The small range below each one shows the 2nd-lowest to 2nd-highest value across 10 new economies the calibration never saw. Rows marked “check” were not targeted, so they test the model honestly.</p>
    <div class="tbl"><table><thead><tr><th>Feature of the economy</th><th>India</th><th>Hand-tuned model</th><th>Calibrated model</th><th>Fit</th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>
  <section class="card">
    <h2>Settings chosen</h2>
    <div class="tbl"><table><thead><tr><th>Setting</th><th>Hand-tuned</th><th>Calibrated</th></tr></thead><tbody>${prow}</tbody></table></div>
  </section>
  <section class="card">
    <h2>Limits</h2>
    <ol class="how">
      <li>This is a calibration, not a full statistical estimation: ten years of annual data can’t pin down every setting precisely.</li>
      <li>Definitions differ. Model unemployment is matched to PLFS usual-status unemployment, and the model’s trade balance is compared with India’s current account, which also includes remittances that the model leaves out.</li>
      <li>The model has no trend growth, so only the size of swings in GDP growth is compared.</li>
      <li><b>Average inflation is too low.</b> The model averages about 4%, India about 5%. In the model the RBI meets its 4% target on average, while India’s inflation ran above target, especially in 2020–22.</li>
      <li><b>Inflation persistence is now close but slightly low.</b> India’s figure is ${R.moments.inflAc1.data.toFixed(2)}; the model’s is about ${R.moments.inflAc1.after.toFixed(2)}. With only ten years of data, India’s figure is uncertain by roughly ±0.3. The model’s persistence comes from two sources. Wage-setters who don’t trust the 4% target link pay to last year’s inflation. And oil, harvest and capital-flow shocks are long-lasting, as they are in reality. An earlier version swung the wrong way (−0.3), because its shocks faded within months and its RBI over-corrected.</li>
      <li><b>World inflation is set low (under 1%).</b> It stands in for every reason the rupee drifts down by about 3% a year, such as capital flows, not only price differences.</li>
      <li><b>No current-account deficit.</b> The model has no remittances or foreign investment, so its trade balances out over time, while India runs a deficit of about 1% of GDP.</li>
      <li><b>GDP swings are a little too large</b> (about 2.0% against India’s 1.4%).</li>
    </ol>
  </section>
  <section class="card">
    <h2>Data sources</h2>
    <ul class="src">${srcs}</ul>
    <p class="small" style="margin-top:10px">Reproduce: <code>cd calibration && node build-targets.js && node calibrate.js && node make-report.js</code></p>
  </section>
</main>
<p class="disclaimer">A teaching prototype by Dr Sulaxan. Calibrated to match broad features of Indian data; not a forecast.</p>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, '..', 'prototype', 'calibration.html'), html);
console.log('wrote prototype/calibration.html');
