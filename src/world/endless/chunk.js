import THREE from "../../core/three.js?v=combat-48";
import { mesh, box, rod, poly } from "../../core/geometry.js?v=combat-48";
import { mat } from "../../models/materials.js?v=combat-48";
import { palm, umbrella, lighthouse, beachHut } from "../beach/props.js?v=combat-48";
import { batchStatic } from "../beach/batch.js?v=combat-48";
import { CHUNK_LENGTH, randomAt } from "./path.js?v=coast-55";
import { createEndlessRaceLayout } from "./race-layout.js?v=coast-55";
import { RACE_DISTANCE_METERS } from "../../game/progression.js?v=progress-59";
import { addHazards } from "./hazards.js?v=hazards-58";
import { addObstacles } from "./obstacles.js?v=coast-55";
import { getThemePalette, addThemeScenery } from "./themes.js?v=coast-55";
import { getMapDefinition } from "../../game/map-settings.js?v=coast-55";
const coastPalette = {
  road: mat("#5b686f"),
  sand: mat("#f3d79b"),
  wet: mat("#e0cf9e"),
  shallow: mat("#5ac5c6", 0.6),
  water: mat("#30aab8", 0.48),
  white: mat("#fff6dc"),
  coral: mat("#e78661"),
  grass: mat("#b7cf85"),
  green: mat("#6c9d71"),
  rock: mat("#a9b6ad"),
  wood: mat("#c59e6a"),
};
Object.values(coastPalette).forEach((m) => (m.userData.shared = true));
function ribbon(path, start, from, to, height, material, parent) {
  const vertices = [],
    indices = [],
    steps = 32;
  for (let i = 0; i <= steps; i++) {
    const d = start + (i / steps) * CHUNK_LENGTH,
      pose = path.sample(d);
    for (const side of [from, to]) {
      const p = pose.point.clone().addScaledVector(pose.normal, side);
      vertices.push(p.x, height, p.z + start);
    }
    if (i) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const o = mesh(geo, material, parent);
  o.castShadow = false;
  return o;
}
function flatRibbon(path, start, from, to, height, material, parent) {
  // Terrain coordinates use global X / Z to avoid wedge gaps as the road curves.
  const vertices = [],
    indices = [],
    steps = 32;
  for (let i = 0; i <= steps; i++) {
    const d = start + (i / steps) * CHUNK_LENGTH;
    vertices.push(
      path.center(d) + from,
      height,
      (-i / steps) * CHUNK_LENGTH,
      path.center(d) + to,
      height,
      (-i / steps) * CHUNK_LENGTH,
    );
    if (i) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const o = mesh(g, material, parent);
  o.castShadow = false;
  return o;
}
function at(path, d, start, offset) {
  const p = path.sample(d, offset).point;
  p.z += start;
  return p;
}
export function createChunk(path, index) {
  const start = index * CHUNK_LENGTH,
    root = new THREE.Group();
  const map = getMapDefinition(path.options), palette = getThemePalette(map.id) ?? coastPalette;
  root.name = map.id + "-chunk-" + index;
  root.userData.mapId = map.id;
  root.userData.chunkIndex = index;
  root.userData.barriers = [];
  const rand = (salt) => randomAt(path.seed, index, salt);
  if (map.id === "coast") {
    flatRibbon(path, start, -250, -30, -0.48, palette.water, root);
    flatRibbon(path, start, -30, -21, -0.42, palette.shallow, root);
    flatRibbon(path, start, -21, -18, -0.27, palette.wet, root);
    flatRibbon(path, start, -18, 45, 0.02, palette.sand, root);
    flatRibbon(path, start, 45, 250, 0.01, palette.grass, root);
  } else {
    flatRibbon(path, start, -250, 250, 0.02, palette.sand, root);
    for (const side of [-1, 1]) {
      const shoulder = path.width / 2 + 1;
      flatRibbon(path, start, side < 0 ? -shoulder - 7 : shoulder, side < 0 ? -shoulder : shoulder + 7, 0.035, palette.wet, root);
    }
  }
  ribbon(
    path,
    start,
    -path.width / 2,
    path.width / 2,
    path.height,
    palette.road,
    root,
  );
  for (const side of [-1, 1])
    ribbon(
      path,
      start,
      side * (path.width / 2 - 0.23) - 0.055,
      side * (path.width / 2 - 0.23) + 0.055,
      path.height + 0.016,
      palette.white,
      root,
    );
  // Arc-local curb orientation keeps every chunk aligned with the road.
  for (let i = 0; i < 32; i++) {
    const d = start + (i + 0.5) * 2,
      pose = path.sample(d);
    for (const side of [-1, 1]) {
      const p = at(path, d, start, side * (path.width / 2 + 0.22));
      p.y = 0.18;
      const o = box(
        p.toArray(),
        [0.42, 0.23, 2.04],
        i % 2 ? palette.white : palette.coral,
        root,
      );
      o.rotation.y = -Math.atan(pose.tangent.x / -pose.tangent.z);
      const railPoint = at(path, d, start, side * (path.width / 2 + 0.65));
      const rail = box(
        [railPoint.x, 0.87, railPoint.z],
        [0.18, 0.52, 2.04],
        palette.white,
        root,
      );
      rail.rotation.y = o.rotation.y;
      root.userData.barriers.push({
        x: railPoint.x,
        y: 0.87,
        z: railPoint.z,
        half: [0.09, 0.26, 1.02],
        yaw: rail.rotation.y,
      });
      if (i % 2 === 0) {
        const reflector = box(
          [railPoint.x - side * 0.105, 0.87, railPoint.z],
          [0.035, 0.18, 0.32], palette.coral, root,
        );
        reflector.rotation.y = rail.rotation.y;
        reflector.castShadow = false;
        box(
          [railPoint.x, 0.5, railPoint.z],
          [0.12, 1, 0.12],
          palette.coral,
          root,
        );
      }
    }
  }
  // Four-metre spacing supplies close, world-anchored motion references.
  for (let i = 0; i < 16; i++) {
    const d = start + i * 4 + 2;
    for (const lane of [-path.width / 6, path.width / 6]) {
      const p = at(path, d, start, lane);
      p.y = path.height + 0.024;
      const o = box(p.toArray(), [0.10, 0.014, 1.25], palette.white, root);
      o.rotation.y = -Math.atan(
        path.sample(d).tangent.x / -path.sample(d).tangent.z,
      );
      o.castShadow = false;
    }
  }
  if (map.id === "coast") {
    root.userData.scenery = "tropical-beach";
    for (let i = 0; i < 5; i++) {
      const d = start + 7 + i * 12,
        side = i % 2 ? 1 : -1,
        offset = side * (path.width / 2 + 4 + rand(i + 5) * 7),
        p = at(path, d, start, offset);
      palm(
        root,
        p.x,
        p.z,
        0.85 + rand(i + 20) * 0.42,
        rand(i + 40) * Math.PI * 2,
      );
    }
    if (rand(50) > 0.3) {
      const d = start + 24,
        p = at(path, d, start, -14);
      umbrella(
        root,
        p.x,
        p.z,
        ["#dc8964", "#459fa4", "#eabc69"][index % 3 < 0 ? 0 : index % 3],
      );
    }
    if (index % 7 === 3) {
      const p = at(path, start + 40, start, 20);
      lighthouse(root, p.x, p.z);
    }
    if (index % 5 === 1) {
      const p = at(path, start + 40, start, 15);
      beachHut(root, p.x, p.z);
    }
    for (let i = 0; i < 4; i++) {
      const d = start + rand(i + 75) * 64,
        p = at(path, d, start, 23 + rand(i + 80) * 14);
      poly(
        [p.x, 0.6, p.z],
        [1.5, 1.1, 1.2],
        i % 2 ? palette.green : palette.rock,
        root,
        0,
      );
    }
    // White foam strokes remain below the road, along the water's edge.
    for (let i = 0; i < 8; i++) {
      const d = start + i * 8 + rand(100 + i) * 3;
      box(
        [path.center(d) - 23, -0.2, -(d - start)],
        [0.12, 0.02, 2 + rand(i + 110) * 3],
        palette.white,
        root,
      ).castShadow = false;
    }
  } else addThemeScenery(root, path, index, start);
  // Signs mark distance sectors, never imply a finish line on an endless course.
  if (index >= 0 && index % 4 === 0) {
    for (const side of [-1, 1]) {
      const p = at(path, start + 2, start, side * (path.width / 2 + 1.8));
      rod([p.x, 0.2, p.z], [p.x, 3, p.z], 0.055, palette.wood, root);
      box([p.x, 2.65, p.z], [0.8, 0.55, 0.08], palette.coral, root);
    }
  }
  if (index === -1) {
    const layout = createEndlessRaceLayout(path);
    for (const slot of layout.grid) {
      const pose = path.sample(slot.distance),
        stall = new THREE.Group();
      stall.position.set(
        slot.position.x,
        path.height + 0.026,
        slot.position.z + start,
      );
      stall.rotation.y = -Math.atan(pose.tangent.x / -pose.tangent.z);
      root.add(stall);
      for (const side of [-1, 1])
        box([side * 1.15, 0, 0], [0.08, 0.012, 3.2], palette.white, stall);
      box([0, 0, -1.6], [2.38, 0.012, 0.12], palette.coral, stall);
    }
  }
  if (!map.training && start <= RACE_DISTANCE_METERS && start + CHUNK_LENGTH > RACE_DISTANCE_METERS) {
    root.userData.finishLine = true;
    const pose = path.sample(RACE_DISTANCE_METERS);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 16; column++) {
      const p = at(path, RACE_DISTANCE_METERS + row * 0.4, start, (column - 7.5) * path.width / 16);
      const mark = box([p.x, path.height + 0.027, p.z], [path.width / 16, 0.015, 0.4], (row + column) % 2 ? palette.white : palette.road, root);
      mark.rotation.y = -Math.atan(pose.tangent.x / -pose.tangent.z);
    }
  }
  if (index === 0) {
    const pose = path.sample(0);
    for (let row = 0; row < 3; row++)
      for (let column = 0; column < 16; column++) {
        const p = at(
          path,
          row * 0.4,
          start,
          (column - 7.5) * (path.width / 16),
        );
        box(
          [p.x, path.height + 0.025, p.z],
          [path.width / 16, 0.015, 0.4],
          (row + column) % 2 ? palette.white : palette.road,
          root,
        );
      }
  }
  batchStatic(root);
  addObstacles(root, path, index);
  addHazards(root, path, index);
  return root;
}
export function disposeChunk(root) {
  const geometries = new Set(),
    materials = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      if (!m.userData.shared) materials.add(m);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    if (m.map) m.map.dispose();
    m.dispose();
  });
  root.removeFromParent();
  root.clear();
}
