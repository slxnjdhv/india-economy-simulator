# Economy Simulator: Architecture Plan

Status: draft v0.1, 2026-11-17. Based on the research in [economic-simulators-survey.md](economic-simulators-survey.md) (sections 7–13).

---

## 1. Requirements that drive the design

| # | Requirement | Comes from |
|---|---|---|
| R1 | **One engine** serves every track (Learn, Policy Lab, Research, Business) | §13 decision |
| R2 | Runs **in the browser on a low-end Android phone** (Indian students), offline-capable | §11 India |
| R3 | **Python package** for researchers: headless, batch, Jupyter | §13.2 |
| R4 | **Deterministic and reproducible**: same scenario + seed + version gives identical results on phone, laptop and Python | §13.2 research, share links |
| R5 | **Stock-flow consistent**: money is never created or destroyed by accident | §7.2 |
| R6 | **Modular**: economic topics switch on and off; researchers add their own rules | §13.1 |
| R7 | **Country = data**, not code (India first, then others) | §11.3 |
| R8 | **Textbook mode** (IS-LM, AD-AS, Solow, Keynesian cross) next to the agent-based model | §12.3 |
| R9 | **Interactive**: player changes policy between ticks; UI stays smooth | Learn track |
| R10 | **Explainable**: "why did X happen" traced to real flows | §13.3 |
| R11 | **Cheap to run**: simulation on the user's device; servers only store and share | §10 economics |

---

## 2. Technology decision

**Recommended: Rust core, compiled to WebAssembly for the browser and to a native Python extension for researchers.**

| Option | Browser speed on phones | Python package | One codebase | Cross-platform determinism | Learning cost |
|---|---|---|---|---|---|
| **A. Rust core → WASM + PyO3** | ✅ Fast | ✅ Native speed (`maturin`) | ✅ | ✅ (with care, §4.9) | ⚠️ Rust is harder |
| B. TypeScript core | ✅ OK up to ~10k agents | ⚠️ Python would have to call Node or a re-implementation | ⚠️ | ✅ | ✅ Easy |
| C. Python core (+ Pyodide in browser) | ❌ Slow, ~10 MB download | ✅ | ✅ | ✅ | ✅ Easy |
| D. Julia core | ❌ No good browser story | ⚠️ | ❌ | ✅ | ⚠️ |

