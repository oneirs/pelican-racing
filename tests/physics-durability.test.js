import test from "node:test";
import assert from "node:assert/strict";
import { createRiderPhysics } from "../src/physics/rider-physics.js";

class Vec {
  constructor(x, y, z) { Object.assign(this, { x, y, z }); }
  clone() { return new Vec(this.x, this.y, this.z); }
  addScaledVector(v, scale) {
    this.x += v.x * scale; this.y += v.y * scale; this.z += v.z * scale;
    return this;
  }
}
const path = {
  width: 12, height: 0.22,
  sample(distance, lane = 0) {
    return { point: new Vec(lane, this.height, -distance), normal: new Vec(1, 0, 0), tangent: new Vec(0, 0, -1) };
  },
};
function chunks() {
  return new Map(Array.from({ length: 9 }, (_, index) => [index - 2, { userData: { barriers: [] } }]));
}
function step(sim, state, count) {
  for (let index = 0; index < count; index++) sim.update(1 / 120, state);
}
function damageIds(snapshot) {
  return Object.entries(snapshot.parts).filter(([, part]) => part.current < part.max).map(([id]) => id);
}
async function barrelFixture({ breakable = false, parts } = {}) {
  const sim = await createRiderPhysics(), road = chunks();
  road.get(0).userData.obstacles = [{ x: 0, y: 0.72, z: -15, radius: 0.42, halfHeight: 0.5, mass: 12, breakable }];
  sim.reset(path, road, { distance: 0, lane: 0 }, parts);
  const state = { running: true, throttleInput: 0, targetKmh: 60, desiredLane: 0, time: 0, distance: 0 };
  let barrel;
  sim.world.forEachRigidBody(body => {
    if (body.handle !== sim.body.handle && body.isDynamic()) barrel = body;
  });
  assert(barrel, "barrel fixture did not create a dynamic obstacle");
  sim.update(0, state);
  return { sim, state, barrel };
}
function hitBarrel({ sim, state, barrel }, kmh = 60) {
  const previous = state.collisionCount;
  barrel.setTranslation({ x: 0, y: 0.72, z: -15 }, true);
  barrel.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  barrel.setLinvel({ x: 0, y: 0, z: 0 }, true);
  barrel.setAngvel({ x: 0, y: 0, z: 0 }, true);
  sim.body.setTranslation({ x: 0, y: path.height + 0.72, z: -13.65 }, true);
  sim.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  sim.body.setLinvel({ x: 0, y: 0, z: -kmh / 3.6 }, true);
  sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  sim.world.propagateModifiedBodyPositionsToColliders();
  let impactKmh;
  for (let index = 0; index < 30 && state.collisionCount === previous; index++) {
    const v = sim.body.linvel();
    impactKmh = Math.hypot(v.x, v.z) * 3.6;
    sim.update(1 / 120, state);
  }
  assert(state.collisionCount > previous, "fixture missed the barrel");
  return impactKmh;
}
function landUpright({ sim, state }) {
  sim.body.setTranslation({ x: 3, y: path.height + 0.72, z: -32 }, true);
  sim.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  sim.body.setEnabledRotations(false, false, false, true);
  sim.world.propagateModifiedBodyPositionsToColliders();
  for (let index = 0; index < 180 && state.crashed; index++) sim.update(1 / 120, state);
  assert(!state.crashed && state.grounded, "upright fixture did not land naturally");
}
async function breakOnePart() {
  const fixture = await barrelFixture();
  try {
    for (let hit = 0; hit < 20; hit++) {
      hitBarrel(fixture);
      if (Object.values(fixture.state.partDurability.parts).some(part => part.broken)) return fixture;
      landUpright(fixture);
    }
    assert.fail("repeated physical impacts never broke a local part");
  } catch (error) { fixture.sim.dispose(); throw error; }
}

test("ordinary 60 km/h barrel impact damages local parts without breaking the whole rider", async () => {
  const fixture = await barrelFixture();
  try {
    hitBarrel(fixture);
    const parts = fixture.state.partDurability;
    const damaged = damageIds(parts);
    assert(damaged.length > 0 && damaged.length <= 3, `impact spread damage across too many parts: ${damaged}`);
    for (const id of ["body", "head", "beak", "wing-left", "wing-right", "leg-left", "leg-right"])
      assert.equal(parts.parts[id].current, parts.parts[id].max, `ordinary chassis contact damaged the pelican's ${id}`);
    assert(Object.values(parts.parts).every(part => part.current > 0 && !part.broken), "ordinary impact detached body parts");
    assert(fixture.state.crashed, "test did not exercise a hard collision");
    assert.equal(fixture.sim.debrisCount, 0, "ordinary contact emitted whole-object debris");
    assert(fixture.sim.drainEffects().every(effect => effect.type !== "break"), "ordinary contact emitted a shatter effect");
  } finally { fixture.sim.dispose(); }
});

test("repeated real barrel contacts accumulate damage until one local part reaches zero", async () => {
  const fixture = await breakOnePart();
  try {
    const broken = Object.entries(fixture.state.partDurability.parts).filter(([, part]) => part.broken);
    assert.equal(broken.length, 1, "repeated local impacts broke unrelated parts");
    assert.equal(broken[0][1].current, 0);
    assert(broken[0][1].repairRemaining > 4.9, "newly broken part did not start its repair timer");
    assert(fixture.state.collisionCount > 1, "one collision consumed a full part's durability");
    assert(damageIds(fixture.state.partDurability).length <= 3, "local wear became whole-body wear");
  } finally { fixture.sim.dispose(); }
});

