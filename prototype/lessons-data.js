/* Economy Lab: guided lessons. Each lesson runs real experiments on the engine, and
   every graded answer is computed from the student's own simulated economy. */
(function (root) {
  'use strict';
  const E = root.EconEngine;
  const F = ['infl', 'foodInfl', 'coreInfl', 'u', 'repo', 'loanRate', 'piE', 'I', 'G', 'gdp', 'er', 'tradeBal'];
  const run = (seed, o) => E.runLab(Object.assign({ seed, months: 36, fields: F }, o));
  const mean = (a, i, j) => { let s = 0; for (let k = i; k < j; k++) s += a[k]; return s / (j - i); };
  const max = a => { let m = -Infinity; for (const v of a) m = Math.max(m, v); return m; };
  const pct = (v, d = 1) => (100 * v).toFixed(d) + '%';
  const pts = (a, k = 100) => Array.from(a, (v, i) => ({ x: i + 1, y: v * k }));
  const MONTHS = { xMin: 1, xMax: 36, xTicks: [6, 12, 18, 24, 30, 36], xLabel: t => 'M' + t };
  const shade = (key, start, label) => { const s = E.SHOCKS[key]; return { from: start + 1, to: start + s.months, label }; };

  const LESSONS = [
    {
      id: 'monsoon', title: 'Food prices and a failed monsoon', topic: 'Supply shocks · headline and core inflation',
      syllabus: 'BSc Macroeconomics: aggregate supply and inflation', minutes: 12,
      idea: [
        'Food is 46% of India’s consumer price index (CPI). When the monsoon fails, the harvest is smaller and food prices jump.',
        'Economists split inflation in two. <b>Headline</b> inflation covers everything in the CPI basket. <b>Core</b> inflation leaves out food and fuel, so it shows whether price rises are spreading to the rest of the economy.',
        'In this experiment the RBI keeps the repo rate unchanged, so you can see the shock on its own.',
      ],
      setup: ['1,000 households and 100 firms (30 grow or sell food).', 'The monsoon fails in month 4. Farm output stays low for 9 months, then recovers over a year.', 'The repo rate is held unchanged throughout.'],
      predict: { q: 'After the monsoon fails, which will rise more?', options: ['Food inflation', 'Core inflation', 'Both by about the same'],
        actual: d => max(d.m.foodInfl) - max(d.m.coreInfl) > 0.01 ? 0 : max(d.m.coreInfl) - max(d.m.foodInfl) > 0.01 ? 1 : 2 },
      async run(seed, tick) { const m = run(seed, { policy: { mode: 'fixed' }, shocks: [{ key: 'monsoon', start: 3 }] }); await tick(1); return { m }; },
      charts: (d, c) => [{
        title: 'Inflation, % over the last 12 months', legend: [['Headline', c.accent], ['Food', c.food], ['Core', c.auto, 'dash']],
        opt: Object.assign({ series: [{ data: pts(d.m.foodInfl), color: c.food }, { data: pts(d.m.coreInfl), color: c.auto, dash: 'dash' }, { data: pts(d.m.infl), color: c.accent, width: 2.8 }],
          bandY: [2, 6], shade: [shade('monsoon', 3, 'Monsoon fails')] }, MONTHS),
      }],
      questions: [
        { type: 'num', q: 'What was the highest food inflation rate? Read it from the chart.', unit: '%', tol: 0.7, answer: d => 100 * max(d.m.foodInfl) },
        { type: 'num', q: 'What was the highest headline inflation rate?', unit: '%', tol: 0.5, answer: d => 100 * max(d.m.infl) },
        { type: 'mcq', q: 'Why did headline inflation rise much less than food inflation?',
          options: ['Food is only part of the CPI basket, so other prices dilute the jump', 'The RBI cut the repo rate', 'Core prices fell sharply at the same time'], answer: () => 0,
          explain: () => 'Headline inflation is a weighted average. With food at 46% of the basket, a large food jump moves the headline by less than half as much.' },
        { type: 'mcq', q: 'In month 30, after the harvest has recovered, food inflation is…', options: ['Above 6%', 'Between 2% and 6%', 'Below 2%'],
          answer: d => { const v = d.m.foodInfl[29]; return v > 0.06 ? 0 : v >= 0.02 ? 1 : 2; },
          explain: d => `Food inflation in month 30 was ${pct(d.m.foodInfl[29])}. Once harvests recover, food prices fall back from their peak, so prices compared with a year earlier rise slowly or even fall.` },
      ],
      takeaway: 'A monsoon shock raises food prices sharply but briefly. Core inflation tells the RBI whether the shock is spreading. If it isn’t, the RBI can often “look through” the shock instead of raising rates.',
    },
    {
      id: 'phillips', title: 'The inflation and jobs trade-off', topic: 'The Phillips curve · sacrifice ratio',
      syllabus: 'BSc Macroeconomics: Phillips curve and policy trade-offs', minutes: 12,
      idea: [
        'The Phillips curve says that, in the short run, lower inflation usually comes with higher unemployment.',
        'When the RBI keeps interest rates high, people borrow and spend less, firms hire fewer workers and price rises slow down. The <b>sacrifice ratio</b> measures the cost: how many points of extra unemployment it takes to get one point less inflation.',
        'Here you run three identical economies with the same luck. Only the repo rate differs.',
      ],
      setup: ['Three copies of the same economy, with the same households, firms and luck.', 'The repo rate is held 1.5 points below, at, or 1.5 points above its starting level for 3 years.', 'No shocks.'],
      predict: { q: 'Compared with the low-rate economy, the high-rate economy will have…',
        options: ['Lower inflation and higher unemployment', 'Lower inflation and lower unemployment', 'Higher inflation and higher unemployment', 'Higher inflation and lower unemployment'],
        actual: d => phillipsCase(d) },
      async run(seed, tick) {
        const lo = run(seed, { policy: { mode: 'fixed', repoDelta: -0.015 } }); await tick(1 / 3);
        const mid = run(seed, { policy: { mode: 'fixed' } }); await tick(2 / 3);
        const hi = run(seed, { policy: { mode: 'fixed', repoDelta: 0.015 } }); await tick(1);
        return { lo, mid, hi };
      },
      charts: (d, c) => {
        const lg = [['Low rate', c.food], ['Starting rate', c.hold, 'dash'], ['High rate', c.bad]];
        const s = k => [{ data: pts(d.lo[k]), color: c.food }, { data: pts(d.mid[k]), color: c.hold, dash: 'dash' }, { data: pts(d.hi[k]), color: c.bad }];
        return [
          { title: 'Inflation, %', legend: lg, opt: Object.assign({ series: s('infl'), bandY: [2, 6] }, MONTHS) },
          { title: 'Unemployment, %', legend: lg, opt: Object.assign({ series: s('u') }, MONTHS) },
        ];
      },
      table: d => ({ caption: 'Averages in years 2 and 3 (months 13–36)', head: ['Economy', 'Repo rate', 'Inflation', 'Unemployment'],
        rows: [['Low rate', d.lo], ['Starting rate', d.mid], ['High rate', d.hi]].map(([n, r]) => [n, pct(r.startRepo, 2), pct(mean(r.infl, 12, 36), 2), pct(mean(r.u, 12, 36), 2)]) }),
      questions: [
        { type: 'mcq', q: 'Compared with the low-rate economy, the high-rate economy had…',
          options: ['Lower inflation and higher unemployment', 'Lower inflation and lower unemployment', 'Higher inflation and higher unemployment', 'Higher inflation and lower unemployment'],
          answer: d => phillipsCase(d) },
        { type: 'num', q: 'Use the table. By how many points was unemployment higher in the high-rate economy than in the low-rate one?', unit: 'points', tol: 0.15,
          answer: d => 100 * (mean(d.hi.u, 12, 36) - mean(d.lo.u, 12, 36)) },
        { type: 'num', q: 'Sacrifice ratio: divide the extra unemployment by the fall in inflation (high-rate versus low-rate economy).', unit: '', tol: 0.15, rel: true,
          answer: d => (mean(d.hi.u, 12, 36) - mean(d.lo.u, 12, 36)) / (mean(d.lo.infl, 12, 36) - mean(d.hi.infl, 12, 36)),
          explain: d => `${(100 * (mean(d.hi.u, 12, 36) - mean(d.lo.u, 12, 36))).toFixed(2)} ÷ ${(100 * (mean(d.lo.infl, 12, 36) - mean(d.hi.infl, 12, 36))).toFixed(2)} = ${((mean(d.hi.u, 12, 36) - mean(d.lo.u, 12, 36)) / (mean(d.lo.infl, 12, 36) - mean(d.hi.infl, 12, 36))).toFixed(2)} points of unemployment for each point of inflation.` },
        { type: 'mcq', q: 'Why does the trade-off exist in the short run?',
          options: ['Prices and wages adjust slowly, so lower demand cuts jobs before it cuts price rises', 'Higher interest rates directly raise firms’ prices', 'Unemployed workers spend more'], answer: () => 0,
          explain: () => 'Firms change prices only occasionally and wages follow slowly. When demand falls, firms cut hiring first and price rises slow down later.' },
      ],
      takeaway: 'Lower inflation has a cost in jobs, at least for a while. The sacrifice ratio is why the RBI tries to keep inflation near 4% in the first place: bringing it down later is expensive.',
    },
    {
      id: 'transmission', title: 'How a rate hike travels through the economy', topic: 'Monetary transmission · policy lags',
      syllabus: 'BSc Money and Banking: transmission mechanism', minutes: 12,
      idea: [
        'When the RBI raises the repo rate, banks raise the rates they charge on loans. Firms invest less and households borrow and spend less. Lower demand then cools hiring and, eventually, prices.',
        'Each link takes time. Economists call these delays <b>policy lags</b>.',
        'Here you compare the same economy twice: once with the repo rate unchanged, and once with a 2-point hike in month 1.',
      ],
      setup: ['Two copies of the same economy, with the same luck.', 'One keeps the repo rate unchanged. The other raises it by 2 points in month 1 and keeps it there.', 'No shocks.'],
      predict: { q: 'Which will respond first to the rate hike?', options: ['Bank loan rates and investment', 'Unemployment', 'Inflation'], actual: () => 0 },
      async run(seed, tick) {
        const base = run(seed, { policy: { mode: 'fixed' } }); await tick(0.5);
        const hike = run(seed, { policy: { mode: 'fixed', repoDelta: 0.02 } }); await tick(1);
        return { base, hike };
      },
      charts: (d, c) => {
        const lg = [['No change', c.hold, 'dash'], ['2-point hike', c.accent]];
        const s = (k, f) => [{ data: pts(d.base[k], f), color: c.hold, dash: 'dash' }, { data: pts(d.hike[k], f), color: c.accent }];
        return [
          { title: 'Bank loan rate, %', legend: lg, opt: Object.assign({ series: s('loanRate') }, MONTHS) },
          { title: 'Investment, % of starting GDP', legend: lg, opt: Object.assign({ series: s('I', 1) }, MONTHS) },
          { title: 'Unemployment, %', legend: lg, opt: Object.assign({ series: s('u') }, MONTHS) },
          { title: 'Inflation, %', legend: lg, opt: Object.assign({ series: s('infl'), bandY: [2, 6] }, MONTHS) },
        ];
      },
      questions: [
        { type: 'mcq', q: 'Which responded first to the hike?', options: ['Bank loan rates', 'Unemployment', 'Inflation'], answer: () => 0,
          explain: () => 'Banks pass the higher repo rate on to loan rates straight away. Spending, jobs and prices follow over the next months.' },
        { type: 'num', q: 'In which month was inflation in the hike economy first at least 0.5 points below the other economy?', unit: 'month', tol: 2, step: 1,
          answer: d => lagMonth(d) },
        { type: 'num', q: 'In year 2 (months 13–24), how many points higher was average unemployment in the hike economy?', unit: 'points', tol: 0.4,
          answer: d => 100 * (mean(d.hike.u, 12, 24) - mean(d.base.u, 12, 24)) },
        { type: 'mcq', q: 'Why does the RBI set rates by looking at inflation forecasts rather than today’s inflation?',
          options: ['A rate change takes several months to affect inflation', 'Today’s inflation is not measured', 'Forecasts are always right'], answer: () => 0,
          explain: d => `In your economy, inflation took about ${lagMonth(d)} months to respond. A decision made today mostly affects inflation months from now.` },
      ],
      takeaway: 'Monetary policy works through a chain: loan rates, then spending and jobs, then prices. Because the chain takes months, central banks have to act on forecasts.',
    },
    {
      id: 'anchor', title: 'Why trust in the 4% target matters', topic: 'Inflation expectations · credibility',
      syllabus: 'MSc Monetary Economics: expectations and inflation targeting', minutes: 12,
      idea: [
        'Since 2016 the RBI has had a legal target of 4% inflation, within a band of 2% to 6%.',
        'If people believe the RBI will meet the target, their expectations are <b>anchored</b>. Workers don’t demand big pay rises after a temporary shock, so firms don’t keep raising prices.',
        'Here an oil shock hits two identical economies. In one, people trust the 4% target. In the other, they expect future inflation to look like recent inflation.',
      ],
      setup: ['Two copies of the same economy, with the same luck.', 'Oil prices spike in month 3 and costs rise for every firm.', 'Anchored: expectations stay 90% tied to the 4% target. Unanchored: expectations follow recent inflation only.', 'The repo rate is held unchanged.'],
      predict: { q: 'After the oil shock, in which economy will high inflation last longer?', options: ['The anchored economy', 'The unanchored economy', 'About the same'],
        actual: d => anchorCase(d) },
      async run(seed, tick) {
        const sh = [{ key: 'oil', start: 2 }];
        const a = run(seed, { params: { anchor: 0.9 }, policy: { mode: 'fixed' }, shocks: sh }); await tick(0.5);
        const u = run(seed, { params: { anchor: 0 }, policy: { mode: 'fixed' }, shocks: sh }); await tick(1);
        return { a, u };
      },
      charts: (d, c) => {
        const lg = [['Anchored', c.auto], ['Unanchored', c.bad, 'dash']];
        const s = k => [{ data: pts(d.a[k]), color: c.auto }, { data: pts(d.u[k]), color: c.bad, dash: 'dash' }];
        const sh = [shade('oil', 2, 'Oil shock')];
        return [
          { title: 'Inflation, %', legend: lg, opt: Object.assign({ series: s('infl'), bandY: [2, 6], shade: sh }, MONTHS) },
          { title: 'Expected inflation, %', legend: lg, opt: Object.assign({ series: s('piE'), shade: sh }, MONTHS) },
        ];
      },
      table: d => ({ caption: 'Inflation after the shock', head: ['Economy', 'Peak', 'Average, months 7–30'],
        rows: [['Anchored', d.a], ['Unanchored', d.u]].map(([n, r]) => [n, pct(max(r.infl), 2), pct(mean(r.infl, 6, 30), 2)]) }),
      questions: [
        { type: 'mcq', q: 'How did the peak of inflation compare?', options: ['Much higher when anchored', 'Much higher when unanchored', 'About the same (within 1.5 points)'],
          answer: d => { const g = max(d.u.infl) - max(d.a.infl); return g > 0.015 ? 1 : g < -0.015 ? 0 : 2; },
          explain: () => 'Trust doesn’t stop the first jump in prices: the oil shock raises costs either way. It changes what happens next.' },
        { type: 'num', q: 'How many points higher was average inflation in months 7–30 in the unanchored economy?', unit: 'points', tol: 0.2,
          answer: d => 100 * (mean(d.u.infl, 6, 30) - mean(d.a.infl, 6, 30)) },
        { type: 'mcq', q: 'What does it mean for expectations to be “anchored”?',
          options: ['People expect inflation to return to the target even after a shock', 'Prices are fixed by law', 'Inflation is always exactly 4%'], answer: () => 0 },
        { type: 'mcq', q: 'Which policy most helps keep expectations anchored?',
          options: ['A clear target that the central bank is seen to meet over time', 'Changing the target after every shock', 'Keeping interest rates fixed forever'], answer: () => 0,
          explain: () => 'Credibility is built by meeting the target over years. That is why the RBI explains its decisions and reports when it misses the band.' },
      ],
      takeaway: 'Credibility is valuable. When people trust the target, a supply shock causes a short burst of inflation instead of a long one, and the RBI needs smaller rate rises to control it.',
    },
    {
      id: 'multiplier', title: 'The fiscal multiplier in a slowdown', topic: 'Fiscal policy · multiplier · crowding out',
      syllabus: 'BSc Public Finance: fiscal multipliers', minutes: 15,
      idea: [
        'When the government spends an extra rupee, the people it pays spend part of it again, and so on. The <b>fiscal multiplier</b> is the total rise in GDP for each rupee of extra government spending.',
        'The multiplier can be smaller than 1 if the RBI raises interest rates in response, which reduces private spending. This is called <b>crowding out</b>.',
        'Here a global slowdown hits two identical economies. In one, the government raises spending by 2% of GDP. The RBI follows its usual rule in both.',
      ],
      setup: ['Two copies of the same economy, with the same luck.', 'A global slowdown starts in month 4: exports fall and firms and households spend less.', 'Stimulus: government spending rises by 2% of GDP from month 1.', 'The RBI sets the repo rate with its usual rule in both.'],
      predict: { q: 'For each extra rupee of government spending, GDP will rise by…', options: ['More than ₹1', 'Less than ₹1', 'Not at all'], actual: d => multiplier(d) > 1 ? 0 : multiplier(d) > 0.05 ? 1 : 2 },
      async run(seed, tick) {
        const sh = [{ key: 'slowdown', start: 3 }];
        const base = run(seed, { policy: { mode: 'rule' }, shocks: sh }); await tick(0.5);
        const stim = run(seed, { policy: { mode: 'rule', spendDelta: 0.02 }, shocks: sh }); await tick(1);
        return { base, stim };
      },
      charts: (d, c) => {
        const lg = [['No stimulus', c.hold, 'dash'], ['Stimulus', c.accent]];
        const s = (k, f) => [{ data: pts(d.base[k], f), color: c.hold, dash: 'dash' }, { data: pts(d.stim[k], f), color: c.accent }];
        const sh = [shade('slowdown', 3, 'Slowdown')];
        return [
          { title: 'GDP, % of starting GDP', legend: lg, opt: Object.assign({ series: s('gdp', 1), shade: sh }, MONTHS) },
          { title: 'Unemployment, %', legend: lg, opt: Object.assign({ series: s('u'), shade: sh }, MONTHS) },
          { title: 'Repo rate set by the RBI, %', legend: lg, opt: Object.assign({ series: s('repo').map(x => Object.assign(x, { stepped: true })), shade: sh }, MONTHS) },
        ];
      },
      table: d => { const t = totals(d); return { caption: 'Totals over the first 12 months, as % of one month’s starting GDP', head: ['Measure', 'Value'],
        rows: [['Extra government spending (ΔG)', (100 * t.dG).toFixed(1)], ['Extra GDP (ΔGDP)', (100 * t.dY).toFixed(1)]] }; },
      questions: [
        { type: 'num', q: 'Use the table to calculate the multiplier: ΔGDP ÷ ΔG.', unit: '', tol: 0.05, answer: d => multiplier(d),
          explain: d => { const t = totals(d); return `${(100 * t.dY).toFixed(1)} ÷ ${(100 * t.dG).toFixed(1)} = ${multiplier(d).toFixed(2)}.`; } },
        { type: 'num', q: 'How many points lower was average unemployment in the stimulus economy in the first year?', unit: 'points', tol: 0.4,
          answer: d => 100 * (mean(d.base.u, 0, 12) - mean(d.stim.u, 0, 12)) },
        { type: 'mcq', q: 'In the stimulus economy, the RBI set the repo rate…', options: ['Higher than without stimulus', 'Lower than without stimulus', 'The same'],
          answer: d => { const g = mean(d.stim.repo, 0, 24) - mean(d.base.repo, 0, 24); return g > 0.0005 ? 0 : g < -0.0005 ? 1 : 2; } },
        { type: 'mcq', q: 'Why might the multiplier be smaller when the central bank reacts to the stimulus?',
          options: ['Higher interest rates reduce private investment and spending (crowding out)', 'Government spending is not counted in GDP', 'Taxes fall automatically'], answer: () => 0 },
      ],
      takeaway: 'Government spending can soften a slowdown, but the size of the effect depends on how the central bank and households respond. Multipliers are not fixed numbers.',
    },
    {
      id: 'rupee', title: 'Oil, the rupee and imported inflation', topic: 'Exchange rates · trade balance · imported inflation',
      syllabus: 'BSc International Economics: exchange rates and the balance of payments', minutes: 12,
      idea: [
        'India imports most of the oil it uses, along with gas, fertiliser and electronic parts. They are priced in dollars.',
        'When world oil prices jump, India needs more dollars to pay for the same imports. Importers sell more rupees, so the rupee <b>weakens</b>, which makes imports dearer still. Economists call the result <b>imported inflation</b>.',
        'Higher interest rates pull foreign money into India and support the rupee. Here you compare three identical economies to see both effects.',
      ],
      setup: ['Three copies of the same economy, with the same luck. The rupee starts at ₹83 per dollar.', 'No shock: world oil prices stay steady.', 'Oil shock: world oil prices rise by half in month 3, for 10 months.', 'Oil shock and rate rise: the same shock, but the RBI raises the repo rate by 1.5 points in month 1.'],
      predict: { q: 'When world oil prices jump, the rupee will…', options: ['Weaken (more rupees per dollar)', 'Strengthen (fewer rupees per dollar)', 'Stay about the same'],
        actual: d => d.oil.er[11] > d.base.er[11] * 1.005 ? 0 : d.oil.er[11] < d.base.er[11] * 0.995 ? 1 : 2 },
      async run(seed, tick) {
        const sh = [{ key: 'oil', start: 2 }];
        const base = run(seed, { policy: { mode: 'fixed' } }); await tick(1 / 3);
        const oil = run(seed, { policy: { mode: 'fixed' }, shocks: sh }); await tick(2 / 3);
        const hike = run(seed, { policy: { mode: 'fixed', repoDelta: 0.015 }, shocks: sh }); await tick(1);
        return { base, oil, hike };
      },
      charts: (d, c) => {
        const lg = [['No shock', c.hold, 'dash'], ['Oil shock', c.bad], ['Oil shock and rate rise', c.auto]];
        const s = (k, f) => [{ data: pts(d.base[k], f), color: c.hold, dash: 'dash' }, { data: pts(d.oil[k], f), color: c.bad }, { data: pts(d.hike[k], f), color: c.auto }];
        const sh = [shade('oil', 2, 'Oil shock')];
        return [
          { title: 'Rupees per US dollar', legend: lg, opt: Object.assign({ series: s('er', E.RUPEE_START), shade: sh, minSpan: 2 }, MONTHS) },
          { title: 'Trade balance, % of GDP', legend: lg, opt: Object.assign({ series: s('tradeBal'), shade: sh }, MONTHS) },
          { title: 'CPI inflation, %', legend: lg, opt: Object.assign({ series: s('infl'), bandY: [2, 6], shade: sh }, MONTHS) },
        ];
      },
      table: d => ({ caption: 'Results', head: ['Economy', '₹ per $ in month 12', 'Avg trade balance, months 3–14', 'Avg inflation, months 3–14'],
        rows: [['No shock', d.base], ['Oil shock', d.oil], ['Oil shock and rate rise', d.hike]].map(([n, r]) => [n, '₹' + (r.er[11] * E.RUPEE_START).toFixed(2), pct(mean(r.tradeBal, 2, 14), 2), pct(mean(r.infl, 2, 14), 2)]) }),
      questions: [
        { type: 'num', q: 'Use the table. By how many rupees per dollar did the oil shock weaken the rupee by month 12 (oil shock minus no shock)?', unit: '₹', tol: 0.1,
          answer: d => E.RUPEE_START * (d.oil.er[11] - d.base.er[11]) },
        { type: 'num', q: 'How large was the average trade deficit in the oil-shock economy in months 3–14, as % of GDP? Enter it as a positive number.', unit: '%', tol: 0.05,
          answer: d => -100 * mean(d.oil.tradeBal, 2, 14) },
        { type: 'mcq', q: 'Compared with the oil shock alone, raising rates made the rupee…', options: ['Stronger', 'Weaker', 'No different'],
          answer: d => d.hike.er[11] < d.oil.er[11] * 0.995 ? 0 : d.hike.er[11] > d.oil.er[11] * 1.005 ? 1 : 2,
          explain: d => `In month 12 the rupee was ₹${(d.hike.er[11] * E.RUPEE_START).toFixed(2)} with the rate rise and ₹${(d.oil.er[11] * E.RUPEE_START).toFixed(2)} without. Higher Indian rates attract foreign savings, which buy rupees.` },
        { type: 'mcq', q: 'Why does a rise in world oil prices weaken the rupee?',
          options: ['India must pay for oil in dollars, so importers sell more rupees to buy them', 'Oil companies are not allowed to use rupees in India', 'Higher oil prices raise India’s exports'], answer: () => 0,
          explain: () => 'A bigger import bill means more demand for dollars and more supply of rupees in currency markets, so the rupee falls. A weaker rupee then makes every import dearer.' },
      ],
      takeaway: 'For an oil importer like India, an oil shock hits twice: dearer oil, and a weaker rupee that makes all imports dearer. Higher interest rates can support the rupee, but only by slowing the economy, which is why the RBI also uses its dollar reserves to steady the currency.',
    },
    {
      id: 'luck', title: 'Luck, noise and why we run many economies', topic: 'Uncertainty · counterfactuals · causal inference',
      syllabus: 'BSc Econometrics: sampling variation and causal effects', minutes: 10,
      idea: [
        'Every economy in this simulator has its own luck: who finds a job, which shop people visit, which firm wins a contract. Two economies with identical rules still end up a little different.',
        'This matters for evidence. If one country does better than another, was it policy or luck? Economists use <b>many runs</b> and <b>counterfactuals</b> (the same economy with and without a policy) to tell the two apart.',
        'Here you run 20 economies with exactly the same rules and no shocks.',
      ],
      setup: ['20 economies with the same rules and policy, each with different luck.', 'The RBI follows its usual rule. No shocks.', 'Each runs for 3 years.'],
      predict: { q: 'Across 20 economies with identical rules, the range of average unemployment will be…', options: ['Zero: same rules, same result', 'Less than 1 point', 'More than 1 point'],
        actual: d => { const r = spread(d); return r < 0.0001 ? 0 : r < 0.01 ? 1 : 2; } },
      async run(seed, tick) {
        const runs = [];
        for (let i = 0; i < 20; i++) { runs.push(run(seed * 31 + i, { policy: { mode: 'rule' } })); await tick((i + 1) / 20); }
        return { runs };
      },
      charts: (d, c) => [{
        title: 'Unemployment in 20 economies, %', legend: [['Each line is one economy', c.auto]],
        opt: Object.assign({ series: d.runs.map(r => ({ data: pts(r.u), color: c.auto, width: 1.2 })) }, MONTHS),
      }],
      table: d => ({ caption: 'Average unemployment over 3 years, sorted', head: ['Rank', 'Economy', 'Unemployment'],
        rows: d.runs.map((r, i) => ({ i, v: mean(r.u, 0, 36) })).sort((a, b) => a.v - b.v).map((x, k) => [String(k + 1), '#' + (x.i + 1), pct(x.v, 2)]) }),
      questions: [
        { type: 'num', q: 'Use the table. What is the range of average unemployment (highest minus lowest)?', unit: 'points', tol: 0.05, answer: d => 100 * spread(d) },
        { type: 'mcq', q: 'One economy raised rates and ended with unemployment 0.3 points higher than another that didn’t. Can you conclude the hike caused it?',
          options: ['No: luck alone can create differences that large', 'Yes: any difference must be caused by policy', 'Yes, as long as both economies are in India'],
          answer: () => 0, explain: d => `In your table, luck alone created a range of ${(100 * spread(d)).toFixed(2)} points between economies with identical rules.` },
        { type: 'mcq', q: 'What is the fairest way to measure the effect of a policy in this simulator?',
          options: ['Run the same economies with and without the policy, then compare', 'Run one economy once with the policy', 'Compare two economies with different luck'], answer: () => 0,
          explain: () => 'Using the same luck in both runs removes noise. Repeating it across many economies shows how reliable the effect is. The Experiment Lab does exactly this.' },
      ],
      takeaway: 'One run is an anecdote, not evidence. Good experiments compare like with like and repeat many times, which is what the Experiment Lab is built for.',
    },
  ];

  function phillipsCase(d) {
    const di = mean(d.hi.infl, 12, 36) - mean(d.lo.infl, 12, 36), du = mean(d.hi.u, 12, 36) - mean(d.lo.u, 12, 36);
    return di < 0 ? (du > 0 ? 0 : 1) : (du > 0 ? 2 : 3);
  }
  function lagMonth(d) {
    for (let i = 0; i < 36; i++) if (d.hike.infl[i] < d.base.infl[i] - 0.005) return i + 1;
    return 36;
  }
  function anchorCase(d) {
    const g = mean(d.u.infl, 6, 30) - mean(d.a.infl, 6, 30);
    return g > 0.003 ? 1 : g < -0.003 ? 0 : 2;
  }
  function totals(d) {
    let dG = 0, dY = 0;
    for (let i = 0; i < 12; i++) { dG += (d.stim.G[i] - d.base.G[i]) / 100; dY += (d.stim.gdp[i] - d.base.gdp[i]) / 100; }
    return { dG, dY };
  }
  function multiplier(d) { const t = totals(d); return Math.round(100 * t.dY / t.dG) / 100; }
  function spread(d) { const v = d.runs.map(r => mean(r.u, 0, 36)); return Math.max(...v) - Math.min(...v); }

  // Grade one answer. Numeric answers allow an absolute (or relative) tolerance.
  function grade(q, data, given) {
    const ans = q.answer(data);
    if (q.type === 'mcq') return { ok: given === ans, ans };
    const x = parseFloat(String(given).replace(',', '.'));
    if (!isFinite(x)) return { ok: false, ans };
    const tol = q.rel ? Math.abs(ans) * q.tol : q.tol;
    return { ok: Math.abs(x - ans) <= tol + 1e-9, ans };
  }

  root.EconLessons = { LESSONS, grade };
})(typeof window !== 'undefined' ? window : globalThis);
