/**
 * CO2 Budget Map — 3D globe
 *
 * globe.gl provides the stage: camera, drag and zoom, the ocean sphere and
 * the atmosphere. The countries are drawn by this file, as a handful of
 * merged meshes instead of one object per island:
 *
 *   caps       every country surface in one mesh, colored per vertex
 *   borders    every border in one set of lines
 *   walls      the sides of raised countries ("resize countries"), built on demand
 *   selection  the resized copy of the selected country
 *   outlines   bands along the selected country's outline, sized to the zoom
 *
 * That keeps a frame at a few draw calls (globe.gl's own polygon layer
 * needed several thousand) and makes changes cheap: positions are unit
 * vectors times a radius, colors are one buffer.
 *
 * Because drawing is custom, so is hit testing: a ray from the pointer is
 * intersected with the sphere and tested against the country outlines.
 *
 * Both libraries are fetched while the browser is idle and the globe is
 * built in the background, so opening it takes no noticeable time.
 *
 * Resizing works differently here than on the flat map:
 *   - one selected country is resized by area, like on the map
 *   - "resize countries" raises every country by its ratio instead,
 *     because resized areas would hide each other on a sphere
 */

// Exact versions, kept in vendor/ (see vendor/README.md).
const GLOBE_LIBRARIES = [
  'vendor/globe.gl-2.46.2/globe.gl.min.js',
  'vendor/earcut-2.2.4/earcut.min.js',   // polygon triangulation
];

const GLOBE_RADIUS = 100;            // globe.gl's sphere, in its world units
const GLOBE_SIMPLIFY_DEG = 0.045;    // border detail the globe keeps
const GLOBE_MIN_PART_AREA = 0.01;    // squared degrees; smaller islands are skipped

// Heights are fractions of the globe radius.
const CAP_ALTITUDE = 0.006;          // countries float just above the ocean
const SELECTED_ALTITUDE = 0.014;     // the resized selected country, above its neighbours
const BORDER_LIFT = 0.0008;          // borders sit just above their country
const HEIGHT_PER_RATIO = 0.02;       // raised countries: 1x the reference = 2 % of the radius
const HEIGHT_MIN = 0.005;
const HEIGHT_MAX = 0.25;             // capped so the tallest stay on screen

// Outlines of the selected country (widths: OUTLINE_WIDTHS in state.js)
const OUTLINE_DASH_PX = 8;
const OUTLINE_GAP_PX = 6;
const OUTLINE_DASH_STEP = 1.3;       // dashes are cut again when the zoom changes this much
const OUTLINE_NEAR_ALTITUDE = 1;     // camera heights between which outlines thin out
const OUTLINE_FAR_ALTITUDE = 2.5;

let globe = null;                    // the globe.gl instance
let globePreparation = null;         // promise of the one-time setup
let globeIsReady = false;
let globeUrgent = false;             // someone is waiting: stop yielding to the browser

const globeScene = {
  three: null,         // three.js classes (see harvestThree)
  shapes: [],          // one entry per country
  shapeById: new Map(),
  caps: null,
  borders: null,
  walls: null,
  selectionMesh: null,
  selectionParts: null,   // patches of the resized selected country, for hit testing
  outlines: [],           // see addOutline
  outlinePixel: 0,        // the zoom the outlines were last fitted to
  outlineFrame: 0,
  hoveredId: null,
  altitudeFrame: 0,
  tooltip: null,
};

// ============================================================================
// Loading and Preparation
// ============================================================================

const loadedScripts = new Map();

function loadScript(url) {
  if (!loadedScripts.has(url)) {
    loadedScripts.set(url, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        loadedScripts.delete(url);   // allow another attempt later
        reject(new Error(`Could not load ${url}`));
      };
      document.head.appendChild(script);
    }));
  }
  return loadedScripts.get(url);
}

/**
 * Give the browser a turn every few milliseconds while preparing in the
 * background, so the page never stutters. Skipped once someone waits.
 */
