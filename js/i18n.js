/**
 * CO2 Budget Map — texts and number formatting (English, German)
 *
 * Static texts are bound in index.html with `data-i18n="key"` (text content)
 * and `data-i18n-attr="attribute:key;attribute:key"`. Texts with numbers in
 * them are functions; the numbers arrive already formatted.
 */

const TRANSLATIONS = {
  en: {
    // Page
    pageTitle: 'CO₂ Budget Map — Who\'s Using More Than Their Fair Share?',
    titleA: 'CO₂ ',
    titleB: 'Budget Map',
    loading: 'Loading map data…',
    loadError: 'The map data could not be loaded. Check your connection and try again.',
    retry: 'Try again',
    globeLoading: 'Loading the globe…',
    globeError: 'The globe could not be loaded. The flat map still works.',
    languageLabel: 'Language',

    // Metric selector
    metricsLabel: 'What the map compares',
    groupFair: 'Fair share',
    groupWorld: 'World average',
    metricShort: { paris: '1.5 °C', paris2: '2 °C', co2: 'Territorial', cons: 'Consumption', hist: 'Historical' },
    metricLong: {
      paris: 'Fair share for 1.5 °C',
      paris2: 'Fair share for 2 °C',
      co2: 'Territorial',
      cons: 'Consumption-based',
      hist: 'Historical (since 1750)',
    },
    warmingLabel: { paris: '1.5 °C', paris2: '2 °C' },

    // Header controls
    settings: 'View settings',
    scaleToggle: 'Resize countries',
    colorblind: 'Colorblind',
    globeView: 'Globe',
    mapView: 'Map',
    ranking: 'Ranking',
    share: 'Share',
    summaryScaled: 'resized',

    // Map
    mapLabel: 'World map of CO₂ emissions per person',
    globeLabel: 'Globe of CO₂ emissions per person',
    mapHint: 'The map needs a pointer. Open the ranking to browse and select countries with the keyboard.',

    // Key (finding + legend)
    keyLabel: 'What the map shows',
    findingParis: (pc, label, above, total, share) =>
      `<strong>${pc} t of CO₂</strong> per person and year is a fair share if warming is to stay at ${label}. <strong>${above} of ${total} countries</strong> emit more. They are home to ${share} of all people.`,
    findingWorld: (pc, above, total, share) =>
      `The world emits <strong>${pc} t of CO₂</strong> per person and year. <strong>${above} of ${total} countries</strong> are above that average. They are home to ${share} of all people.`,
    findingHist: (pc, above, total, share) =>
      `Since 1750 the world has emitted <strong>${pc} t of CO₂</strong> for each person alive today. <strong>${above} of ${total} countries</strong> are above that average. They are home to ${share} of all people.`,
    basisNote: {
      paris: 'Counted by consumption where data exists.',
      paris2: 'Counted by consumption where data exists.',
      co2: 'Counted where the CO₂ is emitted.',
      cons: 'Counted where goods are consumed, imports included.',
      hist: 'Past emissions divided by today\'s population.',
    },
    resizedNoteFair: 'Each country is drawn as large as the share of its fair budget it uses. The pale shapes underneath show its real size.',
    resizedNoteWorld: 'Each country is drawn larger or smaller by how far it is above or below the world average. The pale shapes underneath show its real size.',
    resizedNoteGlobe: 'The taller a country stands, the more it emits per person.',
    legendFair: (label) => `Share of the fair ${label} budget`,
    legendWorld: 'Compared with the world average',
    noData: 'no data',
    dataBy: 'Data:',
    aboutLink: 'How this is calculated',

    // Tooltip
    unitPerCapita: 't CO₂ per person',
    unitPerCapitaHist: 't CO₂ per person since 1750',
    ofFairShare: (pct) => `${pct} of the fair share`,
    ofWorldAvg: (pct) => `${pct} of the world average`,
    tooltipDataUnder: (parent) => `Included in: ${parent}`,
    tooltipNoData: 'No data available',

    // Ranking
    countryRanking: 'Country ranking',
    rankingHint: 'Tonnes of CO₂ per person and year, highest first',
    rankingHintHist: 'Tonnes of CO₂ per person since 1750, highest first',
    searchCountry: 'Find a country',
    noMatch: 'No country matches.',
    unitShort: 't',

    // Info panel
    close: 'Close',
    minimize: 'Collapse',
    expand: 'Expand',
    heroFair: (label) => `of its fair share for ${label}`,
    heroWorld: 'of the world average per person',
    aboveFair: (pct) => `${pct} above the fair share`,
    belowFair: (pct) => `${pct} below the fair share`,
    aboveWorld: (pct) => `${pct} above the world average`,
    belowWorld: (pct) => `${pct} below the world average`,
    resizeCountry: 'Resize this country',
    resetCountry: 'Show actual size',
    factPerCapita: 'Emissions per person',
    factFair: 'Fair share per person',
    factWorld: 'World average per person',
    factPopulation: 'Population',
    perYear: 'a year',
    million: 'million',
    since1750: 'since 1750',
    allFigures: 'All figures',
    perCapita: 'Per person',
    total: 'Total',
    na: 'n/a',

    // Explanations
    explainParisOver: (label, fair, pc, times, years, total) =>
      `<p>To keep warming at ${label}, each person can emit about <strong>${fair} t</strong> of CO₂ a year until 2050. Here it is <strong>${pc} t</strong> per person, ${times} times as much.</p><p>At this pace the country's fair share of the remaining budget would be used up in <strong>${years} years</strong> instead of ${total}.</p>`,
    explainParisUnder: (label, fair, pc, years, total) =>
      `<p>To keep warming at ${label}, each person can emit about <strong>${fair} t</strong> of CO₂ a year until 2050. Here it is <strong>${pc} t</strong> per person, which is less.</p><p>At this pace the country's fair share of the remaining budget would last <strong>${years} years</strong> instead of ${total}.</p>`,
    moreThanYears: (n) => `more than ${n}`,
    explainWorldOver: (pc, ref, cut) =>
      `<p>Emissions here are <strong>${pc} t</strong> of CO₂ per person and year. The world average is ${ref} t.</p><p>To reach the average, the country would have to cut its emissions by <strong>${cut}</strong>.</p>`,
    explainWorldUnder: (pc, ref, grow) =>
      `<p>Emissions here are <strong>${pc} t</strong> of CO₂ per person and year. The world average is ${ref} t.</p><p>The country could emit <strong>${grow}</strong> more before reaching the average.</p>`,
    explainWorldTiny: (pc, ref) =>
      `<p>Emissions here are <strong>${pc} t</strong> of CO₂ per person and year. The world average is ${ref} t.</p><p>That is less than a tenth of the average.</p>`,
    explainHistOver: (pc, ref, times) =>
      `<p>Since 1750, <strong>${pc} t</strong> of CO₂ have been emitted here for each person alive today. That is ${times} times the world average of ${ref} t.</p>`,
    explainHistUnder: (pc, ref) =>
      `<p>Since 1750, <strong>${pc} t</strong> of CO₂ have been emitted here for each person alive today. The world average is ${ref} t.</p>`,
    histNote: 'A rough measure: all past emissions are divided by today\'s population.',
    sizeNote: (pct) => `On the map the country is drawn at <strong>${pct}</strong> of its real area.`,
    consNote: 'Counted by consumption: imports count, exports do not.',
    consFallbackNote: 'There is no consumption-based data for this country, so territorial emissions are used.',

    // Territories and missing data
    unknownTerritory: (code) => `Unknown (${code})`,
    dataIncludedUnder: (parent) => `The emissions of this territory are included in the figures for <strong>${parent}</strong>.`,
    noDataAvailable: 'There is no emissions data for this country.',

    // Sharing
    linkCopied: 'Link copied',
    shareFailed: 'The link could not be copied. Copy it from the address bar instead.',
    shareTextCountry: (name, pct, label) => `${name}: ${pct} of the fair CO₂ share for ${label}.`,
    shareTextWorld: (name, pct) => `${name}: ${pct} of the world average per person.`,
    shareTextDefault: 'Which countries use more than their fair share of the CO₂ budget?',

    // About
    aboutTitle: 'How this is calculated',
    aboutHtml: (c) => `
      <h3>The idea</h3>
      <p>The atmosphere can only take a limited amount of CO₂ before warming passes 1.5 °C or 2 °C. This map gives every person on Earth the same share of what is left and compares each country's emissions with it.</p>
      <p>A country at 100% uses exactly its fair share. At 300% it uses three times as much, and when you resize countries it is drawn at three times its area.</p>

      <h3>The fair share, step by step</h3>
      <ol>
        <li>The IPCC's Sixth Assessment Report gives the carbon budget left from 2020: ${c.from15} Gt of CO₂ for 1.5 °C (${c.like15}% likelihood) and ${c.from2} Gt for 2 °C (${c.like2}% likelihood).</li>
        <li>About ${c.emitted} Gt were emitted from ${c.baseYear} to ${c.dataYear}. That leaves ${c.left15} Gt and ${c.left2} Gt from ${c.startYear}.</li>
        <li>The rest is spread evenly over the ${c.years} years to ${c.targetYear} and over ${c.people} billion people.</li>
      </ol>
      <p>The result is <strong>${c.pc15} t of CO₂ per person and year</strong> for 1.5 °C and <strong>${c.pc2} t</strong> for 2 °C.</p>
      <p class="about-note"><strong>Newer estimates are stricter.</strong> The study <a href="${c.newer.url}" target="_blank" rel="noopener">Indicators of Global Climate Change</a> (Forster et al., 2026) puts the remaining budget for 1.5 °C (${c.newer.likelihood} % likelihood) at ${c.newer.gt} Gt from the start of ${c.newer.year}. Spread the same way as above, that is about ${c.newer.perCapita} t per person and year, not ${c.pc15} t. This map keeps the IPCC figures because they are the latest the IPCC has assessed and cover both temperature limits.</p>

      <h3>The five views</h3>
      <dl>
        <dt>Fair share for 1.5 °C and for 2 °C</dt>
        <dd>Today's emissions per person, compared with the fair share above. Emissions are counted by consumption where that data exists.</dd>
        <dt>Territorial</dt>
        <dd>CO₂ emitted inside a country's borders, from power plants, factories, cars and heating. Compared with the world average per person.</dd>
        <dt>Consumption-based</dt>
        <dd>CO₂ caused by what a country consumes. Emissions in imported goods count, emissions in exports do not. Compared with the world average.</dd>
        <dt>Historical</dt>
        <dd>All CO₂ emitted since 1750, divided by today's population and compared with the world average.</dd>
      </dl>

      <h3>What the map simplifies</h3>
      <ul>
        <li>An equal share per person is one way to define fairness. It leaves out past emissions and how much a country can afford to do.</li>
        <li>Spreading the budget evenly to ${c.targetYear} keeps the calculation simple. It is not a forecast of how emissions will fall.</li>
        <li>The emissions subtracted from the budget are those from fossil fuels and cement, as in the country data. Emissions from land use (about 4 Gt a year) are left out, so the remaining budget comes out slightly too large.</li>
        <li>Consumption-based data exists for ${c.consCount} of ${c.countries} countries. The others are shown with territorial emissions, and the country panel says so.</li>
        <li>The historical view divides past emissions by today's population. Countries that grew fast look lower, countries that grew slowly look higher.</li>
        <li>Some territories are counted under the country that reports their emissions.</li>
        <li>International aviation and shipping are part of the world average but belong to no country.</li>
      </ul>

      <h3>Sources</h3>
      <ul>
        <li>Emissions and population: <a href="https://github.com/owid/co2-data" target="_blank" rel="noopener">Our World in Data CO₂ dataset</a>, based on the <a href="https://globalcarbonbudget.org/" target="_blank" rel="noopener">Global Carbon Project</a> and UN population estimates. Data year ${c.dataYear}, licence CC BY 4.0.</li>
        <li>Carbon budgets: <a href="https://www.ipcc.ch/report/ar6/wg1/" target="_blank" rel="noopener">IPCC AR6, Working Group I</a>, Summary for Policymakers, Table SPM.2.</li>
        <li>Newer budget estimate: <a href="${c.newer.url}" target="_blank" rel="noopener">Forster et al. (2026)</a>, Indicators of Global Climate Change, Earth System Science Data.</li>
        <li>Country shapes: Natural Earth via world-atlas. Map: Leaflet. Globe: globe.gl. Font: Source Sans 3.</li>
      </ul>

      <h3>Privacy</h3>
      <p>This page sets no cookies, and every file it needs comes from this site itself. Page views are counted with <a href="https://www.goatcounter.com/" target="_blank" rel="noopener">GoatCounter</a>, without cookies: it records the page view, the referring page, browser, screen width and country, and stores no IP address. Your language choice stays in your browser. The country the map starts on is guessed in your browser from its time zone and language and is sent nowhere.</p>

      <p class="about-credit">A project by <a href="https://github.com/Evolving-Thoughts" target="_blank" rel="noopener">Evolving Thoughts</a>. The <a href="https://github.com/Evolving-Thoughts/CO2-map" target="_blank" rel="noopener">source code</a> is on GitHub.</p>`,
  },

  de: {
    pageTitle: 'CO₂-Budgetkarte — Wer verbraucht mehr als seinen fairen Anteil?',
    titleA: 'CO₂-',
    titleB: 'Budgetkarte',
    loading: 'Kartendaten werden geladen…',
    loadError: 'Die Kartendaten konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.',
    retry: 'Erneut versuchen',
    globeLoading: 'Globus wird geladen…',
    globeError: 'Der Globus konnte nicht geladen werden. Die Karte funktioniert weiterhin.',
    languageLabel: 'Sprache',

    metricsLabel: 'Was die Karte vergleicht',
    groupFair: 'Fairer Anteil',
    groupWorld: 'Weltdurchschnitt',
    metricShort: { paris: '1,5 °C', paris2: '2 °C', co2: 'Territorial', cons: 'Konsum', hist: 'Historisch' },
    metricLong: {
      paris: 'Fairer Anteil für 1,5 °C',
      paris2: 'Fairer Anteil für 2 °C',
      co2: 'Territorial',
      cons: 'Konsumbasiert',
      hist: 'Historisch (seit 1750)',
    },
    warmingLabel: { paris: '1,5 °C', paris2: '2 °C' },

    settings: 'Ansicht einstellen',
    scaleToggle: 'Länder skalieren',
    colorblind: 'Farbenblind',
    globeView: 'Globus',
    mapView: 'Karte',
    ranking: 'Rangliste',
    share: 'Teilen',
    summaryScaled: 'skaliert',

    mapLabel: 'Weltkarte der CO₂-Emissionen pro Kopf',
    globeLabel: 'Globus der CO₂-Emissionen pro Kopf',
    mapHint: 'Die Karte wird mit Maus oder Finger bedient. Über die Rangliste lassen sich Länder auch mit der Tastatur auswählen.',

    keyLabel: 'Was die Karte zeigt',
    findingParis: (pc, label, above, total, share) =>
      `<strong>${pc} t CO₂</strong> pro Kopf und Jahr sind ein fairer Anteil, wenn die Erwärmung bei ${label} bleiben soll. <strong>${above} von ${total} Ländern</strong> liegen darüber. Dort leben ${share} der Menschen.`,
    findingWorld: (pc, above, total, share) =>
      `Weltweit entstehen <strong>${pc} t CO₂</strong> pro Kopf und Jahr. <strong>${above} von ${total} Ländern</strong> liegen über diesem Durchschnitt. Dort leben ${share} der Menschen.`,
    findingHist: (pc, above, total, share) =>
      `Seit 1750 hat die Welt <strong>${pc} t CO₂</strong> pro heute lebendem Menschen ausgestoßen. <strong>${above} von ${total} Ländern</strong> liegen über diesem Durchschnitt. Dort leben ${share} der Menschen.`,
    basisNote: {
      paris: 'Gezählt nach Konsum, wo Daten vorliegen.',
      paris2: 'Gezählt nach Konsum, wo Daten vorliegen.',
      co2: 'Gezählt dort, wo das CO₂ ausgestoßen wird.',
      cons: 'Gezählt dort, wo Güter verbraucht werden, Importe eingeschlossen.',
      hist: 'Bisherige Emissionen geteilt durch die heutige Bevölkerung.',
    },
    resizedNoteFair: 'Jedes Land ist so groß gezeichnet, wie es sein faires Budget ausschöpft. Die hellen Flächen darunter zeigen seine tatsächliche Größe.',
    resizedNoteWorld: 'Jedes Land ist größer oder kleiner gezeichnet, je nachdem, wie weit es über oder unter dem Weltdurchschnitt liegt. Die hellen Flächen darunter zeigen seine tatsächliche Größe.',
    resizedNoteGlobe: 'Je höher ein Land aufragt, desto mehr stößt es pro Kopf aus.',
    legendFair: (label) => `Anteil am fairen ${label.replace(' °C', '-°C')}-Budget`,
    legendWorld: 'Im Vergleich zum Weltdurchschnitt',
    noData: 'keine Daten',
    dataBy: 'Daten:',
    aboutLink: 'So wird gerechnet',

    unitPerCapita: 't CO₂ pro Kopf',
    unitPerCapitaHist: 't CO₂ pro Kopf seit 1750',
    ofFairShare: (pct) => `${pct} des fairen Anteils`,
    ofWorldAvg: (pct) => `${pct} des Weltdurchschnitts`,
    tooltipDataUnder: (parent) => `Enthalten in: ${parent}`,
    tooltipNoData: 'Keine Daten verfügbar',

    countryRanking: 'Länder-Rangliste',
    rankingHint: 'Tonnen CO₂ pro Kopf und Jahr, höchste zuerst',
    rankingHintHist: 'Tonnen CO₂ pro Kopf seit 1750, höchste zuerst',
    searchCountry: 'Land suchen',
    noMatch: 'Kein Land gefunden.',
    unitShort: 't',

    close: 'Schließen',
    minimize: 'Einklappen',
    expand: 'Ausklappen',
    heroFair: (label) => `des fairen Anteils für ${label}`,
    heroWorld: 'des Weltdurchschnitts pro Kopf',
    aboveFair: (pct) => `${pct} über dem fairen Anteil`,
    belowFair: (pct) => `${pct} unter dem fairen Anteil`,
    aboveWorld: (pct) => `${pct} über dem Weltdurchschnitt`,
    belowWorld: (pct) => `${pct} unter dem Weltdurchschnitt`,
    resizeCountry: 'Dieses Land skalieren',
    resetCountry: 'Tatsächliche Größe zeigen',
    factPerCapita: 'Emissionen pro Kopf',
    factFair: 'Fairer Anteil pro Kopf',
    factWorld: 'Weltdurchschnitt pro Kopf',
    factPopulation: 'Bevölkerung',
    perYear: 'pro Jahr',
    million: 'Mio.',
    since1750: 'seit 1750',
    allFigures: 'Alle Zahlen',
    perCapita: 'Pro Kopf',
    total: 'Gesamt',
    na: 'k. A.',

    explainParisOver: (label, fair, pc, times, years, total) =>
      `<p>Damit die Erwärmung bei ${label} bleibt, kann jeder Mensch bis 2050 etwa <strong>${fair} t</strong> CO₂ pro Jahr ausstoßen. Hier sind es <strong>${pc} t</strong> pro Kopf, das ${times}-Fache.</p><p>Bei diesem Tempo wäre der faire Anteil des Landes am verbleibenden Budget in <strong>${years} Jahren</strong> aufgebraucht statt in ${total}.</p>`,
    explainParisUnder: (label, fair, pc, years, total) =>
      `<p>Damit die Erwärmung bei ${label} bleibt, kann jeder Mensch bis 2050 etwa <strong>${fair} t</strong> CO₂ pro Jahr ausstoßen. Hier sind es <strong>${pc} t</strong> pro Kopf, also weniger.</p><p>Bei diesem Tempo würde der faire Anteil des Landes am verbleibenden Budget <strong>${years} Jahre</strong> reichen statt ${total}.</p>`,
    moreThanYears: (n) => `mehr als ${n}`,
    explainWorldOver: (pc, ref, cut) =>
      `<p>Hier entstehen pro Kopf und Jahr <strong>${pc} t</strong> CO₂. Der Weltdurchschnitt liegt bei ${ref} t.</p><p>Um den Durchschnitt zu erreichen, müsste das Land seine Emissionen um <strong>${cut}</strong> senken.</p>`,
    explainWorldUnder: (pc, ref, grow) =>
      `<p>Hier entstehen pro Kopf und Jahr <strong>${pc} t</strong> CO₂. Der Weltdurchschnitt liegt bei ${ref} t.</p><p>Bis zum Durchschnitt könnte das Land <strong>${grow}</strong> mehr ausstoßen.</p>`,
    explainWorldTiny: (pc, ref) =>
      `<p>Hier entstehen pro Kopf und Jahr <strong>${pc} t</strong> CO₂. Der Weltdurchschnitt liegt bei ${ref} t.</p><p>Das ist weniger als ein Zehntel des Durchschnitts.</p>`,
    explainHistOver: (pc, ref, times) =>
      `<p>Seit 1750 sind hier <strong>${pc} t</strong> CO₂ pro heute lebendem Menschen entstanden. Das ist das ${times}-Fache des Weltdurchschnitts von ${ref} t.</p>`,
    explainHistUnder: (pc, ref) =>
      `<p>Seit 1750 sind hier <strong>${pc} t</strong> CO₂ pro heute lebendem Menschen entstanden. Der Weltdurchschnitt liegt bei ${ref} t.</p>`,
    histNote: 'Eine grobe Näherung: Alle bisherigen Emissionen werden durch die heutige Bevölkerung geteilt.',
    sizeNote: (pct) => `Auf der Karte ist das Land auf <strong>${pct}</strong> seiner tatsächlichen Fläche skaliert.`,
    consNote: 'Gezählt nach Konsum: Importe zählen mit, Exporte nicht.',
    consFallbackNote: 'Für dieses Land gibt es keine konsumbasierten Daten, deshalb zählen die territorialen Emissionen.',

    unknownTerritory: (code) => `Unbekannt (${code})`,
    dataIncludedUnder: (parent) => `Die Emissionen dieses Gebiets stecken in den Zahlen für <strong>${parent}</strong>.`,
    noDataAvailable: 'Für dieses Land liegen keine Emissionsdaten vor.',

    linkCopied: 'Link kopiert',
    shareFailed: 'Der Link ließ sich nicht kopieren. Kopiere ihn aus der Adresszeile.',
    shareTextCountry: (name, pct, label) => `${name}: ${pct} des fairen CO₂-Anteils für ${label}.`,
    shareTextWorld: (name, pct) => `${name}: ${pct} des Weltdurchschnitts pro Kopf.`,
    shareTextDefault: 'Welche Länder verbrauchen mehr als ihren fairen Anteil am CO₂-Budget?',

    aboutTitle: 'So wird gerechnet',
    aboutHtml: (c) => `
      <h3>Die Idee</h3>
      <p>Die Atmosphäre verträgt nur noch eine begrenzte Menge CO₂, bevor die Erwärmung 1,5 °C oder 2 °C überschreitet. Diese Karte gibt jedem Menschen denselben Anteil an dem, was übrig ist, und vergleicht die Emissionen jedes Landes damit.</p>
      <p>Ein Land bei 100 % verbraucht genau seinen fairen Anteil. Bei 300 % ist es das Dreifache, und wenn du die Länder skalierst, wird es mit der dreifachen Fläche gezeichnet.</p>

      <h3>Der faire Anteil, Schritt für Schritt</h3>
      <ol>
        <li>Der Sechste Sachstandsbericht des IPCC nennt das CO₂-Budget, das ab 2020 bleibt: ${c.from15} Gt CO₂ für 1,5 °C (${c.like15} % Wahrscheinlichkeit) und ${c.from2} Gt für 2 °C (${c.like2} % Wahrscheinlichkeit).</li>
        <li>Von ${c.baseYear} bis ${c.dataYear} wurden rund ${c.emitted} Gt ausgestoßen. Ab ${c.startYear} bleiben also ${c.left15} Gt und ${c.left2} Gt.</li>
        <li>Der Rest wird gleichmäßig auf die ${c.years} Jahre bis ${c.targetYear} und auf ${c.people} Milliarden Menschen verteilt.</li>
      </ol>
      <p>Das ergibt <strong>${c.pc15} t CO₂ pro Kopf und Jahr</strong> für 1,5 °C und <strong>${c.pc2} t</strong> für 2 °C.</p>
      <p class="about-note"><strong>Neuere Schätzungen sind strenger.</strong> Die Studie <a href="${c.newer.url}" target="_blank" rel="noopener">Indicators of Global Climate Change</a> (Forster et al., 2026) beziffert das verbleibende Budget für 1,5 °C (${c.newer.likelihood} % Wahrscheinlichkeit) auf ${c.newer.gt} Gt ab Anfang ${c.newer.year}. Genauso verteilt wie oben sind das rund ${c.newer.perCapita} t pro Kopf und Jahr statt ${c.pc15} t. Diese Karte bleibt bei den IPCC-Werten, weil sie die zuletzt vom Weltklimarat bewerteten sind und beide Temperaturgrenzen abdecken.</p>

      <h3>Die fünf Ansichten</h3>
      <dl>
        <dt>Fairer Anteil für 1,5 °C und für 2 °C</dt>
        <dd>Die heutigen Emissionen pro Kopf im Vergleich zum fairen Anteil von oben. Gezählt wird nach Konsum, wo es dazu Daten gibt.</dd>
        <dt>Territorial</dt>
        <dd>CO₂, das innerhalb der Landesgrenzen entsteht, durch Kraftwerke, Fabriken, Autos und Heizungen. Verglichen mit dem Weltdurchschnitt pro Kopf.</dd>
        <dt>Konsumbasiert</dt>
        <dd>CO₂, das der Konsum eines Landes verursacht. Emissionen in importierten Gütern zählen mit, Emissionen in Exporten nicht. Verglichen mit dem Weltdurchschnitt.</dd>
        <dt>Historisch</dt>
        <dd>Alles CO₂ seit 1750, geteilt durch die heutige Bevölkerung und verglichen mit dem Weltdurchschnitt.</dd>
      </dl>

      <h3>Was die Karte vereinfacht</h3>
      <ul>
        <li>Ein gleicher Anteil pro Kopf ist eine Möglichkeit, Fairness zu bestimmen. Frühere Emissionen und die wirtschaftlichen Möglichkeiten eines Landes bleiben dabei außen vor.</li>
        <li>Das Budget gleichmäßig bis ${c.targetYear} zu verteilen, hält die Rechnung einfach. Es ist keine Vorhersage, wie die Emissionen sinken werden.</li>
        <li>Vom Budget abgezogen werden die Emissionen aus fossilen Brennstoffen und Zement, wie in den Länderdaten. Emissionen aus Landnutzung (rund 4 Gt pro Jahr) bleiben außen vor; das verbleibende Budget fällt dadurch etwas zu groß aus.</li>
        <li>Konsumbasierte Daten gibt es für ${c.consCount} von ${c.countries} Ländern. Für die übrigen zählen die territorialen Emissionen; das Länderpanel weist darauf hin.</li>
        <li>Die historische Ansicht teilt frühere Emissionen durch die heutige Bevölkerung. Schnell gewachsene Länder wirken dadurch niedriger, langsam gewachsene höher.</li>
        <li>Manche Gebiete werden bei dem Land mitgezählt, das ihre Emissionen meldet.</li>
        <li>Internationaler Flug- und Schiffsverkehr steckt im Weltdurchschnitt, wird aber keinem Land zugerechnet.</li>
      </ul>

      <h3>Quellen</h3>
      <ul>
        <li>Emissionen und Bevölkerung: <a href="https://github.com/owid/co2-data" target="_blank" rel="noopener">CO₂-Datensatz von Our World in Data</a>, gestützt auf das <a href="https://globalcarbonbudget.org/" target="_blank" rel="noopener">Global Carbon Project</a> und Bevölkerungsschätzungen der UN. Datenjahr ${c.dataYear}, Lizenz CC BY 4.0.</li>
        <li>CO₂-Budgets: <a href="https://www.ipcc.ch/report/ar6/wg1/" target="_blank" rel="noopener">IPCC AR6, Arbeitsgruppe I</a>, Zusammenfassung für politische Entscheidungsträger, Tabelle SPM.2.</li>
        <li>Neuere Budget-Schätzung: <a href="${c.newer.url}" target="_blank" rel="noopener">Forster et al. (2026)</a>, Indicators of Global Climate Change, Earth System Science Data.</li>
        <li>Ländergrenzen: Natural Earth über world-atlas. Karte: Leaflet. Globus: globe.gl. Schrift: Source Sans 3.</li>
      </ul>

      <h3>Datenschutz</h3>
      <p>Diese Seite setzt keine Cookies und lädt alle Dateien von sich selbst. Seitenaufrufe werden mit <a href="https://www.goatcounter.com/" target="_blank" rel="noopener">GoatCounter</a> gezählt, ohne Cookies: Erfasst werden der Seitenaufruf, die verweisende Seite, Browser, Bildschirmbreite und Land, aber keine IP-Adresse. Deine Sprachwahl bleibt in deinem Browser. Das Land, auf dem die Karte startet, wird in deinem Browser aus Zeitzone und Sprache geschätzt und nirgendwohin gesendet.</p>

      <p class="about-credit">Ein Projekt von <a href="https://github.com/Evolving-Thoughts" target="_blank" rel="noopener">Evolving Thoughts</a>. Der <a href="https://github.com/Evolving-Thoughts/CO2-map" target="_blank" rel="noopener">Quellcode</a> liegt auf GitHub.</p>`,
  },
};

