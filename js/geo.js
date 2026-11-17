/**
 * CO2 Budget Map — geometry helpers
 *
 * Pure functions: Mercator and spherical math, antimeridian repair and the
 * area scaling that makes a country grow or shrink with its budget ratio.
 * Nothing in here touches the DOM or the application state.
 */

const MIN_SCALE_RATIO = 0.01;
const MERCATOR_LAT_LIMIT = 85;
// Resized shapes may reach past the usual edge of a Mercator map (85°).
// The flat map is set up to draw up to this latitude (see initMap).
const RESIZED_LAT_LIMIT = 89.99;

// Scaled geometries are expensive (every vertex is re-projected), so both
// scalers remember their results. Key: `${featureId}|${ratio}`.
const _mercatorScaleCache = new Map();
const _sphericalScaleCache = new Map();

// ============================================================================
// Mercator Projection Helpers
// ============================================================================

const EARTH_RADIUS = 6378137;

function toMercator(lng, lat) {
  const x = EARTH_RADIUS * lng * Math.PI / 180;
  // Clamp latitude to avoid infinity at poles
  const clampedLat = Math.max(-MERCATOR_LAT_LIMIT, Math.min(MERCATOR_LAT_LIMIT, lat));
  const clampedLatRad = clampedLat * Math.PI / 180;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + clampedLatRad / 2));
  return [x, y];
}

function fromMercator(x, y) {
  const lng = (x / EARTH_RADIUS) * 180 / Math.PI;
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * 180 / Math.PI;
  return [lng, lat];
}

// ============================================================================
// Spherical Geometry Helpers (for globe scaling)
// ============================================================================

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Angular distance (radians) between two points on the sphere via Haversine.
 */
function geoDistance(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Initial bearing (radians) from point 1 to point 2.
 */
function geoBearing(lat1, lon1, lat2, lon2) {
  const phi1 = lat1 * DEG2RAD, phi2 = lat2 * DEG2RAD;
  const dLambda = (lon2 - lon1) * DEG2RAD;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return Math.atan2(y, x);
}

/**
 * Destination point given start, bearing (radians), and angular distance (radians).
 * Returns [lng, lat] in degrees.
 */
function geoDestination(lat, lon, bearing, dist) {
  const phi1 = lat * DEG2RAD;
  const lambda1 = lon * DEG2RAD;
  const sinDist = Math.sin(dist), cosDist = Math.cos(dist);
  const sinPhi1 = Math.sin(phi1), cosPhi1 = Math.cos(phi1);

  const phi2 = Math.asin(sinPhi1 * cosDist + cosPhi1 * sinDist * Math.cos(bearing));
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(bearing) * sinDist * cosPhi1,
    cosDist - sinPhi1 * Math.sin(phi2)
  );
  // Normalize longitude to [-180, 180]
  let lng = lambda2 * RAD2DEG;
  lng = ((lng + 540) % 360) - 180;
  return [lng, phi2 * RAD2DEG];
}

/**
 * Geographic centroid of a polygon ring (simple average of [lng, lat] coordinates).
 */
function ringCentroidGeo(ring) {
  let sumLng = 0, sumLat = 0;
  for (const coord of ring) {
    sumLng += coord[0];
    sumLat += coord[1];
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

// ============================================================================
// Antimeridian Fix (Russia, Fiji, etc.)
// ============================================================================

/**
 * Check if a polygon ring crosses the antimeridian (±180° longitude).
 */
function doesRingCrossAntimeridian(ring) {
  for (let i = 0; i < ring.length - 1; i++) {
    if (Math.abs(ring[i][0] - ring[i + 1][0]) > 180) return true;
  }
  return false;
}

/**
 * For a ring that crosses the antimeridian, shift coordinates so they
 * are continuous. Uses the provided shiftEast flag to determine direction.
 */
function normalizeRingAcrossAntimeridian(ring, shiftEast) {
  if (!doesRingCrossAntimeridian(ring)) return ring;

  if (shiftEast) {
    // Shift western (negative) points by +360 to join eastern side
    return ring.map(c => c[0] < -90 ? [c[0] + 360, c[1]] : c);
  } else {
    // Shift eastern (positive) points by -360 to join western side
    return ring.map(c => c[0] > 90 ? [c[0] - 360, c[1]] : c);
  }
}

/**
 * Determine the dominant hemisphere for an entire feature by counting
 * all coordinates across all polygons.
 */
function featureDominantSide(geometry) {
  const polygons = geometry.type === 'MultiPolygon'
    ? geometry.coordinates : [geometry.coordinates];
  let east = 0, west = 0;
  for (const polygon of polygons) {
    for (const coord of polygon[0]) {
      if (coord[0] > 0) east++;
      else if (coord[0] < 0) west++;
    }
  }
  return east >= west; // true = shift toward east (shift negatives by +360)
}

/**
 * Fix all antimeridian-crossing polygons in a GeoJSON FeatureCollection.
 * Instead of splitting, shifts coordinates so each polygon is continuous.
 * The shift direction is determined per-feature so all sub-polygons
 * of a country (e.g. Russia) shift consistently.
 * Leaflet handles coordinates outside [-180, 180] correctly.
 */
function fixAntimeridian(geojson) {
  return {
    ...geojson,
    features: geojson.features.map(feature => {
      const geom = feature.geometry;
      if (!geom) return feature;

      // Check if any ring crosses the antimeridian
      const polygons = geom.type === 'MultiPolygon'
        ? geom.coordinates
        : geom.type === 'Polygon' ? [geom.coordinates] : null;
      if (!polygons) return feature;

      const hasCrossing = polygons.some(p => doesRingCrossAntimeridian(p[0]));
      if (!hasCrossing) return feature;

      // Determine shift direction from the whole feature
      const shiftEast = featureDominantSide(geom);

      if (geom.type === 'Polygon') {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map(r => normalizeRingAcrossAntimeridian(r, shiftEast))
          }
        };
      }

      if (geom.type === 'MultiPolygon') {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map(polygon =>
              doesRingCrossAntimeridian(polygon[0])
                ? polygon.map(r => normalizeRingAcrossAntimeridian(r, shiftEast))
                : polygon
            )
          }
        };
      }

      return feature;
    })
  };
}

