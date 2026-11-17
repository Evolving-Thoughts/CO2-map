/**
 * CO2 Budget Map — flat map (Leaflet)
 *
 * There is no tile basemap: the countries are drawn directly on an
 * ocean-colored background, so the map has no external tile service to
 * depend on.
 *
 * Layers, bottom to top:
 *   baseLayer        real country shapes in a neutral land color; only
 *                    while every country is resized, as a reference
 *   countriesLayer   the colored countries (real or resized shapes)
 *   selectionLayer   the selected country, outlined in white on a dark casing
 *   ghostLayer       dashed real outline of a resized selected country
 *
 * Both outlines are a white line on a wider dark one, so they stay
 * readable on the palest and on the darkest fill.
 */

let map = null;
let baseLayer = null;
let countriesLayer = null;
let selectionLayer = null;
let ghostLayer = null;
let outlineParts = [];             // [layer, weight at full size] of the selection outlines

let layerById = new Map();   // feature id -> its layer in countriesLayer
let fadedLayer = null;       // real-size layer faded while its resized copy shows
let mapLayerKey = null;      // what countriesLayer was last built for

// Leaflet would simplify every shape on its own at each zoom, which leaves
// the two sides of a shared border slightly different: gaps. So the map
// draws shapes simplified in the topology instead, one set per whole zoom
// level, and Leaflet's own simplification is off (smoothFactor 0).
const MAP_FULL_DETAIL_ZOOM = 5;        // from here on the shapes are drawn as loaded
const MAP_DETAIL_TOLERANCE_PX = 0.3;   // how far a simplified border may stray on screen
const mapDetailCache = new Map();      // level -> Map(feature id -> Leaflet coordinates)
let mapDetailLevel = null;             // the level the real shapes are drawn at

// The whole inhabited world; east of 180° because Russia's far east is
// shifted there by the antimeridian repair.
const WORLD_BOUNDS = [[-56, -170], [76, 190]];

// How far the map can be dragged: the Mercator world, plus whatever
// resized shapes reach beyond it (see updatePanBounds).
const PAN_BOUNDS = [[-85.05, -280], [85.05, 300]];
const PAN_MARGIN = 0.12;   // room around resized shapes, as a share of the world's width
const FRAME_PADDING = 40;  // pixels kept free around a country that is brought into view

// The first view shows the visitor's own country (see focusMapOnHome):
const HOME_CONTEXT_ZOOM = 1.5;   // zoom levels wider than a tight fit, to show the surroundings
const HOME_MAX_ZOOM_IN = 2;      // but at most this many levels closer than the overview

// Map zooms between which the selection outlines thin out
const OUTLINE_NEAR_ZOOM = 4.5;
const OUTLINE_FAR_ZOOM = 2;

const BASE_STYLE = {
  fillColor: LAND_COLOR,
  fillOpacity: 1,
  color: '#b9c1cc',
  weight: 0.5,
  opacity: 1,
};

// ============================================================================
// Setup
// ============================================================================

