import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRiderPhysics } from "../src/physics/rider-physics.js";
import { loadPhysics } from "../src/physics/engine.js";

const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
globalThis.window = { THREE: context.THREE };
const { createEndlessPath } = await import("../src/world/endless/path.js");
const { createChunk, disposeChunk } = await import("../src/world/endless/chunk.js");
delete globalThis.window;

const state = () => ({ running: true, targetKmh: 220, throttleInput: 0, desiredLane: 0, time: 0, distance: 0 });
const road = () => new Map(Array.from({ length: 9 }, (_, i) => [i - 2, { userData: { barriers: [] } }]));

test("seeded chunks create ramp and bumps with matching physical ground; obstacle setting disables terrain", async () => {
  const path = createEndlessPath(17, { curves: "straight", obstacles: "dense" });
  const ramp = createChunk(path, 1), bumps = createChunk(path, 4);
  const disabled = createChunk(createEndlessPath(17, { curves: "straight", obstacles: "off" }), 1);
  const sim = await createRiderPhysics();
  try {
    assert.equal(ramp.userData.terrain[0].kind, "ramp");
    assert.equal(bumps.userData.terrain[0].kind, "bumps");
    assert.equal(disabled.userData.terrain.length, 0);
    const chunks = road(); chunks.set(1, { userData: { terrain: ramp.userData.terrain } });
    sim.reset(path, chunks, { distance: 0, lane: 0 });
    const terrain = ramp.userData.terrain[0], v = terrain.vertices;
    const x = (v[6] + v[9]) / 2, z = (v[8] + v[11]) / 2 - 64;
    const R = await loadPhysics();
    const hit = sim.world.castRay(new R.Ray({ x, y: 10, z }, { x: 0, y: -1, z: 0 }), 15, true);
    assert(hit, "physical ramp was not hit by a downward ray");
    assert(Math.abs((10 - hit.timeOfImpact) - (path.height + 0.715)) < 0.04, `incorrect physical ramp height: ${10 - hit.timeOfImpact}`);
  } finally { sim.dispose(); disposeChunk(ramp); disposeChunk(bumps); disposeChunk(disabled); }
});

test("collectibles are deterministic and remain separate from obstacles", () => {
  const path = createEndlessPath(18, { curves: "straight", obstacles: "off" });
  const a = createChunk(path, 0), b = createChunk(path, 2), again = createChunk(path, 0);
  try {
    assert.equal(a.userData.pickups[0].kind, "boost");
    assert.equal(b.userData.pickups[0].kind, "repair");
    assert.equal(a.userData.pickups[0].x, again.userData.pickups[0].x);
    assert.equal(a.userData.obstacles.length, 0);
  } finally { disposeChunk(a); disposeChunk(b); disposeChunk(again); }
});

test("a high-speed pass collects once, pauses the boost timer, and new races reset it", async () => {
  const path = createEndlessPath(18, { curves: "straight", obstacles: "off" });
  const chunks = road(), mesh = { visible: true };
  chunks.get(0).userData.pickups = [{ kind: "boost", x: 0, y: 1, z: -5, mesh }];
  const sim = await createRiderPhysics(), s = state();
  sim.reset(path, chunks, { distance: 0, lane: 0 }, { rocket: "boost", drive: "balanced" });
  try {
    sim.body.setTranslation({ x: 0, y: 1, z: -3.5 }, true);
    sim.body.setLinvel({ x: 0, y: 0, z: -130 }, true);
    for (let i = 0; i < 5; i++) sim.update(1 / 120, s);
    assert(!mesh.visible); assert(s.pickupBoostRemaining > 5.9);
    const before = s.pickupBoostRemaining;
    s.running = false;
    for (let i = 0; i < 60; i++) sim.update(1 / 60, s);
    assert.equal(s.pickupBoostRemaining, before);
    s.running = true; sim.update(0.1, s);
    assert(s.pickupBoostRemaining < before);
    sim.reset(path, road(), { distance: 0, lane: 0 }); sim.update(0, s);
    assert.equal(s.pickupBoostRemaining, 0);
  } finally { sim.dispose(); }
});

test("a repair pickup restores real collision wear when collected", async () => {
  const path = createEndlessPath(18, { curves: "straight", obstacles: "off" });
  const chunks = road(), marker = { visible: true };
  chunks.get(0).userData.obstacles = [{ x: 0, y: 0.72, z: -15, radius: 0.42, halfHeight: 0.5, mass: 12, breakable: false }];
  chunks.get(0).userData.pickups = [{ kind: "repair", x: 3, y: 1.1, z: -32, mesh: marker }];
  const sim = await createRiderPhysics(), s = state();
  sim.reset(path, chunks, { distance: 0, lane: 0 });
  try {
    sim.body.setTranslation({ x: 0, y: 0.94, z: -13.65 }, true);
    sim.body.setLinvel({ x: 0, y: 0, z: -60 / 3.6 }, true);
    sim.world.propagateModifiedBodyPositionsToColliders();
    for (let i = 0; i < 30 && !s.crashed; i++) sim.update(1 / 120, s);
    assert(s.partDurability.totalCurrent < s.partDurability.totalMax, "fixture did not cause collision wear");
    sim.body.setTranslation({ x: 3, y: 0.94, z: -32 }, true);
    sim.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    sim.body.setEnabledRotations(false, false, false, true);
    sim.world.propagateModifiedBodyPositionsToColliders();
    for (let i = 0; i < 180 && (s.crashed || marker.visible); i++) sim.update(1 / 120, s);
    assert.equal(marker.visible, false);
    assert.equal(s.partDurability.totalCurrent, s.partDurability.totalMax);
    assert.match(s.pickupNotice, /维修道具/);
  } finally { sim.dispose(); }
});

test("boost pickup increases acceleration while preserving the equipment speed limit", async () => {
  const path = createEndlessPath(18, { curves: "straight", obstacles: "off" });
  const boostedRoad = road(), normalRoad = road();
  boostedRoad.get(0).userData.pickups = [{ kind: "boost", x: 0, y: 1, z: 0, mesh: { visible: true } }];
  const boosted = await createRiderPhysics(), normal = await createRiderPhysics();
  const a = { ...state(), throttleInput: 1 }, b = { ...state(), throttleInput: 1 };
  boosted.reset(path, boostedRoad, { distance: 0, lane: 0 });
  normal.reset(path, normalRoad, { distance: 0, lane: 0 });
  try {
    for (let i = 0; i < 120; i++) { boosted.update(1 / 120, a); normal.update(1 / 120, b); }
    assert(a.pickupBoostRemaining > 4.5);
    assert(a.velocity > b.velocity + 0.5, `boost did not improve acceleration: ${a.velocity} vs ${b.velocity}`);
    assert(a.velocity <= 220 / 3.6 + 0.05);
  } finally { boosted.dispose(); normal.dispose(); }
});

test("competitive finish line is generated at 5 km while the training map stays endless", () => {
  const competition = createEndlessPath(18, { mapId: "canyon", curves: "straight" });
  const training = createEndlessPath(18, { mapId: "coast", curves: "straight" });
  const finish = createChunk(competition, Math.floor(5000 / 64));
  const noFinish = createChunk(training, Math.floor(5000 / 64));
  try { assert.equal(finish.userData.finishLine, true); assert.notEqual(noFinish.userData.finishLine, true); }
  finally { disposeChunk(finish); disposeChunk(noFinish); }
});