// ============================================================================
// Shape Helpers
// ============================================================================

/**
 * Outer rings of a Polygon or MultiPolygon geometry ([] for anything else).
 */
function geometryPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

/**
 * Planar (shoelace) area of a ring in squared degrees. Only used to compare
 * the parts of one country with each other, never as a real-world area.
 */
function ringArea(ring) {
  let area = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const j = (i + 1) % n;
    area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return Math.abs(area) / 2;
}

/**
 * Outer ring of the largest part of a country (its mainland).
 */
function largestRing(geometry) {
  let best = null, bestArea = -1;
  for (const polygon of geometryPolygons(geometry)) {
    const area = ringArea(polygon[0]);
    if (area > bestArea) { bestArea = area; best = polygon[0]; }
  }
  return best;
}

/**
 * Rough size of a whole feature, used to decide the drawing order.
 */
function featureArea(feature) {
  let total = 0;
  for (const polygon of geometryPolygons(feature.geometry)) total += ringArea(polygon[0]);
  return total;
}

/**
 * Centre of a country's mainland as { lat, lng }.
 */
function getFeatureCentroid(feature) {
  const ring = largestRing(feature.geometry);
  if (!ring || ring.length === 0) return null;
  const [lng, lat] = ringCentroidGeo(ring);
  return { lat, lng };
}

/**
 * Bounding box [[south, west], [north, east]] of a feature.
 */
/**
 * The polygons that make up the main part of a country: the largest one
 * and those near it. Far-away territories (Alaska, French Guiana) are
 * left out, so that framing a country does not end up over an ocean.
 * Returns indexes into geometryPolygons(); a resized copy of the feature
 * has its polygons in the same order.
 */
const _mainPartsCache = new Map();
function mainPartIndexes(feature) {
  const cached = _mainPartsCache.get(feature.id);
  if (cached) return cached;

  const boxes = geometryPolygons(feature.geometry).map(polygon => {
    let s = 90, w = Infinity, n = -90, e = -Infinity;
    for (const c of polygon[0]) {
      if (c[1] < s) s = c[1];
      if (c[1] > n) n = c[1];
      if (c[0] < w) w = c[0];
      if (c[0] > e) e = c[0];
    }
    return { s, w, n, e, area: ringArea(polygon[0]) };
  });
  const main = boxes.reduce((best, box) => (box.area > best.area ? box : best), boxes[0]);
  // "Near": the middle of the part lies within the main part's box,
  // widened by half its size on every side.
  const padLat = (main.n - main.s) / 2, padLng = (main.e - main.w) / 2;
  const indexes = [];
  boxes.forEach((box, i) => {
    const lat = (box.s + box.n) / 2, lng = (box.w + box.e) / 2;
    if (lat >= main.s - padLat && lat <= main.n + padLat &&
        lng >= main.w - padLng && lng <= main.e + padLng) indexes.push(i);
  });
  _mainPartsCache.set(feature.id, indexes);
  return indexes;
}

/**
 * Bounds as [[south, west], [north, east]]: of the whole feature, or of
 * the polygons with the given indexes.
 */
function featureBounds(feature, indexes) {
  if (indexes) {
    const polygons = geometryPolygons(feature.geometry);
    return featureBounds({ geometry: { type: 'MultiPolygon', coordinates: indexes.map(i => polygons[i]) } });
  }
  let s = 90, w = Infinity, n = -90, e = -Infinity;
  for (const polygon of geometryPolygons(feature.geometry)) {
    for (const c of polygon[0]) {
      if (c[1] < s) s = c[1];
      if (c[1] > n) n = c[1];
      if (c[0] < w) w = c[0];
      if (c[0] > e) e = c[0];
    }
  }
  return [[s, w], [n, e]];
}