function initMap() {
  // Leaflet cuts every shape off at 85° north and south, the edge of the
  // usual square world map. A country near that edge that is resized
  // (Greenland, Canada, Russia) grows past it, so this map draws further.
  const crs = L.extend({}, L.CRS.EPSG3857, {
    projection: L.extend({}, L.Projection.SphericalMercator, { MAX_LATITUDE: RESIZED_LAT_LIMIT }),
  });

  map = L.map('map', {
    crs,
    zoomControl: false,
    attributionControl: false,
    zoomSnap: 0.25,
    minZoom: 0,
    maxZoom: 8,
    maxBoundsViscosity: 0.8,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  fitWorld();

  // A click on open water clears the selection (country clicks stop here).
  map.on('click', () => {
    if (state.selectedId != null) deselectCountry();
  });
  // How far the map can be dragged. The limits are not given to Leaflet as
  // an option, because it would then bring the map back inside at the end
  // of every move, including one that a move of the app has just
  // interrupted, and run into that move. The app does it itself instead.
  map.options.maxBounds = L.latLngBounds(PAN_BOUNDS);
  map.on('moveend', () => {
    if (!appMoves) keepMapInBounds();
  });

  // Any move the app did not start itself is the visitor's (see autoView).
  map.on('movestart', () => {
    if (!appMoves && autoView) autoView.touched = true;
  });
  map.on('zoomend', applyOutlineWeights);
  // 'zoom' comes before 'zoomend', where Leaflet redraws every shape.
  map.on('zoom', updateMapDetail);
}

/**
 * Tell Leaflet that the map's container may have changed size. Not while
 * the globe is shown: a hidden map measures as empty and would lose its
 * place.
 */
function refreshMapSize(options) {
  if (map && !state.globeView) moveByApp(() => map.invalidateSize(options));
}

/**
 * Show the whole world, clear of the key card on phones.
 */
function fitWorld() {
  const key = document.getElementById('key');
  const padBottom = isSmallScreen() && key ? key.offsetHeight + 16 : 0;
  moveByApp(() => {
    map.setMinZoom(0);
    map.fitBounds(WORLD_BOUNDS, {
      paddingTopLeft: [0, 8],
      paddingBottomRight: [0, padBottom],
      animate: false,
    });
    overviewMinZoom = Math.max(0, map.getZoom() - 0.5);
    map.setMinZoom(overviewMinZoom);
  });
}

// ============================================================================
// Detail Levels
// ============================================================================

function detailLevelFor(zoom) {
  return Math.max(0, Math.min(MAP_FULL_DETAIL_ZOOM, Math.floor(zoom)));
}

/**
 * The real country shapes as Leaflet coordinates, as detailed as a zoom
 * level needs: a border strays at most MAP_DETAIL_TOLERANCE_PX from the
 * data anywhere within the level. Made on first use.
 */
function mapDetail(level) {
  if (!mapDetailCache.has(level)) {
    let features = state.geojson.features;
    if (level < MAP_FULL_DETAIL_ZOOM) {
      // Metres per pixel at the upper end of the level, on the Mercator plane
      const metresPerPixel = 2 * Math.PI * EARTH_RADIUS / (256 * Math.pow(2, level + 1));
      const simple = simplifyTopology(
        state.topology,
        MAP_DETAIL_TOLERANCE_PX * metresPerPixel,
        point => toMercator(point[0], point[1])
      );
      features = flatMapFeatures(simple).features;
    }
    const shapes = new Map();
    for (const feature of features) {
      const geometry = feature.geometry;
      if (!geometry) continue;
      shapes.set(feature.id, L.GeoJSON.coordsToLatLngs(geometry.coordinates, geometry.type === 'Polygon' ? 1 : 2));
    }
    mapDetailCache.set(level, shapes);
  }
  return mapDetailCache.get(level);
}

/**
 * Give the layers of a group the real shapes at a detail level. With
 * `quiet`, only the coordinates are exchanged and nothing is drawn: used
 * during a zoom, at whose end Leaflet redraws every shape anyway. (That
 * uses Leaflet's internal _setLatLngs; without it the shapes are redrawn
 * right away, which is correct but does the work twice.)
 */
function applyMapDetail(group, level, quiet) {
  const shapes = mapDetail(level);
  group.eachLayer(layer => {
    const latlngs = layer.feature && shapes.get(layer.feature.id);
    if (!latlngs) return;
    if (quiet && typeof layer._setLatLngs === 'function') layer._setLatLngs(latlngs);
    else layer.setLatLngs(latlngs);
  });
}

/**
 * Switch the real shapes to the detail of the current zoom, if it changed.
 */
function updateMapDetail() {
  const level = detailLevelFor(map.getZoom());
  if (level === mapDetailLevel) return;
  mapDetailLevel = level;
  // In resized mode the real shapes are the pale base layer.
  const real = state.scaled ? baseLayer : countriesLayer;
  if (real) applyMapDetail(real, level, true);
  prepareNeighbourDetail();
}

/**
 * Make the neighbouring detail levels while the browser is idle, so the
 * next zoom step does not have to wait for them.
 */
function prepareNeighbourDetail() {
  const idle = window.requestIdleCallback || (run => setTimeout(run, 300));
  [mapDetailLevel + 1, mapDetailLevel - 1]
    .filter(level => level >= 0 && level <= MAP_FULL_DETAIL_ZOOM && !mapDetailCache.has(level))
    .forEach(level => idle(() => mapDetail(level)));
}

// ============================================================================
// Rendering
// ============================================================================

function countryStyle(feature) {
  const ratio = getBudgetRatio(feature.id, state.metric);
  if (state.scaled) {
    // Resized countries overlap. Translucent fills with a light edge keep
    // each one readable.
    return {
      fillColor: getRatioColor(ratio),
      fillOpacity: 0.72,
      color: '#ffffff',
      weight: 0.9,
      opacity: 0.95,
    };
  }
  return {
    fillColor: getRatioColor(ratio),
    fillOpacity: 1,
    color: '#3a4150',
    weight: 0.5,
    opacity: 0.7,
  };
}

function bindCountryEvents(feature, layer) {
  if (placeName(feature.id)) {
    // A function, so the text follows the metric and the language.
    layer.bindTooltip(() => buildTooltipHtml(feature.id), {
      sticky: true,
      className: 'country-tooltip',
    });
  }
  layer.on('click', (e) => {
    L.DomEvent.stopPropagation(e);
    selectCountry(feature.id);
  });
}

/**
 * Rebuild the country layer. Only needed when the shapes themselves
 * change: on first render and whenever all countries are resized.
 */
function rebuildMapLayers() {
  if (baseLayer) map.removeLayer(baseLayer);
  if (countriesLayer) map.removeLayer(countriesLayer);
  baseLayer = null;
  fadedLayer = null;
  layerById = new Map();

  let features = state.geojson.features;
  mapDetailLevel = detailLevelFor(map.getZoom());

  if (state.scaled) {
    baseLayer = L.geoJSON(state.geojson, { style: BASE_STYLE, interactive: false, smoothFactor: 0 });
    applyMapDetail(baseLayer, mapDetailLevel);
    baseLayer.addTo(map);

    // Largest shapes first, so small countries end up on top and stay
    // visible and clickable.
    features = features
      .map(feature => {
        const ratio = getBudgetRatio(feature.id, state.metric);
        const shape = ratio != null ? scaleFeature(feature, ratio) : feature;
        return { shape, area: featureArea(shape) };
      })
      .sort((a, b) => b.area - a.area)
      .map(entry => entry.shape);
  }

  countriesLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    style: countryStyle,
    // Resized shapes overlap anyway and keep Leaflet's own simplification.
    smoothFactor: state.scaled ? 1 : 0,
    onEachFeature: (feature, layer) => {
      layerById.set(feature.id, layer);
      bindCountryEvents(feature, layer);
    },
  });
  if (!state.scaled) applyMapDetail(countriesLayer, mapDetailLevel);
  countriesLayer.addTo(map);
  prepareNeighbourDetail();
}

