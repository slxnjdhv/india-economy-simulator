# Economy Lab: working prototype

Three pages, no install. Open them in any modern browser, or use the live site:
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
- **Six charts:** inflation (headline, food and core), unemployment, policy settings, real output, a Phillips curve "textbook check", and the government deficit and debt.
- **Six indicators:** inflation, unemployment, food and core inflation, real wages and wealth inequality (Gini).
- **A scorecard** at the end, graded against the "nothing changed" economy.
- **Copy replay link.** The link reproduces a student's exact game, so a teacher can check it.
- **Download data (CSV)** of every month, for use in R, Python or Excel.

## 2. Guided lessons (`lessons.html`)
Six 10–15 minute lessons, each tied to a BSc or MSc syllabus topic:

| # | Lesson | Topic |
|---|---|---|
| 1 | Food prices and a failed monsoon | Supply shocks; headline and core inflation |
| 2 | The inflation and jobs trade-off | Phillips curve; sacrifice ratio |
| 3 | How a rate hike travels through the economy | Monetary transmission; policy lags |
| 4 | Why trust in the 4% target matters | Inflation expectations; credibility |
| 5 | The fiscal multiplier in a slowdown | Multiplier; crowding out |
| 6 | Luck, noise and why we run many economies | Uncertainty; counterfactuals |

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
- **Behaviour:** expectations anchoring, the Phillips curve slope, price stickiness and food share. Economists can also change consumption and investment sensitivity, markups, natural unemployment, quit rates, benefits and how fast expectations adapt.
- **Many economies:** each run uses up to 1,000 economies that follow the same rules but have different luck. You can also vary one setting across up to 12 values.

Runs happen in parallel in the browser. 100 economies of 10,000 households each take about 6 seconds on a laptop. Results show:
- averages with 10th–90th percentile ranges, in a table;
- each measure over time, shaded with the range across economies;
- the effect of the setting you varied.

You can download a summary CSV or every run as CSV. "Copy settings" saves the experiment as text, so anyone can load it and repeat it exactly.

## Files
- `engine.js`: the agent-based model. Households, firms, a banking sector, the government and the RBI interact every month. The accounts are checked every month, and the same economy number always gives the same run.
- `lessons-data.js`: the six lessons, their experiments and grading.
- `charts.js`, `shared.css`: charts and styles shared by all pages (light and dark themes).
- `test.js`: 20 automated checks, including that every lesson gives its intended result and grades correctly. Run `node test.js`.

## Known limits (prototype)
- Teaching tool, not a forecast. Parameters are hand-tuned to India-like levels, not estimated from RBI, MOSPI or PLFS data.
- Two goods sectors and one simplified bank. There's no exchange rate, capital stock or informal sector yet.
- With the repo rate held fixed for many years the economy drifts. The warm-up therefore uses the RBI's rule.