// ============================================================================
// Geometry Scaling
// ============================================================================

/**
 * Calculate the centroid of a polygon ring in Mercator coordinates.
 */
function ringCentroidMercator(ring) {
  let sumX = 0, sumY = 0, count = 0;
  for (const coord of ring) {
    const [mx, my] = toMercator(coord[0], coord[1]);
    sumX += mx;
    sumY += my;
    count++;
  }
  return [sumX / count, sumY / count];
}

/**
 * Scale a single ring around a centroid in Mercator space.
 */
function scaleRing(ring, centroid, scaleFactor) {
  return ring.map(coord => {
    const [mx, my] = toMercator(coord[0], coord[1]);
    const newX = centroid[0] + scaleFactor * (mx - centroid[0]);
    const newY = centroid[1] + scaleFactor * (my - centroid[1]);
    const [newLng, newLat] = fromMercator(newX, newY);
    return [newLng, Math.max(-RESIZED_LAT_LIMIT, Math.min(RESIZED_LAT_LIMIT, newLat))];
  });
}

/**
 * Scale a GeoJSON feature's geometry by a given area ratio.
 * The linear scale factor is sqrt(ratio) since area ~ scale^2.
 * Each polygon is scaled from its own centroid (not from a single feature centroid)
 * to avoid extreme coordinate shifts for countries with far-flung territories
 * (e.g. US with Alaska/Hawaii, Russia with Chukotka, France with overseas).
 */
function scaleFeature(feature, ratio) {
  if (ratio === null || ratio === undefined || !isFinite(ratio)) return feature;
  if (ratio <= 0) ratio = MIN_SCALE_RATIO; // prevent zero/negative

  const cacheKey = `${feature.id}|${ratio}`;
  const cached = _mercatorScaleCache.get(cacheKey);
  if (cached) return cached;

  const scaleFactor = Math.sqrt(ratio);
  const geometry = feature.geometry;

  let newCoordinates;

  if (geometry.type === 'Polygon') {
    const centroid = ringCentroidMercator(geometry.coordinates[0]);
    newCoordinates = geometry.coordinates.map(ring =>
      scaleRing(ring, centroid, scaleFactor)
    );
  } else if (geometry.type === 'MultiPolygon') {
    // Use the centroid of the largest polygon for all parts so that
    // small coastal islands scale together with the main landmass,
    // avoiding gaps between them.
    const sharedCentroid = ringCentroidMercator(largestRing(geometry));
    newCoordinates = geometry.coordinates.map(polygon => {
      return polygon.map(ring => scaleRing(ring, sharedCentroid, scaleFactor));
    });
  } else {
    return feature;
  }

  const result = {
    ...feature,
    geometry: {
      ...geometry,
      coordinates: newCoordinates
    }
  };
  _mercatorScaleCache.set(cacheKey, result);
  return result;
}

// ============================================================================
// Spherical Geometry Scaling (for globe)
// ============================================================================

/**
 * Scale a single polygon ring on the sphere around a geographic centroid.
 * Inlines Haversine, bearing, and destination for performance.
 */
function scaleRingSpherical(ring, centroidLat, centroidLon, scaleFactor) {
  const cLatR = centroidLat * DEG2RAD;
  const cLonR = centroidLon * DEG2RAD;
  const sinCLat = Math.sin(cLatR);
  const cosCLat = Math.cos(cLatR);

  return ring.map(coord => {
    const vLatR = coord[1] * DEG2RAD;
    const vLonR = coord[0] * DEG2RAD;
    const dLat = vLatR - cLatR;
    const dLon = vLonR - cLonR;
    const a = Math.sin(dLat * 0.5) ** 2 + cosCLat * Math.cos(vLatR) * Math.sin(dLon * 0.5) ** 2;
    const dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist < 1e-10) return coord;
    const cosVLat = Math.cos(vLatR);
    const bearing = Math.atan2(
      Math.sin(dLon) * cosVLat,
      cosCLat * Math.sin(vLatR) - sinCLat * cosVLat * Math.cos(dLon)
    );
    const newDist = dist * scaleFactor;
    const sinD = Math.sin(newDist), cosD = Math.cos(newDist);
    const phi2 = Math.asin(sinCLat * cosD + cosCLat * sinD * Math.cos(bearing));
    const lambda2 = cLonR + Math.atan2(Math.sin(bearing) * sinD * cosCLat, cosD - sinCLat * Math.sin(phi2));
    let lng = lambda2 * RAD2DEG;
    lng = ((lng + 540) % 360) - 180;
    return [lng, phi2 * RAD2DEG];
  });
}

/**
 * Scale a GeoJSON feature's geometry on the sphere by a given area ratio.
 * Mirrors `scaleFeature` but uses great-circle math instead of Mercator projection.
 */
