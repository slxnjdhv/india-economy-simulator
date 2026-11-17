# Economy Lab: working prototype

**You are the RBI Governor: The Failed Monsoon.** Set the repo rate every two months for two years while a failed monsoon pushes up food prices.

## Run it
Open `index.html` in any modern browser (double-click it). No install or internet connection needed.

## What's inside
- `engine.js`: an agent-based economy with 1,000 households, 100 firms (30 food, 70 non-food), a banking sector, the government and the RBI. Each month:
  - firms set wages and prices, and hire and fire workers
  - households look for work, then spend and save
  - banks lend
  - the RBI sets the repo rate
- Inflation and unemployment come out of these decisions; no formula sets them directly.
- **Accounting check:** every month, the engine confirms that every rupee lent equals a rupee deposited.
- **Reproducible:** the same economy number always gives the same run (see the run fingerprint).
- **"If repo unchanged" path:** a second, identical economy keeps the repo rate fixed, so the "explain why" panel can show exactly what your decisions changed.
- `index.html`: the game screen (charts, the 1,000-household grid, the "explain why" panel and the scorecard).
- `test.js`: automated checks. Run `node test.js`.

## Known limits (prototype)
- Teaching tool, not a forecast. Parameters are hand-tuned to India-like levels (4% target, food is 46% of the CPI basket), not estimated from RBI or MOSPI data.
- One scenario; only the repo rate can be changed (no CRR, SLR or fiscal policy yet).
- With the repo rate held fixed for many years the economy drifts. The warm-up period therefore uses an RBI-style rule, and the game lasts 24 months.
- No textbook mode yet (IS-LM or AD-AS side by side).
