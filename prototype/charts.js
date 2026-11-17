/* Economy Lab: small canvas charts that read colours from the page's theme tokens. */
(function (root) {
  'use strict';
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function setup(c) {
    const dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    c.width = Math.max(1, W * dpr); c.height = Math.max(1, H * dpr);
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    return { g, W, H };
  }
  function niceStep(x) {
    if (!(x > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  const fmt = (v, step) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0);

  // opt: { series: [{ data: [{x,y}], color, width, dash: 'dash'|'dot', stepped, band: [{x,lo,hi}] }],
  //        xMin, xMax, xTicks: [values], xLabel: fn, bandY: [lo,hi], shade: [{from,to,label,color}], marker: x, minSpan }
  function line(c, opt) {
    const { g, W, H } = setup(c);
    const L = 40, R = 10, T = 10, B = 24;
    const xMin = opt.xMin, xMax = opt.xMax;
    let lo = Infinity, hi = -Infinity;
    for (const s of opt.series) {
      for (const r of s.data) if (isFinite(r.y)) { lo = Math.min(lo, r.y); hi = Math.max(hi, r.y); }
      for (const r of s.band || []) { lo = Math.min(lo, r.lo); hi = Math.max(hi, r.hi); }
    }
    if (opt.bandY) { lo = Math.min(lo, opt.bandY[0]); hi = Math.max(hi, opt.bandY[1]); }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const pad = Math.max((hi - lo) * 0.1, (opt.minSpan || 0.5) / 2); lo -= pad; hi += pad;
    const X = x => L + (W - L - R) * (x - xMin) / Math.max(xMax - xMin, 1e-9);
    const Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    for (const s of opt.shade || []) {
      g.fillStyle = s.color || tok('--monsoon');
      const a = X(Math.max(s.from, xMin)), b = X(Math.min(s.to, xMax));
      if (b > a) { g.fillRect(a, T, b - a, H - T - B); g.fillStyle = tok('--muted'); g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText(s.label || '', a + 4, T + 12); }
    }
    if (opt.bandY) { g.fillStyle = tok('--band'); g.fillRect(L, Y(opt.bandY[1]), W - L - R, Y(opt.bandY[0]) - Y(opt.bandY[1])); }
    const step = niceStep((hi - lo) / 4);
    g.strokeStyle = tok('--grid'); g.fillStyle = tok('--muted'); g.lineWidth = 1; g.font = '11px sans-serif'; g.textAlign = 'right';
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
      g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(W - R, Y(v)); g.stroke();
      g.fillText(fmt(v, step), L - 6, Y(v) + 4);
    }
    g.textAlign = 'center';
    for (const t of opt.xTicks || []) g.fillText(opt.xLabel ? opt.xLabel(t) : String(t), X(t), H - 6);
    if (opt.marker !== undefined) {
      g.strokeStyle = tok('--zero'); g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(opt.marker), T); g.lineTo(X(opt.marker), H - B); g.stroke(); g.setLineDash([]);
    }
    for (const s of opt.series) {
      if (s.band && s.band.length) {
        g.globalAlpha = 0.16; g.fillStyle = s.color; g.beginPath();
        s.band.forEach((r, i) => (i ? g.lineTo(X(r.x), Y(r.hi)) : g.moveTo(X(r.x), Y(r.hi))));
        for (let i = s.band.length - 1; i >= 0; i--) g.lineTo(X(s.band[i].x), Y(s.band[i].lo));
        g.closePath(); g.fill(); g.globalAlpha = 1;
      }
      if (!s.data.length) continue;
      g.strokeStyle = s.color; g.lineWidth = s.width || 2.2;
      g.setLineDash(s.dash === 'dash' ? [6, 4] : s.dash === 'dot' ? [2, 4] : []);
      g.beginPath();
      s.data.forEach((r, i) => {
        const x = X(r.x), y = Y(r.y);
        if (i === 0) g.moveTo(x, y);
        else if (s.stepped) { g.lineTo(x, Y(s.data[i - 1].y)); g.lineTo(x, y); }
        else g.lineTo(x, y);
      });
      g.stroke(); g.setLineDash([]);
      if (s.end) { const r = s.data[s.data.length - 1]; g.fillStyle = s.color; g.beginPath(); g.arc(X(r.x), Y(r.y), 3.5, 0, 7); g.fill(); }
    }
  }

  // Scatter with a connecting path and an optional straight reference line.
  // opt: { points: [{x,y}], color, ref: {x0,y0,x1,y1,color,label}, xLabel, yLabel }
  function scatter(c, opt) {
    const { g, W, H } = setup(c);
    const L = 40, R = 12, T = 10, B = 30;
    const xs = opt.points.map(p => p.x), ys = opt.points.map(p => p.y);
    if (opt.ref) { xs.push(opt.ref.x0, opt.ref.x1); }
    let xlo = Math.min(...xs), xhi = Math.max(...xs), ylo = Math.min(...ys), yhi = Math.max(...ys);
    const px = Math.max((xhi - xlo) * 0.1, 0.5), py = Math.max((yhi - ylo) * 0.1, 0.5);
    xlo -= px; xhi += px; ylo -= py; yhi += py;
    const X = x => L + (W - L - R) * (x - xlo) / (xhi - xlo), Y = v => T + (H - T - B) * (1 - (v - ylo) / (yhi - ylo));
    g.strokeStyle = tok('--grid'); g.fillStyle = tok('--muted'); g.font = '11px sans-serif'; g.lineWidth = 1;
    const sy = niceStep((yhi - ylo) / 4), sx = niceStep((xhi - xlo) / 5);
    g.textAlign = 'right';
    for (let v = Math.ceil(ylo / sy) * sy; v <= yhi; v += sy) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(W - R, Y(v)); g.stroke(); g.fillText(fmt(v, sy), L - 6, Y(v) + 4); }
    g.textAlign = 'center';
    for (let v = Math.ceil(xlo / sx) * sx; v <= xhi; v += sx) g.fillText(fmt(v, sx), X(v), H - 14);
    if (opt.xLabel) g.fillText(opt.xLabel, (L + W - R) / 2, H - 1);
    if (opt.ref) {
      const r = opt.ref;
      g.save(); g.beginPath(); g.rect(L, T, W - L - R, H - T - B); g.clip();
      g.strokeStyle = r.color; g.setLineDash([6, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(X(r.x0), Y(r.y0)); g.lineTo(X(r.x1), Y(r.y1)); g.stroke(); g.setLineDash([]);
      g.restore();
    }
    g.strokeStyle = opt.color; g.globalAlpha = 0.35; g.lineWidth = 1.2; g.beginPath();
    opt.points.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); g.stroke(); g.globalAlpha = 1;
    opt.points.forEach((p, i) => {
      g.fillStyle = opt.color; g.globalAlpha = 0.25 + 0.75 * (i + 1) / opt.points.length;
      g.beginPath(); g.arc(X(p.x), Y(p.y), i === opt.points.length - 1 ? 5 : 3, 0, 7); g.fill();
    });
    g.globalAlpha = 1;
  }

  // Points with whiskers: opt { points: [{x, y, lo, hi, label}], color, xLabel }
  function whisker(c, opt) {
    const { g, W, H } = setup(c);
    const L = 44, R = 14, T = 10, B = 32;
    const n = opt.points.length;
    let lo = Math.min(...opt.points.map(p => p.lo)), hi = Math.max(...opt.points.map(p => p.hi));
    const pad = Math.max((hi - lo) * 0.12, 0.2); lo -= pad; hi += pad;
    const X = i => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1)) * 0.9 + (W - L - R) * 0.05;
    const Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const step = niceStep((hi - lo) / 4);
    g.strokeStyle = tok('--grid'); g.fillStyle = tok('--muted'); g.font = '11px sans-serif'; g.textAlign = 'right';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(W - R, Y(v)); g.stroke(); g.fillText(fmt(v, step), L - 6, Y(v) + 4); }
    g.textAlign = 'center';
    opt.points.forEach((p, i) => g.fillText(p.label, X(i), H - 14));
    if (opt.xLabel) g.fillText(opt.xLabel, (L + W - R) / 2, H - 1);
    g.strokeStyle = opt.color; g.globalAlpha = 0.4; g.lineWidth = 1.5; g.beginPath();
    opt.points.forEach((p, i) => (i ? g.lineTo(X(i), Y(p.y)) : g.moveTo(X(i), Y(p.y)))); g.stroke(); g.globalAlpha = 1;
    opt.points.forEach((p, i) => {
      g.strokeStyle = opt.color; g.lineWidth = 2; g.beginPath(); g.moveTo(X(i), Y(p.lo)); g.lineTo(X(i), Y(p.hi)); g.stroke();
      g.beginPath(); g.moveTo(X(i) - 5, Y(p.lo)); g.lineTo(X(i) + 5, Y(p.lo)); g.moveTo(X(i) - 5, Y(p.hi)); g.lineTo(X(i) + 5, Y(p.hi)); g.stroke();
      g.fillStyle = opt.color; g.beginPath(); g.arc(X(i), Y(p.y), 4.5, 0, 7); g.fill();
    });
  }

  function onThemeChange(fn) {
    window.addEventListener('resize', fn);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
    new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  function downloadText(name, text, type) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch (e) { return false; }
  }
  function toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  root.EconCharts = { tok, line, scatter, whisker, onThemeChange, downloadText, toast, copyText };
})(window);