// German country & territory name translations (English → German)
const COUNTRY_NAMES_DE = {
  'Afghanistan': 'Afghanistan', 'Albania': 'Albanien', 'Algeria': 'Algerien', 'Andorra': 'Andorra',
  'Angola': 'Angola', 'Antigua and Barbuda': 'Antigua und Barbuda', 'Azerbaijan': 'Aserbaidschan',
  'Argentina': 'Argentinien', 'Australia': 'Australien', 'Austria': 'Österreich', 'Bahamas': 'Bahamas',
  'Bahrain': 'Bahrain', 'Bangladesh': 'Bangladesch', 'Armenia': 'Armenien', 'Barbados': 'Barbados',
  'Belgium': 'Belgien', 'Bermuda': 'Bermuda', 'Bhutan': 'Bhutan', 'Bolivia': 'Bolivien',
  'Bosnia and Herzegovina': 'Bosnien und Herzegowina', 'Botswana': 'Botswana', 'Brazil': 'Brasilien',
  'Belize': 'Belize', 'Solomon Islands': 'Salomonen', 'British Virgin Islands': 'Britische Jungferninseln',
  'Brunei': 'Brunei', 'Bulgaria': 'Bulgarien', 'Myanmar': 'Myanmar', 'Burundi': 'Burundi',
  'Belarus': 'Belarus', 'Cambodia': 'Kambodscha', 'Cameroon': 'Kamerun', 'Canada': 'Kanada',
  'Cape Verde': 'Kap Verde', 'Central African Republic': 'Zentralafrikanische Republik',
  'Sri Lanka': 'Sri Lanka', 'Chad': 'Tschad', 'Chile': 'Chile', 'China': 'China', 'Taiwan': 'Taiwan',
  'Colombia': 'Kolumbien', 'Comoros': 'Komoren', 'Congo': 'Kongo',
  'Democratic Republic of Congo': 'Demokratische Republik Kongo', 'Cook Islands': 'Cookinseln',
  'Costa Rica': 'Costa Rica', 'Croatia': 'Kroatien', 'Cuba': 'Kuba', 'Cyprus': 'Zypern',
  'Czechia': 'Tschechien', 'Benin': 'Benin', 'Denmark': 'Dänemark', 'Dominica': 'Dominica',
  'Dominican Republic': 'Dominikanische Republik', 'Ecuador': 'Ecuador', 'El Salvador': 'El Salvador',
  'Equatorial Guinea': 'Äquatorialguinea', 'Ethiopia': 'Äthiopien', 'Eritrea': 'Eritrea',
  'Estonia': 'Estland', 'Faroe Islands': 'Färöer', 'Fiji': 'Fidschi', 'Finland': 'Finnland',
  'France': 'Frankreich', 'French Polynesia': 'Französisch-Polynesien', 'Djibouti': 'Dschibuti',
  'Gabon': 'Gabun', 'Georgia': 'Georgien', 'Gambia': 'Gambia', 'Palestine': 'Palästina',
  'Germany': 'Deutschland', 'Ghana': 'Ghana', 'Kiribati': 'Kiribati', 'Greece': 'Griechenland',
  'Greenland': 'Grönland', 'Grenada': 'Grenada', 'Guatemala': 'Guatemala', 'Guinea': 'Guinea',
  'Guyana': 'Guyana', 'Haiti': 'Haiti', 'Honduras': 'Honduras', 'Hong Kong': 'Hongkong',
  'Hungary': 'Ungarn', 'Iceland': 'Island', 'India': 'Indien', 'Indonesia': 'Indonesien',
  'Iran': 'Iran', 'Iraq': 'Irak', 'Ireland': 'Irland', 'Israel': 'Israel', 'Italy': 'Italien',
  "Cote d'Ivoire": 'Elfenbeinküste', 'Jamaica': 'Jamaika', 'Japan': 'Japan',
  'Kazakhstan': 'Kasachstan', 'Jordan': 'Jordanien', 'Kenya': 'Kenia', 'North Korea': 'Nordkorea',
  'South Korea': 'Südkorea', 'Kuwait': 'Kuwait', 'Kyrgyzstan': 'Kirgisistan', 'Laos': 'Laos',
  'Lebanon': 'Libanon', 'Lesotho': 'Lesotho', 'Latvia': 'Lettland', 'Liberia': 'Liberia',
  'Libya': 'Libyen', 'Liechtenstein': 'Liechtenstein', 'Lithuania': 'Litauen',
  'Luxembourg': 'Luxemburg', 'Macao': 'Macao', 'Madagascar': 'Madagaskar', 'Malawi': 'Malawi',
  'Malaysia': 'Malaysia', 'Maldives': 'Malediven', 'Mali': 'Mali', 'Malta': 'Malta',
  'Mauritania': 'Mauretanien', 'Mauritius': 'Mauritius', 'Mexico': 'Mexiko', 'Monaco': 'Monaco',
  'Mongolia': 'Mongolei', 'Moldova': 'Moldau', 'Montenegro': 'Montenegro', 'Montserrat': 'Montserrat',
  'Morocco': 'Marokko', 'Mozambique': 'Mosambik', 'Oman': 'Oman', 'Namibia': 'Namibia',
  'Nauru': 'Nauru', 'Nepal': 'Nepal', 'Netherlands': 'Niederlande', 'Curacao': 'Curaçao',
  'Aruba': 'Aruba', 'Sint Maarten (Dutch part)': 'Sint Maarten (niederländischer Teil)',
  'Bonaire Sint Eustatius and Saba': 'Bonaire, Sint Eustatius und Saba',
  'New Caledonia': 'Neukaledonien', 'Vanuatu': 'Vanuatu', 'New Zealand': 'Neuseeland',
  'Nicaragua': 'Nicaragua', 'Niger': 'Niger', 'Nigeria': 'Nigeria', 'Niue': 'Niue',
  'Norway': 'Norwegen', 'Micronesia (country)': 'Mikronesien', 'Marshall Islands': 'Marshallinseln',
  'Palau': 'Palau', 'Pakistan': 'Pakistan', 'Panama': 'Panama',
  'Papua New Guinea': 'Papua-Neuguinea', 'Paraguay': 'Paraguay', 'Peru': 'Peru',
  'Philippines': 'Philippinen', 'Poland': 'Polen', 'Portugal': 'Portugal',
  'Guinea-Bissau': 'Guinea-Bissau', 'East Timor': 'Osttimor', 'Qatar': 'Katar',
  'Romania': 'Rumänien', 'Russia': 'Russland', 'Rwanda': 'Ruanda', 'Saint Helena': 'St. Helena',
  'Saint Kitts and Nevis': 'St. Kitts und Nevis', 'Anguilla': 'Anguilla', 'Saint Lucia': 'St. Lucia',
  'Saint Pierre and Miquelon': 'St. Pierre und Miquelon',
  'Saint Vincent and the Grenadines': 'St. Vincent und die Grenadinen', 'San Marino': 'San Marino',
  'Sao Tome and Principe': 'São Tomé und Príncipe', 'Saudi Arabia': 'Saudi-Arabien',
  'Senegal': 'Senegal', 'Serbia': 'Serbien', 'Seychelles': 'Seychellen',
  'Sierra Leone': 'Sierra Leone', 'Singapore': 'Singapur', 'Slovakia': 'Slowakei',
  'Vietnam': 'Vietnam', 'Slovenia': 'Slowenien', 'Somalia': 'Somalia', 'South Africa': 'Südafrika',
  'Zimbabwe': 'Simbabwe', 'Spain': 'Spanien', 'South Sudan': 'Südsudan', 'Sudan': 'Sudan',
  'Suriname': 'Suriname', 'Eswatini': 'Eswatini', 'Sweden': 'Schweden', 'Switzerland': 'Schweiz',
  'Syria': 'Syrien', 'Tajikistan': 'Tadschikistan', 'Thailand': 'Thailand', 'Togo': 'Togo',
  'Tonga': 'Tonga', 'Trinidad and Tobago': 'Trinidad und Tobago',
  'United Arab Emirates': 'Vereinigte Arabische Emirate', 'Tunisia': 'Tunesien', 'Turkey': 'Türkei',
  'Turkmenistan': 'Turkmenistan', 'Turks and Caicos Islands': 'Turks- und Caicosinseln',
  'Tuvalu': 'Tuvalu', 'Uganda': 'Uganda', 'Ukraine': 'Ukraine',
  'North Macedonia': 'Nordmazedonien', 'Egypt': 'Ägypten',
  'United Kingdom': 'Vereinigtes Königreich', 'Tanzania': 'Tansania',
  'United States': 'Vereinigte Staaten', 'Burkina Faso': 'Burkina Faso', 'Uruguay': 'Uruguay',
  'Uzbekistan': 'Usbekistan', 'Venezuela': 'Venezuela', 'Wallis and Futuna': 'Wallis und Futuna',
  'Samoa': 'Samoa', 'Yemen': 'Jemen', 'Zambia': 'Sambia',
  // Territory names
  'Western Sahara': 'Westsahara', 'French Guiana': 'Französisch-Guayana',
  'Guadeloupe': 'Guadeloupe', 'Martinique': 'Martinique', 'Réunion': 'Réunion',
  'Mayotte': 'Mayotte', 'Saint Barthélemy': 'Saint-Barthélemy', 'Saint Martin': 'Saint-Martin',
  'Guernsey': 'Guernsey', 'Jersey': 'Jersey', 'Isle of Man': 'Isle of Man',
  'Åland Islands': 'Ålandinseln', 'American Samoa': 'Amerikanisch-Samoa',
  'Norfolk Island': 'Norfolkinsel', 'Christmas Island': 'Weihnachtsinsel',
  'Antarctica': 'Antarktis', 'Vatican City': 'Vatikanstadt',
  'Northern Mariana Islands': 'Nördliche Marianen',
  'U.S. Virgin Islands': 'Amerikanische Jungferninseln', 'Guam': 'Guam',
  'Puerto Rico': 'Puerto Rico',
  'South Georgia and the South Sandwich Islands': 'Südgeorgien und die Südlichen Sandwichinseln',
  'British Indian Ocean Territory': 'Britisches Territorium im Indischen Ozean',
  'Pitcairn Islands': 'Pitcairninseln', 'Falkland Islands': 'Falklandinseln',
  'Cayman Islands': 'Kaimaninseln',
  'French Southern and Antarctic Lands': 'Französische Süd- und Antarktisgebiete',
  'Heard Island and McDonald Islands': 'Heard und McDonaldinseln',
  'Somaliland': 'Somaliland', 'Kosovo': 'Kosovo', 'Northern Cyprus': 'Nordzypern',
  'Indian Ocean Territories': 'Indischer-Ozean-Territorien', 'Siachen Glacier': 'Siachengletscher',
};