/**
 * Draw the selected country on top: resized if requested, with its real
 * outline dashed for comparison.
 */
function updateMapSelection() {
  if (selectionLayer) map.removeLayer(selectionLayer);
  if (ghostLayer) map.removeLayer(ghostLayer);
  selectionLayer = ghostLayer = null;
  outlineParts = [];
  if (fadedLayer) {
    countriesLayer.resetStyle(fadedLayer);
    fadedLayer = null;
  }

  const id = state.selectedId;
  const original = id != null ? findFeature(id) : null;
  if (!original) return;

  const ratio = getBudgetRatio(id, state.metric);
  const resized = ratio != null && ratio !== 1 && (state.scaled || state.selectedScaled);
  const shape = resized ? scaleFeature(original, ratio) : original;

  if (resized && !state.scaled) {
    fadedLayer = layerById.get(id) || null;
    if (fadedLayer) fadedLayer.setStyle({ fillOpacity: 0.18, opacity: 0 });
  }

  const casing = L.geoJSON(shape, {
    interactive: false,
    style: { fill: false, color: OUTLINE_DARK, opacity: 0.85 },
  });
  const line = L.geoJSON(shape, {
    style: { fillColor: getRatioColor(ratio), fillOpacity: 0.94, color: '#ffffff', opacity: 1 },
    onEachFeature: (feature, layer) => {
      if (placeName(id)) {
        layer.bindTooltip(() => buildTooltipHtml(id), { sticky: true, className: 'country-tooltip' });
      }
      layer.on('click', (e) => L.DomEvent.stopPropagation(e));
    },
  });
  outlineParts.push([casing, OUTLINE_WIDTHS.solid.casing], [line, OUTLINE_WIDTHS.solid.line]);

  if (resized) {
    const dashes = { fill: false, dashArray: '7 6', lineCap: 'butt' };
    const ghost = (style) => L.geoJSON(original, { interactive: false, style: { ...dashes, ...style } });
    const ghostCasing = ghost({ color: OUTLINE_DARK, opacity: 0.85 });
    const ghostLine = ghost({ color: '#ffffff', opacity: 1 });
    outlineParts.push([ghostCasing, OUTLINE_WIDTHS.dashed.casing], [ghostLine, OUTLINE_WIDTHS.dashed.line]);
    ghostLayer = L.featureGroup([ghostCasing, ghostLine]);
  }

  applyOutlineWeights();
  selectionLayer = L.featureGroup([casing, line]).addTo(map);
  if (ghostLayer) ghostLayer.addTo(map);
}

