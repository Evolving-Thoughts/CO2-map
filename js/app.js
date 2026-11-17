/**
 * CO2 Budget Map — application
 *
 * An interactive world map that colors and resizes countries by their
 * CO₂ emissions relative to a fair per-capita budget.
 *
 * This file starts the app and is the only place that changes the state
 * (js/state.js). Files, in loading order:
 *   i18n.js     texts (English, German) and number formatting
 *   co2data.js  generated data (run generate_data.py to refresh)
 *   config.js   hand-maintained territories and budget assumptions
 *   metrics.js  calculations
 *   geo.js      geometry: projections and resizing
 *   state.js    shared state, color scale, tooltip text
 *   map.js      flat map (Leaflet)
 *   globe.js    3D globe (globe.gl, prepared in the background)
 *   ui.js       header, key, ranking, country panel, method dialog
 *   app.js      startup, controls, shareable URL, language
 */

// Country shapes: Natural Earth 1:50m, exact package version.

// ============================================================================
// Shareable URL
// ============================================================================
//
// The view lives in the URL hash, so a copied link opens what the sender
// saw: #m=paris2&c=276&scaled=1&view=globe&cb=1. Defaults are left out.
// The language is not part of the link; recipients get their own.

function readUrlState() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const metric = params.get('m');
  return {
    metric: METRICS.includes(metric) ? metric : 'paris',
    scaled: params.get('scaled') === '1',
    colorblind: params.get('cb') === '1',
    globeView: params.get('view') === 'globe',
    selectedId: params.get('c') || null,
  };
}

function writeUrlState() {
  const params = new URLSearchParams();
  if (state.metric !== 'paris') params.set('m', state.metric);
  if (state.selectedId != null) params.set('c', state.selectedId);
  if (state.scaled) params.set('scaled', '1');
  if (state.globeView) params.set('view', 'globe');
  if (state.colorblind) params.set('cb', '1');
  const hash = params.toString();
  const url = location.pathname + location.search + (hash ? `#${hash}` : '');
  try {
    history.replaceState(null, '', url);
  } catch (e) { /* e.g. file:// in some browsers: the app works without it */ }
}

function isKnownPlace(id) {
  return id != null && findFeature(id) != null;
}

// ============================================================================
// Rendering
// ============================================================================

function renderView() {
  if (state.globeView) renderGlobe();
  else renderMap();
}

/**
 * Redraw everything that depends on the metric, the colors or the language.
 */
function renderAll() {
  renderHeader();
  renderKey();
  renderView();
  if (state.rankingOpen) renderRanking();
  if (state.selectedId != null) renderInfoPanel();
}

// ============================================================================
// Actions (the only code that changes the state)
// ============================================================================

function setMetric(metric) {
  if (!METRICS.includes(metric) || metric === state.metric) return;
  state.metric = metric;
  renderAll();
  writeUrlState();
}

function setScaled(scaled) {
  state.scaled = scaled;
  state.selectedScaled = false;
  renderHeader();
  renderKey();
  renderView();
  if (state.selectedId != null) renderInfoPanel();
  writeUrlState();
}

function setColorblind(on) {
  state.colorblind = on;
  document.body.classList.toggle('colorblind', on);
  renderAll();
  writeUrlState();
}

/**
 * @param {string} id
 * @param {{pan?: boolean, focus?: boolean}} [options]
 *   pan: move the map to the country; focus: move keyboard focus to the panel
 */
function selectCountry(id, options = {}) {
  // Taken before the country sheet changes the map's size on a phone.
  const viewBefore = state.globeView ? undefined : viewToReturnTo();
  state.selectedId = id;
  state.selectedScaled = true;
  renderView();
  renderInfoPanel();
  markRankingSelection(true);
  writeUrlState();

  if (isSmallScreen()) {
    // Phones: the country panel is a bottom sheet and needs the room.
    // The map ends above the sheet, so bring the country into what is
    // left; the view from before comes back when the sheet closes.
    setHeaderCollapsed(true);
    if (state.rankingOpen) setRankingOpen(false);
    syncViewSize();
    if (state.globeView) panGlobeToCountry(id);
    else panMapToCountry(id, viewBefore);
  } else {
    // Bring the country into the middle. From the ranking or a link the
    // map also zooms to it; a click on the map keeps the zoom. The map
    // stays there when the country is closed.
    syncViewSize();
    if (state.globeView) panGlobeToCountry(id);
    else panMapToCountry(id, undefined, { zoomIn: !!options.pan });
  }
  if (options.focus) focusInfoPanel();
}

/**
 * Tell the renderers that their container changed size (the country
 * sheet opened, closed or was collapsed on a phone).
 */
function syncViewSize() {
  refreshMapSize({ pan: false });
  resizeGlobe();
}