let sliceStart = 0;
async function breathe() {
  if (globeUrgent || performance.now() - sliceStart < 8) return;
  await new Promise(resolve => setTimeout(resolve));
  sliceStart = performance.now();
}

/**
 * Load the libraries and build the globe, hidden and paused. Safe to
 * call any number of times; rejects if a library cannot be loaded, so
 * the caller can stay on the flat map.
 */
function prepareGlobe() {
  if (!globePreparation) {
    globePreparation = (async () => {
      await Promise.all(GLOBE_LIBRARIES.map(loadScript));
      if (typeof Globe === 'undefined' || typeof earcut === 'undefined') {
        throw new Error('Globe libraries loaded but did not register');
      }
      sliceStart = performance.now();
      await buildGlobeShapes();
      await initGlobe();
      globeIsReady = true;
    })().catch(error => {
      globePreparation = null;
      throw error;
    });
  }
  return globePreparation;
}

/**
 * Prepare the globe once the browser has nothing better to do. Skipped on
 * data-saving and very slow connections; the globe then loads on demand.
 */
function scheduleGlobePrewarm() {
  const connection = navigator.connection;
  if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''))) return;
  const run = () => prepareGlobe().catch(error => console.warn('Globe prewarm failed:', error));
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

/**
 * A lighter copy of the country shapes, turned into sphere patches.
 */
async function buildGlobeShapes() {
  const simple = simplifyTopology(state.topology, GLOBE_SIMPLIFY_DEG);
  const collection = assignFeatureIds(topojson.feature(simple, simple.objects.countries));
  const features = collection.features.map(feature => dropSmallParts(feature, GLOBE_MIN_PART_AREA));
  state.globeGeojson = { ...collection, features };
  await breathe();

  const shapes = [];
  for (const feature of features) {
    const parts = geometryPolygons(feature.geometry).map(polygon => buildSpherePart(polygon)).filter(Boolean);
    if (parts.length) shapes.push({ id: feature.id, feature, parts, altitude: CAP_ALTITUDE });
    await breathe();
  }
  globeScene.shapes = shapes;
  globeScene.shapeById = new Map(shapes.map(shape => [shape.id, shape]));
}

async function initGlobe() {
  const container = document.getElementById('globe');
  const sizeSource = container.clientWidth ? container : document.getElementById('map');

  globe = new Globe(container, { animateIn: false })
    .backgroundColor(OCEAN_COLOR)
    .showAtmosphere(true)
    .atmosphereColor('lightskyblue')
    .atmosphereAltitude(0.15)
    .width(sizeSource.clientWidth)
    .height(sizeSource.clientHeight)
    .pointOfView({ lat: 20, lng: 0, altitude: 2.5 })
    // globe.gl's own picking tests every triangle in the scene; ours is
    // exact and far cheaper (see pickCountry).
    .enablePointerInteraction(false);

  // A plain sphere in the ocean color instead of a tiled basemap.
  const material = globe.globeMaterial();
  material.color.set('#c3d0dd');
  if (material.emissive) {
    material.emissive.set('#8fa3b8');
    material.emissiveIntensity = 0.35;
  }

  // Start facing the visitor's own country, if known.
  const home = state.homeId != null ? globeScene.shapeById.get(state.homeId) : null;
  const homeCentroid = home ? getFeatureCentroid(home.feature) : null;
  if (homeCentroid) globe.pointOfView({ ...homeCentroid, altitude: 2.5 });

  globeScene.three = await harvestThree();
  await breathe();
  createCountryMeshes();
  bindGlobePointer(container);
  applyGlobeColors();
  writeGlobeAltitudes();

  // Draw one frame now, so shaders and buffers are ready before the globe
  // is shown, then stop rendering until it is.
  globe.renderer().render(globe.scene(), globe.camera());
  globe.pauseAnimation();
}