function scaleFeatureSpherical(feature, ratio) {
  if (ratio === null || ratio === undefined || !isFinite(ratio)) return feature;
  if (ratio <= 0) ratio = MIN_SCALE_RATIO;

  // Check cache
  const cacheKey = `${feature.id}|${ratio}`;
  const cached = _sphericalScaleCache.get(cacheKey);
  if (cached) return cached;

  const scaleFactor = Math.sqrt(ratio);
  const geometry = feature.geometry;
  let newCoordinates;

  if (geometry.type === 'Polygon') {
    const [cLng, cLat] = ringCentroidGeo(geometry.coordinates[0]);
    newCoordinates = geometry.coordinates.map(ring =>
      scaleRingSpherical(ring, cLat, cLng, scaleFactor)
    );
  } else if (geometry.type === 'MultiPolygon') {
    // Two-phase scaling for MultiPolygon:
    // Phase 1: Scale each sub-polygon around its OWN centroid (correct shape).
    // Phase 2: Reposition each scaled sub-polygon so that inter-polygon
    //          distances from the main (largest) centroid are also scaled,
    //          preserving relative layout proportionally.

    // Find centroid of the largest sub-polygon (shared reference point)
    const mainCentroid = ringCentroidGeo(largestRing(geometry));
    const [mcLng, mcLat] = mainCentroid;

    // Phase 1: scale each polygon from its own centroid
    const scaledPolygons = geometry.coordinates.map(polygon => {
      const [cLng, cLat] = ringCentroidGeo(polygon[0]);
      return {
        coords: polygon.map(ring => scaleRingSpherical(ring, cLat, cLng, scaleFactor)),
        origCentroid: [cLng, cLat]
      };
    });

    // Phase 2: reposition via 3D rotation matrix (fast rigid spherical translation).
    // Instead of per-vertex geoDistance+geoBearing+geoDestination (16 trig ops each),
    // compute one rotation matrix per sub-polygon, then 4 trig ops per vertex.
    newCoordinates = scaledPolygons.map(({ coords, origCentroid }) => {
      const [ocLng, ocLat] = origCentroid;
      const dist = geoDistance(mcLat, mcLng, ocLat, ocLng);
      if (dist < 1e-10) return coords; // this IS the main polygon, no shift needed
      const bearing = geoBearing(mcLat, mcLng, ocLat, ocLng);
      const [ncLng, ncLat] = geoDestination(mcLat, mcLng, bearing, dist * scaleFactor);

      // Build rotation matrix from old centroid to new centroid on unit sphere
      const oLatR = ocLat * DEG2RAD, oLonR = ocLng * DEG2RAD;
      const nLatR = ncLat * DEG2RAD, nLonR = ncLng * DEG2RAD;
      // Old centroid as 3D unit vector
      const ox = Math.cos(oLatR) * Math.cos(oLonR);
      const oy = Math.cos(oLatR) * Math.sin(oLonR);
      const oz = Math.sin(oLatR);
      // New centroid as 3D unit vector
      const nx = Math.cos(nLatR) * Math.cos(nLonR);
      const ny = Math.cos(nLatR) * Math.sin(nLonR);
      const nz = Math.sin(nLatR);
      // Rotation axis = cross(old, new), angle = acos(dot(old, new))
      let ax = oy * nz - oz * ny;
      let ay = oz * nx - ox * nz;
      let az = ox * ny - oy * nx;
      const axLen = Math.sqrt(ax * ax + ay * ay + az * az);
      if (axLen < 1e-12) return coords; // centroids coincide after scaling
      ax /= axLen; ay /= axLen; az /= axLen;
      const cosA = ox * nx + oy * ny + oz * nz;
      const sinA = axLen;
      // Rodrigues' rotation matrix components
      const C = 1 - cosA;
      const r00 = cosA + ax * ax * C, r01 = ax * ay * C - az * sinA, r02 = ax * az * C + ay * sinA;
      const r10 = ay * ax * C + az * sinA, r11 = cosA + ay * ay * C, r12 = ay * az * C - ax * sinA;
      const r20 = az * ax * C - ay * sinA, r21 = az * ay * C + ax * sinA, r22 = cosA + az * az * C;

      return coords.map(ring =>
        ring.map(coord => {
          const latR = coord[1] * DEG2RAD;
          const lonR = coord[0] * DEG2RAD;
          const cosLat = Math.cos(latR);
          const px = cosLat * Math.cos(lonR);
          const py = cosLat * Math.sin(lonR);
          const pz = Math.sin(latR);
          // Apply rotation
          const rx = r00 * px + r01 * py + r02 * pz;
          const ry = r10 * px + r11 * py + r12 * pz;
          const rz = r20 * px + r21 * py + r22 * pz;
          // Back to lat/lng
          let lng = Math.atan2(ry, rx) * RAD2DEG;
          lng = ((lng + 540) % 360) - 180;
          return [lng, Math.asin(Math.max(-1, Math.min(1, rz))) * RAD2DEG];
        })
      );
    });
  } else {
    return feature;
  }

  const result = {
    ...feature,
    geometry: {
      ...geometry,
      coordinates: newCoordinates
    }
  };
  _sphericalScaleCache.set(cacheKey, result);
  return result;
}

