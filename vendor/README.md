# Third-party files

Everything the site needs from other projects is kept here and served by the site itself, so a visit contacts no other server. The files are unchanged copies of the published versions (one exception, noted below). Each folder holds the project's licence.

| Folder | What | Version | Licence | Taken from |
|--------|------|---------|---------|------------|
| `leaflet-1.9.4/` | Leaflet, the flat map | 1.9.4 | BSD 2-Clause | `https://unpkg.com/leaflet@1.9.4/dist/` |
| `topojson-client-3.1.0/` | Decodes the country shapes | 3.1.0 | ISC | `https://unpkg.com/topojson-client@3.1.0/dist/` |
| `globe.gl-2.46.2/` | Camera, controls and sphere of the globe (bundles three.js, MIT) | 2.46.2 | MIT | `https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/` |
| `earcut-2.2.4/` | Polygon triangulation for the globe | 2.2.4 | ISC | `https://cdn.jsdelivr.net/npm/earcut@2.2.4/dist/` |
| `world-atlas-2.0.2/` | Country shapes (Natural Earth 1:50m, public domain) | 2.0.2 | ISC | `https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/` |
| `source-sans-3/` | The font, Latin and Latin Extended, all weights in one variable file each | v20 on Google Fonts | SIL Open Font License 1.1 | `https://fonts.gstatic.com/s/sourcesans3/v20/` |
| `goatcounter/` | Counts page views without cookies | count.js v5 | ISC (stated in the file) | `https://gc.zgo.at/count.v5.js` |

## Checksums

SHA-384, base64, as used for subresource integrity. They match the values the projects or the CDNs publish.

| File | SHA-384 |
|------|---------|
| `leaflet-1.9.4/leaflet.js` | `cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH` |
| `leaflet-1.9.4/leaflet.css` | `sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H` |
| `topojson-client-3.1.0/topojson-client.min.js` | `Ukv1p/xTma6P4/2bY5KzWBw+ydSpXmhCMtyciIQVDJ1RmOxtCYNMF1uXT9T63H67` |
| `globe.gl-2.46.2/globe.gl.min.js` | `1uolMBZ25k3zJcNwCLEv49+L+m2dZudqAzsoSAJfQTzDCSBxJzrMuZ2dkp/5JKiT` |
| `earcut-2.2.4/earcut.min.js` | `2H0pAXlHBLfkdkuPuERxxSBlz7fMZ2EqrwxccEG7J9Svyk1SbUDaknB5UCoel/ZX` |
| `goatcounter/count.v5.js` | `atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ` |
| `world-atlas-2.0.2/countries-50m.json` (the original) | `Aw4s9pX1PTPntIYkZ/qV9IYiF5Gv8eTl6Dd/TT56zfO1Wwd+owFwYUuuXNUMrWkc` |

## The one changed file

`world-atlas-2.0.2/countries-50m.js` is the original `countries-50m.json` with `const WORLD_ATLAS = ` in front and a comment on top. As a script it also loads when `index.html` is opened straight from disk, where a request for a JSON file is not allowed.

## Updating a library

1. Put the new version in a new folder named after it and copy the licence along.
2. Change the path in `index.html` (or in `js/globe.js` for the globe libraries, or in `css/style.css` for the font).
3. Remove the old folder and update the tables above.

For globe.gl, also check that the globe still opens: `harvestThree()` in `js/globe.js` depends on its internals.

Leaflet's stylesheet refers to marker and layer images that this site never shows, so they are not included.