/**
 * Fit the outline widths to the zoom.
 */
function applyOutlineWeights() {
  const t = Math.max(0, Math.min(1, (OUTLINE_NEAR_ZOOM - map.getZoom()) / (OUTLINE_NEAR_ZOOM - OUTLINE_FAR_ZOOM)));
  const scale = 1 - t * (1 - OUTLINE_FAR_SCALE);
  for (const [layer, weight] of outlineParts) layer.setStyle({ weight: weight * scale });
}

/**
 * Let the map be dragged as far as the resized shapes reach, so a
 * country that has grown past the edge of the world can be seen whole.
 * This only sets the limits; keepMapInBounds applies them.
 */
function updatePanBounds() {
  const world = L.latLngBounds(PAN_BOUNDS);
  const bounds = L.latLngBounds(PAN_BOUNDS);
  // A rectangle around a point at a zoom, given as half its size in pixels
  const around = (point, zoom, half) => L.latLngBounds(
    map.unproject(point.subtract(half), zoom),
    map.unproject(point.add(half), zoom)
  );

  if (state.scaled && countriesLayer) {
    const all = countriesLayer.getBounds();
    if (!world.contains(all)) {
      const margin = L.point(256 * PAN_MARGIN, 256 * PAN_MARGIN);
      bounds.extend(map.unproject(map.project(all.getNorthWest(), 0).subtract(margin), 0));
      bounds.extend(map.unproject(map.project(all.getSouthEast(), 0).add(margin), 0));
    }
  }

  // A selected country that reaches past the world: allow the whole shape
  // and the view that centres it (see panMapToCountry), so the map does
  // not push back.
  const frame = state.selectedId != null ? countryFrame(state.selectedId) : null;
  if (frame && !world.contains(frame.fullBounds)) {
    const slack = L.point(24, 24);
    const zoom = Math.min(frame.zoom, map.getZoom());
    bounds.extend(frame.fullBounds);
    bounds.extend(around(map.project(frameCenter(frame, zoom), zoom), zoom, map.getSize().divideBy(2).add(slack)));
  }
  map.options.maxBounds = bounds;
}

/**
 * Bring the map back inside its limits: at the end of a move, and when
 * the limits have shrunk and no other move follows.
 */
function keepMapInBounds() {
  if (state.globeView) return;   // hidden: the map has no size to work with
  const bounds = map.options.maxBounds;
  moveByApp(() => map.panInsideBounds(bounds));
}

/**
 * The shape a country currently has on the map: resized or real.
 */
function currentShape(id) {
  const feature = findFeature(id);
  if (!feature) return null;
  const ratio = getBudgetRatio(id, state.metric);
  const resized = ratio != null && ratio !== 1 &&
    (state.scaled || (state.selectedScaled && id === state.selectedId));
  return resized ? scaleFeature(feature, ratio) : feature;
}

/**
 * Bring the flat map in line with the state. Cheap for color and
 * selection changes; shapes are only rebuilt when they have to be.
 */