// ============================================================================
// Simplification
// ============================================================================
//
// The globe draws every vertex in 3D and the flat map has many vertices
// per pixel when zoomed out, so both work on lighter copies of the
// shapes. Borders are simplified in the topology, where neighbours share
// them: both sides of a border stay identical, without gaps.

/**
 * Douglas–Peucker simplification of a line of [x, y] points. Both ends
 * are always kept; a closed line keeps at least a triangle. With
 * `measure`, distances are taken between measure(point) instead (for
 * example in map projection), while the points returned stay as they are.
 */
function simplifyLine(line, tolerance, measure) {
  const n = line.length;
  if (n <= 2) return line.slice();
  const points = measure ? line.map(measure) : line;

  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const tolerance2 = tolerance * tolerance;
  const stack = [[0, n - 1]];

  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = points[a][0], ay = points[a][1];
    const dx = points[b][0] - ax, dy = points[b][1] - ay;
    const length2 = dx * dx + dy * dy;
    let maxDistance2 = 0, farthest = -1;

    for (let i = a + 1; i < b; i++) {
      const px = points[i][0] - ax, py = points[i][1] - ay;
      let distance2;
      if (length2 === 0) {
        distance2 = px * px + py * py;
      } else {
        const k = Math.max(0, Math.min(1, (px * dx + py * dy) / length2));
        const ex = px - k * dx, ey = py - k * dy;
        distance2 = ex * ex + ey * ey;
      }
      if (distance2 > maxDistance2) {
        maxDistance2 = distance2;
        farthest = i;
      }
    }
    if (maxDistance2 > tolerance2) {
      keep[farthest] = 1;
      stack.push([a, farthest], [farthest, b]);
    }
  }

  const result = line.filter((_, i) => keep[i]);
  const closed = line[0][0] === line[n - 1][0] && line[0][1] === line[n - 1][1];
  if (closed && result.length < 4 && n >= 4) {
    return [line[0], line[Math.floor(n / 3)], line[Math.floor(2 * n / 3)], line[n - 1]];
  }
  return result;
}

/**
 * A copy of a TopoJSON topology with every arc simplified. The tolerance
 * is in degrees, or in the units of `measure` if one is given (see
 * simplifyLine). The copy stores plain coordinates (no quantization).
 */
function simplifyTopology(topology, tolerance, measure) {
  const transform = topology.transform;
  const arcs = topology.arcs.map(arc => {
    let x = 0, y = 0;
    const absolute = transform
      ? arc.map(p => [
          (x += p[0]) * transform.scale[0] + transform.translate[0],
          (y += p[1]) * transform.scale[1] + transform.translate[1],
        ])
      : arc;
    return simplifyLine(absolute, tolerance, measure);
  });
  const copy = { ...topology, arcs };
  delete copy.transform;
  return copy;
}

/**
 * Remove the parts of a country that are too small to see on the globe
 * (tiny islands). The largest part always stays, so no country vanishes.
 * `minArea` is in squared degrees.
 */
function dropSmallParts(feature, minArea) {
  const geometry = feature.geometry;
  if (!geometry || geometry.type !== 'MultiPolygon') return feature;
  const areas = geometry.coordinates.map(polygon => ringArea(polygon[0]));
  const largest = Math.max(...areas);
  const kept = geometry.coordinates.filter((_, i) => areas[i] >= minArea || areas[i] === largest);
  if (kept.length === geometry.coordinates.length) return feature;
  return { ...feature, geometry: { ...geometry, coordinates: kept } };
}

// ============================================================================
// Sphere Meshes (for the globe)
// ============================================================================
//
// A polygon becomes triangles on the unit sphere. Positions are stored as
// unit vectors, so drawing a country higher or lower is one multiplication
// per vertex. The axes match globe.gl: y points to the north pole.

function lngLatToUnit(lng, lat, out, offset) {
  const latR = lat * DEG2RAD, lngR = lng * DEG2RAD;
  const cosLat = Math.cos(latR);
  out[offset] = cosLat * Math.sin(lngR);
  out[offset + 1] = Math.sin(latR);
  out[offset + 2] = cosLat * Math.cos(lngR);
}

/**
 * Split a spherical triangle until no edge is longer than the limit and
 * append the pieces (9 numbers each) to `out`. Whether an edge is split
 * depends on that edge alone, so neighbouring triangles always agree and
 * no cracks open between them.
 */