/**
 * Translate a country or territory name.
 * Returns the German name when in German mode, otherwise the original.
 */
function tn(name) {
  if (currentLang === 'de' && COUNTRY_NAMES_DE[name]) return COUNTRY_NAMES_DE[name];
  return name;
}

// ============================================================================
// Language
// ============================================================================

const LANG_STORAGE_KEY = 'co2map.lang';

function detectLanguage() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && TRANSLATIONS[stored]) return stored;
  } catch (e) { /* storage unavailable: fall through to the browser language */ }
  return (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
}

let currentLang = detectLanguage();

function t(key) {
  return TRANSLATIONS[currentLang][key] ?? TRANSLATIONS.en[key] ?? key;
}

/**
 * Fill every element that carries a `data-i18n` or `data-i18n-attr` binding.
 */
function applyStaticTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
}

// ============================================================================
// Number Formatting
// ============================================================================

function locale() {
  return currentLang === 'de' ? 'de-DE' : 'en-US';
}

/**
 * A number with a fixed count of decimals in the current language.
 */
function fmt(value, decimals = 1) {
  if (value == null || !isFinite(value)) return t('na');
  return value.toLocaleString(locale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Tonnes: one decimal for everyday values, none from 100 upwards.
 */
function fmtTonnes(value) {
  if (value == null || !isFinite(value)) return t('na');
  return fmt(value, Math.abs(value) >= 100 ? 0 : 1);
}

/**
 * A ratio as a whole percentage: 3.83 becomes "383%" or "383 %".
 */
function fmtPercent(ratio) {
  if (ratio == null || !isFinite(ratio)) return t('na');
  return ratio.toLocaleString(locale(), { style: 'percent', maximumFractionDigits: 0 });
}

/**
 * A multiple such as "3.8" (one decimal below 10, none above).
 */
function fmtTimes(ratio) {
  if (ratio == null || !isFinite(ratio)) return t('na');
  return fmt(ratio, ratio < 10 ? 1 : 0);
}

/**
 * Population given in millions: "84.5 million", or "39,000" below a million.
 */
function fmtPopulation(millions) {
  if (millions == null || !isFinite(millions)) return t('na');
  if (millions >= 1) return `${fmt(millions, 1)} ${t('million')}`;
  return fmt(Math.round(millions * 1000) * 1000, 0);
}
