/**
 * CO2 Budget Map — calculations
 *
 * Turns the raw data (js/co2data.js) and the budget assumptions
 * (js/config.js) into the numbers the interface shows. Every view of the
 * app (map, globe, tooltip, panel, ranking) reads its figures from here,
 * so they cannot drift apart.
 *
 * Metrics:
 *   paris, paris2  current emissions against an equal per-capita share of
 *                  the remaining 1.5 °C / 2 °C budget
 *   co2, cons      territorial / consumption-based emissions against the
 *                  world average per person
 *   hist           cumulative emissions since 1750 per person alive today,
 *                  against the world average
 */

const METRICS = ['paris', 'paris2', 'co2', 'cons', 'hist'];

function isParisMetric(metric) {
  return metric === 'paris' || metric === 'paris2';
}

/**
 * Derived figures for one Paris budget.
 * @returns {{warming:number, likelihood:number, from2020:number, remaining:number,
 *            years:number, annualGlobal:number, perCapita:number}}
 */
/**
 * The newer budget estimate (js/config.js), spread the same way as the
 * Paris budgets: evenly over the years to the target year and over
 * everyone alive today.
 */
function getNewerBudgetEstimate() {
  const years = BUDGET_TARGET_YEAR - NEWER_BUDGET_ESTIMATE.fromYear + 1;
  return {
    ...NEWER_BUDGET_ESTIMATE,
    years,
    perCapita: (NEWER_BUDGET_ESTIMATE.remaining * 1000) / years / WORLD_TOTALS.pop,
  };
}

function getParisBudget(metric) {
  const base = PARIS_BUDGETS[metric];
  if (!base) return null;
  const startYear = DATA_META.dataYear + 1;                       // first year the rest covers
  const emitted = WORLD_TOTALS.emittedSince2020;                  // Gt, 2020 to the data year
  const remaining = base.from2020 - emitted;                      // Gt from startYear
  const years = BUDGET_TARGET_YEAR - startYear + 1;               // startYear..2050
  const annualGlobal = (remaining * 1000) / years;                // Mt per year
  return {
    ...base,
    startYear,
    emitted,
    remaining,
    years,
    annualGlobal,
    perCapita: annualGlobal / WORLD_TOTALS.pop,                   // t per person and year
  };
}

/**
 * The per-capita value a country is compared with: the fair budget share
 * for the Paris metrics, the world average for the others. In tonnes.
 */
function getReferencePerCapita(metric) {
  if (isParisMetric(metric)) return getParisBudget(metric).perCapita;
  if (metric === 'hist') return (WORLD_TOTALS.hist * 1000) / WORLD_TOTALS.pop;
  return WORLD_TOTALS[metric === 'cons' ? 'cons' : 'co2'] / WORLD_TOTALS.pop;
}

/**
 * A country's emissions for a metric, in Mt (cumulative Mt for `hist`).
 * The Paris and consumption metrics prefer consumption-based data and fall
 * back to territorial emissions where none exists.
 * @returns {{value:number|null, usedFallback:boolean}}
 */
function getMetricEmissions(d, metric) {
  if (metric === 'hist') {
    return { value: d.hist != null ? d.hist * 1000 : null, usedFallback: false };
  }
  if (metric === 'co2') return { value: d.co2, usedFallback: false };
  if (d.cons != null) return { value: d.cons, usedFallback: false };
  return { value: d.co2, usedFallback: d.co2 != null };
}

/**
 * Tonnes of CO₂ per person for a metric, or null without data.
 */
function getPerCapita(id, metric) {
  const d = CO2_DATA[id];
  if (!d || !d.pop) return null;
  const { value } = getMetricEmissions(d, metric);
  return value != null ? value / d.pop : null;
}

/**
 * How many times its reference a country emits per person.
 * 1 means exactly the fair share (or exactly the world average).
 */
function getBudgetRatio(id, metric) {
  const perCapita = getPerCapita(id, metric);
  return perCapita != null ? perCapita / getReferencePerCapita(metric) : null;
}

/**
 * Everything the info panel needs for one country. `ratio` is null when
 * the country has no data for the metric.
 */
function getCountryStats(id, metric) {
  const d = CO2_DATA[id];
  if (!d) return null;
  return {
    name: d.name,
    population: d.pop,
    co2: d.co2,
    cons: d.cons,
    hist: d.hist,
    ratio: getBudgetRatio(id, metric),
    perCapita: getPerCapita(id, metric),
    usedFallback: getMetricEmissions(d, metric).usedFallback,
  };
}

/**
 * All countries with data for a metric, highest ratio first.
 */
function getRanking(metric) {
  const entries = [];
  for (const id of Object.keys(CO2_DATA)) {
    const ratio = getBudgetRatio(id, metric);
    if (ratio == null) continue;
    entries.push({ id, name: CO2_DATA[id].name, ratio, perCapita: getPerCapita(id, metric) });
  }
  return entries.sort((a, b) => b.ratio - a.ratio);
}

/**
 * Headline numbers for a metric: how many countries lie above the reference
 * and what share of the world's people live in them.
 */
function getOverview(metric) {
  let countries = 0, above = 0, popAbove = 0;
  for (const id of Object.keys(CO2_DATA)) {
    const ratio = getBudgetRatio(id, metric);
    if (ratio == null) continue;
    countries++;
    if (ratio > 1) {
      above++;
      popAbove += CO2_DATA[id].pop;
    }
  }
  return {
    countries,
    above,
    popShareAbove: popAbove / WORLD_TOTALS.pop,
    reference: getReferencePerCapita(metric),
  };
}