/**
 * globe.gl bundles three.js but does not export it, and objects from a
 * second copy of three.js must not be mixed into its scene. So the
 * classes are taken from objects globe.gl has already created. This
 * relies on globe.gl's scene containing a plain Mesh and LineSegments
 * (the globe and its graticules), which holds for the pinned version;
 * if a future version changes that, this throws and the globe reports
 * itself unavailable.
 */
async function harvestThree() {
  const scene = globe.scene();
  const deadline = performance.now() + 3000;
  let Mesh = null, LineSegments = null;

  for (;;) {
    scene.traverse(object => {
      if (!Mesh && object.type === 'Mesh') Mesh = object.constructor;
      if (!LineSegments && object.type === 'LineSegments') LineSegments = object.constructor;
    });
    if (Mesh && LineSegments) break;
    if (performance.now() > deadline) {
      throw new Error('three.js classes not found in the globe.gl scene');
    }
    await new Promise(resolve => setTimeout(resolve, 16));   // globe.gl builds its scene asynchronously
  }

  // A Mesh and a LineSegments made without arguments carry the default
  // geometry and materials, which gives us those classes too.
  const meshProbe = new Mesh();
  const lineProbe = new LineSegments();
  meshProbe.geometry.setIndex([0, 1, 2]);
  const three = {
    Mesh,
    LineSegments,
    BufferGeometry: meshProbe.geometry.constructor,
    BufferAttribute: Object.getPrototypeOf(meshProbe.geometry.index.constructor),
    MeshBasicMaterial: meshProbe.material.constructor,
    LineBasicMaterial: lineProbe.material.constructor,
    Color: meshProbe.material.color.constructor,
    Vector3: globe.camera().position.constructor,
    DoubleSide: 2,
  };
  [meshProbe, lineProbe].forEach(probe => {
    probe.geometry.dispose();
    probe.material.dispose();
  });

  if (!new three.BufferAttribute(new Float32Array(3), 3).isBufferAttribute) {
    throw new Error('three.js BufferAttribute class not found');
  }
  return three;
}

// ============================================================================
// Merged Country Meshes
// ============================================================================

/**
 * A mesh or line set whose vertices are unit vectors scaled per country.
 * `units` holds the directions, `positions` what is drawn.
 */
function makeLayer(units, { lines = false, colors = false, material }) {
  const { BufferGeometry, BufferAttribute, Mesh, LineSegments } = globeScene.three;
  const geometry = new BufferGeometry();
  const positions = new BufferAttribute(new Float32Array(units.length), 3);
  geometry.setAttribute('position', positions);
  let colorAttribute = null;
  if (colors) {
    colorAttribute = new BufferAttribute(new Float32Array(units.length), 3);
    geometry.setAttribute('color', colorAttribute);
  }
  const object = lines ? new LineSegments(geometry, material) : new Mesh(geometry, material);
  object.frustumCulled = false;   // vertices move; the globe is always in view anyway
  globe.scene().add(object);
  return { object, units, positions, colors: colorAttribute };
}

function createCountryMeshes() {
  const { MeshBasicMaterial, LineBasicMaterial, DoubleSide } = globeScene.three;
  const shapes = globeScene.shapes;

  // Give every country its range in the shared buffers
  let capLength = 0, lineLength = 0;
  for (const shape of shapes) {
    shape.capStart = capLength;
    shape.lineStart = lineLength;
    for (const part of shape.parts) {
      capLength += part.triangles.length;
      lineLength += part.outline.length;
    }
    shape.capEnd = capLength;
    shape.lineEnd = lineLength;
  }

  const capUnits = new Float32Array(capLength);
  const lineUnits = new Float32Array(lineLength);
  for (const shape of shapes) {
    let cap = shape.capStart, line = shape.lineStart;
    for (const part of shape.parts) {
      capUnits.set(part.triangles, cap);
      lineUnits.set(part.outline, line);
      cap += part.triangles.length;
      line += part.outline.length;
    }
  }

  globeScene.caps = makeLayer(capUnits, {
    colors: true,
    material: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
  });
  globeScene.borders = makeLayer(lineUnits, {
    lines: true,
    material: new LineBasicMaterial({ color: 0x232a36, transparent: true, opacity: 0.7 }),
  });
}