function subdivideTriangle(out, ax, ay, az, bx, by, bz, cx, cy, cz, cosMaxEdge, depth) {
  const ab = ax * bx + ay * by + az * bz < cosMaxEdge;
  const bc = bx * cx + by * cy + bz * cz < cosMaxEdge;
  const ca = cx * ax + cy * ay + cz * az < cosMaxEdge;
  const long = ab + bc + ca;

  if (long === 0 || depth >= 8) {
    out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    return;
  }

  // Rotate the corners so the long edges come first (ab, then bc).
  if ((long === 1 && bc) || (long === 2 && !ab)) {
    subdivideTriangle(out, bx, by, bz, cx, cy, cz, ax, ay, az, cosMaxEdge, depth);
    return;
  }
  if ((long === 1 && ca) || (long === 2 && !bc)) {
    subdivideTriangle(out, cx, cy, cz, ax, ay, az, bx, by, bz, cosMaxEdge, depth);
    return;
  }

  // Midpoint of a-b, pushed back onto the sphere
  let mx = ax + bx, my = ay + by, mz = az + bz;
  let k = 1 / Math.hypot(mx, my, mz);
  mx *= k; my *= k; mz *= k;
  const next = depth + 1;

  if (long === 1) {
    subdivideTriangle(out, ax, ay, az, mx, my, mz, cx, cy, cz, cosMaxEdge, next);
    subdivideTriangle(out, mx, my, mz, bx, by, bz, cx, cy, cz, cosMaxEdge, next);
    return;
  }

  // Midpoint of b-c
  let nx = bx + cx, ny = by + cy, nz = bz + cz;
  k = 1 / Math.hypot(nx, ny, nz);
  nx *= k; ny *= k; nz *= k;

  if (long === 2) {
    subdivideTriangle(out, mx, my, mz, bx, by, bz, nx, ny, nz, cosMaxEdge, next);
    subdivideTriangle(out, ax, ay, az, mx, my, mz, nx, ny, nz, cosMaxEdge, next);
    subdivideTriangle(out, ax, ay, az, nx, ny, nz, cx, cy, cz, cosMaxEdge, next);
    return;
  }

  // Midpoint of c-a
  let ox = cx + ax, oy = cy + ay, oz = cz + az;
  k = 1 / Math.hypot(ox, oy, oz);
  ox *= k; oy *= k; oz *= k;

  subdivideTriangle(out, ax, ay, az, mx, my, mz, ox, oy, oz, cosMaxEdge, next);
  subdivideTriangle(out, mx, my, mz, bx, by, bz, nx, ny, nz, cosMaxEdge, next);
  subdivideTriangle(out, ox, oy, oz, nx, ny, nz, cx, cy, cz, cosMaxEdge, next);
  subdivideTriangle(out, mx, my, mz, nx, ny, nz, ox, oy, oz, cosMaxEdge, next);
}

/**
 * Append the segment a-b to `out` (6 numbers per piece), cut into pieces
 * short enough to follow the curve of the sphere.
 */
function pushArcSegments(out, ax, ay, az, bx, by, bz, stepRad) {
  const angle = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));
  const pieces = Math.max(1, Math.ceil(angle / stepRad));
  let px = ax, py = ay, pz = az;
  for (let i = 1; i <= pieces; i++) {
    let qx = bx, qy = by, qz = bz;
    if (i < pieces) {
      const t = i / pieces;
      qx = ax + (bx - ax) * t; qy = ay + (by - ay) * t; qz = az + (bz - az) * t;
      const k = 1 / Math.hypot(qx, qy, qz);
      qx *= k; qy *= k; qz *= k;
    }
    out.push(px, py, pz, qx, qy, qz);
    px = qx; py = qy; pz = qz;
  }
}

/**
 * Turn one polygon (outer ring plus holes, [lng, lat] coordinates) into
 * a patch of the unit sphere:
 *
 *   triangles  Float32Array, 9 numbers per triangle
 *   outline    Float32Array, 6 numbers per border segment
 *   center, t1, t2, cosRadius, rings2d   for hit testing (spherePartContains)
 *
 * The polygon is flattened around its own centre (azimuthal equidistant
 * projection), so shapes across the antimeridian or a pole need no
 * special case. Requires the `earcut` library. Returns null for
 * degenerate input.
 */
