# Economic Simulators: Landscape Survey (for building our own)

Written 2026-11-17. Goal: pull out the mechanics, architecture and design patterns of existing economic simulators so we can design one here.

---

## 1. Taxonomy: the four families

| Family | What it optimizes for | Typical agents | Price formation | Time |
|---|---|---|---|---|
| **Games** | Fun, legibility, player agency | Aggregated "pops", buildings, cities | Supply/demand formula with caps | Ticks (days/weeks) |
| **Agent-based research models (ABM)** | Emergent macro behavior out of micro rules | Thousands of heterogeneous households, firms, banks, gov't | Decentralized search and matching, posted prices with adaptive markups | Discrete periods (months/quarters) |
| **Equilibrium / macro models (DSGE, CGE, SFC)** | Analytical tractability, policy evaluation | Representative agents, sectors | Market clearing (solved, not simulated) | Quarters, solved via perturbation |
| **Teaching and policy tools** | Teaching one concept clearly | Humans plus a few bots | Double auction, or a fixed reduced-form model | Rounds |
| **AI / LLM-agent sims (new)** | Behavioral realism, policy learning | RL or LLM agents | Usually a simple market wrapped around smart agents | Steps |

---

## 2. Games

### Grand strategy and nation-scale
- **Victoria 3 (Paradox, 2022; *Charters of Commerce* expansion 2025).** The best modern reference for a goods-based economy.
  - About 50 goods, each with a **base price**. Market price = base × f(buy orders vs sell orders), **clamped to ±75%** of base, so prices can't run away.
  - **Pops** (population groups by profession, culture and wealth) earn wages and buy goods from **needs baskets** (staples first, then luxuries). Unmet needs lower their "standard of living", which drives politics.
  - **Buildings** run **production methods** (input goods → output goods plus a labor requirement). Profit decides whether they hire or fire.
  - Markets are regional, and trade routes move goods between them. Infrastructure and market access cap how much can flow.
  - Takeaway: a price band plus needs baskets plus a production-method graph gives deep, stable gameplay without solving for equilibrium.
- **Europa Universalis / Hearts of Iron.** The economy is abstract (trade-node "value flow", factory counts). Useful only as a counter-example: abstraction is enough when the economy isn't the point.

### City builders and colony sims
- **SimCity (1989–2013), Cities: Skylines I/II.** Residential/commercial/industrial demand meters. C:S II added household wealth, rent, company profit and a resource market, and launched with visible imbalances (rent spirals, zero-profit firms). That's a useful warning: once you add real agent budgets, you have to tune the money loops.
- **Anno series.** Population tiers, each needing a basket of goods. Long production chains with fixed ratios ("3 wheat farms : 1 mill : 1 bakery"). Mostly deterministic, with no real prices inside the island. It's a logistics puzzle more than a market.
- **Workers & Resources: Soviet Republic.** Every unit of goods is physically moved by vehicles. Shows how far logistics realism can go.
- **Dwarf Fortress / RimWorld.** Item-level economies; DF's original "dwarven economy" was cut for being unwieldy. Lesson: item-level money at scale is hard.

### Trading and merchant sims
- **Patrician / Port Royale.** Each town keeps a stock of each good. Price is a steep curve of stock vs consumption ("price = f(days of supply)"). Buying pushes the price up immediately, which creates arbitrage gameplay. Elegant and cheap to compute.
- **X4: Foundations / Elite Dangerous.** Stations post buy and sell orders based on how full their storage is. NPC traders really fill those orders, so you get a closed (or nearly closed) economy driven by real cargo.
- **Offworld Trading Company.** An RTS where the market is the battlefield. Every purchase moves the price globally. Good model for a **player-impact market**.

### Tycoon and business
- **Capitalism Lab / Capitalism II (Enlight).** The deepest firm-level sim: retail, manufacturing, R&D, brand, quality, a stock market. Demand is a utility over price, quality and brand. Ideal reference for **firm competition**.
- **Factorio / Satisfactory.** No money, but the best production-graph and throughput design anywhere (ratios, bottlenecks, belts).

### Player-driven MMO economies
- **EVE Online.** Almost everything is player-produced. Regional **order-book** markets (limit orders), with taxes and broker fees as money sinks. EVE has employed an in-house economist and publishes Monthly Economic Reports. Key concepts: **faucets vs sinks**, inflation control, destroying goods (ship loss) to keep demand alive.
- **RuneScape Grand Exchange, WoW Auction House, Albion Online.** Order books or auctions. Albion's gear is fully player-crafted and destroyed on death.
- Lesson for any multiplayer economy: track **money supply** and **item supply** explicitly, and design the sinks.

---

## 3. Agent-based research models

