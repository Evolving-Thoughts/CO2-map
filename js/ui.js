/**
 * CO2 Budget Map — interface around the map
 *
 * Header texts, the key (finding and color scale), the ranking, the
 * country panel, the method dialog, and the loading and toast messages.
 * Everything here draws from the state; changes to the state happen in
 * js/app.js.
 */

const $ = (id) => document.getElementById(id);

const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// ============================================================================
// Loading, Errors, Toast
// ============================================================================

function showLoading(show, text) {
  const overlay = $('loading');
  overlay.classList.remove('error');
  $('loading-spinner').hidden = false;
  $('loading-retry').hidden = true;
  $('loading-text').textContent = text || t('loading');
  overlay.hidden = !show;
}

/**
 * Replace the spinner with a message and a way to try again.
 */
function showLoadError(onRetry) {
  const overlay = $('loading');
  overlay.hidden = false;
  overlay.classList.add('error');
  $('loading-spinner').hidden = true;
  $('loading-text').textContent = t('loadError');
  const retry = $('loading-retry');
  retry.hidden = false;
  retry.onclick = onRetry;
  retry.focus();
}

let toastTimer = null;

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

// ============================================================================
// Header
// ============================================================================

function renderHeader() {
  const short = t('metricShort');
  document.querySelectorAll('.metric-btn').forEach(btn => {
    const active = btn.dataset.metric === state.metric;
    btn.textContent = short[btn.dataset.metric];
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
    btn.tabIndex = active ? 0 : -1;
  });

  $('scale-toggle').checked = state.scaled;
  $('colorblind-toggle').checked = state.colorblind;

  $('projection-label').textContent = state.globeView ? t('mapView') : t('globeView');
  $('projection-icon').setAttribute('href', state.globeView ? '#i-map' : '#i-globe');
  $('ranking-toggle').setAttribute('aria-expanded', String(state.rankingOpen));

  $('header-summary').textContent =
    short[state.metric] + (state.scaled ? ` · ${t('summaryScaled')}` : '');

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === currentLang));
  });
}

function setHeaderCollapsed(collapsed) {
  $('header').classList.toggle('collapsed', collapsed);
  $('settings-toggle').setAttribute('aria-expanded', String(!collapsed));
}

// ============================================================================
// Key: the finding in one sentence, and the color scale
// ============================================================================

function renderKey() {
  const metric = state.metric;
  const overview = getOverview(metric);
  const share = fmtPercent(overview.popShareAbove);

  let finding;
  if (isParisMetric(metric)) {
    finding = t('findingParis')(fmt(overview.reference, 1), t('warmingLabel')[metric],
      overview.above, overview.countries, share);
  } else if (metric === 'hist') {
    finding = t('findingHist')(fmtTonnes(overview.reference), overview.above, overview.countries, share);
  } else {
    finding = t('findingWorld')(fmtTonnes(overview.reference), overview.above, overview.countries, share);
  }
  $('key-finding').innerHTML = finding;
  // While countries are resized, say what the sizes mean instead.
  let note = t('basisNote')[metric];
  if (state.scaled) {
    note = state.globeView ? t('resizedNoteGlobe')
      : isParisMetric(metric) ? t('resizedNoteFair') : t('resizedNoteWorld');
  }
  $('key-basis').textContent = note;
  $('key').classList.toggle('explains-resize', state.scaled);

  const title = isParisMetric(metric)
    ? t('legendFair')(t('warmingLabel')[metric])
    : t('legendWorld');

  const steps = LEGEND_STEPS
    .map(value => `<div class="legend-step" style="background:${getRatioColor(value)}"></div>`)
    .join('');
  const ticks = LEGEND_TICKS.map(value => {
    const position = (LEGEND_STEPS.indexOf(value) + 0.5) / LEGEND_STEPS.length * 100;
    const reference = value === 1 ? ' legend-tick-reference' : '';
    return `<span class="legend-tick${reference}" style="left:${position}%">${fmtPercent(value)}</span>`;
  }).join('');

  $('legend').innerHTML = `
    <div class="legend-title">${escapeHtml(title)}</div>
    <div class="legend-bar" aria-hidden="true">${steps}</div>
    <div class="legend-ticks" aria-hidden="true">${ticks}</div>
    <div class="legend-nodata">
      <span class="legend-swatch" style="background:${NO_DATA_COLOR}"></span>${escapeHtml(t('noData'))}
    </div>`;
}