function buildSpherePart(polygon, maxEdgeDeg = 5, outlineStepDeg = 2) {
  // Unit vectors per ring, without the closing duplicate
  const rings = [];
  const cuts = [];   // per ring: is the vertex on an artificial cut (antimeridian, pole)?
  for (const ring of polygon) {
    const last = ring.length - 1;
    const closed = last > 0 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1];
    const count = closed ? last : ring.length;
    if (count < 3) {
      if (!rings.length) return null;   // no outer ring, no polygon
      continue;
    }
    const units = new Float64Array(count * 3);
    const cut = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      lngLatToUnit(ring[i][0], ring[i][1], units, i * 3);
      cut[i] = Math.abs(Math.abs(ring[i][0]) - 180) < 1e-6 || ring[i][1] < -89.99 ? 1 : 0;
    }
    rings.push(units);
    cuts.push(cut);
  }
  if (!rings.length) return null;

  // Centre: mean direction of the outer ring
  const outer = rings[0];
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < outer.length; i += 3) {
    cx += outer[i]; cy += outer[i + 1]; cz += outer[i + 2];
  }
  let length = Math.hypot(cx, cy, cz);
  if (length < 1e-9) { cx = outer[0]; cy = outer[1]; cz = outer[2]; length = 1; }
  cx /= length; cy /= length; cz /= length;

  // Two directions at right angles to the centre and to each other
  const ux = Math.abs(cy) > 0.9 ? 1 : 0, uy = Math.abs(cy) > 0.9 ? 0 : 1;
  let t1x = uy * cz, t1y = -ux * cz, t1z = ux * cy - uy * cx;
  length = Math.hypot(t1x, t1y, t1z);
  t1x /= length; t1y /= length; t1z /= length;
  const t2x = cy * t1z - cz * t1y, t2y = cz * t1x - cx * t1z, t2z = cx * t1y - cy * t1x;

  // Flatten
  const flat = [];
  const holes = [];
  const rings2d = [];
  let cosRadius = 1;
  rings.forEach((units, r) => {
    if (r > 0) holes.push(flat.length / 2);
    const ring2d = new Float64Array(units.length / 3 * 2);
    for (let i = 0, j = 0; i < units.length; i += 3, j += 2) {
      const px = units[i], py = units[i + 1], pz = units[i + 2];
      const cos = Math.max(-1, Math.min(1, px * cx + py * cy + pz * cz));
      if (r === 0 && cos < cosRadius) cosRadius = cos;
      const x = px * t1x + py * t1y + pz * t1z;
      const y = px * t2x + py * t2y + pz * t2z;
      const norm = Math.hypot(x, y);
      const k = norm < 1e-12 ? 0 : Math.acos(cos) / norm;
      ring2d[j] = x * k;
      ring2d[j + 1] = y * k;
      flat.push(ring2d[j], ring2d[j + 1]);
    }
    rings2d.push(ring2d);
  });

  // Triangulate in the plane, then refine on the sphere
  const indices = earcut(flat, holes.length ? holes : null, 2);
  const vertexCount = flat.length / 2;
  const all = new Float64Array(vertexCount * 3);
  let offset = 0;
  for (const units of rings) { all.set(units, offset); offset += units.length; }

  const triangles = [];
  const cosMaxEdge = Math.cos(maxEdgeDeg * DEG2RAD);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    subdivideTriangle(triangles,
      all[a], all[a + 1], all[a + 2],
      all[b], all[b + 1], all[b + 2],
      all[c], all[c + 1], all[c + 2],
      cosMaxEdge, 0);
  }

  // Border segments. The cuts that world-atlas makes at the antimeridian
  // and at the south pole are not borders and are left out.
  const outline = [];
  const step = outlineStepDeg * DEG2RAD;
  rings.forEach((units, r) => {
    const count = units.length / 3;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      if (cuts[r][i] && cuts[r][j]) continue;
      pushArcSegments(outline,
        units[i * 3], units[i * 3 + 1], units[i * 3 + 2],
        units[j * 3], units[j * 3 + 1], units[j * 3 + 2], step);
    }
  });

  return {
    triangles: Float32Array.from(triangles),
    outline: Float32Array.from(outline),
    center: [cx, cy, cz],
    t1: [t1x, t1y, t1z],
    t2: [t2x, t2y, t2z],
    cosRadius,
    rings2d,
  };
}

/**
 * Is the direction (x, y, z) inside a patch made by buildSpherePart?
 */