function renderMap() {
  if (!map || !state.geojson) return;
  const key = state.scaled ? `scaled|${state.metric}` : 'actual';
  if (key !== mapLayerKey) {
    rebuildMapLayers();
    mapLayerKey = key;
  } else {
    countriesLayer.setStyle(countryStyle);
  }
  updateMapSelection();
  updatePanBounds();
}

/**
 * Move the flat map so a country sits in the middle of the part not
 * covered by panels. On phones the map itself ends above the bottom sheet
 * (see the CSS), so no extra room is needed there.
 *
 *   back     a view, or null for the overview: the move is remembered
 *            and undone when the country closes
 *   zoomIn   false keeps the zoom and only zooms out if the country
 *            would not fit; true (default) zooms to fit
 */
function panMapToCountry(id, back, { zoomIn = true } = {}) {
  const frame = countryFrame(id);
  if (!frame) return;
  updatePanBounds();   // the map may have changed size since the last render

  // A country resized far beyond the world (Greenland, Canada) may need a
  // wider view than the overview allows.
  map.setMinZoom(Math.min(map.getMinZoom(), frame.zoom));

  const zoom = zoomIn ? frame.zoom : Math.min(map.getZoom(), frame.zoom);
  const center = limitCenter(frameCenter(frame, zoom), zoom);
  if (back !== undefined) autoView = { back, touched: false };
  moveByApp(() => {
    if (prefersReducedMotion()) map.setView(center, zoom, { animate: false });
    else map.flyTo(center, zoom, { duration: 0.6 });
  });
}

/**
 * Centre the map on a country at the zoom the visitor has chosen. On
 * phones the view from before comes back when the country is closed
 * (see restoreOverviewIfUntouched); elsewhere the map stays.
 */
function centerMapOnCountry(id) {
  panMapToCountry(id, isSmallScreen() ? viewToReturnTo() : undefined, { zoomIn: false });
}

/**
 * The view to come back to when the country closes: where the map is
 * now, or, if the app has already moved it for another country and the
 * visitor has not moved it since, where it was before that.
 */
function viewToReturnTo() {
  return autoView && !autoView.touched
    ? autoView.back
    : { center: map.getCenter(), zoom: map.getZoom() };
}

/**
 * Centre the map only if the country does not fit into the visible part,
 * for when its size changes while it is selected.
 */
function revealCountryOnMap(id) {
  const frame = countryFrame(id);
  if (!frame) return;
  const size = map.getSize();
  const edge = 8;   // the shape may reach into the padding, but not under a panel
  const left = frame.options.paddingTopLeft[0] - FRAME_PADDING + edge;
  const right = size.x - frame.options.paddingBottomRight[0] + FRAME_PADDING - edge;
  const topLeft = map.latLngToContainerPoint(frame.bounds.getNorthWest());
  const bottomRight = map.latLngToContainerPoint(frame.bounds.getSouthEast());
  const visible = topLeft.x >= left && topLeft.y >= edge &&
    bottomRight.x <= right && bottomRight.y <= size.y - edge;
  if (visible) keepMapInBounds();
  else centerMapOnCountry(id);
}

/**
 * Start on the visitor's own country: its surroundings in view, the
 * country in the middle, nothing selected.
 */
function focusMapOnHome(id) {
  const frame = countryFrame(id, false);
  if (!frame) return;
  const overview = map.getZoom();
  const snap = map.options.zoomSnap;
  const wide = Math.floor((frame.zoom - HOME_CONTEXT_ZOOM) / snap) * snap;
  const zoom = Math.max(overview, Math.min(overview + HOME_MAX_ZOOM_IN, wide));
  const center = limitCenter(frameCenter(frame, zoom), zoom);
  moveByApp(() => map.setView(center, zoom, { animate: false }));
}

/**
 * What to frame for a country: the main part of the real and of the
 * resized shape (so both outlines are in view), clear of the panels.
 * `zoom` is the zoom at which that fits, `fullBounds` covers every part.
 * `panel` says whether the country panel is (about to be) open.
 */
