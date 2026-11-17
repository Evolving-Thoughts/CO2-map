# CO₂ Budget Map

**See how countries compare to a fair per-capita carbon budget.**

An interactive world map that resizes countries based on their CO₂ emissions relative to what would be a fair, equal share. Built with Leaflet and real data from Our World in Data.

[Open the map.](https://evolving-thoughts.github.io/CO2-map/)

## Features

- **Paris Agreement budgets** — Compare emissions against the remaining carbon budget for 1.5°C and 2.0°C warming (IPCC AR6), split equally per capita
- **Five views** — Fair share for 1.5°C and 2°C, plus territorial, consumption-based and historical emissions against the world average
- **Country scaling** — Countries grow or shrink by how far they are over or under their fair share; the real outline stays visible for comparison
- **Map and globe** — A flat map (Leaflet) and a 3D globe (globe.gl), prepared in the background so it opens instantly
- **Country panel** — Click any country for its share, a plain-language explanation and all figures
- **Ranking with search** — Every country by per-capita emissions; also the keyboard route to any country
- **Starts where you are** — The first view is centred on the visitor's own country, and a clicked country moves to the middle
- **Shareable links** — View, metric and selected country live in the URL (`#m=paris2&c=276`)
- **Method and sources** — "How this is calculated" explains the budget step by step, in the app
- **Colorblind mode** and **English/German**

## Data

All emissions data comes from [Our World in Data](https://github.com/owid/co2-data) (Global Carbon Project):

- Territorial, consumption-based and historical cumulative CO₂, plus population ([UN estimates](https://population.un.org/wpp/), via OWID), for more than 200 countries
- Each value is the newest one available up to the data year; the year and the source file are recorded in [`js/co2data.js`](js/co2data.js)
- Consumption-based data exists for about 120 countries and lags a year behind; territorial emissions are used as fallback for the rest
- The world total includes international aviation and shipping, which belong to no country

The data updates itself: see [Updating the data](#updating-the-data).

### Paris budget methodology

| Target | Budget from 2020 (IPCC AR6, Table SPM.2) | Likelihood | Left from 2026 | Per-capita annual budget |
|--------|------|------|------|------|
| 1.5°C  | 500 Gt CO₂   | 50% | ~275 Gt | ~1.3 t/year |
| 2.0°C  | 1,150 Gt CO₂ | 67% | ~925 Gt | ~4.5 t/year |

The table is for data year 2025. What the world has emitted from 2020 up to the data year (about 225 Gt, from fossil fuels and cement) is subtracted. The rest is spread evenly over the years after the data year up to 2050 and over the world population. The emitted amount comes with the data, so the remaining budget moves on by itself with every data update. The assumptions live in [`js/config.js`](js/config.js); the per-capita figures are derived from them in [`js/metrics.js`](js/metrics.js).

Newer estimates are stricter: [Forster et al. (2026)](https://doi.org/10.5194/essd-18-3889-2026) put the remaining 1.5°C budget (50%) at 130 Gt from the start of 2026, which spread the same way is about 0.6 t per person and year. The map keeps the IPCC figures, the latest the IPCC has assessed, and says so in "How this is calculated".

## Tech stack

- [Leaflet.js](https://leafletjs.com/) 1.9.4 — flat map (no tile basemap; countries are drawn on a plain background)
- [globe.gl](https://globe.gl/) 2.46.2 — camera, controls and sphere of the 3D globe
- [earcut](https://github.com/mapbox/earcut) 2.2.4 — polygon triangulation for the globe
- [TopoJSON Client](https://github.com/topojson/topojson-client) 3.1.0 — decoding [world-atlas](https://github.com/topojson/world-atlas) 2.0.2 geometry (Natural Earth)
- [Source Sans 3](https://github.com/adobe-fonts/source-sans) — the font
- Vanilla JavaScript, HTML, CSS — no build step, no framework

All of these are exact versions kept in [`vendor/`](vendor/README.md) and served by the site itself. A visit contacts no other server, apart from the page-view count below.

### Privacy

- No cookies, and no files from other servers.
- Page views are counted with [GoatCounter](https://www.goatcounter.com/), without cookies and without storing IP addresses. The counting script is in `vendor/` too; it stays quiet on localhost.
- The language choice is kept in the browser. The visitor's country is guessed in the browser and sent nowhere.

### Finding the visitor's country

The first view is centred on the visitor's country, without selecting it. The country is guessed in the browser from the device's time zone and, failing that, the region in the preferred languages (`guessHomeCountry` in `js/app.js`, with the code table in `js/config.js`). No request is made for this and nothing is stored. A link that names a country takes precedence.

### Borders without gaps on the flat map

Leaflet simplifies every shape on its own when the zoom changes, so the two sides of a shared border come out slightly different and gaps appear. `js/map.js` turns that off (`smoothFactor: 0`) and draws shapes simplified in the topology instead, where neighbours share their borders. There is one set per whole zoom level, accurate to 0.3 pixels, made on first use and for the neighbouring levels while the browser is idle. From zoom 5 on the data is drawn as loaded.

### Resized countries at the edge of the map

A Mercator map normally ends at 85° north and south, and Leaflet cuts shapes off there. A resized country near that edge (Greenland, Canada, Russia) grows past it, so `js/map.js` uses a projection that draws up to almost 90° and widens the pan limits to the resized shape. A selected country is moved to the middle of the free part of the map, zooming out if it would not fit; far-away territories (Alaska, French Guiana) are ignored for this. When the country is closed the map stays where it is; on phones, where the country sheet covers half the map, the previous view comes back if the visitor has not moved the map since. The pan limits are enforced by the app, not by Leaflet's `maxBounds` option, whose automatic correction collides with these moves.

### How the globe stays fast

globe.gl's own polygon layer creates one object per island: over 1,600 for this dataset, several thousand draw calls per frame, and a slow first build. `js/globe.js` therefore draws the countries itself:

- Borders are simplified in the topology (shared borders stay identical on both sides) and tiny islands are skipped. The flat map keeps the full detail.
- All countries are one mesh colored per vertex, all borders one set of lines. A frame takes about five draw calls.
- Vertices are unit vectors times a radius, so raising countries or recoloring them only rewrites a buffer.
- Hit testing is a ray against the sphere plus a point-in-polygon test, not a scan of every triangle.
- The outline of the selected country is a narrow band of triangles. Its width is set in pixels and refitted when the zoom changes, so it stays thin at any distance.
- The globe libraries are fetched while the browser is idle and the globe is built hidden and paused, so switching to it takes a few milliseconds. On data-saving or 2G connections it loads on demand instead.

globe.gl bundles three.js without exporting it. `harvestThree()` in `js/globe.js` takes the classes it needs from objects globe.gl created. This depends on the pinned version; when upgrading globe.gl, check that the globe still opens.

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | Markup, icons, script loading order |
| `css/style.css` | All styles |
| `js/i18n.js` | Texts (English, German) and number formatting |
| `js/co2data.js` | **Generated** data (`generate_data.py`) |
| `js/config.js` | Hand-maintained: territory mappings, Paris budget assumptions, country codes |
| `js/metrics.js` | Calculations (ratios, per-capita values, ranking) |
| `js/geo.js` | Geometry: projections, antimeridian repair, resizing, simplification, sphere meshes, outline bands |
| `js/state.js` | Shared state, color scale, outline widths, tooltip text |
| `js/map.js` | Flat map: layers, detail levels per zoom, selection |
| `js/globe.js` | Globe: merged country meshes, selection and its outlines, hit testing |
| `js/ui.js` | Header, key, ranking, country panel, method dialog |
| `js/app.js` | Startup, controls, shareable URL, language |
| `vendor/` | Third-party libraries, country shapes and the font ([details](vendor/README.md)) |
| `og-image.png` | Preview image for shared links, drawn by `tools/preview-image.html` |
| `generate_data.py` | Makes `js/co2data.js` from the OWID dataset |
| `.github/workflows/` | Publishing (`pages.yml`) and the weekly data update (`data.yml`) |

## Running locally

Open `index.html` in a browser, or serve it with any static file server (no internet connection needed):

```bash
python -m http.server 8000
```

## Updating the data

The workflow in [`.github/workflows/data.yml`](.github/workflows/data.yml) runs every Monday. It downloads the current OWID dataset, runs `generate_data.py` and, if the data differs, commits `js/co2data.js` and publishes the site. It can also be started by hand from the Actions tab.

`generate_data.py` picks the newest complete year in the file. It refuses to write data that looks broken (no World total, too few countries, an older year than before); the run then fails, GitHub sends a mail, and the site keeps its data.

To run it yourself:

1. Download `owid-co2-data.csv` from [owid/co2-data](https://github.com/owid/co2-data)
2. Run `python generate_data.py path/to/owid-co2-data.csv` (default: the project root)

This rewrites only `js/co2data.js`. Not updated automatically, because they are assumptions and not data:

- **The budget assumptions** in [`js/config.js`](js/config.js): the IPCC budgets from 2020, the target year, and the newer estimate quoted in "How this is calculated", which is given from a fixed year. (What has been emitted since 2020 and the start year of the remaining budget do follow the data.)
- **The preview image** `og-image.png`, shown by messengers for a link to the site. To redraw it with the current data, serve the project locally, open [`tools/preview-image.html`](tools/preview-image.html) and save the picture as `og-image.png`.

GitHub switches scheduled workflows off after 60 days without activity in a repository. The workflow re-enables itself on every run to prevent that; if GitHub still sends a mail that it was disabled, enable it again in the Actions tab.

## Releasing

Push to `master`. The workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes `index.html`, `favicon.svg`, `og-image.png`, `css/`, `js/` and `vendor/` to GitHub Pages and replaces the `?v=` on the local script and stylesheet URLs with the commit id. Without a new address per release, a returning visitor's browser can mix cached old files with new ones. The workflow fails if a local script or stylesheet in `index.html` has no `?v=`.

This needs the repository's Pages source set to "GitHub Actions" (Settings > Pages). With the older "Deploy from a branch" setting the workflow does not publish, and the `?v=` number in `index.html` has to be raised by hand.

## License

Data: [Our World in Data](https://github.com/owid/co2-data) — Creative Commons BY 4.0

Third-party libraries, country shapes and the font: see [`vendor/README.md`](vendor/README.md); each folder there holds its licence.