test("natural upright landing preserves damage on parts that have not broken", async () => {
  const fixture = await barrelFixture();
  try {
    hitBarrel(fixture);
    const before = structuredClone(fixture.state.partDurability.parts);
    assert(damageIds(fixture.state.partDurability).length > 0);
    landUpright(fixture);
    assert.deepEqual(fixture.state.partDurability.parts, before, "landing healed unfinished part damage");
    assert(Math.abs(fixture.state.physicsPose.x - 3) < 0.05, "natural landing reset the rider to a lane");
  } finally { fixture.sim.dispose(); }
});

test("pause freezes part HP and repair time; resume ticks repair and a new race restores every part", async () => {
  const fixture = await breakOnePart();
  const { sim, state } = fixture;
  try {
    const brokenId = Object.keys(state.partDurability.parts).find(id => state.partDurability.parts[id].broken);
    const before = structuredClone(state.partDurability);
    state.running = false;
    step(sim, state, 720);
    assert.deepEqual(state.partDurability, before, "paused durability or repair countdown changed");
    state.running = true;
    step(sim, state, 24);
    assert(state.partDurability.parts[brokenId].repairRemaining < before.parts[brokenId].repairRemaining - 0.15,
      "resumed simulation did not advance repair countdown");
    sim.reset(path, chunks(), { distance: 0, lane: 0 });
    sim.update(0, state);
    assert(Object.values(state.partDurability.parts).every(part => part.current === part.max && !part.broken && part.repairRemaining === 0),
      "starting a new race retained damage or detached parts");
  } finally { sim.dispose(); }
});

test("impact above the 200 km/h threshold breaks the obstacle without wearing the rider", async () => {
  // A small margin keeps the actual contact above 200 after drag and Float32 storage.
  for (const kmh of [200.1, 250]) {
    const fixture = await barrelFixture({ breakable: true, parts: { drive: "balanced", rocket: "boost" } });
    try {
      const before = structuredClone(fixture.state.partDurability.parts);
      const impactKmh = hitBarrel(fixture, kmh);
      assert(impactKmh >= 200, `fixture slowed below the smash threshold: ${impactKmh}`);
      assert.equal(fixture.state.destroyedCount, 1, `${kmh} km/h contact did not smash the obstacle`);
      assert(!fixture.state.crashed, `${kmh} km/h launch / actual impact ${impactKmh} km/h`);
      assert.deepEqual(fixture.state.partDurability.parts, before, "clean smash consumed player durability");
      assert(fixture.sim.debrisCount > 0, "smashed obstacle emitted no physical fragments");
    } finally { fixture.sim.dispose(); }
  }
});

test("a shallow guardrail scrape produces friction feedback without wearing rider parts", async () => {
  const sim = await createRiderPhysics(), road = chunks();
  road.get(0).userData.barriers = [{ x: 0.7, y: 0.87, z: -25, half: [0.1, 0.6, 35], yaw: 0 }];
  sim.reset(path, road, { distance: 0, lane: 0 });
  const state = { running: true, throttleInput: 0, targetKmh: 108, time: 0, distance: 0 };
  sim.body.setTranslation({ x: 0.2, y: 1.25, z: -10 }, true);
  sim.body.setLinvel({ x: 4, y: 0, z: -30 }, true);
  sim.world.propagateModifiedBodyPositionsToColliders();
  sim.update(0, state);
  try {
    const before = structuredClone(state.partDurability.parts);
    for (let index = 0; index < 30 && state.collisionCount === 0; index++) sim.update(1 / 120, state);
    assert(state.collisionCount > 0, "fixture missed the rail");
    assert(!state.crashed, "shallow scrape launched the rider");
    assert(sim.drainEffects().some(effect => effect.type === "scrape"), "rail contact produced no scrape feedback");
    assert.deepEqual(state.partDurability.parts, before, "light rail friction consumed part HP");
  } finally { sim.dispose(); }
});

test("a 45-degree tilted fall wears the first landing leg without shattering the pelican", async () => {
  const fixture = await barrelFixture();
  const { sim, state } = fixture;
  try {
    hitBarrel(fixture);
    const before = structuredClone(state.partDurability.parts);
    sim.body.setTranslation({ x: 3, y: 2.6, z: -30 }, true);
    sim.body.setRotation({ x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) }, true);
    sim.body.setLinvel({ x: 0, y: -6, z: 0 }, true);
    sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    // Hold the impact angle so Rapier tests the leg-first ground contact,
    // independently of the game's airborne balance assistance.
    sim.body.setEnabledRotations(false, false, false, true);
    sim.world.propagateModifiedBodyPositionsToColliders();
    for (let index = 0; index < 120 && state.partDurability.parts["leg-left"].current === before["leg-left"].current; index++)
      sim.update(1 / 120, state);
    const after = state.partDurability.parts;
    assert(after["leg-left"].current < before["leg-left"].current, "tilted ground impact did not damage the landing leg");
    assert.equal(after["leg-right"].current, before["leg-right"].current, "fall damaged the opposite leg");
    assert.equal(after["wing-left"].current, before["wing-left"].current, "leg-first tilt was classified as a flat side landing");
    assert(Object.values(after).every(part => part.current > 0 && !part.broken), "one tilted fall shattered pelican parts");
  } finally { sim.dispose(); }
});