/**
 * Side walls for raised countries: one quad per border segment, from the
 * ocean up to the country's surface. Built the first time they are needed.
 */
function ensureGlobeWalls() {
  if (globeScene.walls) return;
  const { MeshBasicMaterial, DoubleSide } = globeScene.three;
  const lineUnits = globeScene.borders.units;
  const segments = lineUnits.length / 6;
  const units = new Float32Array(segments * 18);
  const top = new Uint8Array(segments * 6);   // 1 = vertex on the upper edge

  // Per segment a-b: triangles (a↓, b↓, b↑) and (a↓, b↑, a↑)
  const corner = [0, 3, 3, 0, 3, 0];
  const upper = [0, 0, 1, 0, 1, 1];
  for (let s = 0; s < segments; s++) {
    for (let v = 0; v < 6; v++) {
      const from = s * 6 + corner[v];
      const to = s * 18 + v * 3;
      units[to] = lineUnits[from];
      units[to + 1] = lineUnits[from + 1];
      units[to + 2] = lineUnits[from + 2];
      top[s * 6 + v] = upper[v];
    }
  }

  globeScene.walls = makeLayer(units, {
    colors: true,
    material: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
  });
  globeScene.walls.top = top;
}

// ============================================================================
// Colors and Heights
// ============================================================================

/**
 * Id of the country whose real shape is faded because a resized copy is
 * shown above it.
 */
function resizedSelectionId() {
  const id = state.selectedId;
  if (id == null || state.scaled || !state.selectedScaled) return null;
  const ratio = getBudgetRatio(id, state.metric);
  return ratio != null && ratio !== 1 ? id : null;
}

function applyGlobeColors() {
  const { caps, walls, shapes, three } = globeScene;
  const color = new three.Color();
  const land = new three.Color().setStyle(LAND_COLOR);
  const faded = resizedSelectionId();
  const capColors = caps.colors.array;
  const wallColors = walls ? walls.colors.array : null;

  for (const shape of shapes) {
    // setStyle converts the CSS color into the renderer's working color space
    color.setStyle(getRatioColor(getBudgetRatio(shape.id, state.metric)));
    let { r, g, b } = color;
    if (shape.id === faded) {
      r += (land.r - r) * 0.85; g += (land.g - g) * 0.85; b += (land.b - b) * 0.85;
    } else if (shape.id === globeScene.hoveredId) {
      r += (1 - r) * 0.32; g += (1 - g) * 0.32; b += (1 - b) * 0.32;
    }
    for (let i = shape.capStart; i < shape.capEnd; i += 3) {
      capColors[i] = r; capColors[i + 1] = g; capColors[i + 2] = b;
    }
    if (wallColors) {
      // Walls a shade darker than the surface, so raised countries read as solid
      const wr = r * 0.7, wg = g * 0.7, wb = b * 0.7;
      for (let i = shape.lineStart * 3; i < shape.lineEnd * 3; i += 3) {
        wallColors[i] = wr; wallColors[i + 1] = wg; wallColors[i + 2] = wb;
      }
    }
  }
  caps.colors.needsUpdate = true;
  if (walls) walls.colors.needsUpdate = true;
}

function targetAltitude(shape) {
  if (!state.scaled) return CAP_ALTITUDE;
  const ratio = getBudgetRatio(shape.id, state.metric);
  if (ratio === null || !isFinite(ratio)) return CAP_ALTITUDE;
  return Math.max(HEIGHT_MIN, Math.min(ratio * HEIGHT_PER_RATIO, HEIGHT_MAX));
}

/**
 * Move every vertex to its country's current height.
 */
