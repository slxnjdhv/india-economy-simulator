# India Economy Simulator (Economy Lab)

An agent-based simulator of the Indian economy for economics teaching and research. Students set policy, such as the RBI's repo rate, and watch a simulated economy of households, firms and banks respond.

**Play the prototype:** https://slxnjdhv.github.io/india-economy-simulator/prototype/  
**Guided lessons:** https://slxnjdhv.github.io/india-economy-simulator/prototype/lessons.html  
**Experiment Lab:** https://slxnjdhv.github.io/india-economy-simulator/prototype/lab.html  
**Calibration report:** https://slxnjdhv.github.io/india-economy-simulator/prototype/calibration.html

## What's here

| Folder | Contents |
|---|---|
| [`prototype/`](prototype/) | **Play a scenario:** four policy games (RBI Governor in a failed monsoon or an oil shock, Finance Minister in a slowdown, and free play) with replay links and data downloads. **Guided lessons:** seven auto-graded lessons for BSc and MSc topics, with completion codes for teachers. **Experiment Lab:** set up your own experiments and run up to 1,000 simulated economies of up to 20,000 households each. See the [prototype README](prototype/README.md). |
| [`calibration/`](calibration/) | Indian data (RBI, MoSPI, PLFS, World Bank) with sources, and the program that calibrates the model to it by the simulated method of moments. |
| [`docs/economic-simulators-survey.md`](docs/economic-simulators-survey.md) | A survey of existing economic simulators, the market, and how the idea fits BSc and MSc Economics syllabi. |
| [`docs/architecture.md`](docs/architecture.md) | The planned architecture for the full engine, the classroom web app and the Python package for researchers. |
| [`docs/concept-note/`](docs/concept-note/) | A one-page concept note for institutes, as LaTeX source and PDF. |
| [`media/`](media/) | A 64-second concept video and the HTML animation it was rendered from. |

## The model
1,000 households and 100 firms trade, borrow and work every month, with a banking sector, moneylenders, the government, the RBI and the rest of the world. The model includes:
- **food and non-food sectors.** Food is 46% of the CPI basket.
- **random harvest, oil-price and demand shocks**, sized to match Indian data.
- **a large informal sector.** About 74% of non-farm jobs are informal, as in PLFS data: they're untaxed, less productive and financed by moneylenders.
- **the rupee.** It floats, starting each game at ₹83 per US dollar.
- **imported inputs such as oil, and exports.**
- **GST and taxes on wages.**

Every rupee is tracked, and the accounts are checked every month.

## Status

This is a prototype. Sixteen model settings are calibrated to Indian data from 2015–2024 (RBI, MoSPI, PLFS and the World Bank). The calibration targets 11 features of the data: the level, variability and persistence of inflation, food-price swings, unemployment, the repo rate, the rupee's trend and volatility, imports, informality and GDP swings. Three more features were kept back as checks: two match, and the current account doesn't, because the model has no remittances. Inflation persistence is now matched too. See the [calibration report](https://slxnjdhv.github.io/india-economy-simulator/prototype/calibration.html). It is a teaching tool, not a forecast.

## Author

Dr Sulaxan
