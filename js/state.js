/**
 * CO2 Budget Map — shared state and small helpers
 *
 * One object holds what the user has chosen. js/app.js changes it;
 * js/map.js, js/globe.js and js/ui.js only read it and draw.
 */

const state = {
  metric: 'paris',        // one of METRICS (js/metrics.js)
  scaled: false,          // every country is resized by its ratio
  colorblind: false,
  globeView: false,
  selectedId: null,       // id of the selected country or territory
  selectedScaled: false,  // only the selected country is resized
  rankingOpen: false,

  topology: null,         // world-atlas TopoJSON as loaded
  geojson: null,          // country shapes for the flat map (antimeridian repaired)
  globeGeojson: null,     // lighter shapes for the globe, made when it is prepared
  homeId: null,           // the visitor's own country, if it could be guessed (see guessHomeCountry)
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Escape HTML special characters before inserting text into innerHTML.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Debounce a function so it only fires after a pause in calls.
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function isSmallScreen() {
  return window.matchMedia('(max-width: 640px)').matches;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Make every shape findable by one id. Some have no numeric id
 * (Somaliland, Kosovo): they get their name. And some share an id with
 * their country (the Ashmore and Cartier Islands carry Australia's): they
 * become part of it, so that an id never stands for two shapes.
 */
function assignFeatureIds(collection) {
  const byId = new Map();
  const features = [];
  for (const feature of collection.features) {
    if (feature.id == null && feature.properties && feature.properties.name) {
      feature.id = feature.properties.name;
    }
    const first = byId.get(feature.id);
    if (!first || !first.geometry || !feature.geometry) {
      if (!first) byId.set(feature.id, feature);
      features.push(feature);
      continue;
    }
    first.geometry = {
      type: 'MultiPolygon',
      coordinates: [...geometryPolygons(first.geometry), ...geometryPolygons(feature.geometry)],
    };
  }
  collection.features = features;
  return collection;
}

/**
 * Country shapes for the flat map from a topology: the ones crossing the
 * antimeridian (Russia, Fiji) made continuous, and without Antarctica,
 * which Mercator stretches across the whole bottom edge; it has no
 * emissions data and stays on the globe only.
 */
function flatMapFeatures(topology) {
  const collection = assignFeatureIds(topojson.feature(topology, topology.objects.countries));
  return fixAntimeridian({
    ...collection,
    features: collection.features.filter(feature => feature.id !== ANTARCTICA_ID),
  });
}

/**
 * The shape of a country by id, from the flat-map or the globe set.
 */
function findFeature(id, forGlobe = false) {
  const data = forGlobe ? state.globeGeojson : state.geojson;
  return data ? data.features.find(f => f.id === id) || null : null;
}

/**
 * Display name of a country or territory in the current language.
 */
function placeName(id) {
  if (CO2_DATA[id]) return tn(CO2_DATA[id].name);
  if (TERRITORY_NAMES[id]) return tn(TERRITORY_NAMES[id]);
  return null;
}

// ============================================================================
// Color Scale
// ============================================================================

const ANTARCTICA_ID = '010';

// Outlines of the selected country, in CSS pixels: a white line on a
// slightly wider dark one. Zoomed out they shrink to OUTLINE_FAR_SCALE,
// so they do not swallow small countries.
const OUTLINE_WIDTHS = {
  solid: { line: 2.2, casing: 3.8 },
  dashed: { line: 1.6, casing: 3 },
};
const OUTLINE_FAR_SCALE = 0.7;
const OUTLINE_DARK = '#111827';

const NO_DATA_COLOR = '#9aa1ac';
const OCEAN_COLOR = '#dde4ec';
const LAND_COLOR = '#f3f4f6';

// Values the legend shows; the labelled ones are the ticks.
const LEGEND_STEPS = [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0, 12.0];
const LEGEND_TICKS = [0.1, 0.5, 1.0, 2.0, 4.0, 12.0];

// [ratio, r, g, b]. More stops between 0.5 and 3 keep countries near the
// reference apart; the scale saturates at 12.
const COLOR_STOPS = [
  [0.0,   22, 160,  90],   // deep green
  [0.5,   80, 190, 110],   // medium green
  [1.0,  230, 210,  60],   // yellow: exactly at the reference
  [1.5,  245, 170,  50],   // light orange
  [2.0,  240, 130,  40],   // orange
  [3.0,  220,  70,  30],   // red-orange
  [5.0,  200,  20,  20],   // red
  [8.0,  150,  10,  30],   // dark red
  [12.0, 100,   5,  20],   // burgundy
];

// Blue to orange-brown, safe for the common forms of color blindness.
const COLOR_STOPS_COLORBLIND = [
  [0.0,   33, 102, 172],   // deep blue
  [0.5,  103, 169, 207],   // medium blue
  [1.0,  245, 245, 245],   // near-white: exactly at the reference
  [1.5,  253, 208, 162],   // light peach
  [2.0,  245, 165,  80],   // orange
  [3.0,  215, 120,  30],   // dark orange
  [5.0,  179,  88,   6],   // brown
  [8.0,  127,  59,   8],   // dark brown
  [12.0,  84,  36,   5],   // very dark brown
];

/**
 * Linearly interpolate between color stops.
 */
function interpolateStops(value, stops) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, r0, g0, b0] = stops[i];
    const [v1, r1, g1, b1] = stops[i + 1];
    if (value <= v1) {
      const k = (value - v0) / (v1 - v0);
      return `rgb(${Math.round(r0 + (r1 - r0) * k)}, ${Math.round(g0 + (g1 - g0) * k)}, ${Math.round(b0 + (b1 - b0) * k)})`;
    }
  }
  const last = stops[stops.length - 1];
  return `rgb(${last[1]}, ${last[2]}, ${last[3]})`;
}

/**
 * Color for a ratio (1 = exactly the fair share or the world average).
 */
function getRatioColor(ratio) {
  if (ratio === null || ratio === undefined || !isFinite(ratio)) return NO_DATA_COLOR;
  const clamped = Math.max(0.05, Math.min(ratio, 12));
  return interpolateStops(clamped, state.colorblind ? COLOR_STOPS_COLORBLIND : COLOR_STOPS);
}

// ============================================================================
// Tooltip (shared by map and globe)
// ============================================================================

/**
 * Lines of a country tooltip, or null for a shape without a name.
 */
function tooltipLines(id) {
  const country = CO2_DATA[id];
  if (country) {
    const name = tn(country.name);
    const ratio = getBudgetRatio(id, state.metric);
    if (ratio == null) return [name, t('tooltipNoData')];
    const unit = state.metric === 'hist' ? t('unitPerCapitaHist') : t('unitPerCapita');
    const share = isParisMetric(state.metric)
      ? t('ofFairShare')(fmtPercent(ratio))
      : t('ofWorldAvg')(fmtPercent(ratio));
    return [name, `${fmtTonnes(getPerCapita(id, state.metric))} ${unit}`, share];
  }
  if (TERRITORY_NAMES[id]) {
    const parent = TERRITORY_PARENTS[id];
    return [
      tn(TERRITORY_NAMES[id]),
      parent ? t('tooltipDataUnder')(tn(parent)) : t('tooltipNoData'),
    ];
  }
  return null;
}

function buildTooltipHtml(id) {
  const lines = tooltipLines(id);
  if (!lines) return '';
  return `<strong>${escapeHtml(lines[0])}</strong>` +
    lines.slice(1).map(line => `<span>${escapeHtml(line)}</span>`).join('');
}