function writeGlobeAltitudes() {
  const { caps, borders, walls, shapes } = globeScene;
  const capPositions = caps.positions.array, capUnits = caps.units;
  const linePositions = borders.positions.array, lineUnits = borders.units;

  for (const shape of shapes) {
    const capRadius = GLOBE_RADIUS * (1 + shape.altitude);
    for (let i = shape.capStart; i < shape.capEnd; i++) capPositions[i] = capUnits[i] * capRadius;

    const lineRadius = GLOBE_RADIUS * (1 + shape.altitude + BORDER_LIFT);
    for (let i = shape.lineStart; i < shape.lineEnd; i++) linePositions[i] = lineUnits[i] * lineRadius;

    if (walls) {
      const wallPositions = walls.positions.array, wallUnits = walls.units, top = walls.top;
      for (let v = shape.lineStart, end = shape.lineEnd; v < end; v++) {
        const radius = top[v] ? capRadius : GLOBE_RADIUS;
        const i = v * 3;
        wallPositions[i] = wallUnits[i] * radius;
        wallPositions[i + 1] = wallUnits[i + 1] * radius;
        wallPositions[i + 2] = wallUnits[i + 2] * radius;
      }
    }
  }
  caps.positions.needsUpdate = true;
  borders.positions.needsUpdate = true;
  if (walls) walls.positions.needsUpdate = true;
}

/**
 * Bring the countries to the heights the state asks for, with a short
 * rise or fall unless reduced motion is preferred.
 */
function updateGlobeAltitudes() {
  const shapes = globeScene.shapes;
  const targets = shapes.map(targetAltitude);
  if (state.scaled) {
    const firstWalls = !globeScene.walls;
    ensureGlobeWalls();
    if (firstWalls) applyGlobeColors();
  }
  if (globeScene.walls) globeScene.walls.object.visible = true;

  cancelAnimationFrame(globeScene.altitudeFrame);
  const finish = () => {
    shapes.forEach((shape, i) => { shape.altitude = targets[i]; });
    writeGlobeAltitudes();
    if (globeScene.walls) globeScene.walls.object.visible = state.scaled;
  };

  const changed = shapes.some((shape, i) => Math.abs(shape.altitude - targets[i]) > 1e-6);
  if (!changed || prefersReducedMotion()) {
    finish();
    return;
  }

  const starts = shapes.map(shape => shape.altitude);
  const startTime = performance.now();
  const duration = 520;
  const step = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 4);   // ease-out
    if (t >= 1) {
      finish();
      return;
    }
    shapes.forEach((shape, i) => { shape.altitude = starts[i] + (targets[i] - starts[i]) * eased; });
    writeGlobeAltitudes();
    globeScene.altitudeFrame = requestAnimationFrame(step);
  };
  globeScene.altitudeFrame = requestAnimationFrame(step);
}

// ============================================================================
// Selection
// ============================================================================

/**
 * The angle on the globe that one CSS pixel covers where the globe is
 * nearest to the camera.
 */
function globePixelAngle() {
  const camera = globe.camera();
  const distance = Math.max(1, camera.position.length() - GLOBE_RADIUS);
  const height = globe.renderer().domElement.clientHeight || 1;
  return 2 * distance * Math.tan(camera.fov * DEG2RAD / 2) / height / GLOBE_RADIUS;
}

/**
 * Outlines are thinner when the globe is small on screen, so they do not
 * swallow small countries.
 */
function outlineZoomScale() {
  const altitude = globe.camera().position.length() / GLOBE_RADIUS - 1;
  const t = Math.max(0, Math.min(1, (altitude - OUTLINE_NEAR_ALTITUDE) / (OUTLINE_FAR_ALTITUDE - OUTLINE_NEAR_ALTITUDE)));
  return 1 - t * (1 - OUTLINE_FAR_SCALE);
}

/**
 * Outline a feature: a white band on a slightly wider dark one, so it
 * reads on any fill. `dashed` is used for the real outline of a resized
 * country.
 */
