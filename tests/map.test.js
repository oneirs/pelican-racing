import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { normalizeMap, loadMap, saveMap, MAPS, getMapDefinition } from "../src/game/map-settings.js";
const context = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(
    new URL("../vendor/three/three.min.js", import.meta.url),
    "utf8",
  ),
  context,
);
globalThis.window = { THREE: context.THREE };
const { createEndlessPath } = await import("../src/world/endless/path.js");
const { createChunk, disposeChunk } = await import(
  "../src/world/endless/chunk.js"
);
const { createEndlessRaceLayout } = await import(
  "../src/world/endless/race-layout.js"
);
const { createEndlessWorld } = await import("../src/world/endless/streamer.js");

test("map settings validate, persist and recover from corrupt storage", () => {
  assert.deepEqual(
    normalizeMap({ width: 1, curves: "bad", seed: -1 }),
    normalizeMap(),
  );
  const records = new Map(),
    storage = {
      getItem: (k) => records.get(k),
      setItem: (k, v) => records.set(k, v),
    };
  const settings = normalizeMap({
    width: 20,
    curves: "straight",
    obstacles: "dense",
    seed: 123,
    sparks: false,
    destruction: false,
  });
  saveMap(storage, settings);
  assert.deepEqual(loadMap(storage), settings);
  assert.deepEqual(loadMap({ getItem: () => "{broken" }), normalizeMap());
});

test("map options change deterministic geometry, road colliders and obstacle generation", () => {
  const straight = createEndlessPath(123, {
    mapId: "canyon",
    width: 20,
    curves: "straight",
    obstacles: "off",
  });
  assert.equal(straight.center(80), 0);
  assert.equal(straight.center(500), 0);
  const curve = createEndlessPath(123, {
    width: 16,
    curves: "sweeping",
    obstacles: "dense",
    destruction: true,
  });
  const same = createEndlessPath(123, { curves: "sweeping" });
  assert.equal(curve.center(300), same.center(300));
  assert.notEqual(curve.center(300), 0);
  const grid = createEndlessRaceLayout(straight).grid;
  assert.equal(grid.length, 8);
  assert(grid.every((slot) => Math.abs(slot.lane) < straight.width / 2));
  const empty = createChunk(straight, 0),
    dense = createChunk(curve, 1);
  try {
    assert.equal(empty.userData.obstacles.length, 0);
    assert.equal(dense.userData.obstacles.length, 1);
    assert(dense.userData.obstacles[0].breakable);
    assert.equal(Math.abs(empty.userData.barriers[0].x), 10.65);
  } finally {
    disposeChunk(empty);
    disposeChunk(dense);
  }
});

test("old maps migrate to solo coast; the two additional maps preserve competition and selection", () => {
  assert.deepEqual(MAPS.map(map => map.id), ["coast", "canyon", "neon"]);
  assert.equal(normalizeMap({ width: 16 }).mapId, "coast");
  assert(getMapDefinition(normalizeMap()).training);
  const records = new Map(), storage = { getItem: k => records.get(k), setItem: (k, value) => records.set(k, value) };
  for (const map of MAPS) {
    const settings = normalizeMap({ mapId: map.id, seed: 123, width: 20, curves: "sweeping", obstacles: "dense" });
    saveMap(storage, settings); assert.deepEqual(loadMap(storage), settings);
    const layout = createEndlessRaceLayout(createEndlessPath(settings.seed, settings));
    assert.equal(layout.training, map.training); assert.equal(layout.grid.length, map.training ? 1 : 8);
    assert.equal(layout.maxPlayers, map.training ? 1 : 8);
    if (map.training) assert.equal(layout.grid[0].lane, 0);
  }
  assert.equal(normalizeMap({ mapId: "unknown" }).mapId, "coast");
  assert.equal(getMapDefinition({ mapId: "neon", training: true }).training, false, "saved flags cannot alter a map's mode");
});

test("canyon and neon chunks have distinct scenery while keeping road barriers and obstacles", () => {
  const colors = [], scenery = [];
  for (const mapId of ["coast", "canyon", "neon"]) {
    const path = createEndlessPath(123, { mapId, width: 16, curves: "straight", obstacles: "dense" });
    const chunk = createChunk(path, 1);
    try {
      assert.equal(chunk.userData.mapId, mapId); scenery.push(chunk.userData.scenery);
      assert.equal(chunk.userData.barriers.length, 64); assert.equal(chunk.userData.obstacles.length, 1);
      assert.equal(Math.abs(chunk.userData.barriers[0].x), 8.65);
      const palette = new Set(); let maximumHeight = 0, emissive = false;
      chunk.traverse(object => {
        if (!object.isMesh) return;
        palette.add(object.material.color.getHex()); emissive ||= object.material.emissive?.getHex() > 0;
        const position = object.geometry.getAttribute("position");
        for (let i = 0; i < position.count; i++) maximumHeight = Math.max(maximumHeight, position.getY(i));
      });
      colors.push([...palette].sort().join(","));
      if (mapId === "neon") assert(emissive && maximumHeight > 10, "neon should contain glowing lighting and city towers");
      if (mapId === "canyon") assert(maximumHeight > 10, "canyon should contain tall rock formations");
    } finally { disposeChunk(chunk); }
  }
  assert.equal(new Set(colors).size, 3); assert.equal(new Set(scenery).size, 3);
});

test("switching and riding the new maps updates atmosphere and keeps streamed geometry bounded", () => {
  const scene = new context.THREE.Scene(); scene.fog = new context.THREE.Fog("#ffffff", 140, 320);
  const world = createEndlessWorld(scene, 123);
  const skies = [];
  try {
    for (const mapId of ["coast", "canyon", "neon"]) {
      world.reset(123, { mapId, width: 16 }); world.update(20000);
      assert.equal(world.chunkCount, 9); assert.equal(world.path.options.mapId, mapId);
      assert([...world.chunks.values()].every(chunk => chunk.userData.mapId === mapId));
      skies.push(scene.background.getHex()); assert.equal(scene.fog.color.getHex(), scene.background.getHex());
      assert.equal(world.root.name, "endless-" + mapId);
    }
    assert.equal(new Set(skies).size, 3);
  } finally { world.dispose(); }
  assert.equal(scene.children.length, 0);
});
