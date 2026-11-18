# Calibration

This folder calibrates the Economy Lab model to Indian data from 2015–2024 by the **simulated method of moments**. The model runs many simulated economies. The calibration program then adjusts eleven settings until the economies' summary statistics match the data.

| File | What it does |
|---|---|
| `india-data.json` | The Indian data, each series with its official source and notes: CPI, food (CFPI) and core inflation, PLFS unemployment and informality, the RBI repo rate, the rupee, imports, GDP growth and the current account. |
| `build-targets.js` | Turns the data into target statistics (`targets.json`), such as mean inflation and the standard deviation of food inflation. |
| `moments.js` | Computes the same statistics from a simulated economy. |
| `calibrate.js` | Searches for the settings that minimise the gap, using Nelder–Mead over 10 economies of 20 years each. It writes `result.json`. |
| `make-report.js` | Builds the public report, `prototype/calibration.html`. |

To reproduce:

```
node build-targets.js && node calibrate.js 700 && node make-report.js
```

A full run takes about 8 minutes on a 10-core laptop. Then copy the values in `result.json` → `params` into `DEFAULTS` in `prototype/engine.js`, where they are marked `[cal]`.
