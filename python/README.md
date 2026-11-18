# indiasim

**indiasim** is the Python package for the Economy Lab: an agent-based model of the Indian economy, calibrated to RBI, MoSPI and PLFS data. It runs the same engine as the [website](https://slxnjdhv.github.io/india-economy-simulator/). The same economy number gives identical results in Python, Node.js and the browser, matching to the last digit.

The model has:
- 1,000 households and 100 firms (food and non-food, formal and informal);
- a banking sector, moneylenders, the government (wage tax and GST) and the RBI;
- the rest of the world: imported inputs such as oil, exports and a floating rupee.

The accounts are checked every month.

## Install

```bash
pip install "git+https://github.com/slxnjdhv/india-economy-simulator#subdirectory=python"
```

It needs Python 3.9 or later. Dependencies are installed automatically: `mini-racer` (an embedded V8 JavaScript engine), `numpy` and `pandas`. Node.js is not needed.

## Quick start

```python
import indiasim as isim

# One economy, 3 years, a failed monsoon in month 4, the RBI following its usual rule
df = isim.run(months=36, shocks=["monsoon"])
df[["infl", "foodInfl", "coreInfl", "u", "repo", "inr_per_usd"]].plot(subplots=True)

# The same experiment on 100 economies with different luck, in parallel
many = isim.run_many(seeds=range(1, 101), shocks=["monsoon"])
many.groupby("month")["infl"].describe()

# Vary one setting: hold the repo rate 1 point lower, unchanged, 1 and 2 points higher
sw = isim.sweep("repoDelta", [-0.01, 0, 0.01, 0.02], seeds=range(1, 41))
sw[sw.month > 12].groupby("repoDelta")[["infl", "u"]].mean()

# How well does the model match India? (calibration statistics, 2015–2024)
isim.moments()
```

## What you can do

| Function | What it does |
|---|---|
| `run(months, seed, policy=, shocks=, params=, params_after=)` | One economy. Returns a monthly DataFrame. |
| `run_many(seeds, months, ...)` | Many economies in parallel. Returns a long DataFrame with a `seed` column. |
| `sweep(setting, values, seeds, ...)` | Varies one setting or policy lever across values, on the same economies. |
| `Economy(seed, **settings)` | Step through one economy month by month: `.warm_up()`, `.set(repo=0.07)`, `.shock("oil")`, `.run(12)`, `.history`. |
| `Game(scenario, seed)` | The website's policy games, with "nothing changed" and "RBI rule" comparison economies. |
| `moments(params=, seeds=, years=)` | Compares the model with Indian data on the calibration statistics. |
| `calibration_targets()`, `india_data()` | The Indian data used, with official sources. |
| `defaults()`, `scenarios()`, `shocks()` | Model settings, games and scripted shocks. |

**Policy.** Options for `policy=`:
- `"rule"`: the RBI's usual rule sets the repo rate.
- `"fixed"`: the repo rate stays where the warm-up left it.
- A dict, such as `{"repo": 0.07}`, `{"repoDelta": 0.01}`, `{"spendDelta": 0.02}` or `{"tax": 0.12}`.

**Shocks.** Scripted shocks are `"monsoon"`, `"oil"` and `"slowdown"`. You can set the timing and size, as in `{"key": "oil", "start": 2, "depth": 1.0}`, where a depth of 1.0 doubles the world oil price. Random harvest, oil-price, demand and capital-flow shocks happen every month as well. They are sized by calibration, and you can switch them off with `params={"foodSd": 0, "oilSd": 0, "demSd": 0, "erNoise": 0}`.

**Settings.** `params=` changes settings from the start of the 10-year warm-up. `params_after=` changes them only when the experiment starts. Use `params_after=` to compare otherwise identical economies.

## Output columns

Rates are fractions: 0.04 means 4%. Month 1 is the first month of the experiment, and warm-up months are numbered 0 and below.

| Column | Meaning |
|---|---|
| `infl`, `foodInfl`, `coreInfl` | CPI, food and core inflation, year on year |
| `u` | Unemployment rate |
| `repo`, `loanRate` | RBI repo rate; bank lending rate |
| `piE` | Expected inflation |
| `Y`, `Y_index` | Real output; output index (100 = end of warm-up) |
| `C`, `I`, `G`, `X`, `M`, `gdp` | Consumption, investment, government, exports, imports and GDP in rupees. `*_pct_gdp0` gives each as % of starting monthly GDP. |
| `wage`, `realWage` | Average wage; real wage index (1 = start) |
| `deficit`, `defRatio`, `debtRatio` | Government deficit (rupees and % of GDP); debt as % of a year's GDP |
| `er`, `inr_per_usd`, `erChg`, `tradeBal` | Rupee index; ₹ per US$ (₹83 at month 0); 12-month change; trade balance, % of GDP |
| `infShare`, `infShareNF` | Informal share of all jobs and of non-farm jobs |
| `gini` | Wealth inequality |
| `residual`, `money`, `loans` | Accounting check (the residual is always about 0), money stock and bank loans |

`df.attrs` holds the economy number, its fingerprint, whether the accounts balanced, and the full settings used.

## Reproducibility

Every result depends only on the settings and the economy number. Fingerprints (`df.attrs["fingerprint"]`, `Economy.fingerprint`) let you confirm a run matches someone else's, or the website's.

## Citation

Dr Sulaxan, *Economy Lab: an agent-based simulator of the Indian economy* (2026). https://github.com/slxnjdhv/india-economy-simulator

## Limits

This is a calibrated teaching and research prototype, not a forecasting model. See the [calibration report](https://slxnjdhv.github.io/india-economy-simulator/prototype/calibration.html) for where it matches Indian data and where it doesn't.