function deselectCountry() {
  if (state.selectedId == null) return;
  const panelHadFocus = $('info-panel').contains(document.activeElement);
  const previousId = state.selectedId;
  state.selectedId = null;
  state.selectedScaled = false;
  renderView();
  hideInfoPanel();
  markRankingSelection(false);
  writeUrlState();
  syncViewSize();
  if (state.globeView) forgetReturnView();
  else restoreOverviewIfUntouched();

  if (panelHadFocus) {
    // Hand the keyboard back to where the selection came from.
    const origin = state.rankingOpen
      ? $('ranking-list').querySelector(`.ranking-item[data-id="${CSS.escape(previousId)}"]`)
      : null;
    (origin || $('ranking-toggle')).focus();
  }
}

function toggleSelectedScale() {
  state.selectedScaled = !state.selectedScaled;
  renderView();
  renderInfoPanel();
  if (!state.globeView) revealCountryOnMap(state.selectedId);
  const button = $('info-panel').querySelector('[data-action="resize"]');
  if (button) button.focus();
}

function panToCountry(id) {
  if (state.globeView) panGlobeToCountry(id);
  else panMapToCountry(id);
}

/**
 * Switch between the flat map and the globe. The globe is normally ready
 * by now (it is prepared in the background); the loading message only
 * appears if it is not. If the globe cannot be loaded, the flat map stays.
 */
async function setGlobeView(on) {
  if (on === state.globeView) return;

  if (on && !globeIsReady) {
    globeUrgent = true;
    const slow = setTimeout(() => showLoading(true, t('globeLoading')), 200);
    try {
      await prepareGlobe();
    } catch (error) {
      console.error('Globe unavailable:', error);
      showToast(t('globeError'));
      return;
    } finally {
      clearTimeout(slow);
      showLoading(false);
    }
  }

  state.globeView = on;
  $('map').style.display = on ? 'none' : 'block';
  $('globe').style.display = on ? 'block' : 'none';
  renderHeader();
  renderKey();
  setGlobeVisible(on);

  if (on) {
    renderGlobe();
    if (state.selectedId != null) panGlobeToCountry(state.selectedId);
  } else {
    refreshMapSize();
    renderMap();
  }
  if (state.selectedId != null) renderInfoPanel();
  writeUrlState();
}

function setLanguage(lang) {
  if (!TRANSLATIONS[lang] || lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (e) { /* private mode: the choice lasts for this visit */ }
  applyLanguage();
  renderAll();
  if ($('about').open) renderAbout();
}

function applyLanguage() {
  document.documentElement.lang = currentLang;
  document.title = t('pageTitle');
  applyStaticTranslations();
}

// ============================================================================
// Sharing
// ============================================================================

function shareText() {
  const id = state.selectedId;
  const ratio = id != null ? getBudgetRatio(id, state.metric) : null;
  if (ratio == null) return t('shareTextDefault');
  const name = placeName(id);
  return isParisMetric(state.metric)
    ? t('shareTextCountry')(name, fmtPercent(ratio), t('warmingLabel')[state.metric])
    : t('shareTextWorld')(name, fmtPercent(ratio));
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Older browsers and plain http
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('copy command rejected');
}

/**
 * Phones get the system share sheet, everything else a copied link.
 */
async function shareView() {
  writeUrlState();
  const url = location.href;

  if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: t('pageTitle'), text: shareText(), url });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;   // the user closed the sheet
    }
  }

  try {
    await copyToClipboard(url);
    showToast(t('linkCopied'));
  } catch (error) {
    showToast(t('shareFailed'));
  }
}

// ============================================================================
// Controls
// ============================================================================