function addOutline(feature, altitude, dashed) {
  const { Mesh, BufferGeometry, MeshBasicMaterial, DoubleSide } = globeScene.three;
  const lines = [];
  for (const polygon of geometryPolygons(feature.geometry)) {
    for (const ring of polygon) {
      for (const run of borderRuns(ring)) {
        const line = lineToUnits(run);
        if (line.points.length > 1) lines.push(line);
      }
    }
  }
  if (!lines.length) return;

  // Drawn after everything else and without writing depth: the bands never
  // fight each other or the surface below, but the globe still hides them.
  const band = (color, order) => {
    const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial({
      color,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    }));
    mesh.renderOrder = order + (dashed ? 2 : 0);
    mesh.frustumCulled = false;
    globe.scene().add(mesh);
    return mesh;
  };

  globeScene.outlines.push({
    lines,
    dashed,
    radius: GLOBE_RADIUS * (1 + altitude),
    ribbon: dashed ? null : buildRibbon(lines),
    dashStep: null,
    built: false,
    casing: band(OUTLINE_DARK, 10),
    line: band(0xffffff, 11),
  });
}

function clearOutlines() {
  for (const outline of globeScene.outlines) {
    for (const mesh of [outline.casing, outline.line]) {
      globe.scene().remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
  globeScene.outlines = [];
  globeScene.outlinePixel = 0;
}

/**
 * Give the outlines the width (and the dashes the length) that fits the
 * current zoom. Cheap when nothing changed.
 */
function layoutOutlines() {
  if (!globeScene.outlines.length) return;
  const pixel = globePixelAngle();
  if (Math.abs(pixel - globeScene.outlinePixel) < pixel * 0.004) return;
  globeScene.outlinePixel = pixel;

  const { BufferGeometry, BufferAttribute } = globeScene.three;
  const scale = outlineZoomScale();

  for (const outline of globeScene.outlines) {
    if (outline.dashed) {
      // Dashes keep roughly their length on screen: they are cut again
      // whenever the zoom has changed by a step.
      const step = Math.round(Math.log(pixel) / Math.log(OUTLINE_DASH_STEP));
      if (step !== outline.dashStep) {
        outline.dashStep = step;
        const unit = Math.pow(OUTLINE_DASH_STEP, step);
        outline.ribbon = buildRibbon(outline.lines.flatMap(
          line => dashLine(line, OUTLINE_DASH_PX * unit, OUTLINE_GAP_PX * unit)
        ));
        outline.built = false;
      }
    }

    const { centers, offsets } = outline.ribbon;
    const widths = outline.dashed ? OUTLINE_WIDTHS.dashed : OUTLINE_WIDTHS.solid;
    for (const [mesh, width] of [[outline.casing, widths.casing], [outline.line, widths.line]]) {
      if (!outline.built) {
        mesh.geometry.dispose();
        mesh.geometry = new BufferGeometry();
        mesh.geometry.setAttribute('position', new BufferAttribute(new Float32Array(centers.length), 3));
      }
      const attribute = mesh.geometry.getAttribute('position');
      const positions = attribute.array;
      const half = width * scale * pixel / 2;
      const radius = outline.radius;
      for (let i = 0; i < positions.length; i++) positions[i] = (centers[i] + offsets[i] * half) * radius;
      attribute.needsUpdate = true;
    }
    outline.built = true;
  }
}

/**
 * Keep the outlines fitted to the zoom while the globe is shown and a
 * country is selected.
 */
function watchOutlines() {
  if (globeScene.outlineFrame) return;
  const tick = () => {
    globeScene.outlineFrame = 0;
    if (!state.globeView || !globeScene.outlines.length) return;
    layoutOutlines();
    globeScene.outlineFrame = requestAnimationFrame(tick);
  };
  globeScene.outlineFrame = requestAnimationFrame(tick);
}

/**
 * A ring as continuous runs of real border, without the cuts world-atlas
 * makes at the antimeridian and the south pole.
 */
function borderRuns(ring) {
  const onCut = (c) => Math.abs(Math.abs(c[0]) - 180) < 1e-6 || c[1] < -89.99;
  if (!ring.some(onCut)) return [ring];
  const runs = [];
  let run = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    if (onCut(a) && onCut(b)) {
      if (run.length > 1) runs.push(run);
      run = [];
    } else {
      if (!run.length) run.push(a);
      run.push(b);
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

function removeSelectionMesh() {
  const mesh = globeScene.selectionMesh;
  if (mesh) {
    globe.scene().remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  globeScene.selectionMesh = null;
  globeScene.selectionParts = null;
}

/**
 * Show the selected country: outlined, and if it is resized, as a
 * resized copy with its real outline dashed for comparison.
 */
function updateGlobeSelection() {
  removeSelectionMesh();
  clearOutlines();
  const shape = state.selectedId != null ? globeScene.shapeById.get(state.selectedId) : null;
  if (!shape) return;

  if (resizedSelectionId() == null) {
    addOutline(shape.feature, targetAltitude(shape) + 0.003, false);
    layoutOutlines();
    watchOutlines();
    return;
  }

  const { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, Color, DoubleSide } = globeScene.three;
  const ratio = getBudgetRatio(shape.id, state.metric);
  const resized = scaleFeatureSpherical(shape.feature, ratio);
  const parts = geometryPolygons(resized.geometry).map(polygon => buildSpherePart(polygon)).filter(Boolean);

  let length = 0;
  for (const part of parts) length += part.triangles.length;
  const positions = new Float32Array(length);
  const radius = GLOBE_RADIUS * (1 + SELECTED_ALTITUDE);
  let offset = 0;
  for (const part of parts) {
    for (let i = 0; i < part.triangles.length; i++) positions[offset + i] = part.triangles[i] * radius;
    offset += part.triangles.length;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const mesh = new Mesh(geometry, new MeshBasicMaterial({
    color: new Color().setStyle(getRatioColor(ratio)),
    side: DoubleSide,
  }));
  mesh.frustumCulled = false;
  globe.scene().add(mesh);
  globeScene.selectionMesh = mesh;
  globeScene.selectionParts = parts;

  addOutline(resized, SELECTED_ALTITUDE + 0.002, false);
  addOutline(shape.feature, SELECTED_ALTITUDE + 0.002, true);
  layoutOutlines();
  watchOutlines();
}

// ============================================================================
// Rendering
// ============================================================================

/**
 * Bring the globe in line with the state.
 */
function renderGlobe() {
  if (!globeIsReady) return;
  applyGlobeColors();
  updateGlobeAltitudes();
  updateGlobeSelection();
}

function setGlobeVisible(visible) {
  if (!globe) return;
  if (visible) {
    resizeGlobe();
    globe.resumeAnimation();
    globeScene.outlinePixel = 0;
    watchOutlines();
  } else {
    setGlobeHover(null);
    globe.pauseAnimation();   // no rendering while the flat map is shown
  }
}

function resizeGlobe() {
  if (!globe || !state.globeView) return;
  const container = document.getElementById('globe');
  globe.width(container.clientWidth).height(container.clientHeight);
}

function panGlobeToCountry(id) {
  const shape = globeScene.shapeById.get(id);
  if (!shape || !globe) return;
  const centroid = getFeatureCentroid(shape.feature);
  if (centroid) globe.pointOfView(centroid, prefersReducedMotion() ? 0 : 600);
}

// ============================================================================
// Pointer: hover, tooltip, click
// ============================================================================

function shapeAtDirection(x, y, z) {
  for (const shape of globeScene.shapes) {
    for (const part of shape.parts) {
      if (spherePartContains(part, x, y, z)) return shape;
    }
  }
  return null;
}

/**
 * The country under a screen position, or null. A ray from the camera is
 * intersected with spheres at the heights countries are drawn at.
 */
function pickCountry(clientX, clientY) {
  const container = document.getElementById('globe');
  const rect = container.getBoundingClientRect();
  const camera = globe.camera();
  const origin = camera.position;
  const direction = new globeScene.three.Vector3(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
    0.5
  ).unproject(camera).sub(origin).normalize();

  const along = origin.dot(direction);
  const originLength2 = origin.lengthSq();
  // Where the ray first meets a sphere of the given altitude, as a unit vector
  const hit = (altitude) => {
    const radius = GLOBE_RADIUS * (1 + altitude);
    const discriminant = along * along - (originLength2 - radius * radius);
    if (discriminant < 0) return null;
    const distance = -along - Math.sqrt(discriminant);
    if (distance < 0) return null;
    return [
      (origin.x + direction.x * distance) / radius,
      (origin.y + direction.y * distance) / radius,
      (origin.z + direction.z * distance) / radius,
    ];
  };

  // The resized selected country lies on top of everything.
  if (globeScene.selectionParts) {
    const point = hit(SELECTED_ALTITUDE);
    if (point && globeScene.selectionParts.some(part => spherePartContains(part, ...point))) {
      return state.selectedId;
    }
  }

  if (state.scaled) {
    // Raised countries: walk down through the heights. The first country
    // that is at least as tall as the level the ray has reached is hit.
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const altitude = HEIGHT_MAX * (1 - i / steps);
      const point = hit(altitude);
      if (!point) continue;
      const shape = shapeAtDirection(...point);
      if (shape && shape.altitude >= altitude - 1e-6) return shape.id;
    }
    return null;
  }

  const point = hit(CAP_ALTITUDE);
  const shape = point ? shapeAtDirection(...point) : null;
  return shape ? shape.id : null;
}

function setGlobeHover(id, event) {
  const container = document.getElementById('globe');
  const tooltip = globeScene.tooltip;
  if (id !== globeScene.hoveredId) {
    globeScene.hoveredId = id;
    if (globeIsReady) applyGlobeColors();
    container.style.cursor = id != null ? 'pointer' : '';
    const html = id != null ? buildTooltipHtml(id) : '';
    if (tooltip) {
      tooltip.innerHTML = html;
      tooltip.hidden = !html;
    }
  }
  if (id != null && event && tooltip && !tooltip.hidden) {
    const rect = container.getBoundingClientRect();
    const x = Math.min(event.clientX - rect.left + 14, rect.width - tooltip.offsetWidth - 8);
    const y = Math.min(event.clientY - rect.top + 16, rect.height - tooltip.offsetHeight - 8);
    tooltip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }
}

function bindGlobePointer(container) {
  const tooltip = document.createElement('div');
  tooltip.className = 'country-tooltip globe-tooltip';
  tooltip.hidden = true;
  container.appendChild(tooltip);
  globeScene.tooltip = tooltip;

  let press = null;      // where a click or tap began
  let pending = null;    // latest pointer position, handled once per frame
  let frame = 0;

  container.addEventListener('pointerdown', (e) => {
    press = { x: e.clientX, y: e.clientY, time: performance.now() };
    setGlobeHover(null);
  });

  container.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || e.buttons) return;   // no hover while dragging or on touch
    pending = e;
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (globeIsReady && state.globeView) setGlobeHover(pickCountry(pending.clientX, pending.clientY), pending);
      });
    }
  });

  container.addEventListener('pointerleave', () => setGlobeHover(null));

  container.addEventListener('pointerup', (e) => {
    if (!press || !globeIsReady) return;
    const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    const quick = performance.now() - press.time < 700;
    press = null;
    if (moved > 6 || !quick) return;   // that was a drag, not a click

    const id = pickCountry(e.clientX, e.clientY);
    if (id != null) selectCountry(id);
    else if (state.selectedId != null) deselectCountry();
  });
}
