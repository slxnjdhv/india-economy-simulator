// Recompute the model columns of result.json with the current engine (same settings, no new search).
// Run after engine changes that don't alter the calibrated settings: node refresh.js && node make-report.js
'use strict';
const fs = require('fs'), path = require('path');
const { simulate } = require('./moments.js');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'targets.json'), 'utf8')).moments;
const avg = rs => Object.fromEntries(Object.keys(rs[0].m).map(k => [k, rs.reduce((s, r) => s + r.m[k], 0) / rs.length]));
const fit = R.seeds.map(s => simulate({}, s, R.years));
const check = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(s => simulate({}, s, R.years));
const after = avg(fit);
let loss = 0;
for (const [k, t] of Object.entries(T)) if (t.weight) loss += t.weight * ((after[k] - t.value) / t.scale) ** 2;
for (const k of Object.keys(R.moments)) {
  const v = check.map(r => r.m[k]).sort((a, b) => a - b);
  R.moments[k].after = after[k];
  R.moments[k].range = [v[1], v[8]];
}
R.lossAfter = loss;
R.balanced = fit.concat(check).every(r => r.balanced);
R.refreshed = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify(R, null, 1));
console.log('loss', loss.toFixed(2), 'inflAc1', after.inflAc1.toFixed(3), 'balanced', R.balanced);