function countryFrame(id, panel = true) {
  const feature = findFeature(id);
  if (!feature) return null;
  const shape = currentShape(id);
  const parts = mainPartIndexes(feature);
  const bounds = L.latLngBounds(featureBounds(feature, parts))
    .extend(L.latLngBounds(featureBounds(shape, parts)));
  const fullBounds = L.latLngBounds(featureBounds(feature)).extend(L.latLngBounds(featureBounds(shape)));

  const small = isSmallScreen();
  const key = document.getElementById('key');
  // Without the panel, phones show the key card over the bottom of the map.
  const keyHeight = !panel && small && key ? key.offsetHeight + 16 : 0;
  const options = {
    maxZoom: 5,
    paddingTopLeft: [(!small && state.rankingOpen ? 320 : 0) + FRAME_PADDING, FRAME_PADDING],
    paddingBottomRight: [(panel && !small ? 380 : 0) + FRAME_PADDING, keyHeight + FRAME_PADDING],
  };

  const room = map.getSize().subtract(L.point(options.paddingTopLeft).add(options.paddingBottomRight));
  const topLeft = map.project(bounds.getNorthWest(), 0);
  const bottomRight = map.project(bounds.getSouthEast(), 0);
  const scale = Math.min(room.x / (bottomRight.x - topLeft.x), room.y / (bottomRight.y - topLeft.y));
  // Rounded the way Leaflet's fitBounds does it
  const snap = map.options.zoomSnap;
  const exact = Math.round(Math.log2(scale) / (snap / 100)) * (snap / 100);
  const zoom = Math.max(0, Math.min(options.maxZoom, Math.floor(exact / snap) * snap));

  return { bounds, fullBounds, options, zoom };
}

/**
 * The map centre that puts a frame in the middle of the free part.
 */
function frameCenter(frame, zoom) {
  const topLeft = L.point(frame.options.paddingTopLeft);
  const bottomRight = L.point(frame.options.paddingBottomRight);
  const middle = map.project(frame.bounds.getNorthWest(), zoom)
    .add(map.project(frame.bounds.getSouthEast(), zoom))
    .divideBy(2);
  return map.unproject(middle.add(bottomRight.subtract(topLeft).divideBy(2)), zoom);
}

/**
 * A map centre moved as little as needed to keep the view inside the pan
 * limits; where the view is larger than the limits, it is centred on
 * them. The app aims there right away instead of being pulled back after.
 */
function limitCenter(center, zoom) {
  const bounds = map.options.maxBounds;
  const point = map.project(center, zoom);
  const half = map.getSize().divideBy(2);
  const min = map.project(bounds.getNorthWest(), zoom);
  const max = map.project(bounds.getSouthEast(), zoom);
  const within = (value, low, high, reach) =>
    (high - low <= 2 * reach ? (low + high) / 2 : Math.max(low + reach, Math.min(high - reach, value)));
  return map.unproject(L.point(within(point.x, min.x, max.x, half.x), within(point.y, min.y, max.y, half.y)), zoom);
}

// Set on phones while the app has moved the map for a country: there the
// country sheet covers half the map and the app zooms to the country. If
// the visitor has not moved the map since (`touched`) when the sheet
// closes, the view from before (`back`) comes back, or the overview if
// there is none. On larger screens the map stays where it is.
let autoView = null;
let appMoves = 0;            // above zero while the app itself moves the map
let overviewMinZoom = 0;     // how far out the overview lets the map zoom

/**
 * Run a move the app makes itself.
 */
function moveByApp(move) {
  appMoves++;
  try {
    move();
  } finally {
    appMoves--;
  }
}

/**
 * The country was closed on the globe: the flat map stays where it is.
 */
function forgetReturnView() {
  autoView = null;
}

function restoreOverviewIfUntouched() {
  const { back = null, touched = true } = autoView || {};
  autoView = null;
  if (touched) {
    // The wider zoom range was only for a resized country.
    if (map.getZoom() >= overviewMinZoom) map.setMinZoom(overviewMinZoom);
    keepMapInBounds();
    return;
  }
  if (!back) {
    fitWorld();
    return;
  }
  moveByApp(() => {
    if (prefersReducedMotion()) map.setView(back.center, back.zoom, { animate: false });
    else map.flyTo(back.center, back.zoom, { duration: 0.5 });
  });
  // The wider zoom range was only for the resized country.
  map.once('moveend', () => {
    if (!autoView && map.getZoom() >= overviewMinZoom) map.setMinZoom(overviewMinZoom);
  });
}
