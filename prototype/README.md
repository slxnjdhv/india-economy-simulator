# Economy Lab: working prototype

Four pages, no install. Open them in any modern browser, or use the live site:
https://slxnjdhv.github.io/india-economy-simulator/prototype/

## 1. Play a scenario (`index.html`)
Students take a policy role and make decisions every few months:

| Scenario | Role | You control | What happens |
|---|---|---|---|
| The Failed Monsoon | RBI Governor | Repo rate | Food prices jump after a bad harvest |
| Oil Shock and the Rupee | RBI Governor | Repo rate | Costs rise for every firm at once |
| The Slowdown Budget | Finance Minister | Tax rate, government spending | Exports and investment fall; the RBI sets rates on its own |
| Your Own Economy | Free play | All three, plus shock buttons | Whatever you test |

The game includes:
- **Two comparison lines.** One shows an identical economy where nothing changed. For the RBI scenarios, the other shows what the RBI's usual policy rule would have done.
- **"Explain why".** This panel traces your decisions through loan rates, saving, investment, jobs, wages and prices.
- **Eight charts:** inflation (headline, food and core), unemployment, policy settings, real output, a Phillips curve "textbook check", the government deficit and debt, the rupee in ₹ per US dollar, and the trade balance.
- **Eight indicators:** inflation, unemployment, food and core inflation, real wages, wealth inequality (Gini), the rupee and the share of informal jobs.
- **A scorecard** at the end, graded against the "nothing changed" economy.
- **Copy replay link.** The link reproduces a student's exact game, so a teacher can check it.
- **Download data (CSV)** of every month, for use in R, Python or Excel.

## 2. Guided lessons (`lessons.html`)
Seven 10–15 minute lessons, each tied to a BSc or MSc syllabus topic:

| # | Lesson | Topic |
|---|---|---|
| 1 | Food prices and a failed monsoon | Supply shocks; headline and core inflation |
| 2 | The inflation and jobs trade-off | Phillips curve; sacrifice ratio |
| 3 | How a rate hike travels through the economy | Monetary transmission; policy lags |
| 4 | Why trust in the 4% target matters | Inflation expectations; credibility |
| 5 | The fiscal multiplier in a slowdown | Multiplier; crowding out |
| 6 | Oil, the rupee and imported inflation | Exchange rates; trade balance |
| 7 | Luck, noise and why we run many economies | Uncertainty; counterfactuals |

Each lesson follows predict, run, answer:
- Students **predict** the result first. The prediction isn't graded, but the page shows it next to what happened.
- They **run** a real experiment on the engine and read the results from charts and tables.
- They **answer** 3–4 auto-graded questions. Numeric answers are checked against the student's own economy.
- Each student's name gives them their own economy, so numeric answers differ between classmates and can't simply be copied.
- Students get a **completion code** with their name, score, attempt and date.
- On the **Teacher view**, teachers paste the codes to check them and download class results as CSV. Nothing is sent to a server. The codes stop casual editing but are not secure.

## 3. Experiment Lab (`lab.html`)
Students and economists can design their own experiments:
- **Economy size:** 100 to 20,000 households and 10 to 2,000 firms.
- **Run length:** up to 240 months, after a warm-up period.
- **Policy:** the RBI's rule with adjustable responses, or a fixed repo rate. Also the inflation target, tax rate and government spending.
- **Shocks:** monsoon, oil or slowdown, each with its own start month and size.
- **India's structure:** the size of the informal sector, imported inputs, and how the rupee and exports respond. Economists can also set informal productivity, the moneylender rate, world inflation and how the rupee reacts to foreign debt.
- **Behaviour:** expectations anchoring, the Phillips curve slope, price stickiness and food share. Economists can also change consumption and investment sensitivity, markups, natural unemployment, quit rates, benefits and how fast expectations adapt.
- **Many economies:** each run uses up to 1,000 economies that follow the same rules but have different luck. You can also vary one setting across up to 12 values.

Runs happen in parallel in the browser. 100 economies of 10,000 households each take about 6 seconds on a laptop. Results show:
- averages with 10th–90th percentile ranges, in a table;
- each measure over time, shaded with the range across economies;
- the effect of the setting you varied.

You can download a summary CSV or every run as CSV. "Copy settings" saves the experiment as text, so anyone can load it and repeat it exactly.

## How the economy works
- **Informal sector.** About 74% of non-farm jobs are informal, matching PLFS. Informal firms pay no tax on wages and are less productive. They borrow from moneylenders at 24%, a rate that doesn't move with the repo rate, which weakens monetary policy. Workers without formal qualifications or documents can only find informal jobs. Everyone pays GST on what they buy.
- **Rupee and trade.** Firms import inputs such as oil, and non-food firms export. The rupee starts each game at ₹83 per US dollar and floats:
  - it weakens when Indian inflation runs above world inflation, or when foreign debt builds up;
  - it strengthens when the RBI raises rates.
- **Oil shocks** raise world oil prices, which widens the trade deficit and weakens the rupee.
- **Random shocks.** Every month brings small random changes in harvests, world oil prices, demand and capital flows. They are long-lasting and sized to match how much Indian inflation, food prices, the rupee and growth vary.
- **Wages and the RBI.** Wage-setters who trust the 4% target expect 4%; the rest link pay mostly to last year's inflation, which makes inflation persistent. The RBI smooths its rate changes.

## 4. Calibration report (`calibration.html`)
Shows how closely the model matches Indian data for 2015–2024, the settings the calibration chose, and where the model still falls short. The data, sources and calibration program are in [`../calibration/`](../calibration/).

## Files
- `engine.js`: the agent-based model. Households, firms, a banking sector, the government and the RBI interact every month. The accounts are checked every month, and the same economy number always gives the same run.
- `lessons-data.js`: the seven lessons, their experiments and grading.
- `charts.js`, `shared.css`: charts and styles shared by all pages (light and dark themes).
- `test.js`: 28 automated checks. They cover the rupee, trade, the informal sector and the calibration, and confirm that every lesson gives its intended result and grades correctly. Run `node test.js`.

## Known limits (prototype)
- Teaching tool, not a forecast. Sixteen settings are calibrated to 2015–2024 Indian data; the rest are hand-tuned. Average inflation sits near the 4% target rather than India's 5%, and the model has no current-account deficit.
- Two goods sectors and one simplified bank. There's no capital stock yet.
- The rupee is set by relative prices, interest rates and foreign debt, with some random capital-flow noise. The RBI doesn't yet use its dollar reserves to steady it.
- The labour market is split: informal workers can't move into formal jobs. Real-world movement between the two sectors isn't modelled yet.
- With the repo rate held fixed for many years the economy drifts. The warm-up therefore uses the RBI's rule.
