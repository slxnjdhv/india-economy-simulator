"""Build and run examples/quickstart.ipynb (so the notebook on GitHub shows real outputs).

Run: python examples/make_quickstart.py   (needs nbformat, nbclient, ipykernel, matplotlib)
"""
from pathlib import Path

import nbformat as nbf
from nbclient import NotebookClient

md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell
cells = [
    md("# indiasim quick start\n\nThe Economy Lab model of the Indian economy, run from Python. It runs the same engine as the "
       "[website](https://slxnjdhv.github.io/india-economy-simulator/), calibrated to RBI, MoSPI and PLFS data for 2015–2024.\n\n"
       "Install: `pip install indiasim`"),
    code("import indiasim as isim\nimport matplotlib.pyplot as plt\nimport pandas as pd\n\npd.set_option('display.precision', 3)\nisim.__version__"),
    md("## 1. One economy: a failed monsoon\n\nEach run first warms the economy up for 10 years. The monsoon then fails in month 4, and the RBI follows its usual rule. "
       "Rates are fractions, so 0.04 means 4%."),
    code("df = isim.run(months=36, shocks=['monsoon'])\n"
         "ax = (100 * df[['infl', 'foodInfl', 'coreInfl']]).plot(figsize=(8, 3.5), title='Inflation, % year on year')\n"
         "ax.axhspan(2, 6, color='grey', alpha=0.1); ax.set_xlabel('month'); plt.show()\n"
         "df[['infl', 'foodInfl', 'coreInfl', 'u', 'repo', 'inr_per_usd']].iloc[[0, 6, 12, 24, 35]]"),
    md("## 2. The cost of lower inflation: a repo-rate sweep on 40 economies\n\nHold the repo rate between 1 point below and 2 points above its starting level for 3 years. "
       "Every setting uses the same 40 economies, so differences come from policy, not luck."),
    code("sw = isim.sweep('repoDelta', [-0.01, 0.0, 0.01, 0.02], seeds=range(1, 41), months=36)\n"
         "yr23 = sw[sw.month > 12].groupby('repoDelta')[['infl', 'u']].mean() * 100\n"
         "yr23.columns = ['inflation, %', 'unemployment, %']\nyr23"),
    code("lo, hi = yr23.iloc[0], yr23.iloc[-1]\n"
         "ratio = (hi['unemployment, %'] - lo['unemployment, %']) / (lo['inflation, %'] - hi['inflation, %'])\n"
         "print(f'Sacrifice ratio: {ratio:.2f} points of unemployment per point of inflation')"),
    md("## 3. Oil, the rupee and imported inflation\n\nWorld oil prices double in month 3. Compare 40 economies with and without the shock."),
    code("none = isim.run_many(seeds=range(1, 41), months=36, policy='fixed')\n"
         "oil = isim.run_many(seeds=range(1, 41), months=36, policy='fixed', shocks=[{'key': 'oil', 'start': 2, 'depth': 1.0}])\n"
         "fig, ax = plt.subplots(1, 2, figsize=(10, 3.5))\n"
         "for name, d in [('no shock', none), ('oil doubles', oil)]:\n"
         "    q = d.groupby('month')['inr_per_usd'].quantile([0.1, 0.5, 0.9]).unstack()\n"
         "    ax[0].plot(q.index, q[0.5], label=name); ax[0].fill_between(q.index, q[0.1], q[0.9], alpha=0.2)\n"
         "    ax[1].plot(d.groupby('month')['tradeBal'].mean() * 100, label=name)\n"
         "ax[0].set_title('Rupees per US$ (median, 10th–90th pct)'); ax[1].set_title('Trade balance, % of GDP')\n"
         "ax[0].legend(); plt.tight_layout(); plt.show()"),
    md("## 4. Does a large informal sector weaken monetary policy?\n\nInformal firms borrow from moneylenders, whose rates don't follow the repo rate. "
       "For each informal-sector size, compare a 2-point rate hike with no change, on the same 20 economies."),
    code("rows = []\nfor inf in [0.2, 0.5, 0.75, 1.0]:\n"
         "    p = {'informal': inf}\n"
         "    base = isim.run_many(seeds=range(1, 21), months=24, policy='fixed', params=p)\n"
         "    hike = isim.run_many(seeds=range(1, 21), months=24, policy={'repoDelta': 0.02}, params=p)\n"
         "    y2 = lambda d, k: d[d.month > 12][k].mean() * 100\n"
         "    rows.append({'informal setting': inf, 'informal share of jobs, %': y2(base, 'infShare'),\n"
         "                 'fall in inflation, pts': y2(base, 'infl') - y2(hike, 'infl'),\n"
         "                 'rise in unemployment, pts': y2(hike, 'u') - y2(base, 'u')})\n"
         "pd.DataFrame(rows).set_index('informal setting')"),
    md("## 5. Step by step, like a policymaker"),
    code("e = isim.Economy(seed=74).warm_up(rule=False)   # repo held where the warm-up left it\n"
         "e.run(6)\n"
         "e.shock('monsoon')\n"
         "e.run(4)\n"
         "e.set(repo=0.075)                               # respond with a hike\n"
         "e.run(14)\n"
         "e.history.loc[1:, ['repo', 'infl', 'foodInfl', 'u']].iloc[::4]"),
    md("## 6. How well does the model match India?\n\nThe calibration statistics, 2015–2024: the Indian value, the model average over 10 economies of 20 years, and the model's 10th–90th percentile range."),
    code("isim.moments()"),
    md("## 7. Reproducibility\n\nThe same settings and economy number always give the same result, in Python and on the website. The fingerprint identifies a run exactly."),
    code("a = isim.run(months=36, seed=74, shocks=['monsoon'])\nb = isim.run(months=36, seed=74, shocks=['monsoon'])\n"
         "a.attrs['fingerprint'], a.attrs['fingerprint'] == b.attrs['fingerprint'], a.attrs['balanced']"),
]
nb = nbf.v4.new_notebook(cells=cells, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"}})
out = Path(__file__).with_name("quickstart.ipynb")
NotebookClient(nb, timeout=600, kernel_name="python3").execute()
nbf.write(nb, out)
print("wrote", out)