- **Why A:** it's the only option that meets R2, R3 and R4 with a single implementation. The trade-off is Rust's learning curve (and it isn't installed yet on this machine; `rustup` installs it in minutes).
- **Fallback, B:** TypeScript core, with the Python package as a thin wrapper that runs the same JS engine through an embedded runtime. That's slower and clunkier for research, but faster to start. The engine API below is identical either way, so a later port is mechanical.

**Rest of the stack**

| Layer | Choice | Why |
|---|---|---|
| Web app | TypeScript + React + Vite; charts with Apache ECharts or uPlot | Mature; uPlot is very light on phones |
| Engine in the browser | WASM inside a **Web Worker** | UI never freezes during a run (R9) |
| Offline | PWA (service worker caches the app + WASM) | Works on poor networks (R2) |
| i18n | `i18next`, strings in JSON; English + Hindi first | §11 |
| Python package | `maturin` + PyO3; outputs as pandas/polars DataFrames | Research workflow |
| Backend (minimal) | Postgres + a small API (Supabase or a FastAPI service) | Accounts, classrooms, saved runs, sharing |
| Batch/cloud runs | Python package on container workers (queue: Redis or SQS) | Paid research feature |
| AI explainer | Server-side call to the Claude API with a compact event trace | No API key in the browser |
| Data pipeline | Python scripts → country profile YAML | RBI DBIE, MOSPI, World Bank, FRED |

---

## 3. System overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                         CLIENTS (tracks)                               │
│  Learn (web/PWA)   Policy Lab (web)   Research (Python/Jupyter)  Embed │
└──────┬───────────────────┬──────────────────────┬──────────────┬──────┘
       │ JS API            │                      │ Python API   │ iframe
┌──────▼───────────────────▼──────┐     ┌─────────▼──────────┐   │
│ engine-wasm (in Web Worker)     │     │ econsim (PyO3)     │   │
└──────────────┬──────────────────┘     └─────────┬──────────┘   │
               └───────────────┬──────────────────┘              │
                     ┌─────────▼─────────┐                       │
                     │   engine-core     │  ← one Rust crate     │
                     │ (no I/O, no clock)│                       │
                     └─────────▲─────────┘                       │
                               │ loads                           │
                 ┌─────────────┴─────────────┐                   │
                 │ data/: country profiles,   │                  │
                 │ scenarios, goods, recipes  │                  │
                 └────────────────────────────┘                  │
┌────────────────────────────────────────────────────────────────▼─────┐
│ SERVICES (thin): auth · classrooms · saved runs & share links ·       │
│ batch-run workers · AI explainer proxy · data connectors (offline)    │
└──────────────────────────────────────────────────────────────────────┘
```

Rule: **`engine-core` does no I/O, has no wall clock and no global state.** Everything comes in through `Scenario` and goes out through `Snapshot`, `Metrics` and `Trace`. That keeps it deterministic, testable and portable.

---

## 4. Engine core design

### 4.1 Main concepts
| Concept | What it is |
|---|---|
| `Scenario` | Complete, serializable input: country profile, enabled modules, parameters, initial conditions, shock timeline, policy schedule, seed, engine version |
| `World` | All simulation state: agent stores, ledger, markets, RNG streams, tick counter |
| `Module` | A pluggable unit that owns some state and registers systems into phases (e.g. `monetary`, `fiscal`, `banking`) |
| `Phase` | A fixed, ordered step within a tick |
| `Action` | A player/policy input applied between ticks (e.g. `SetRepoRate(6.25)`) |
| `Shock` | A scheduled exogenous event (monsoon failure, oil spike) |
| `Metrics` | Per-tick aggregate time series |
| `Trace` | Causal event log for the explainer, sampled or aggregated |

### 4.2 Agent storage (performance)
- **Struct-of-arrays** per agent type (`HouseholdStore { wealth: Vec<f64>, employer: Vec<Option<FirmId>>, … }`) rather than one object per agent. That's cache-friendly, fast in WASM, and gives cheap DataFrame export.
- IDs are dense indices; firm exit and entry reuse slots via a free list.
- Target budget: **10k households + 1k firms + 10 banks, 120 monthly ticks, under 3 s on a mid-range Android phone.** The default Learn scenario uses 1k/100 (Lengnick scale) for instant runs.

### 4.3 Tick pipeline (fixed phase order)
```
0. apply_actions        player/policy inputs queued since last tick
1. apply_shocks         scheduled exogenous events
2. policy               central bank rule (or player-set), fiscal rules
3. firm_planning        expected demand → target output, price, wage, vacancies
4. credit_market        firms/households request loans; banks decide (banking module)
5. labour_market        vacancy matching; wages agreed
6. production           recipes consume inputs + labour → output, inventory
7. income               wages, interest, dividends, transfers paid
8. goods_market         households shop (search K firms); firms sell from inventory
9. taxes                income tax, GST, corporate tax collected
10. settlement          loan repayments, defaults, bank capital, CB reserves
11. adaptation          expectations, price/wage rules, reservation wages
12. entry_exit          bankrupt firms exit; new entrants
13. accounting_check    SFC invariants (debug: assert; release: record violation)
14. collect             metrics, trace, optional snapshot
```
Modules register systems into these phases. Order within a phase is deterministic (module priority, then registration order).

### 4.4 Ledger: stock-flow consistent by construction
- Every monetary account belongs to exactly one sector: household, firm, bank, government, central bank, rest of world.
- The **only** way to move money is `ledger.transfer(from, to, amount, FlowKind)`. Money creation and destruction are explicit and limited to `bank_lending`, `loan_repayment`, `cb_operations` and `gov_deficit_financing`.
- Kept at all times: a **balance sheet matrix** (stocks by sector) and a **transaction flow matrix** (flows by kind per tick). Both are exportable, and researchers expect them (Godley–Lavoie style).
- Invariants checked every tick: each flow row sums to zero across sectors; Δ(money stock) = created − destroyed; assets = liabilities + net worth per sector.
- Amounts: `f64` with tolerance checks. Switch to integer paise (`i64`) only if drift appears in tests.

### 4.5 Markets (pluggable via a `Market` trait)
| Implementation | Used for | From survey |
|---|---|---|
| `PostedPriceSearch` | Default goods market: households sample K firms and switch to cheaper ones | Lengnick, CATS |
| `VacancyMatching` | Labour market with reservation wages | Lengnick |
| `BandedFormula` | Simplified/teaching mode, legible prices | Victoria 3 |
| `OrderBook` | Financial markets module (later), player trading | ABIDES, EVE |
| `CreditMarket` | Bank loan supply with capital/CRR/SLR constraints | AB-SFC |

### 4.6 Modules (initial set and later)
| Module | Owns | Phase hooks | Milestone |
|---|---|---|---|
| `core_real` | Households, firms, goods + labour markets | 3,5–8,11,12 | M1 |
| `monetary` | Central bank, policy rate, Taylor rule or player control, CRR/SLR/OMO | 2,10 | M1 |
| `fiscal` | Government, income tax, GST, spending, transfers, deficit, debt | 2,7,9 | M1 |
| `banking` | Banks, deposits, loans, defaults, capital | 4,10 | M2 |
| `textbook` | IS-LM, AD-AS, Keynesian cross, Solow, money multiplier (closed-form) | separate solver | M1 |
| `agriculture` | Food sector, monsoon shocks, MSP/procurement | 1,6 | M3 |
| `informal` | Informal firms/workers (no tax, cash-only, no credit) | 5,8,9 | M3 |
| `open_economy` | Imports/exports, exchange rate, oil, remittances, BoP | 6,8,10 | M3 |
| `inequality` | Gini, deciles, wealth tails (mostly metrics) | 14 | M2 |
| `regions` | States, rural/urban, migration | all | M4 |
| `networks` | Input-output links, interbank exposure | 6,10 | M4 |
| `financial_markets` | Equity/bond order book | own phase | M5 |
| `climate` | Damage functions, carbon price | 1,6 | M5 |
| `ai_agents` | RL planner, LLM decision-makers (Python-side) | 2 via hook | M5 |

Module interface (sketch):
```rust
trait Module {
    fn id(&self) -> &'static str;
    fn depends_on(&self) -> &[&'static str];        // e.g. banking -> core_real
    fn params_schema(&self) -> ParamSchema;          // validated, documented, UI-renderable
    fn init(&mut self, world: &mut World, p: &Params, rng: &mut Rng);
    fn systems(&self) -> Vec<(Phase, Priority, SystemFn)>;
    fn metrics(&self) -> Vec<MetricDef>;
    fn handle_action(&mut self, world: &mut World, a: &Action) -> Result<()>;
}
```
`params_schema` is the key to "one engine, many tracks". The UI generates sliders from it, the docs come from it, and Python validates against it.

### 4.7 Decision rules (agent behaviour)
- Each behaviour is a named, swappable rule: `household.consumption = "adaptive_mpc" | "buffer_stock" | "rule_of_thumb"`, `firm.pricing = "markup_adaptive" | "inventory_rule"`, `expectations = "adaptive" | "rational_proxy" | "extrapolative"`.
- **School-of-thought presets** are just bundles of rule choices plus parameters ("Keynesian: sticky wages, demand-led investment"; "Monetarist: …"). This answers the "one ideology baked in" criticism.
- **Researcher plugins:**
  1. *Python hooks*: override a rule with a Python function (slower, flexible).
  2. *Rust plugins*: compiled into a custom build (fast).
  3. *WASM plugins* (later): load user rules in the browser.

### 4.8 Randomness
- `ChaCha8` RNG, **one stream per (module, purpose)** derived from the master seed. Adding a module or reordering code doesn't shift other modules' random draws, so experiments stay comparable.

### 4.9 Determinism across WASM, native and Python
- Use the `libm` crate for `exp`, `ln` and `pow` (identical on all targets). No platform math intrinsics. No `HashMap` iteration in logic (use `BTreeMap` or indexed Vecs). No threads inside a run (parallelism happens *across* runs in batch mode).
- CI test: run golden scenarios on native, WASM (Node) and Python, and compare a **state hash** each tick.

### 4.10 Outputs
| Output | Contents | Consumers |
|---|---|---|
| `Metrics` | ~50 aggregate series per tick (GDP, CPI, unemployment, policy rate, deficit, Gini, money supply, firm count, …) | All tracks |
| `Snapshot` | Full state at tick t, serializable | Save/resume, debugging |
| `AgentPanel` | Optional agent-level data (sampled or full) | Research, distributional analysis |
| `SFC matrices` | Balance sheet + flow matrices | Research, teaching |
| `Trace` | Aggregated causal events ("repo +50bp → bank lending −8% → firm investment −5% → hiring −2%") | AI explainer, "why" panel |
| `StateHash` | Per-tick hash | Determinism tests, share-link verification |

### 4.11 Textbook mode
- A separate, small **analytical solver** in the core (closed-form or simple fixed-point): Keynesian cross, IS-LM, AD-AS, Solow, money multiplier, Phillips curve.
- A **bridge** maps ABM parameters to textbook parameters (e.g. average MPC → multiplier; observed Phillips slope), so both views run from the same scenario.
- The UI shows the textbook curve, the ABM outcome and an explanation of the gap: the core teaching feature (§12.3).

---

## 5. Data model

### 5.1 Country profile (`data/countries/india.yaml`)
```yaml
id: india
currency: INR
calibration_year: 2024
sectors: [agriculture, manufacturing, services]
informal_share: { employment: 0.85, output: 0.45 }    # placeholder, calibrate from MOSPI/PLFS
policy_tools: [repo_rate, crr, slr, omo, gst_slabs, income_tax, msp]
initial:
  policy_rate: 6.5
  crr: 4.0
  ...
targets:              # used for calibration and validation
  cpi_inflation: { mean: 5.0, sd: 1.5 }
  unemployment: { mean: ..., source: PLFS }
sources: [RBI-DBIE, MOSPI, PLFS, World Bank WDI]
```
(Values above are placeholders, to be filled by the data pipeline with cited sources.)

### 5.2 Scenario (`data/scenarios/india/rbi-governor-food-inflation.yaml`)
```yaml
engine: ">=0.1 <0.2"
country: india
modules: [core_real, monetary, fiscal, textbook]
preset: keynesian
agents: { households: 1000, firms: 100 }
ticks: 60            # months
seed: 42
shocks:
  - { tick: 6, kind: food_price_shock, size: 0.15, duration: 6 }
player:
  role: central_bank
  controls: [repo_rate, crr]
  decision_every: 2  # ticks (MPC meets bi-monthly)
curriculum:
  - { course: "Money & Banking", unit: "Monetary policy instruments" }
  - { course: "Intermediate Macro", unit: "Phillips curve" }
teacher_kit: kits/rbi-governor-food-inflation.md
```

### 5.3 Run manifest and share links
- `RunManifest = { scenario (resolved), engine_version, seed, actions: [(tick, Action)] }`.
- Share link = content hash of the manifest, stored server-side (or encoded in the URL for small runs). Anyone opening it **re-simulates locally** and gets identical results (R4), so servers store kilobytes, not result data (R11).

---

## 6. Engine API (identical surface in JS and Python)

```text
Engine.load(scenario) -> Sim
sim.step(n=1) -> Metrics[]           # advance n ticks
sim.apply(action)                     # queue a player/policy action
sim.metrics() -> table                # all series so far
sim.snapshot() / Engine.restore(snap)
sim.trace(since_tick) -> events
sim.agent_panel(fields, sample=0.1) -> table
sim.sfc_matrices(tick) -> (balance_sheet, flows)
sim.textbook(model="islm") -> curves + equilibrium
sim.state_hash() -> str

# Python-only conveniences
econsim.sweep(scenario, grid={...}, seeds=range(50), workers=8) -> DataFrame
econsim.sensitivity(scenario, params=[...], method="sobol")
econsim.calibrate(scenario, targets, method="smm")
```

---

## 7. Tracks (front-ends over the same API)

| Track | Client | Key screens / features | Milestone |
|---|---|---|---|
| **Learn** | Web/PWA, mobile-first | Scenario picker by syllabus chapter → play (policy controls, live charts) → textbook vs ABM view → "why?" explainer → quiz; teacher: classrooms, assignments, dashboard | M1–M2 |
| **Research** | `pip install econsim`, Jupyter | Headless runs, sweeps, sensitivity, calibration, panel export, SFC matrices, ODD docs, Zenodo DOI per release | M2–M3 |
| **Policy Lab** | Web, desktop-first | Policy A vs B side by side, distributional impact (decile/state), exportable brief, embeddable charts | M3–M4 |
| **Embed** | iframe/JS widget | Live chart of a shared run for articles and posts | M3 |
| **Business** | Web | Input-cost and demand scenarios (scenario analysis, not forecasts or advice) | M5 |

Web app structure: a shared `ui-kit` (charts, controls auto-generated from `params_schema`), plus one route group per track.

---

## 8. Services (kept thin)

| Service | Responsibility | Notes |
|---|---|---|
| Auth & orgs | Users, colleges, classrooms, roles (student/teacher/researcher) | Supabase Auth or similar; Google + phone OTP (India) |
| Runs | Store manifests, share links, assignment submissions | KB-sized records |
| Content | Scenarios, teacher kits, quizzes, translations | Versioned in git, published as static JSON |
| Batch | Queue + workers running `econsim` for large sweeps | Paid research tier |
| Explainer | Trace → prompt → Claude API → explanation; cache by (manifest hash, tick) | Rate-limited; disabled offline |
| Data connectors | Offline Python jobs pulling RBI DBIE, MOSPI, World Bank, FRED → country YAML with source citations | Not user-facing |
| Analytics | Privacy-respecting usage metrics | Needed for teacher dashboards and product decisions |

The simulation never runs on the server for normal use, so cost scales with users only for storage and the explainer.

---

## 9. Repository layout (monorepo)

```
Simulator/
├── docs/                      # survey, architecture, ODD model docs, ADRs
├── engine/
│   ├── core/                  # Rust crate: world, ledger, phases, modules, markets, rules
│   ├── wasm/                  # wasm-bindgen wrapper + TS types
│   └── python/                # PyO3 + maturin → `econsim` package (sweep, calibrate…)
├── data/
│   ├── countries/             # india.yaml, usa.yaml …
│   ├── scenarios/             # by country & track
│   ├── presets/               # schools of thought
│   └── kits/                  # teacher kits, quizzes (md/json), i18n strings
├── web/
│   ├── app/                   # React app: tracks/learn, tracks/policy, tracks/embed
│   └── ui-kit/                # charts, schema-driven controls
├── services/
│   ├── api/                   # auth, runs, classrooms
│   ├── explainer/             # Claude API proxy
│   └── batch/                 # workers
├── pipelines/                 # data connectors → country profiles
└── tests/
    ├── golden/                # golden scenarios + expected state hashes
    └── stylized_facts/        # validation suite
```

---

## 10. Quality and validation strategy

| Test type | What it checks | When |
|---|---|---|
| Unit | Rules, markets, ledger operations | Every commit |
| **SFC invariants** | Flows sum to zero; money conservation | Every tick in debug; every test run |
| **Determinism** | Same manifest gives same state hash on native, WASM and Python | CI |
| **Golden scenarios** | Key metrics stay within tolerance of reviewed baselines | CI; changes need sign-off |
| **Stylized facts** | Phillips curve, Okun's law, right-skewed firm sizes, Pareto wealth tail, pro-cyclical investment, plausible inflation/unemployment ranges | Nightly; published dashboard |
| **Textbook agreement** | In the limit settings (flexible prices, homogeneous agents) the ABM approaches textbook predictions in sign and rough size | CI |
| Performance | 10k/1k/10 agents × 120 ticks under 3 s on a reference low-end device; WASM bundle under 1.5 MB gzipped | CI benchmark + device lab |
| Content | Every scenario loads, finishes, and its teacher-kit answers match the outputs | CI |

Versioning: the engine uses semver. Any change that alters outputs for the same manifest is a **minor bump** with a changelog entry. Old manifests record their version, and the web app can load older engine builds for exact replay.

---

## 11. Milestones (architecture view)

| Milestone | Engine | Clients | Done when |
|---|---|---|---|
| **M0 Foundations** | Workspace, ledger, phases, RNG, metrics, determinism CI | CLI runner | Empty-economy invariants pass on native + WASM |
| **M1 Demo** | `core_real` + `monetary` + `fiscal` + `textbook` (Lengnick-scale) | Learn: RBI Governor + Budget scenarios, textbook view, charts, English/Hindi | Business cycles emerge; teachers can play it on a phone |
| **M2 Pilot** | `banking`, `inequality`, presets, trace + explainer | Teacher classrooms; `econsim` alpha on PyPI | 3–5 college pilots running |
| **M3 Research and India depth** | `agriculture`, `informal`, `open_economy`; calibration pipeline | Research docs (ODD), sweeps/sensitivity; Policy Lab alpha; embeds | India calibration validated; first research collaboration |
| **M4 Scale** | `regions`, `networks` | Policy Lab v1; batch cloud runs | Think-tank or newsroom users |
| **M5 Frontier** | `financial_markets`, `climate`, `ai_agents` | Business track; global country packs | International university sales |

---

## 12. Key risks and how the architecture handles them

| Risk | Mitigation |
|---|---|
| Model gives silly results and loses credibility | SFC invariants, stylized-facts suite, open-source engine, ODD docs, golden-scenario review |
| Too slow on cheap phones | Struct-of-arrays, Rust/WASM, Web Worker, small default scenarios, performance CI |
| Results differ across platforms, breaking share links | `libm`, no hash iteration, per-module RNG streams, cross-platform hash CI |
| Engine complexity blocks teachers | Tracks expose curated scenarios; schema-driven UI hides parameters unless "advanced" |
| Rust learning curve slows the start | Keep the core small in M0–M1; option B (TypeScript) as fallback with the same API |
| LLM explainer cost or errors | Explanations grounded in the trace, cached per run/tick, optional and clearly labelled |

---

## 13. Open decisions

1. **Core language:** Rust (recommended) or TypeScript (faster start). Needs your call.
2. **Licence:** permissive (MIT/Apache, wider adoption) or copyleft (AGPL, like BeforeIT.jl, which protects against closed forks). Usually: engine Apache-2.0, web app and content proprietary.
3. **Backend host:** Supabase (fastest) or self-hosted Postgres + FastAPI (more control).
4. **Name** of the product and package (`econsim` is a placeholder; check availability).
