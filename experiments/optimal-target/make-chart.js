// Draws chart.svg from result.json: four panels against the inflation target.
const fs = require('fs'), path = require('path');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'result.json')));
const panels = [
  { key: 'outN', title: 'Output volatility (4% target = 1)' },
  { key: 'dispN', title: 'Price dispersion across firms (4% = 1)' },
  { key: 'u', title: 'Average unemployment, %' },
  { key: 'loss', title: 'Combined loss, equal weights (4% = 1)', rbi: true },
];
const W = 360, H = 230, M = { l: 46, r: 14, t: 30, b: 36 }, cols = 2;
const svgW = cols * W, svgH = Math.ceil(panels.length / cols) * H + 34;
const ink = '#1f2a37', grid = '#d9dee5', c1 = '#b4532a', c2 = '#2f6f8f', rbi = '#6b7280';
let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" font-family="Helvetica, Arial, sans-serif" font-size="11">`;
s += `<rect width="100%" height="100%" fill="#ffffff"/>`;
panels.forEach((p, i) => {
  const ox = (i % cols) * W, oy = Math.floor(i / cols) * H;
  const series = ['shift', 'engine'].map(v => R[v].tab.map(r => [r.target, r[p.key]]));
  const ys = series.flat().map(d => d[1]);
  let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const X = t => ox + M.l + (t / 8) * (W - M.l - M.r), Y = v => oy + M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
  s += `<text x="${ox + M.l}" y="${oy + 18}" fill="${ink}" font-weight="bold">${p.title}</text>`;
  for (let k = 0; k <= 4; k++) {
    const v = lo + (k / 4) * (hi - lo);
    s += `<line x1="${X(0)}" x2="${X(8)}" y1="${Y(v)}" y2="${Y(v)}" stroke="${grid}"/>`;
    s += `<text x="${X(0) - 6}" y="${Y(v) + 4}" text-anchor="end" fill="${ink}">${v.toFixed(2)}</text>`;
  }
  for (let t = 0; t <= 8; t += 2) s += `<text x="${X(t)}" y="${oy + H - M.b + 16}" text-anchor="middle" fill="${ink}">${t}%</text>`;
  if (p.rbi) {
    s += `<rect x="${X(4.5)}" y="${oy + M.t}" width="${X(5.5) - X(4.5)}" height="${H - M.t - M.b}" fill="${rbi}" opacity="0.12"/>`;
    s += `<text x="${X(5)}" y="${oy + M.t + 12}" text-anchor="middle" fill="${rbi}">RBI annex: ~5%</text>`;
  }
  series.forEach((d, j) => {
    const pts = d.map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="${j ? c2 : c1}" stroke-width="2" ${j ? 'stroke-dasharray="5 4"' : ''}/>`;
  });
  const best = series[0].reduce((a, b) => (b[1] < a[1] ? b : a));
  s += `<circle cx="${X(best[0])}" cy="${Y(best[1])}" r="4" fill="${c1}"/>`;
});
s += `<text x="${svgW / 2}" y="${svgH - 18}" text-anchor="middle" fill="${ink}">Inflation target. Each point: average of the same 100 economies over 20 years after a 10-year warm-up. Dot: lowest point.</text>`;
s += `<line x1="${svgW / 2 - 250}" x2="${svgW / 2 - 225}" y1="${svgH - 4}" y2="${svgH - 4}" stroke="${c1}" stroke-width="2"/><text x="${svgW / 2 - 220}" y="${svgH}" fill="${ink}">rule bounds and neutral rate move with the target (main)</text>`;
s += `<line x1="${svgW / 2 + 70}" x2="${svgW / 2 + 95}" y1="${svgH - 4}" y2="${svgH - 4}" stroke="${c2}" stroke-width="2" stroke-dasharray="5 4"/><text x="${svgW / 2 + 100}" y="${svgH}" fill="${ink}">engine's own rule bounds (2–14%)</text>`;
s += `</svg>`;
fs.writeFileSync(path.join(__dirname, 'chart.svg'), s);
console.log('wrote chart.svg');