// ============================================================================
// Ranking
// ============================================================================

/**
 * Lower-case and strip accents, so "reunion" finds "Réunion".
 */
function normalizeForSearch(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function renderRanking() {
  const entries = getRanking(state.metric);
  $('ranking-hint').textContent = state.metric === 'hist' ? t('rankingHintHist') : t('rankingHint');

  $('ranking-list').innerHTML = entries.map((entry, index) => {
    const name = tn(entry.name);
    const current = entry.id === state.selectedId ? ' aria-current="true"' : '';
    return `<li data-search="${escapeHtml(normalizeForSearch(name))}">
      <button type="button" class="ranking-item" data-id="${escapeHtml(entry.id)}"${current}>
        <span class="ranking-rank">${index + 1}</span>
        <span class="ranking-color" style="background:${getRatioColor(entry.ratio)}"></span>
        <span class="ranking-name">${escapeHtml(name)}</span>
        <span class="ranking-value">${fmtTonnes(entry.perCapita)} ${t('unitShort')}</span>
      </button>
    </li>`;
  }).join('');

  filterRanking();
  markRankingSelection(true);
}

function filterRanking() {
  const query = normalizeForSearch($('ranking-search').value.trim());
  let visible = 0;
  $('ranking-list').querySelectorAll('li').forEach(item => {
    const match = !query || item.dataset.search.includes(query);
    item.hidden = !match;
    if (match) visible++;
  });
  $('ranking-empty').hidden = visible > 0;
}

/**
 * Mark the selected country without rebuilding the list.
 */
function markRankingSelection(scroll) {
  let selected = null;
  $('ranking-list').querySelectorAll('.ranking-item').forEach(item => {
    if (item.dataset.id === state.selectedId) {
      item.setAttribute('aria-current', 'true');
      selected = item;
    } else {
      item.removeAttribute('aria-current');
    }
  });
  if (scroll && selected && !selected.parentElement.hidden) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}

function setRankingOpen(open) {
  state.rankingOpen = open;
  const panel = $('ranking-panel');
  panel.classList.toggle('visible', open);
  panel.inert = !open;
  document.body.classList.toggle('ranking-open', open);
  $('ranking-toggle').setAttribute('aria-expanded', String(open));
  if (open) renderRanking();
}

// ============================================================================
// Country Panel
// ============================================================================

function panelHead(title) {
  return `
    <div class="panel-head">
      <h2 id="info-title" tabindex="-1">${escapeHtml(title)}</h2>
      <button class="icon-btn panel-minimize" type="button" data-action="minimize" aria-expanded="true" aria-label="${escapeHtml(t('minimize'))}">${icon('chevron')}</button>
      <button class="icon-btn" type="button" data-action="close" aria-label="${escapeHtml(t('close'))}">${icon('close')}</button>
    </div>`;
}

/**
 * Small amounts need more decimals than large ones to say anything.
 */
function fmtAmount(value) {
  if (value == null) return t('na');
  return fmt(value, value < 10 ? 2 : value < 100 ? 1 : 0);
}

/**
 * The explanation in plain sentences. What it says depends on the view:
 * a budget that runs out, a distance to the world average, or a
 * historical total that can no longer be changed.
 */
function explanationHtml(stats, metric) {
  const ratio = stats.ratio;
  const over = ratio > 1;
  const perCapita = fmtTonnes(stats.perCapita);
  const reference = fmtTonnes(getReferencePerCapita(metric));

  if (isParisMetric(metric)) {
    const budget = getParisBudget(metric);
    const label = t('warmingLabel')[metric];
    const fair = fmt(budget.perCapita, 1);
    const years = budget.years / ratio;
    const yearsText = years > 200
      ? t('moreThanYears')(200)
      : fmt(years, years < 10 ? 1 : 0);
    return over
      ? t('explainParisOver')(label, fair, perCapita, fmtTimes(ratio), yearsText, budget.years)
      : t('explainParisUnder')(label, fair, perCapita, yearsText, budget.years);
  }

  if (metric === 'hist') {
    return over
      ? t('explainHistOver')(perCapita, reference, fmtTimes(ratio))
      : t('explainHistUnder')(perCapita, reference);
  }

  // Reaching the average from a ratio r means changing emissions by 1/r - 1.
  if (over) return t('explainWorldOver')(perCapita, reference, fmtPercent(1 - 1 / ratio));
  if (ratio < 0.1) return t('explainWorldTiny')(perCapita, reference);
  return t('explainWorldUnder')(perCapita, reference, fmtPercent(1 / ratio - 1));
}

function panelNotes(stats, metric, areaResized) {
  const notes = [];
  if (areaResized) notes.push(t('sizeNote')(fmtPercent(stats.ratio)));
  if (metric === 'hist') notes.push(escapeHtml(t('histNote')));
  if (isParisMetric(metric) || metric === 'cons') {
    notes.push(escapeHtml(stats.usedFallback ? t('consFallbackNote') : t('consNote')));
  }
  return notes.map(note => `<p class="panel-note">${note}</p>`).join('');
}

function figuresTable(stats, metric) {
  const basisInUse = metric === 'hist' ? 'hist'
    : metric === 'co2' || stats.usedFallback ? 'co2'
    : 'cons';
  const perPerson = (value) => (value != null ? `${fmtTonnes(value / stats.population)} t` : t('na'));
  const long = t('metricLong');
  const rows = [
    { key: 'co2', label: long.co2, perCapita: perPerson(stats.co2), total: stats.co2 != null ? `${fmtAmount(stats.co2)} Mt` : t('na') },
    { key: 'cons', label: long.cons, perCapita: perPerson(stats.cons), total: stats.cons != null ? `${fmtAmount(stats.cons)} Mt` : t('na') },
    { key: 'hist', label: long.hist, perCapita: perPerson(stats.hist != null ? stats.hist * 1000 : null), total: stats.hist != null ? `${fmtAmount(stats.hist)} Gt` : t('na') },
  ];
  return `
    <details class="figures"${isSmallScreen() ? '' : ' open'}>
      <summary>${escapeHtml(t('allFigures'))}</summary>
      <table>
        <thead>
          <tr><th scope="col"><span class="sr-only">${escapeHtml(t('allFigures'))}</span></th><th scope="col">${escapeHtml(t('perCapita'))}</th><th scope="col">${escapeHtml(t('total'))}</th></tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr${row.key === basisInUse ? ' class="in-use"' : ''}>
              <td>${escapeHtml(row.label)}</td>
              <td>${escapeHtml(row.perCapita)}</td>
              <td>${escapeHtml(row.total)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </details>`;
}

/**
 * Draw the panel for the selected country, or a short note for places
 * without data of their own.
 */
function renderInfoPanel() {
  const panel = $('info-panel');
  const id = state.selectedId;
  if (id == null) return;

  const metric = state.metric;
  const stats = getCountryStats(id, metric);
  const wasMinimized = panel.classList.contains('minimized');

  if (!stats || stats.ratio == null) {
    const title = placeName(id) || t('unknownTerritory')(id);
    const parent = !stats ? TERRITORY_PARENTS[id] : null;
    const note = parent
      ? t('dataIncludedUnder')(escapeHtml(tn(parent)))
      : escapeHtml(t('noDataAvailable'));
    panel.innerHTML = `${panelHead(title)}<div class="panel-body"><p class="panel-empty">${note}</p></div>`;
  } else {
    const paris = isParisMetric(metric);
    const ratio = stats.ratio;
    const over = ratio > 1;
    const diff = Math.abs(ratio - 1);
    const diffText = fmtPercent(diff);
    const label = paris ? t('warmingLabel')[metric] : null;

    const heroLabel = paris ? t('heroFair')(label) : t('heroWorld');
    let heroDetail = '';
    if (diff >= 0.005) {
      heroDetail = paris
        ? (over ? t('aboveFair')(diffText) : t('belowFair')(diffText))
        : (over ? t('aboveWorld')(diffText) : t('belowWorld')(diffText));
    }

    // Only one country is resized by area on the globe; on the flat map
    // "resize countries" does it for all of them.
    const areaResized = ratio !== 1 && (state.globeView
      ? state.selectedScaled && !state.scaled
      : state.selectedScaled || state.scaled);

    const unit = `t CO₂ ${metric === 'hist' ? t('since1750') : t('perYear')}`;

    panel.innerHTML = `
      ${panelHead(tn(stats.name))}
      <div class="panel-body">
        <div class="hero ${over ? 'over' : 'under'}">
          <div class="hero-value">${fmtPercent(ratio)}</div>
          <div class="hero-label">${escapeHtml(heroLabel)}</div>
          ${heroDetail ? `<div class="hero-detail">${escapeHtml(heroDetail)}</div>` : ''}
        </div>

        <div class="explanation">${explanationHtml(stats, metric)}</div>

        <div class="panel-actions">
          ${!state.scaled && ratio !== 1 ? `
          <button class="btn" type="button" data-action="resize">
            ${icon(state.selectedScaled ? 'undo' : 'resize')}
            <span>${escapeHtml(state.selectedScaled ? t('resetCountry') : t('resizeCountry'))}</span>
          </button>` : ''}
          <button class="btn" type="button" data-action="share">
            ${icon('share')}<span>${escapeHtml(t('share'))}</span>
          </button>
        </div>

        <dl class="facts">
          <div><dt>${escapeHtml(t('factPerCapita'))}</dt><dd>${fmtTonnes(stats.perCapita)} ${unit}</dd></div>
          <div><dt>${escapeHtml(paris ? t('factFair') : t('factWorld'))}</dt><dd>${fmtTonnes(getReferencePerCapita(metric))} ${unit}</dd></div>
          <div><dt>${escapeHtml(t('factPopulation'))}</dt><dd>${fmtPopulation(stats.population)}</dd></div>
        </dl>

        ${figuresTable(stats, metric)}
        ${panelNotes(stats, metric, areaResized)}
      </div>`;
  }

  panel.classList.add('visible');
  panel.inert = false;
  document.body.classList.add('info-open');
  setInfoMinimized(wasMinimized && panel.dataset.country === id);
  panel.dataset.country = id;
}

function hideInfoPanel() {
  const panel = $('info-panel');
  panel.classList.remove('visible', 'minimized');
  panel.inert = true;
  delete panel.dataset.country;
  document.body.classList.remove('info-open', 'info-minimized');
}

function setInfoMinimized(minimized) {
  const panel = $('info-panel');
  panel.classList.toggle('minimized', minimized);
  document.body.classList.toggle('info-minimized', minimized);
  const button = panel.querySelector('[data-action="minimize"]');
  if (button) {
    button.setAttribute('aria-expanded', String(!minimized));
    button.setAttribute('aria-label', minimized ? t('expand') : t('minimize'));
  }
}

function focusInfoPanel() {
  const title = $('info-title');
  if (title) title.focus({ preventScroll: true });
}

// ============================================================================
// Method and Sources
// ============================================================================

function renderAbout() {
  const b15 = getParisBudget('paris');
  const b2 = getParisBudget('paris2');
  const ids = Object.keys(CO2_DATA);
  $('about-body').innerHTML = t('aboutHtml')({
    from15: fmt(b15.from2020, 0),
    from2: fmt(b2.from2020, 0),
    like15: b15.likelihood,
    like2: b2.likelihood,
    emitted: fmt(b15.emitted, 0),
    baseYear: BUDGET_BASE_YEAR,
    left15: fmt(b15.remaining, 0),
    left2: fmt(b2.remaining, 0),
    startYear: b15.startYear,
    targetYear: BUDGET_TARGET_YEAR,
    years: b15.years,
    people: fmt(WORLD_TOTALS.pop / 1000, 2),
    pc15: fmt(b15.perCapita, 1),
    pc2: fmt(b2.perCapita, 1),
    consCount: ids.filter(id => CO2_DATA[id].cons != null).length,
    countries: ids.length,
    dataYear: DATA_META.dataYear,
    newer: (() => {
      const newer = getNewerBudgetEstimate();
      return {
        gt: fmt(newer.remaining, 0),
        year: newer.fromYear,
        likelihood: newer.likelihood,
        perCapita: fmt(newer.perCapita, 1),
        url: newer.url,
      };
    })(),
  });
}

function openAbout() {
  renderAbout();
  const dialog = $('about');
  if (!dialog.open) dialog.showModal();
  $('about-body').scrollTop = 0;
}