function spherePartContains(part, x, y, z) {
  const [cx, cy, cz] = part.center;
  const cos = Math.max(-1, Math.min(1, x * cx + y * cy + z * cz));
  if (cos < part.cosRadius - 1e-9) return false;

  const px = x * part.t1[0] + y * part.t1[1] + z * part.t1[2];
  const py = x * part.t2[0] + y * part.t2[1] + z * part.t2[2];
  const norm = Math.hypot(px, py);
  const k = norm < 1e-12 ? 0 : Math.acos(cos) / norm;
  const qx = px * k, qy = py * k;

  // Even-odd rule over all rings, so holes are handled for free
  let inside = false;
  for (const ring of part.rings2d) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
      if ((yi > qy) !== (yj > qy) && qx < (xj - xi) * (qy - yi) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// ============================================================================
// Outline Ribbons (for the globe)
// ============================================================================
//
// An outline on the globe is a narrow band of triangles along a line. The
// band is stored as its centre line plus, per vertex, the direction to move
// sideways, so its width can follow the zoom by rewriting one buffer.

/**
 * A line of [lng, lat] points as unit vectors: repeated points removed and
 * long edges split, so the line follows the sphere. A line that ends where
 * it starts is marked closed and its last point dropped.
 */
function lineToUnits(coords, maxStepDeg = 2) {
  const points = [];
  const step = maxStepDeg * DEG2RAD;
  const p = [0, 0, 0];
  for (const c of coords) {
    lngLatToUnit(c[0], c[1], p, 0);
    const prev = points[points.length - 1];
    if (prev) {
      const dot = prev[0] * p[0] + prev[1] * p[1] + prev[2] * p[2];
      if (dot > 1 - 1e-12) continue;
      const pieces = Math.ceil(Math.acos(Math.max(-1, dot)) / step);
      for (let i = 1; i < pieces; i++) {
        const t = i / pieces;
        const x = prev[0] + (p[0] - prev[0]) * t;
        const y = prev[1] + (p[1] - prev[1]) * t;
        const z = prev[2] + (p[2] - prev[2]) * t;
        const k = 1 / Math.hypot(x, y, z);
        points.push([x * k, y * k, z * k]);
      }
    }
    points.push([p[0], p[1], p[2]]);
  }

  let closed = false;
  if (points.length > 3) {
    const a = points[0], b = points[points.length - 1];
    if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 1 - 1e-12) {
      points.pop();
      closed = true;
    }
  }
  return { points, closed };
}

/**
 * Cut a line into dashes. `on` and `off` are angles in radians. On a
 * closed line the lengths are adjusted so a whole number of dashes fits.
 */
function dashLine(line, on, off) {
  const points = line.closed ? [...line.points, line.points[0]] : line.points;
  if (points.length < 2) return [];

  const along = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    along.push(along[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = along[along.length - 1];
  let period = on + off;
  if (line.closed) {
    const count = Math.max(1, Math.round(total / period));
    on *= total / (count * period);
    period = total / count;
  }

  const pointAt = (distance, i) => {
    const a = points[i], b = points[i + 1];
    const t = (distance - along[i]) / (along[i + 1] - along[i]);
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
    const k = 1 / Math.hypot(x, y, z);
    return [x * k, y * k, z * k];
  };

  const dashes = [];
  let i = 0;   // segment the walk is in
  for (let start = 0; start < total - 1e-12; start += period) {
    const end = Math.min(start + on, total);
    while (along[i + 1] <= start) i++;
    const dash = [pointAt(start, i)];
    while (along[i + 1] < end) {
      i++;
      dash.push(points[i]);
    }
    dash.push(pointAt(end, i));
    dashes.push({ points: dash, closed: false });
  }
  return dashes;
}

/**
 * Triangles for lines of even width. Returns per vertex the point on the
 * centre line (`centers`) and where to move it for a width of one
 * (`offsets`); a vertex is drawn at centre + offset * half the width.
 */
function buildRibbon(lines) {
  let segments = 0;
  for (const line of lines) {
    if (line.points.length >= 2) segments += line.closed ? line.points.length : line.points.length - 1;
  }
  const centers = new Float32Array(segments * 18);
  const offsets = new Float32Array(segments * 18);
  let at = 0;

  // The sideways direction of the edge a→b, seen from p
  const side = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const x = p[1] * dz - p[2] * dy, y = p[2] * dx - p[0] * dz, z = p[0] * dy - p[1] * dx;
    const k = 1 / (Math.hypot(x, y, z) || 1);
    return [x * k, y * k, z * k];
  };

  for (const line of lines) {
    const points = line.points;
    const n = points.length;
    if (n < 2) continue;

    // At each point: the sideways direction that keeps the band's width
    // through the bend (a mitre, limited so sharp bends grow no spikes).
    const miters = points.map((p, i) => {
      const before = line.closed || i > 0 ? side(p, points[(i - 1 + n) % n], p) : null;
      const after = line.closed || i < n - 1 ? side(p, p, points[(i + 1) % n]) : null;
      if (!before || !after) return before || after;
      let x = before[0] + after[0], y = before[1] + after[1], z = before[2] + after[2];
      const length = Math.hypot(x, y, z);
      if (length < 1e-6) return before;
      x /= length; y /= length; z /= length;
      const k = 1 / Math.max(0.5, x * before[0] + y * before[1] + z * before[2]);
      return [x * k, y * k, z * k];
    });

    const count = line.closed ? n : n - 1;
    for (let i = 0; i < count; i++) {
      const a = i, b = (i + 1) % n;
      // Two triangles per edge: (a+, a-, b+) and (a-, b-, b+)
      for (const [index, sign] of [[a, 1], [a, -1], [b, 1], [a, -1], [b, -1], [b, 1]]) {
        const p = points[index], m = miters[index];
        centers[at] = p[0]; centers[at + 1] = p[1]; centers[at + 2] = p[2];
        offsets[at] = m[0] * sign; offsets[at + 1] = m[1] * sign; offsets[at + 2] = m[2] * sign;
        at += 3;
      }
    }
  }
  return { centers, offsets };
}