function setupControls() {
  // Metric radio group: click, or arrow keys as in any radio group
  const metricButtons = Array.from(document.querySelectorAll('.metric-btn'));
  metricButtons.forEach(btn => {
    btn.addEventListener('click', () => setMetric(btn.dataset.metric));
  });
  $('metric-groups').addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const index = metricButtons.findIndex(btn => btn.dataset.metric === state.metric);
    const next = metricButtons[(index + step + metricButtons.length) % metricButtons.length];
    setMetric(next.dataset.metric);
    next.focus();
  });

  $('scale-toggle').addEventListener('change', (e) => setScaled(e.target.checked));
  $('colorblind-toggle').addEventListener('change', (e) => setColorblind(e.target.checked));

  $('projection-toggle').addEventListener('click', () => setGlobeView(!state.globeView));
  $('share-view').addEventListener('click', shareView);

  $('settings-toggle').addEventListener('click', () => {
    setHeaderCollapsed(!$('header').classList.contains('collapsed'));
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  // Ranking
  $('ranking-toggle').addEventListener('click', () => {
    setRankingOpen(!state.rankingOpen);
    if (state.rankingOpen && isSmallScreen()) setHeaderCollapsed(true);
    syncViewSize();
  });
  $('ranking-close').addEventListener('click', () => {
    setRankingOpen(false);
    syncViewSize();
    $('ranking-toggle').focus();
  });
  $('ranking-search').addEventListener('input', filterRanking);
  $('ranking-list').addEventListener('click', (e) => {
    const item = e.target.closest('.ranking-item');
    if (item) selectCountry(item.dataset.id, { pan: true, focus: true });
  });

  // Country panel (its content is redrawn, so the clicks are delegated)
  $('info-panel').addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'close') deselectCountry();
    else if (action === 'minimize') {
      setInfoMinimized(!$('info-panel').classList.contains('minimized'));
      syncViewSize();
    }
    else if (action === 'resize') toggleSelectedScale();
    else if (action === 'share') shareView();
  });

  // Method dialog
  $('about-open').addEventListener('click', openAbout);
  $('about-close').addEventListener('click', () => $('about').close());
  $('about').addEventListener('click', (e) => {
    if (e.target === $('about')) $('about').close();   // click on the backdrop
  });

  // Escape closes the country panel, then the ranking. The dialog and the
  // search field handle Escape themselves.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || $('about').open) return;
    if (e.target === $('ranking-search') && e.target.value) return;
    if (state.selectedId != null) deselectCountry();
    else if (state.rankingOpen) {
      setRankingOpen(false);
      syncViewSize();
      $('ranking-toggle').focus();
    }
  });

  // A pasted or edited link, or the back button
  window.addEventListener('hashchange', () => applyUrlState(readUrlState()));

  // Keep the layout variable and the renderers in step with the header
  // height (it wraps on narrow screens) and with the window size.
  const header = $('header');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
    refreshMapSize();
    resizeGlobe();
  }).observe(header);
  window.addEventListener('resize', debounce(resizeGlobe, 150));
}

/**
 * Apply a view read from the URL to the running app.
 */
function applyUrlState(next) {
  state.metric = next.metric;
  state.scaled = next.scaled;
  state.colorblind = next.colorblind;
  document.body.classList.toggle('colorblind', state.colorblind);

  if (isKnownPlace(next.selectedId)) {
    state.selectedId = next.selectedId;
    state.selectedScaled = true;
  } else {
    state.selectedId = null;
    state.selectedScaled = false;
    hideInfoPanel();
  }

  renderAll();
  markRankingSelection(true);
  syncViewSize();
  if (next.globeView !== state.globeView) {
    setGlobeView(next.globeView);
  } else if (state.selectedId != null) {
    panToCountry(state.selectedId);
  }
}

// ============================================================================
// Startup
// ============================================================================

/**
 * Take the country boundaries (vendor/world-atlas) and prepare the shapes
 * for the flat map. The globe and the zoomed-out flat map make their own
 * lighter shapes from the topology (js/globe.js, js/map.js).
 */
function loadGeoJSON() {
  state.topology = WORLD_ATLAS;
  state.geojson = flatMapFeatures(state.topology);
}

async function start() {
  showLoading(true);
  try {
    if (typeof L === 'undefined' || typeof topojson === 'undefined' || typeof WORLD_ATLAS === 'undefined') {
      throw new Error('A map library or the country shapes did not load');
    }
    if (!map) initMap();
    loadGeoJSON();
  } catch (error) {
    console.error('Failed to initialize:', error);
    // The missing file is a script of this page: only a fresh page gets it.
    showLoadError(() => location.reload());
    return;
  }

  showLoading(false);
  state.homeId = guessHomeCountry();
  applyUrlState(readUrlState());
  // A first visit without a country in the link starts on the visitor's own.
  if (state.selectedId == null && state.homeId != null) focusMapOnHome(state.homeId);
  scheduleGlobePrewarm();
}

/**
 * The visitor's own country, guessed from what the browser already knows:
 * the device's time zone, then the region in the preferred languages.
 * Nothing is sent anywhere and nothing is stored. Returns the id of a
 * country on the map, or null.
 */
function guessHomeCountry() {
  const onMap = (code) => {
    const id = REGION_IDS[code];
    return id && findFeature(id) ? id : null;
  };

  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const names = [zone];
    for (const pair of TIME_ZONE_ALIASES) {
      if (pair.includes(zone)) names.push(...pair);
    }
    for (const code of Object.keys(REGION_IDS)) {
      const locale = new Intl.Locale(`und-${code}`);
      const zones = locale.getTimeZones ? locale.getTimeZones() : locale.timeZones;
      if (zones && names.some(name => zones.includes(name)) && onMap(code)) return onMap(code);
    }
  } catch (e) { /* older browsers: fall through to the language */ }

  for (const language of navigator.languages || [navigator.language]) {
    try {
      const region = new Intl.Locale(language).region;
      if (region && onMap(region)) return onMap(region);
    } catch (e) { /* not a language tag this browser understands */ }
  }
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.style.setProperty('--header-height', $('header').offsetHeight + 'px');
  applyLanguage();
  setHeaderCollapsed(isSmallScreen());
  renderHeader();
  renderKey();
  setupControls();
  start();
});