### Frameworks (general ABM toolkits)
| Tool | Language | Notes |
|---|---|---|
| **Mesa** | Python | De facto Python ABM library: agents, schedulers, grid/network spaces, data collector, browser visualization. Best for prototyping. |
| **NetLogo** | NetLogo (JVM) | Classic teaching/research tool. Its Models Library includes wealth distribution and Sugarscape-style economies. |
| **Agents.jl** | Julia | Fast; benchmarks well ahead of Mesa. |
| **Repast / MASON** | Java | Large-scale, mature. |
| **ABCE** | Python | Built specifically for economic ABMs (goods, contracts, firms, households). Activity has slowed; check maintenance before relying on it. |
| **ABIDES / ABIDES-Economist** (J.P. Morgan AI Research) | Python | Discrete-event simulator. Started with market microstructure (order books, latency). The Economist variant adds households, firms, a central bank and a government, with RL agents, calibrated to US data ([arXiv 2402.09563](https://arxiv.org/abs/2402.09563)). |
| **BeforeIT.jl** (Bank of Italy, 2025) | Julia | Open-source, industry-grade macro ABM (small open economy, based on Poledna et al. 2023's Austria model), AGPL-3.0 ([arXiv 2502.13267](https://arxiv.org/abs/2502.13267)). |

### Canonical models (the ideas you'd reuse)
- **Sugarscape (Epstein & Axtell, 1996).** Agents on a resource grid with metabolism and vision. Trade between two goods emerges, and it produces a skewed wealth distribution. The "hello world" of computational economics.
- **Santa Fe Artificial Stock Market (Arthur, Holland, LeBaron et al., 1990s).** Traders with evolving forecasting rules. Bubbles and crashes emerge.
- **Zero-Intelligence traders (Gode & Sunder, 1993).** Random but budget-constrained bidders in a double auction still reach near-efficient allocation, so market *structure* does a lot of the work.
- **EURACE / Eurace@Unibi.** A large EU-funded macro ABM: labor, goods, credit and financial markets, with spatial regions.
- **Keynes meets Schumpeter, "K+S" (Dosi, Fagiolo, Roventini).** Capital-good firms innovate, consumption-good firms invest. Endogenous growth plus business cycles, used for fiscal and monetary policy experiments.
- **CATS / "Macroeconomics from the Bottom-up" (Delli Gatti, Gallegati et al.).** Firms set price and quantity adaptively. Bank credit links firms, so financial fragility and bankruptcy cascades emerge.
- **JAMEL (Seppecher), Lengnick's baseline ABM (2013).** *Small* macro ABMs, readable in an afternoon. **Lengnick 2013 is the best template for a first build**: about 1,000 households and 100 firms, a goods market and a labor market, adaptive prices and wages. It produces business cycles and a Phillips curve.
- **Stock-flow consistent ABMs (Caiani et al. 2016, "AB-SFC").** Every flow is a balance-sheet transaction, so money is never created or destroyed by accident. **Use this accounting discipline in ours.**

---

## 4. Equilibrium and macro-model toolkits (for comparison and calibration)
- **Dynare** (MATLAB/Octave/Julia): solves and estimates DSGE models, the standard at central banks.
- **QuantEcon** (Python/Julia): lectures and code for heterogeneous-agent models (Aiyagari, McCall job search, and others).
- **SFC models (Godley & Lavoie)**: sectoral balance-sheet models, the accounting backbone ABMs borrow.
- **CGE (GTAP, GAMS-based)**: trade and policy models with input-output tables.
- **Why care:** they supply **calibration targets** (e.g. consumption ≈ 60–70% of GDP, unemployment around 4–8%, inflation around 2%) and **closed-form sanity checks** for our sim.

---

## 5. Teaching and policy tools
- **Fed "Chair the Fed" / ECB "€conomia" / similar central-bank games**: set the policy rate, then watch inflation and unemployment respond through a reduced-form model.
- **MobLab, Veconlab (Charles Holt), oTree**: classroom market experiments (double auctions, public goods, ultimatum games, bank runs). oTree is open-source Python and the standard for lab experiments.
- **MIT Beer Game**: a four-stage supply chain that teaches the **bullwhip effect** through order delays.
- **Budget simulators (e.g. the CRFB "Debt Fixer")**: policy levers mapped to deficit outcomes. Pure accounting, no behavior.
- **Lesson:** a single clear causal loop plus immediate feedback teaches better than realism does.

---

## 6. AI and LLM-agent economic simulators (2020–2026)
- **The AI Economist (Salesforce, Zheng et al. 2020/2022).** A 2D "Gather-Trade-Build" world. Worker agents trained with RL, plus an **RL planner that learns tax schedules**. Open source as `ai-economist` / Foundation. The key idea is the **two-level RL loop** (agents adapt to policy, policy adapts to agents).
- **EconAgent (Li et al., ACL 2024).** LLM household agents decide work and consumption each month, with perception (profiles) and memory/reflection modules. The authors report more plausible macro patterns than rule-based agents ([arXiv 2310.10436](https://arxiv.org/abs/2310.10436)). A 2025 AAMAS follow-up adds an **LLM government planner** and disaster shocks ([AAMAS 2025](https://aamas.csc.liv.ac.uk/Proceedings/aamas2025/pdfs/p2460.pdf)).
- **TwinMarket (2025)**: LLM investors on a simulated stock market with social influence.
- **"Homo silicus" (Horton 2023)**: LLMs as simulated subjects that reproduce classic behavioral-econ experiments.
- **Caveats:** cost (an LLM call per agent per step), non-determinism, prompt sensitivity, and the risk that agents echo textbook economics instead of behaving realistically. The usual hybrid: **rule-based bulk agents plus a few LLM "decision-makers"** (a central bank, a CEO, the government).

---

## 7. Cross-cutting design patterns (what to steal)

### 7.1 Price formation (choose one per market)
1. **Formula with a band** (Victoria 3): `p = base × clamp(1 + k·(D−S)/(D+S), 0.25, 1.75)`. Stable and legible.
2. **Stock-based curve** (Patrician): `p = base × (target_stock / stock)^ε`. Cheap, and gives instant arbitrage.
3. **Adaptive posted prices** (Lengnick/CATS): firms raise the price when inventory is low and demand unmet, and cut it when inventory piles up, by a random step of 0–x%. Emergent and realistic.
4. **Order book / double auction** (EVE, ABIDES, ZI traders): limit orders matched by price-time priority. Best for player trading and finance.
5. **Walrasian clearing** (CGE/DSGE): solve for the price where excess demand is zero. Accurate but not emergent.

### 7.2 Money and accounting
- **Stock-flow consistency**: every transfer debits one balance sheet and credits another. Money is created only by explicit mechanisms (bank lending, gov't deficit, game faucets).
- Keep a **ledger invariant test**: sum of all money = initial money + created − destroyed. Run it every tick.
- Games: list every **faucet** (quest rewards, NPC buying) and every **sink** (taxes, fees, repairs, item destruction).

### 7.3 Agent decision rules (from cheapest to most expensive)
1. Fixed ratios and needs baskets (Anno, Victoria).
2. Heuristics with adaptive thresholds (Lengnick, K+S).
3. Utility maximization over a budget (Capitalism, Cobb-Douglas consumers).
4. RL policies (AI Economist, ABIDES-Economist).
5. LLM reasoning (EconAgent).

### 7.4 Market matching
- Households search a **random subset** of firms (e.g. 7 in Lengnick) and switch to a cheaper one with some probability. That gives realistic market power without global information.
- Labor market: firms post vacancies with wages, unemployed workers accept if the wage is at least their reservation wage, and reservation wages decay while unemployed.

### 7.5 Production
- Recipe graph: `{inputs: {good: qty}, labor: n, output: {good: qty}, time}` (Factorio/Victoria). Encode it as **data, not code**.

### 7.6 Stability and tuning
- Add damping: price bands, smoothed expectations (`E_t = λ·E_{t-1} + (1−λ)·x_t`), inventory buffers.
- Firm entry and exit: bankrupt firms are replaced (with a fresh small capital stock) to keep the population stable.
- Seeded RNG, so runs are reproducible and can go in a regression suite.

### 7.7 Observability
- Record time series every tick (GDP, CPI, unemployment, Gini, money supply, firm count). Mesa's `DataCollector` is the pattern.
- **Stylized facts to validate against**: right-skewed firm-size distribution, Phillips curve, Okun's law, pro-cyclical investment, a Pareto wealth tail, fat-tailed returns, volatility clustering.

---

## 8. Recommended starting architecture for our simulator

```
core/
  ledger.py        # stock-flow-consistent accounts; transfer(a, b, amount, reason)
  rng.py           # seeded randomness
  clock.py         # tick loop, phase ordering
agents/
  household.py     # labor supply, consumption basket, savings, reservation wage
  firm.py          # recipe-based production, adaptive price/wage/hiring, inventory
  bank.py          # (phase 2) deposits, loans, interest -> endogenous money
  government.py    # taxes, transfers, (phase 3) policy agent: rules -> RL -> LLM
  central_bank.py  # (phase 3) Taylor rule
markets/
  goods.py         # pluggable: posted-price search | formula band | order book
  labor.py         # vacancy matching
data/
  goods.yaml       # goods, base prices
  recipes.yaml     # production methods
metrics/
  collector.py     # per-tick macro series + invariants
ui/                # (later) web dashboard or game front-end
```

**Tick phases** (order matters; fix it explicitly):
1. Firms plan (set price, wage, target output, post vacancies)
2. Labor market matches
3. Production
4. Wages paid → households
5. Goods market: households buy
6. Taxes and transfers
7. Firms update expectations, inventory, profit, exit and entry
8. Metrics plus ledger invariant check

**Build order:**
1. **Milestone 1:** a Lengnick-style closed economy (1 good, households and firms, posted prices, labor market, SFC ledger). Check that business cycles emerge.
2. **Milestone 2:** multiple goods with a recipe graph and needs baskets (Victoria/Anno layer).
3. **Milestone 3:** banks and credit, government, central-bank Taylor rule.
4. **Milestone 4:** a player or AI policymaker (RL planner à la AI Economist, or an LLM planner à la EconAgent).
5. **Milestone 5:** front-end (game or dashboard), plus an order-book market if players trade.

---

## 9. Open decisions (need your input)
1. **Game or research tool?** That decides between legibility (price bands, aggregated pops) and emergence (posted prices, individual agents).
2. **Language:** Python (Mesa ecosystem, fast iteration), Julia (speed: Agents.jl, BeforeIT.jl), or TypeScript (runs in the browser for a playable game).
3. **Scale:** hundreds of agents (fine in Python) or 100k+ (needs vectorization or Julia/Rust).
4. **Is the player an agent** (a firm/trader), **the planner** (government/central bank), or **an observer**?

---

## 10. Market study: which simulator is worth building (added 2026-11-17)

Market-size figures are vendor estimates that disagree widely depending on how each defines its category. Treat them as direction, not truth.

| Segment | Size and demand signal | Competition | Can a small team win? | Verdict |
|---|---|---|---|---|
| **A. Economy game on Steam** | Simulation is the #2 genre by count of 2025 releases that passed 1,000 reviews; Steam made about $17.7B in 2025, about $4.4B of it indie. Schedule I made $150M+. | Extreme: flood of retail/shop sims; Economy-tag life sims had ~8% success (1,000+ reviews); 40% of 2025 games earned <$100 | Possible but hit-driven. Needs a unique "gameplay fantasy" plus marketing. | High risk, high upside |
| **B. Economics education** | MobLab: about $5 per student per day, institutional licenses. Capsim: 2M+ students. Business-sim games market estimates run $0.5–7.8B. | MobLab/Veconlab own **micro** classroom experiments; Capsim owns **business strategy**. **Macro/policy sims are mostly dated reduced-form central-bank games.** | Yes. A clear gap; sells to instructors; cheap to serve. | **Best fit** |
| **C. Corporate business-sim training** | About $8.5B (2025), ~17% CAGR (Marketintelo) | Capsim, consultancies, custom vendors | Hard: enterprise sales cycles, custom content | Later, via B |
| **D. ABM research software** | $0.3–3B depending on report | Free and entrenched: Mesa, NetLogo, Agents.jl, AnyLogic (commercial) | Hard to monetize; academics use free tools | Open-source the engine for credibility, not revenue |
| **E. AI synthetic consumers / market research** | Hottest money: Aaru Series A at a $1B headline valuation (Dec 2025), Simile $200M at $2B (Jul 2026), many seed rounds | Very well funded; validation is the open problem | No, not head-on | Avoid as first product |

### Recommendation
Build **one agent-based economy engine** (the Milestone 1–3 architecture above) and ship it first as a **browser-based "Run the Economy" policy simulator**:
- **The player is the policymaker** (central bank and/or finance minister). They set interest rate, taxes, spending and regulation, then watch thousands of households and firms react. Inflation, unemployment, inequality and crises *emerge*; they aren't scripted.
- **Audience 1: econ instructors and students.** Scenario packs (stagflation, bank run, housing bubble, pandemic shock), a teacher dashboard, per-student or per-class pricing like MobLab. This fills the macro gap.
- **Audience 2: the general public.** A free web version with shareable "what if" runs, as a marketing funnel.
- **Later:** the same engine becomes a Steam strategy game (segment A), a corporate training module (C), or an LLM-planner add-on (EconAgent-style) once the core is proven.

Why this one: the differentiator is real (emergent ABM instead of canned equations), competition is thin, it's cheap to run in a browser, and every later option reuses the engine. Pure Steam first means betting on a hit; synthetic consumers means fighting billion-dollar rivals.

Implication for tech: **TypeScript** (runs in the browser, about 1–10k agents is fine), engine kept UI-independent.

Market sources: Steam/simulation: https://appmagic.rocks/blog/steam-simulation-games-2026 · https://howtomarketagame.com/2026/01/27/what-the-hell-happened-in-2025/ · https://wnhub.io/news/analytics/item-49647 · https://www.steampageanalyzer.com/niches/life-sim · https://mp1st.com/news/40-of-steam-games-in-2025-earned-less-than-100 · Education: https://moblab.com/products/classroom/pricing · https://www.capsim.com/simulations · Training: https://marketintelo.com/report/corporate-simulation-based-training-market · https://www.verifiedmarketresearch.com/product/business-simulation-games-market/ · ABM software: https://www.marketresearchfuture.com/reports/agent-based-modeling-software-market-34695 · https://www.emergenresearch.com/industry-report/agent-based-modeling-software-market · Synthetic consumers: https://techcrunch.com/2025/12/05/ai-synthetic-research-startup-aaru-raised-a-series-a-at-a-1b-headline-valuation · https://thenextweb.com/news/simile-200-million-agentic-twins-ai-market-research

---

## 11. Limitations of existing simulators, and India vs world (added 2026-11-17)

### 11.1 What's wrong with what exists today
| Family | Main limitations | Opportunity for us |
|---|---|---|
| **Economy games** (Victoria 3, Anno, Cities: Skylines) | Economies are tuned for fun, not truth: price caps, infinite supply, fixed ratios. No money accounting, which caused money spirals in C:S II at launch. They never explain *why* something happened. | Real stock-flow-consistent accounting, plus "explain this outcome" |
| **Classroom tools** (MobLab, Veconlab, oTree) | Mostly **micro** experiments (auctions, games). Macro tools are reduced-form: fixed equations, canned outcomes. Many old macro sims are no longer maintained. Research warns games can make students ignore factors the game leaves out, and that models carry one school of thought's assumptions. | Emergent agent-based macro; switchable assumptions (Keynesian vs monetarist presets); transparent model view |
| **Central-bank games** (Fed, ECB) | US- and EU-centric, single lever (the interest rate), short, mostly dated | Multi-lever, multi-country, current |
| **Business sims** (Capsim, MonsoonSIM) | Firm-level only, not the economy; expensive; instructor-heavy | Economy-level view where firms are agents |
| **Research ABMs** (Mesa, NetLogo, BeforeIT.jl, EURACE) | Code-only, no learner UI, require programming; calibrated to the EU/US, not developing economies | Same rigor, wrapped in a usable UI |
| **AI/LLM sims** (EconAgent, synthetic consumers) | Costly per step, non-reproducible, accuracy unvalidated | Use LLMs only as tutor/explainer and optional policymaker, not as every agent |
| **India specifically** | Search found **no digital India-context economy simulator**. What exists: offline token games and role-plays (flipeducation), the GIPE Shadow MPC, an RBI Policy Challenge competition (last result found: 2016), and paper-trading apps (Neostox, NSE Paathshala, BSE Nivesh Mitra) that cover stocks only, not the economy. | **A clear gap** |

Things no existing tool models that matter for India and other emerging markets: the informal sector, food/monsoon-driven inflation, CRR/SLR/repo together, MSP and procurement, GST, rupee depreciation and the oil import bill, remittances, fiscal deficit plus state finances.

### 11.2 India vs world

| Factor | India | World |
|---|---|---|
| Competition | Almost none (digital, macro, India-context) | MobLab, Capsim, Fed/ECB games established |
| Audience size | Large: CBSE Class 12 alone ~17–18 lakh students (2025–26), with 7 lakh+ sitting the economics exam in one reported (undated) sitting; plus state boards, BA/BCom/BBA, MBA, and roughly 10 lakh+ UPSC/RBI Grade-B/banking aspirants a year (background knowledge, not checked) | Large, but you're one of many |
| Curriculum fit | Direct: CBSE Class 12 Macro (Money & Banking, Income Determination, Govt Budget, BoP) maps one-to-one onto the engine; NEP 2020 pushes experiential learning | Varies by country and course |
| Price per student | **Low**: ₹200–1,000 per student per year for school platforms (consultancy estimates) | **High**: MobLab about $5 per student per day; university licenses |
| Sales | School B2B is slow and price-negotiated; B2C (exam aspirants) is more workable | University/instructor sales; harder from India without a network |
| Product needs | Mobile-first, works on low-end Android and bad networks, Hindi plus English (later regional languages) | Desktop/laptop, English |
| Your advantage | Local knowledge, data and context; you can call on teachers | Low cost base if built in India |

### 11.3 Decision: **India-first in product, world-ready in architecture**
1. **Engine is country-agnostic.** A country becomes a data file (`countries/india.yaml`: sectors, informal share, policy tools, calibration targets from MOSPI/RBI). Nothing India-specific is hard-coded.
2. **Launch with an India scenario pack**, in English plus Hindi:
   - "You are the RBI Governor": repo, CRR, SLR, OMO vs a food-inflation shock
   - "Finance Minister's Budget": GST rates, fiscal deficit, capex vs subsidies
   - "Bad monsoon", "Oil price spike & rupee", "Demonetisation-style cash shock", "COVID lockdown"
3. **First paying users: B2C exam aspirants** (UPSC, RBI Grade-B, CBSE Class 12) on freemium, at ₹99–299 a year or per-scenario pricing, plus **colleges** (BA/BCom/MBA economics departments) on a per-class license. Validate with a few teachers before chasing school B2B.
4. **Go global after traction:** add Fed/ECB/BoE scenario packs and sell to universities at global pricing. The India-built cost base keeps margins high there.

Why not world-first: you'd fight incumbents without a home advantage. Why not India-only: Indian price points cap revenue, so the world market is where the revenue upside is.

**Validation before building much** (1–2 weeks): talk to 5–10 economics teachers or UPSC coaching faculty and 20+ students. Ask which chapters are hardest to teach, whether they'd use a simulator, and what they'd pay. Show a clickable mock-up of "RBI Governor".

Sources (§11): India K-12 pricing: https://www.raysolute.com/edtech-india-go-to-market-schools.html · https://www.idreameducation.org/blog/k12-content-licenses · CBSE numbers: https://school.careers360.com/boards/cbse/how-many-students-appeared-for-cbse-12th-exams-2025 · https://news.aglasem.com/cbse-class-12-economics-code-030-term-1-exam-conducted/ · NEP/games in education: https://cemca.org/wp-content/uploads/2026/02/Guidelines-on-the-Use-and-Misuse-of-Games-in-Education-Edited.pdf · Existing India monetary-policy activities: https://flipeducation.ai/curriculum/in/economics/class-12/quantitative-tools-of-monetary-policy-repo-reverse-repo/activities · https://gipe.ac.in/students-corner/gipe-shadow-monetary-policy-committee-mpc/ · https://insideiim.com/amp/students-of-iim-raipur-win-inaugural-rbi-policy-challenge · Paper trading in India: https://nexusfi.com/d/platforms/neostox/ · https://www.business-standard.com/amp/finance/personal-finance/new-to-investing-bse-s-free-nivesh-mitra-app-helps-you-learn-without-risk-125060600114_1.html · Criticism of classroom sims: https://ideas.repec.org/p/wrk/warwec/964.html · https://www.ipe-berlin.org/fileadmin/institut-ipe/Dokumente/Working_Papers/IPE_WP_117.pdf · https://absel-ojs-ttu.tdl.org/absel/article/view/2175

---

## 12. Fit with BSc / MSc Economics syllabi in India (added 2026-11-17)

**Syllabi read in full:** Panskura Banamali College BSc (Hons) Economics (NEP 2023, 4-year); Central University of Andhra Pradesh BSc (Hons) Economics (NEP/UGC framework, 2024-25); BASE University Bengaluru MSc Economics (May 2024). **From search snippets only:** Gokhale Institute (GIPE) MSc, whose 2024-25 macro covers rational expectations/new classical, Real Business Cycle, and New Keynesian rigidities; its 2018-19 list has Macroeconomics and Monetary Macroeconomics.

### 12.1 Key finding
Across the three syllabi read in full, **"agent-based" appears 0 times**, and **"simulation" appears only twice** (option-price simulation and a flood simulation in the MSc). Macro is taught with chalkboard models (IS-LM, multiplier, Phillips curve, Solow, DSGE at MSc), yet every programme now has **R / Python / Excel / SPSS labs**. So students learn the theory and learn programming, but nothing connects the two through an interactive economy. That's the gap.

### 12.2 Course-by-course fit
| Course (where it appears) | Topics in syllabus | How the simulator helps | Fit |
|---|---|---|---|
| Introductory Macroeconomics (BSc Sem II–III) | National income, multiplier, Keynesian cross, inflation | Watch the multiplier play out round by round; GDP accounting from the ledger | ★★★ |
| Intermediate Macro / Macroeconomic Theory (BSc Sem IV) | IS-LM, AD-AS, Phillips curve, Solow | Textbook-mode curves next to the ABM; shock the economy and see the curves shift | ★★★ |
| Money & Banking / Bank & Capital Market (BSc Sem V–VI) | Money supply, multiplier, RBI tools, monetary policy | RBI Governor scenario: repo, CRR, SLR, OMO; bank lending creates money | ★★★ |
| Public Finance (BSc Sem III/V; MSc Public Economics) | Taxes, spending, deficit, incidence | Finance Minister scenario: GST and income tax, deficit, crowding out | ★★★ |
| Indian Economy I/II (BSc Sem VI–VIII; MSc core) | Inflation, agriculture, BoP since 1991, reforms | Calibrated India scenarios: monsoon, oil/rupee, demonetisation, COVID | ★★★ |
| Advanced Macro / Monetary Economics (MSc Sem II–III; GIPE) | RBC, New Keynesian, DSGE, Taylor rule, rational expectations | Compare ABM against DSGE results; Taylor-rule central bank; expectation-type switch | ★★☆ |
| Programming with R / Python (MSc Sem I–II; BSc Sem IV–V labs) | Data handling, scripting | Python/R API and CSV export: students script experiments | ★★★ |
| Econometrics / Time-series / Big Data (BSc & MSc) | Regression, time series | Simulated datasets with a *known* data-generating process: test whether estimators recover the true effect | ★★☆ |
| International Trade / Trade & Finance (BSc Sem V; MSc Sem III) | BoP, exchange rate, trade | Phase 2: open-economy module (rupee, imports) | ★☆☆ now, ★★★ later |
| Development / Inequality / Informal Economy (BSc & MSc electives) | Growth, poverty, informal sector | Gini and wealth tails emerge from agents; informal-sector share as a parameter | ★★☆ |
| Game Theory / Microeconomics | Nash equilibrium, market structures | Firm-competition module (later); otherwise MobLab covers this better | ★☆☆ |
| Behavioural Economics (MSc elective) | Bounded rationality | Agent decision-rule types (rational, adaptive, LLM) | ★★☆ |
| Dissertation / Research Methodology (BSc Sem VIII, MSc Sem IV) | Original research | Ready-made ABM platform for policy-experiment dissertations | ★★★ |

**Coverage:** the simulator directly supports about **6–8 core courses** in a typical BSc and **5–6** in an MSc, mostly the macro, money, public finance, Indian economy, programming and dissertation track.

### 12.3 What this means for the product
1. **Textbook mode next to real-economy mode.** Exams test IS-LM, AD-AS, multiplier and Solow graphs. Show the textbook curve next to what the ABM actually does, and explain where and why they differ. Without this, teachers won't adopt it: "not in syllabus".
2. **Chapter-mapped scenarios.** Label each scenario with its syllabus unit (e.g. "Money & Banking, Unit 3: Credit creation"). Teachers search by chapter.
3. **Python/R package and CSV export.** It plugs into the programming and econometrics labs every programme now has, a second reason for departments to adopt.
4. **Dissertation-ready.** Parameter sweeps, seeds, reproducible run links and citable model docs, so MSc students can use it for research.
5. **Teacher kit.** Every scenario needs a worksheet, questions and an answer guide, because teachers aren't trained in ABMs (zero ABM content in the syllabi).
6. **MSc depth later:** DSGE-vs-ABM comparison, expectations switch (adaptive or rational), open economy.

### 12.4 Verdict
**Yes, it would help.** The fit is strongest for macro, money and banking, public finance, Indian economy, programming labs and dissertations. The risk is that syllabi don't mention simulation at all, so adoption depends on (a) textbook mode, (b) chapter mapping, and (c) teacher materials. Validate with teachers of *Intermediate Macro* and *Money & Banking* first.

Sources (§12): Panskura Banamali College BSc (Hons) Economics syllabus: https://erp.panskurabanamalicollege.ac.in/pict/web/web0909202563601PM.pdf · CUAP BSc (Hons) Economics: https://cuap.ac.in/assets/docs/syllabus/wef_24_25/updated_7_11_24/UG/B.Sc%20(Hons)%20Economics.pdf · BASE University MSc Economics: https://base.ac.in/wp-content/uploads/2024/07/MSc-Economics-Syllabus.pdf · GIPE MSc (snippets): https://gipe.ac.in/wp-content/uploads/2024/08/M.Sc_.Economics_Updated-1.docx · https://gipe.ac.in/wp-content/uploads/2024/04/M.Sc_.Economics_Apr-10.docx.pdf

---

## 13. Product structure: one engine, many tracks (added 2026-11-17)

### 13.1 Decision
**Neither a separate simulator per track nor one blank, generalised canvas.** Build **one general core engine** plus **modules** (economic topics you can switch on) plus **tracks** (audience-specific front-ends over the same engine).
- Separate simulators per track means the same code three times, results that disagree, and more maintenance than you can afford.
- One blank general canvas is too abstract: students and teachers won't know where to start, so nobody adopts it.
- Shared engine with tracks: one validated model; every audience gets a tailored entry point; research credibility flows into teaching sales.

```
                ┌───────────── TRACKS (front-ends) ─────────────┐
                │  Learn     │  Policy Lab  │  Research  │ Business (later)
                │ students,  │ think tanks, │ academics, │ MSMEs, analysts
                │ teachers   │ journalists  │ PhD/MSc    │
                └─────┬──────┴──────┬───────┴─────┬──────┴──────┘
                      │   scenarios, UI depth, outputs differ
                ┌─────▼──────────────────────────────────────────┐
  MODULES       │ Monetary · Fiscal · Banking/Credit · Labour ·    │
  (toggle on)   │ Trade & FX · Agriculture/Monsoon · Informal ·    │
                │ Inequality · Financial markets · Climate · I-O   │
                └─────┬──────────────────────────────────────────┘
                ┌─────▼──────────────────────────────────────────┐
  CORE ENGINE   │ Agents (households, firms, banks, govt, CB) ·    │
                │ SFC ledger · markets · seeded RNG · data collector│
                │ Country profiles (india.yaml, usa.yaml, …)        │
                └──────────────────────────────────────────────────┘
```

### 13.2 What to add for researchers
| Feature | Why researchers need it |
|---|---|
| **Python package (`pip install`) + headless runs** | Script experiments, run thousands of simulations, use in Jupyter |
| **Plugin API** for custom agents, markets and decision rules | Test their own theory without rewriting the whole model |
| **Calibration to real data**: RBI DBIE, MOSPI, World Bank, FRED connectors | Model credibility; India-calibrated ABMs are rare |
| **Estimation**: simulated method of moments, Bayesian calibration | Standard in ABM papers |
| **Sensitivity analysis**: parameter sweeps, Sobol indices | Reviewers always ask "is the result robust?" |
| **Stylized-facts validation dashboard** | Shows the model reproduces Phillips curve, Okun's law, firm-size and wealth distributions |
| **Agent-level panel data export** | Micro-data for econometrics; distributional analysis by decile, region, rural/urban, gender |
| **Reproducibility**: seeds, versioned models, run manifests, DOI via Zenodo | Journals increasingly require replication packages |
| **ODD protocol documentation** (Overview, Design concepts, Details) | The standard way ABM papers describe models |
| **Model comparison**: same shock in ABM vs textbook vs DSGE (Dynare import later) | A hot research question; also a strong teaching tool |
| **Networks**: interbank lending, input-output links (India supply-use tables) | Contagion and supply-chain shock research |
| **Regional economy**: states, rural/urban | Indian policy is state-heavy; few models do this |
| **Optional AI agents**: RL planner, LLM households (EconAgent-style) | Frontier research; keep optional because of cost and reproducibility |
| **Batch and cloud runs** (paid) | Large sweeps; a natural research revenue line |

### 13.3 What to add for everyone else
| Audience | Additions |
|---|---|
| **Students and exam aspirants** | Textbook mode, chapter-mapped scenarios, quizzes, Hindi plus regional languages, mobile-first |
| **Teachers** | Class rooms, assignments, worksheets, auto-graded questions, progress dashboard |
| **Policy analysts and think tanks** | Policy Lab: compare policy A vs B side by side, distributional impact (who gains and who loses by decile, state), exportable briefs |
| **Journalists and creators** | Embeddable live charts, shareable "what-if" links, plain-language explain mode |
| **General public** | "Your household" view: what a repo hike or GST change means for a typical family's EMI, prices and job risk |
| **MSMEs and business** (later) | Demand and input-cost scenarios under inflation, rate or rupee shocks (scenario analysis, not forecasts or investment advice) |
| **Everyone** | AI explainer ("why did unemployment rise in month 14?"), traced from the actual flows in the run |

### 13.4 Build order
1. **Core engine + Monetary & Fiscal modules + Learn track** (RBI Governor, Budget, textbook mode). Users plus first revenue.
2. **Open-source the engine plus a basic Python package early.** Wins researcher trust and lets them contribute.
3. **Research track:** calibration to India data, sweeps and sensitivity, panel export, ODD docs. Aim for one co-authored paper with an economics department for credibility.
4. **Policy Lab track:** A/B comparison, distributional impact, embeds.
5. **More modules:** trade & FX, agriculture/monsoon, informal sector, financial markets, regional, climate.
6. **Business track and AI agents** last.

Revenue by track: Learn (teacher/college licenses, aspirant packs) · Research (free core; paid cloud compute, custom calibration, workshops) · Policy (think-tank subscriptions, commissioned studies) · Business (later).

---

## Sources
- EconAgent: https://arxiv.org/abs/2310.10436 · ACL 2024: https://preview.aclanthology.org/setup/2024.acl-long.829
- LLM planner extension, AAMAS 2025: https://aamas.csc.liv.ac.uk/Proceedings/aamas2025/pdfs/p2460.pdf
- ABIDES-Economist: https://arxiv.org/abs/2402.09563
- BeforeIT.jl: https://arxiv.org/abs/2502.13267 · https://github.com/bancaditalia/BeforeIT.jl
- Victoria 3 review (market mechanics): https://pcgamer.com/victoria-3-review · https://godisageek.com/reviews/victoria-3-review/
- Charters of Commerce review: https://noobfeed.com/reviews/victoria-3-charters-of-commerce-review
- 2025 grand strategy list: https://strategyandwargaming.com/2025/09/13/the-10-best-grand-strategy-games-you-can-play-in-2025
- Port Royale / Patrician: https://nodal.gg/tag/economy
- Other entries (Sugarscape, Santa Fe ASM, ZI traders, K+S, CATS, Lengnick 2013, Caiani AB-SFC, AI Economist, EVE, Anno, Capitalism Lab, Mesa, NetLogo, Dynare, QuantEcon, oTree, Beer Game) are from background knowledge and were not re-checked in this session. Look up the primary papers and repos before relying on specific numbers.
