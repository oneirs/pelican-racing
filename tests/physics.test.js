import test from "node:test";
import assert from "node:assert/strict";
import { createRiderPhysics } from "../src/physics/rider-physics.js";
import { MAX_SPEED_MS } from "../src/physics/config.js";
import { loadPhysics } from "../src/physics/engine.js";
// Minimal vector implementation keeps the engine tests independent of rendering.
class Vec {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  clone() {
    return new Vec(this.x, this.y, this.z);
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
}
const path = {
  width: 12,
  height: 0.22,
  sample(d, lane = 0) {
    return {
      point: new Vec(lane, 0.22, -d),
      normal: new Vec(1, 0, 0),
      tangent: new Vec(0, 0, -1),
    };
  },
};
function chunksAt(d) {
  const chunks = new Map(),
    id = Math.floor(d / 64);
  for (let i = id - 2; i <= id + 6; i++)
    chunks.set(i, { userData: { barriers: [] } });
  return chunks;
}
function state() {
  return {
    running: true,
    targetKmh: 500,
    throttleInput: 1,
    desiredLane: 0,
    time: 0,
    distance: 0,
  };
}
async function setup() {
  const sim = await createRiderPhysics();
  sim.reset(path, chunksAt(0), { distance: 0, lane: 0 });
  return sim;
}
function advance(sim, s, seconds, dt = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    sim.syncChunks(chunksAt(s.distance));
    sim.update(dt, s);
  }
}
test("reaches 500 km/h from rest under wheel force; origin and collider counts stay bounded", async () => {
  const sim = await setup(),
    s = state();
  sim.reset(path, chunksAt(0), { distance: 0, lane: 0 }, { drive: "balanced", rocket: "boost" });
  try {
    advance(sim, s, 25);
    assert(s.velocity > MAX_SPEED_MS - 0.6, `speed ${s.velocity * 3.6}`);
    assert(s.velocity <= MAX_SPEED_MS + 0.01);
    assert(s.distance > 1000);
    assert(Math.abs(sim.body.translation().z) < 260);
    assert.equal(sim.chunkCount, 9);
    assert.equal(sim.colliderCount, 10);
    assert(s.grounded);
    assert(s.physicsPose.y > 0.7 && s.physicsPose.y < 1.1);
  } finally {
    sim.dispose();
  }
});
test("steers through tire forces and brakes to a stop", async () => {
  const sim = await setup(),
    s = state();
  s.targetKmh = 60;
  try {
    advance(sim, s, 4);
    s.steerInput = 1;
    advance(sim, s, 0.4);
    assert(s.lane > 0.2, `manual steering failed: lane ${s.lane}`);
    s.steerInput = 0;
    s.targetKmh = 0;
    advance(sim, s, 4);
    assert(s.velocity < 0.25, `speed ${s.velocity}`);
  } finally {
    sim.dispose();
  }
});
test("CCD prevents tunneling through a thin obstacle at 500 km/h", async () => {
  const sim = await setup(),
    s = state(),
    R = await loadPhysics();
  sim.reset(path, chunksAt(0), { distance: 0, lane: 0 }, { drive: "balanced", rocket: "boost" });
  try {
    sim.world.createCollider(
      R.ColliderDesc.cuboid(10, 2, 0.03).setTranslation(0, 2, -60),
    );
    sim.body.setLinvel({ x: 0, y: 0, z: -MAX_SPEED_MS }, true);
    advance(sim, s, 0.7);
    assert(s.distance < 60, `passed wall at ${s.distance}`);
    assert(s.velocity < 15, `impact failed ${s.velocity}`);
  } finally {
    sim.dispose();
  }
});
test("pause freezes physics and fixed timestep agrees across render rates", async () => {
  const a = await setup(),
    b = await setup(),
    sa = state(),
    sb = state();
  sa.targetKmh = sb.targetKmh = 80;
  try {
    advance(a, sa, 6, 1 / 30);
    advance(b, sb, 6, 1 / 120);
    assert(Math.abs(sa.distance - sb.distance) < 0.2);
    const d = sa.distance;
    sa.running = false;
    advance(a, sa, 2);
    assert.equal(sa.distance, d);
  } finally {
    a.dispose();
    b.dispose();
  }
});

test("barrel collision transfers momentum, slows the rider and releases chunk bodies", async () => {
  const sim = await createRiderPhysics(),
    s = state();
  const chunks = chunksAt(0);
  const rendered = {
    position: {
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    },
    quaternion: {
      copy(q) {
        Object.assign(this, q);
      },
    },
  };
  chunks.get(0).userData.obstacles = [
    {
      x: 0,
      y: 0.72,
      z: -15,
      radius: 0.42,
      halfHeight: 0.5,
      mass: 12,
      mesh: rendered,
    },
  ];
  sim.reset(path, chunks, { distance: 0, lane: 0 });
  try {
    sim.body.setLinvel({ x: 0, y: 0, z: -MAX_SPEED_MS }, true);
    let collided = false;
    for (let i = 0; i < 60; i++) {
      sim.update(1 / 120, s);
      if (s.collisionCount > 0) {
        assert(s.velocity < MAX_SPEED_MS - 1, `no speed loss: ${s.velocity}`);
        assert(s.impact > 0);
        collided = true;
        break;
      }
    }
    assert(collided, "rider missed the barrel");
    for (let i = 0; i < 24; i++) sim.update(1 / 120, s);
    assert(
      rendered.position.z < -16,
      `barrel did not move: ${rendered.position.z}`,
    );
    assert.equal(sim.colliderCount, 11);
    chunks.delete(0);
    sim.syncChunks(chunks);
    assert.equal(sim.colliderCount, 9, "ground and barrel must both unload");
    sim.reset(path, chunksAt(0), { distance: 0, lane: 0 });
    sim.update(0, s);
    assert.equal(s.collisionCount, 0);
    assert.equal(s.impact, 0);
  } finally {
    sim.dispose();
  }
});

test("hard impact launches and tumbles the rider, pauses, then restores riding", async () => {
  const sim = await createRiderPhysics(),
    s = state(),
    chunks = chunksAt(0);
  chunks.get(0).userData.obstacles = [
    { x: 0, y: 0.72, z: -15, radius: 0.42, halfHeight: 0.5, mass: 12 },
  ];
  sim.reset(path, chunks, { distance: 0, lane: 0 });
  try {
    s.targetKmh = 60;
    sim.body.setLinvel({ x: 0, y: 0, z: -60 / 3.6 }, true);
    for (let i = 0; i < 180 && !s.crashed; i++) sim.update(1 / 120, s);
    assert(s.crashed, "hard collision did not trigger flight");
    assert(sim.body.linvel().y > 4, "missing upward launch");
    for (let i = 0; i < 36; i++) sim.update(1 / 120, s);
    assert(s.physicsPose.y > 1.8, `not airborne: ${s.physicsPose.y}`);
    assert(
      Math.hypot(s.physicsPose.rotation.x, s.physicsPose.rotation.z) > 0.2,
      "body stayed upright",
    );
    assert(!s.grounded);
    const remaining = s.crashRemaining,
      position = { ...sim.body.translation() };
    s.running = false;
    for (let i = 0; i < 120; i++) sim.update(1 / 60, s);
    assert.equal(s.crashRemaining, remaining);
    assert.deepEqual({ ...sim.body.translation() }, position);
    s.running = true;
    let landedAfter = 0;
    while (s.crashed && landedAfter < 10) { sim.update(1 / 120, s); landedAfter += 1 / 120; }
    assert(landedAfter < 10, "rider neither landed nor recovered after leaving the air");
    assert(!s.crashed, "recovery failed");
    assert(s.grounded, "wheels did not resume contact");
    advance(sim, s, 1.5);
    assert(s.velocity > 1, "drive did not resume");
    assert(Math.hypot(s.physicsPose.rotation.x, s.physicsPose.rotation.z) < 0.2, `automatic balance failed ${JSON.stringify({pose:s.physicsPose,vel:sim.body.angvel(),crashed:s.crashed})}`);
  } finally {
    sim.dispose();
  }
});

test("low-speed contact moves the barrel without launching the rider", async () => {
  const sim = await createRiderPhysics(),
    s = state(),
    chunks = chunksAt(0);
  chunks.get(0).userData.obstacles = [
    { x: 0, y: 0.72, z: -3, radius: 0.42, halfHeight: 0.5, mass: 12 },
  ];
  sim.reset(path, chunks, { distance: 0, lane: 0 });
  s.targetKmh = 18;
  try {
    sim.body.setLinvel({ x: 0, y: 0, z: -5 }, true);
    for (let i = 0; i < 180; i++) {
      sim.update(1 / 120, s);
      assert(!s.crashed);
    }
    assert(s.collisionCount > 0);
  } finally {
    sim.dispose();
  }
});

test("power thighs and carbon frame improve physical acceleration; gearing caps actual speed", async () => {
  const base = await setup(),
    modified = await setup(),
    a = state(),
    b = state();
  try {
    modified.reset(
      path,
      chunksAt(0),
      { distance: 0, lane: 0 },
      { thighs: "power", frame: "carbon", drive: "torque" },
    );
    assert(Math.abs(modified.body.mass() - 70) < 0.01);
    advance(base, a, 1.2);
    advance(modified, b, 1.2);
    assert(
      b.velocity > a.velocity * 1.15,
      `acceleration unchanged ${a.velocity} / ${b.velocity}`,
    );
    advance(modified, b, 15);
    assert(
      b.velocity * 3.6 > 319 && b.velocity * 3.6 <= 320.01,
      `gear cap ${b.velocity * 3.6}`,
    );
    modified.reset(path, chunksAt(0), { distance: 0, lane: 0 });
    assert(
      Math.abs(modified.body.mass() - 80) < 0.01,
      "stock reset leaked upgrades",
    );
  } finally {
    base.dispose();
    modified.dispose();
  }
});

test("grip tires reach the Rapier wheels and increase real braking", async () => {
  const base = await setup(),
    modified = await setup(),
    a = state(),
    b = state();
  try {
    modified.reset(
      path,
      chunksAt(0),
      { distance: 0, lane: 0 },
      { tires: "grip" },
    );
    assert(Math.abs(modified.vehicle.wheelFrictionSlip(0) - 4.5) < 0.001);
    a.targetKmh = b.targetKmh = 100;
    advance(base, a, 4);
    advance(modified, b, 4);
    a.targetKmh = b.targetKmh = 0;
    advance(base, a, 0.6);
    advance(modified, b, 0.6);
    assert(
      b.velocity < a.velocity - 1,
      `braking unchanged ${a.velocity}/${b.velocity}`,
    );
  } finally {
    base.dispose();
    modified.dispose();
  }
});

async function collideWithParts(parts) {
  const sim = await createRiderPhysics(),
    s = state(),
    chunks = chunksAt(0);
  chunks.get(0).userData.obstacles = [
    { x: 0, y: 0.72, z: -15, radius: 0.42, halfHeight: 0.5, mass: 12 },
  ];
  sim.reset(path, chunks, { distance: 0, lane: 0 }, parts);
  s.targetKmh = 60;
  sim.body.setLinvel({ x: 0, y: 0, z: -60 / 3.6 }, true);
  for (let i = 0; i < 180 && !s.crashed; i++) sim.update(1 / 120, s);
  if (!s.crashed) {
    sim.dispose();
    throw new Error("test impact did not launch");
  }
  return { sim, s };
}
test("all equipment uses a five-second off-track rescue; glide wings alter airborne gravity", async () => {
  const a = await collideWithParts(),
    b = await collideWithParts({ head: "guard", wings: "glide" });
  try {
    assert.equal(a.s.crashRemaining, 5);
    assert.equal(b.s.crashRemaining, 5);
    assert(Math.abs(b.sim.body.gravityScale() - 0.65) < 0.001);
    const ay = a.sim.body.linvel().y,
      by = b.sim.body.linvel().y;
    for (let i = 0; i < 36; i++) {
      a.sim.update(1 / 120, a.s);
      b.sim.update(1 / 120, b.s);
    }
    assert(
      by - b.sim.body.linvel().y < ay - a.sim.body.linvel().y,
      "glide did not slow falling",
    );
    b.sim.body.setTranslation({ x: 30, y: 5, z: -25 }, true);
    b.sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    const stepsToRescue = Math.ceil(b.s.crashRemaining * 120 - 1e-6);
    for (let i = 0; i < stepsToRescue - 1; i++) b.sim.update(1 / 120, b.s);
    assert(b.s.crashed, "off-track rescue happened before 5 seconds");
    b.sim.update(1 / 120, b.s);
    assert(!b.s.crashed);
    assert.equal(b.sim.body.gravityScale(), 1, "gravity not restored");
  } finally {
    a.sim.dispose();
    b.sim.dispose();
  }
});

test("strong impact breaks a barrel into physical debris; pause, expiry and reset clean up", async () => {
  const sim = await createRiderPhysics(),
    s = state(),
    chunks = chunksAt(0);
  const rendered = {
    visible: true,
    position: { set() {} },
    quaternion: { copy() {} },
  };
  chunks.get(0).userData.obstacles = [
    {
      x: 0,
      y: 0.72,
      z: -15,
      radius: 0.42,
      halfHeight: 0.5,
      mass: 12,
      breakable: true,
      mesh: rendered,
    },
  ];
  sim.reset(path, chunks, { distance: 0, lane: 0 });
  s.targetKmh = 100;
  sim.body.setLinvel({ x: 0, y: 0, z: -100 / 3.6 }, true);
  try {
    for (let i = 0; i < 180 && !s.destroyedCount; i++) sim.update(1 / 120, s);
    assert.equal(s.destroyedCount, 1);
    assert.equal(rendered.visible, false);
    assert(sim.debrisCount >= 6 && sim.debrisCount <= 12);
    assert.equal(
      sim.colliderCount,
      10 + sim.debrisCount,
      "original barrel collider must be removed",
    );
    const events = sim.drainEffects();
    assert(events.some((e) => e.type === "impact"));
    assert.equal(events.filter((e) => e.type === "break").length, 1);
    assert(
      events.every((e) => [e.x, e.y, e.z, e.strength].every(Number.isFinite)),
    );
    assert.equal(sim.drainEffects().length, 0);
    const before = structuredClone(s.debris);
    s.running = false;
    sim.update(0.1, s);
    assert.deepEqual(s.debris, before);
    s.running = true;
    sim.update(0.1, s);
    assert.notDeepEqual(s.debris, before, "debris must move under physics");
    for (let i = 0; i < 500; i++) sim.update(1 / 120, s);
    assert.equal(sim.debrisCount, 0);
    assert.equal(sim.colliderCount, 10);
    sim.reset(path, chunks, { distance: 0, lane: 0 });
    sim.update(0, s);
    assert.equal(s.destroyedCount, 0);
    assert.equal(rendered.visible, true);
    assert.equal(sim.debrisCount, 0);
  } finally {
    sim.dispose();
  }
});

test("gentle bump keeps a breakable barrel intact; disabled destruction also keeps it intact", async () => {
  for (const [speed, breakable] of [
    [5, true],
    [40, false],
  ]) {
    const sim = await createRiderPhysics(),
      s = state(),
      chunks = chunksAt(0);
    chunks.get(0).userData.obstacles = [
      {
        x: 0,
        y: 0.72,
        z: -3,
        radius: 0.42,
        halfHeight: 0.5,
        mass: 12,
        breakable,
      },
    ];
    sim.reset(path, chunks, { distance: 0, lane: 0 });
    s.targetKmh = speed * 3.6;
    sim.body.setLinvel({ x: 0, y: 0, z: -speed }, true);
    try {
      for (let i = 0; i < 160; i++) sim.update(1 / 120, s);
      assert(s.collisionCount > 0);
      assert.equal(s.destroyedCount, 0);
      assert.equal(sim.debrisCount, 0);
    } finally {
      sim.dispose();
    }
  }
});

test("scraping a rail emits repeated contact sparks but free travel does not", async () => {
  const sim = await createRiderPhysics(),
    s = state(),
    chunks = chunksAt(0);
  chunks.get(0).userData.barriers = [
    { x: 0.6, y: 0.87, z: -25, half: [0.09, 0.5, 25], yaw: 0 },
  ];
  sim.reset(path, chunks, { distance: 0, lane: 0 });
  s.targetKmh = 36;
  s.desiredLane = 0.22;
  sim.body.setTranslation({ x: 0.22, y: 0.8, z: -2 }, true);
  sim.body.setLinvel({ x: 0.5, y: 0, z: -10 }, true);
  try {
    let scrapes = 0;
    for (let i = 0; i < 200; i++) {
      sim.update(1 / 120, s);
      scrapes += sim.drainEffects().filter((e) => e.type === "scrape").length;
    }
    assert(scrapes > 1, `expected continuous scrape, got ${scrapes}`);
    sim.reset(path, chunksAt(0), { distance: 0, lane: 0 });
    s.desiredLane = 0;
    for (let i = 0; i < 120; i++) sim.update(1 / 120, s);
    assert.equal(
      sim.drainEffects().filter((e) => e.type === "scrape").length,
      0,
    );
  } finally {
    sim.dispose();
  }
});

test("debris stays bounded and unloads with its owning chunk", async () => {
  const R = await loadPhysics();
  const { createDebris, MAX_DEBRIS } = await import("../src/physics/debris.js");
  const world = new R.World({ x: 0, y: -9.81, z: 0 }),
    debris = createDebris(R, world);
  try {
    for (let i = 0; i < 20; i++)
      debris.burst(
        { x: i, y: 2, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: 0, z: -10 },
        1,
        i,
      );
    assert.equal(debris.count, MAX_DEBRIS);
    assert.equal(world.colliders.len(), MAX_DEBRIS);
    debris.syncChunks(new Map());
    assert.equal(debris.count, 0);
    assert.equal(world.colliders.len(), 0);
  } finally {
    world.free();
  }
});

test("dedicated brake overrides a 500 km/h target and stops pedaling", async () => {
  const sim = await setup(), s = state();
  try {
    advance(sim, s, 4);
    const speed = s.velocity;
    assert(s.cadenceRpm > 0);
    s.brakeInput = true;
    advance(sim, s, 0.5);
    assert(s.braking);
    assert(s.velocity < speed - 5);
    assert.equal(s.cadenceRpm, 0);
    const phase = s.phase;
    advance(sim, s, 7);
    assert(s.velocity < 0.25, `brake did not stop: ${s.velocity}`);
    assert.equal(s.phase, phase);
    s.brakeInput = false;
    advance(sim, s, 1);
    assert(s.cadenceRpm > 0);
    assert(s.phase > phase);
  } finally { sim.dispose(); }
});

test("high-speed breakable impacts preserve speed and balance; slower hits still launch", async () => {
  for (const kmh of [180, 250, 500]) {
    const sim = await createRiderPhysics(), s = state(), chunks = chunksAt(0);
    chunks.get(0).userData.obstacles = [{ x: 0, y: 0.72, z: -15, radius: 0.42, halfHeight: 0.5, mass: 12, breakable: true }];
    sim.reset(path, chunks, { distance: 0, lane: 0 }, { drive: "balanced", rocket: "boost" });
    s.targetKmh = kmh;
    sim.body.setLinvel({ x: 0, y: 0, z: -kmh / 3.6 }, true);
    try {
      let previousSpeed = kmh / 3.6;
      for (let i = 0; i < 180 && !s.destroyedCount; i++) {
        previousSpeed = Math.hypot(sim.body.linvel().x, sim.body.linvel().z);
        sim.update(1 / 120, s);
      }
      assert.equal(s.destroyedCount, 1);
      if (kmh >= 200) {
        assert(!s.crashed, `${kmh}: launched after smashing`);
        assert(Math.abs(s.velocity - previousSpeed) < 0.3, `${kmh}: speed lost ${previousSpeed - s.velocity}`);
        assert.equal(s.impact, 0, "clean smash must not shake camera");
        for (let i = 0; i < 40; i++) sim.update(1 / 120, s);
        assert(s.distance > 18);
        assert(!s.crashed);
      } else assert(s.crashed, "below-threshold contact should still launch");
    } finally { sim.dispose(); }
  }
});

test("natural landing retains position and rotation instead of snapping to a lane or upright pose", async () => {
  const { sim, s } = await collideWithParts();
  try {
    for (let i = 0; i < 65; i++) sim.update(1 / 120, s);
    s.desiredLane = -3;
    const tilt = 0.12;
    sim.body.setTranslation({ x: 2.7, y: path.height + 0.72, z: -42 }, true);
    sim.body.setRotation({ x: Math.sin(tilt / 2), y: 0, z: 0, w: Math.cos(tilt / 2) }, true);
    sim.body.setLinvel({ x: 0, y: -0.2, z: -2 }, true);
    sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    sim.world.propagateModifiedBodyPositionsToColliders();
    for (let i = 0; i < 80 && s.crashed; i++) sim.update(1 / 120, s);
    assert(!s.crashed, "road landing not detected");
    assert(Math.abs(sim.body.translation().x - 2.7) < 0.1, "snapped to requested lane");
    assert(s.physicsPose.rotation.x !== 0, "pose was reset to perfectly upright");
    assert(s.velocity > 0.5, "landing erased velocity");
    assert(s.landingBlend > 0, "camera landing transition missing");
  } finally { sim.dispose(); }
});

test("without steering, road curves and desired lane do not turn the bicycle", async () => {
  const sim = await createRiderPhysics(), s = state();
  const curve = { ...path, width: 80, sample(d, lane = 0) {
    const bend = 0.003 * Math.max(0, d) ** 2;
    const dx = 0.006 * Math.max(0, d), length = Math.hypot(1, dx);
    return { point: new Vec(bend + lane, 0.22, -d), normal: new Vec(1 / length, 0, dx / length), tangent: new Vec(dx / length, 0, -1 / length) };
  } };
  sim.reset(curve, chunksAt(0), { distance: 0, lane: 0 });
  s.targetKmh = 60; s.desiredLane = 8;
  try {
    advance(sim, s, 4);
    assert(Math.abs(s.physicsPose.x) < 0.2, `auto-followed curve to x=${s.physicsPose.x}`);
    assert(Math.abs(s.physicsPose.yaw) < 0.01);
    assert(Math.abs(curve.sample(s.distance).point.x) > 3, "test road did not bend enough");
    assert(Math.abs(sim.vehicle.wheelSteering(0)) < 1e-8);
  } finally { sim.dispose(); }
});

test("manual steering into a guardrail slides and sparks instead of launching", async () => {
  const sim = await createRiderPhysics(), s = state(), chunks = chunksAt(0);
  chunks.get(0).userData.barriers = [{ x: 2.1, y: 0.87, z: -35, half: [0.1, 0.6, 35], yaw: 0 }];
  sim.reset(path, chunks, { distance: 0, lane: 0 });
  s.targetKmh = 90; s.steerInput = 1;
  sim.body.setLinvel({ x: 0, y: 0, z: -25 }, true);
  try {
    for (let i = 0; i < 300 && !s.crashed; i++) sim.update(1 / 120, s);
    assert(s.collisionCount > 0, "missed guardrail");
    assert(!s.crashed, "glancing rail contact launched rider");
    assert(sim.drainEffects().some(e => e.type === "scrape"), "missing rail friction sparks");
    assert(s.distance > 20, "bike stopped sliding along rail");
  } finally { sim.dispose(); }
});

test("reverse brakes forward motion, backs up with a speed cap and stops on brake", async () => {
  const sim = await setup(), s = state();
  try {
    s.targetKmh = 60;
    advance(sim, s, 3);
    assert(s.forwardVelocity > 10);
    s.targetKmh = 500; s.throttleInput = -1;
    sim.update(1 / 120, s);
    assert(s.braking, "direction change must first brake");
    advance(sim, s, 5);
    assert(s.forwardVelocity < -5 && s.forwardVelocity > -5.7, `reverse speed ${s.forwardVelocity}`);
    const d = s.distance, phase = s.phase;
    advance(sim, s, 0.5);
    assert(s.distance < d - 2, "reverse did not move backwards");
    assert(s.phase < phase, "reverse pedals did not turn backwards");
    s.brakeInput = true;
    advance(sim, s, 2);
    assert(s.velocity < 0.25, "brakes failed while reversing");
    s.brakeInput = false; s.targetKmh = 60; s.throttleInput = 1;
    advance(sim, s, 3);
    assert(s.forwardVelocity > 10, "forward drive failed after reversing");
  } finally { sim.dispose(); }
});

test("jump leaves the road, rejects an airborne second jump, and lands without a reset", async () => {
  const sim = await setup(), s = state();
  try {
    s.targetKmh = 30;
    advance(sim, s, 1);
    const groundY = s.physicsPose.y;
    s.jumpRequested = true;
    sim.update(1 / 120, s);
    assert(sim.body.linvel().y > 4, "jump impulse missing");
    assert(!s.jumpRequested, "jump request not consumed");
    advance(sim, s, 0.25);
    assert(s.physicsPose.y > groundY + 0.6);
    assert(!s.grounded && !s.crashed);
    const vy = sim.body.linvel().y;
    s.jumpRequested = true;
    sim.update(1 / 120, s);
    assert(sim.body.linvel().y < vy, "air jump was allowed");
    advance(sim, s, 1.5);
    assert(s.grounded && !s.crashed);
    assert(Math.abs(s.physicsPose.y - groundY) < 0.2);
  } finally { sim.dispose(); }
});

test("a rider trapped on its side on the road still resets after five seconds", async () => {
  const { sim, s } = await collideWithParts();
  try {
    sim.body.setTranslation({ x: 3, y: path.height + 0.3, z: -30 }, true);
    sim.body.setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }, true);
    sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    // Constrain the fixture's roll to reproduce a bike wedged on its side.
    sim.body.setEnabledRotations(false, false, false, true);
    for (let i = 0; i < 599; i++) sim.update(1 / 120, s);
    assert(s.crashed, "sideways ground contact wrongly cancelled recovery");
    assert(Math.abs(sim.body.translation().x - 3) < 0.1);
    for (let i = 0; i < 20 && s.crashed; i++) sim.update(1 / 120, s);
    assert(!s.crashed, "failed to rescue after timeout");
    assert(Math.abs(s.physicsPose.rotation.z) < 0.01);
    assert(Math.abs(s.physicsPose.x) < 0.1);
  } finally { sim.dispose(); }
});

test("high-speed steering responds promptly while retaining manual control", async () => {
  const sim = await setup(), s = state();
  try {
    advance(sim, s, 25);
    const x = s.physicsPose.x;
    s.steerInput = 1;
    advance(sim, s, 0.5);
    assert(s.physicsPose.x > x + 1, `sluggish high-speed steering: ${s.physicsPose.x - x}`);
    assert(!s.crashed);
    s.steerInput = 0;
    sim.update(1 / 120, s);
    assert(Math.abs(sim.vehicle.wheelSteering(0)) < 1e-8);
  } finally { sim.dispose(); }
});

test("500 km/h glancing rail contact slides; direct heavy rail impact still launches", async () => {
  for (const frontal of [false, true]) {
    const sim = await createRiderPhysics(), s = state(), chunks = chunksAt(0);
    chunks.get(0).userData.barriers = [frontal
      ? { x: 0, y: 0.87, z: -10, half: [0.1, 0.6, 12], yaw: Math.PI / 2 }
      : { x: 0.7, y: 0.87, z: -25, half: [0.1, 0.6, 35], yaw: 0 }];
    sim.reset(path, chunks, { distance: 0, lane: 0 }, { drive: "balanced", rocket: "boost" });
    const forwardSpeed = frontal ? 25 : 138;
    s.targetKmh = forwardSpeed * 3.6;
    sim.body.setLinvel({ x: frontal ? 0 : 8, y: 0, z: -forwardSpeed }, true);
    try {
      let sparks = 0;
      for (let i = 0; i < 50 && !s.crashed; i++) {
        sim.update(1 / 120, s);
        sparks += sim.drainEffects().filter(e => e.type === "scrape").length;
      }
      assert(s.collisionCount > 0, "fixture missed rail");
      assert.equal(s.crashed, frontal, frontal ? "head-on collision did not launch" : "fast glancing hit launched");
      if (!frontal) {
        assert(sparks > 0);
        assert(s.velocity > 100, `rail stopped forward travel: ${s.velocity}`);
        assert(s.physicsPose.x < 0.5, "crossed guardrail");
        assert(s.physicsPose.y < 1.2, "rail bounced bike upward");
      }
    } finally { sim.dispose(); }
  }
});

test("flight above the track suspends recovery even after five seconds, then a failed landing resumes the timer", async () => {
  const { sim, s } = await collideWithParts();
  try {
    sim.body.setTranslation({ x: 0, y: 250, z: -30 }, true);
    sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    sim.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    const remaining = s.crashRemaining;
    for (let i = 0; i < 720; i++) sim.update(1 / 120, s);
    assert(s.crashed && s.recoverySuspended, "airborne rider was reset");
    assert(s.physicsPose.y > 20, "flight was teleported to ground");
    assert.equal(s.crashRemaining, remaining, "airborne recovery timer advanced");
    sim.body.setTranslation({ x: 0, y: path.height + 0.3, z: -30 }, true);
    sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    sim.body.setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }, true);
    sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    sim.body.setEnabledRotations(false, false, false, true);
    for (let i = 0; i < 120; i++) sim.update(1 / 120, s);
    assert(s.crashed && !s.recoverySuspended);
    assert(s.crashRemaining < remaining && s.crashRemaining > 3.5);
    for (let i = 0; i < 500; i++) sim.update(1 / 120, s);
    assert(!s.crashed);
  } finally { sim.dispose(); }
});

test("reverse correction waits five seconds of actual backward travel, respects pause and yields to steering", async () => {
  const sim = await createRiderPhysics(), s = state();
  const wide = { ...path, width: 200 };
  sim.reset(wide, chunksAt(0), { distance: 0, lane: 0 });
  const yaw = 0.5;
  sim.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
  s.targetKmh = 500; s.throttleInput = -1;
  try {
    for (let i = 0; i < 570; i++) sim.update(1 / 120, s);
    assert(s.reverseSeconds < 5 && s.reverseSeconds > 4);
    assert(!s.directionCorrecting);
    assert(Math.abs(s.physicsPose.yaw - yaw) < 0.01, "direction changed before five seconds");
    const clock = s.reverseSeconds;
    s.running = false;
    for (let i = 0; i < 120; i++) sim.update(1 / 60, s);
    assert.equal(s.reverseSeconds, clock);
    s.running = true;
    for (let i = 0; i < 100 && !s.directionCorrecting; i++) sim.update(1 / 120, s);
    assert(s.directionCorrecting && s.reverseSeconds >= 5);
    const initial = s.physicsPose.yaw;
    for (let i = 0; i < 240; i++) {
      const p = { ...sim.body.translation() };
      sim.update(1 / 120, s);
      const next = sim.body.translation();
      assert(Math.hypot(next.x - p.x, next.z - p.z) < 0.1, "correction teleported the rider");
    }
    assert(Math.abs(s.physicsPose.yaw) < Math.abs(initial) * 0.7, `heading not corrected: ${s.physicsPose.yaw}`);
    assert(s.forwardVelocity < -2, "correction erased reverse travel");
    s.steerInput = 1;
    sim.update(1 / 120, s);
    assert(!s.directionCorrecting, "assistance fought manual steering");
  } finally { sim.dispose(); }
});

test("speed scales steering and balance; the rider banks into real turns", async () => {
  const sim = await createRiderPhysics(), s = state();
  const wide = { ...path, width: 200 };
  sim.reset(wide, chunksAt(0), { distance: 0, lane: 0 });
  try {
    s.targetKmh = 20;
    for (let i = 0; i < 360; i++) sim.update(1 / 120, s);
    s.steerInput = 1;
    sim.update(1 / 120, s);
    const slowAngle = Math.abs(s.steeringAngle), slowBalance = s.balance;
    s.steerInput = 0;
    s.targetKmh = 200;
    sim.body.setLinvel({ x: 0, y: 0, z: -200 / 3.6 }, true);
    for (let i = 0; i < 10; i++) sim.update(1 / 120, s);
    s.steerInput = 1;
    for (let i = 0; i < 60; i++) sim.update(1 / 120, s);
    assert(Math.abs(s.steeringAngle) < slowAngle * 0.25, "high-speed steering angle too large");
    assert(s.balance > slowBalance + 0.3);
    assert(s.rideLean < -0.05 && s.rideLean >= -0.43, `missing right corner lean: ${s.rideLean}`);
    const lean = s.rideLean;
    s.running = false; sim.update(0.1, s);
    assert.equal(s.rideLean, lean, "paused lean changed");
  } finally { sim.dispose(); }
});

test("opposite steering reverses yaw promptly at urban and racing speeds", async () => {
  for (const kmh of [60, 200, 500]) {
    const sim = await createRiderPhysics(), s = state();
    sim.reset({ ...path, width: 200 }, chunksAt(0), { distance: 0, lane: 0 }, { drive: "balanced", rocket: "boost" });
    s.targetKmh = kmh;
    try {
      for (let i = 0; i < 60; i++) sim.update(1 / 120, s);
      sim.body.setLinvel({ x: 0, y: 0, z: -kmh / 3.6 }, true);
      s.steerInput = 1;
      for (let i = 0; i < 48; i++) sim.update(1 / 120, s);
      assert(sim.body.angvel().y < -0.02);
      s.steerInput = -1;
      let frames = 0;
      while (sim.body.angvel().y < 0.02 && frames < 60) { sim.update(1 / 120, s); frames++; }
      assert(frames <= 18, `${kmh} km/h reversal took ${frames / 120}s`);
    } finally { sim.dispose(); }
  }
});

test("released throttle coasts gently, stops pedaling, and does not auto-accelerate at spawn", async () => {
  const sim = await setup(), s = state();
  try {
    s.throttleInput = 0;
    advance(sim, s, 2);
    assert(s.velocity < 0.1, "idle rider accelerated without throttle");
    s.throttleInput = 1; s.targetKmh = 100;
    advance(sim, s, 4);
    const speed = s.velocity;
    s.throttleInput = 0;
    advance(sim, s, 1);
    assert(s.velocity < speed && s.velocity > speed * 0.9, `coast was not gentle: ${speed} -> ${s.velocity}`);
    assert(!s.braking && s.cadenceRpm === 0, "coasting applied brakes or kept pedaling");
    const coastingSpeed = s.velocity;
    s.brakeInput = true;
    advance(sim, s, 1);
    assert(coastingSpeed - s.velocity > (speed - coastingSpeed) * 5, "braking is not distinct from coasting");
  } finally { sim.dispose(); }
});

test("holding forward builds speed gradually and resumes after an unsteady landing", async () => {
  const sim = await setup(), s = state();
  s.targetKmh = 220;
  s.balanceAssistHeld = true;
  try {
    advance(sim, s, 0.25);
    const start = s.velocity;
    assert(start > 0 && start < 5, `forward launch was abrupt: ${start} m/s`);
    advance(sim, s, 1);
    assert(s.velocity > start + 5, `holding forward did not keep accelerating: ${s.velocity} m/s`);
    s.throttleInput = 0;
    s.balanceAssistHeld = false;
    advance(sim, s, 0.5);
    const coast = s.velocity;
    assert(coast < s.targetKmh / 3.6 && coast > 0);
  } finally { sim.dispose(); }

  const assisted = await collideWithParts(), idle = await collideWithParts();
  try {
    for (const { sim: rider, s: riderState } of [assisted, idle]) {
      for (let i = 0; i < 65; i++) rider.update(1 / 120, riderState);
      rider.body.setTranslation({ x: 0, y: path.height + 0.72, z: -42 }, true);
      rider.body.setRotation({ x: Math.sin(0.2), y: 0, z: 0, w: Math.cos(0.2) }, true);
      rider.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rider.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rider.world.propagateModifiedBodyPositionsToColliders();
    }
    assisted.s.balanceAssistHeld = true;
    assisted.s.throttleInput = 1;
    idle.s.throttleInput = 0;
    for (let i = 0; i < 150; i++) {
      assisted.sim.update(1 / 120, assisted.s);
      idle.sim.update(1 / 120, idle.s);
    }
    assert(!assisted.s.crashed, "forward assistance did not bring the bike back to riding");
    assert(assisted.s.velocity > idle.s.velocity + 1,
      `forward did not restore gradual drive: ${assisted.s.velocity} vs ${idle.s.velocity}`);
  } finally { assisted.sim.dispose(); idle.sim.dispose(); }
});

test("balance keys apply physical roll and pitch control while airborne", async () => {
  const a = await collideWithParts(), b = await collideWithParts();
  try {
    for (const { sim, s } of [a, b]) {
      sim.body.setTranslation({ x: 0, y: 10, z: -30 }, true);
      sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      sim.body.setRotation({ x: 0, y: 0, z: Math.sin(0.3), w: Math.cos(0.3) }, true);
    }
    a.s.balanceRoll = 1; a.s.balancePitch = 1;
    for (let i = 0; i < 30; i++) { a.sim.update(1 / 120, a.s); b.sim.update(1 / 120, b.s); }
    assert(Math.abs(a.s.physicsPose.rotation.z) < Math.abs(b.s.physicsPose.rotation.z) - 0.03, "roll key did not correct the lean");
    assert(Math.abs(a.s.physicsPose.rotation.x) > 0.03, "pitch key did not move the body");
    assert(a.s.recoverySuspended && a.s.crashed, "balance control triggered a reset");
  } finally { a.sim.dispose(); b.sim.dispose(); }
});

test("rear braking leaves the front wheel free and skid feedback requires rear contact", async () => {
  const sim = await setup(), s = state();
  try {
    s.targetKmh = 100; advance(sim, s, 4);
    const grip = sim.vehicle.wheelSideFrictionStiffness(1);
    s.brakeInput = true; sim.update(1 / 60, s);
    assert.equal(sim.vehicle.wheelBrake(0), 0);
    assert(sim.vehicle.wheelBrake(1) > 0);
    assert(s.rearBrake > 0.9 && s.rearSkid > 0.9);
    assert(s.rearContact && s.rearContact.z > -s.distance, "skid is not behind chassis");
    assert(sim.vehicle.wheelSideFrictionStiffness(1) < grip);
    s.brakeInput = false; s.throttleInput = 0; sim.update(1 / 60, s);
    assert.equal(s.rearSkid, 0);
    assert.equal(sim.vehicle.wheelSideFrictionStiffness(1), grip);
    sim.body.setTranslation({ ...sim.body.translation(), y: 8 }, true);
    s.brakeInput = true; sim.update(1 / 60, s);
    assert.equal(s.rearSkid, 0, "airborne tire emitted skid feedback");
    assert.equal(s.rearContact, null);
  } finally { sim.dispose(); }
});

test("rail friction preserves more speed at shallow angles and only launches near head-on", async () => {
  const retained = [];
  for (const degrees of [10, 30, 50, 80]) {
    const sim = await createRiderPhysics(), s = state(), chunks = chunksAt(0);
    chunks.get(0).userData.barriers = [{ x: 1, y: 0.87, z: -25, half: [0.1, 0.6, 40], yaw: 0 }];
    sim.reset(path, chunks, { distance: 0, lane: 0 });
    const a = degrees * Math.PI / 180;
    s.throttleInput = 0;
    // Align the bike with travel so tire forces do not erase the approach angle.
    sim.body.setTranslation({ x: 0, y: 1.25, z: -10 }, true);
    sim.body.setRotation({ x: 0, y: -Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }, true);
    sim.body.setLinvel({ x: Math.sin(a) * 30, y: 0, z: -Math.cos(a) * 30 }, true);
    try {
      for (let i = 0; i < 20 && !s.collisionCount; i++) sim.update(1 / 120, s);
      assert(s.collisionCount > 0, `missed rail at ${degrees} degrees: ${JSON.stringify({pose:s.physicsPose,v:sim.body.linvel()})}`);
      assert.equal(s.crashed, degrees >= 60, `wrong collision classification at ${degrees} degrees`);
      if (!s.crashed) {
        assert(sim.body.linvel().z < -1, "lost tangential sliding");
        retained.push(s.velocity);
      }
    } finally { sim.dispose(); }
  }
  assert(retained[0] > retained[1] && retained[1] > retained[2], `angle did not affect speed loss: ${retained}`);
});

test("ground balance moves physical center of mass, preserves mass, pauses and recenters", async () => {
  const sim = await setup(), s = state();
  s.targetKmh = 40;
  try {
    advance(sim, s, 2);
    const mass = sim.body.mass();
    s.balanceRoll = 1; s.balancePitch = 1;
    advance(sim, s, 0.5);
    let com = sim.body.localCom();
    assert(com.x > 0.11 && com.z < -0.20, `COM ${JSON.stringify(com)}`);
    assert(Math.abs(sim.body.mass() - mass) < 0.001);
    assert(s.grounded && !s.crashed);
    s.running = false; s.balanceRoll = -1; s.balancePitch = -1;
    advance(sim, s, 0.5);
    assert.deepEqual(sim.body.localCom(), com, "paused mass center moved");
    s.running = true;
    advance(sim, s, 0.75);
    com = sim.body.localCom();
    assert(com.x < -0.11 && com.z > 0.20);
    s.balanceRoll = s.balancePitch = 0;
    advance(sim, s, 1);
    com = sim.body.localCom();
    assert(Math.abs(com.x) < 0.001 && Math.abs(com.z) < 0.001);
    assert(s.grounded && !s.crashed && Number.isFinite(s.velocity));
  } finally { sim.dispose(); }
});

test("rocket upgrades increase actual acceleration and gearing speed; bars increase wheel steering", async () => {
  const baseline = await setup(), upgraded = await setup(), a = state(), b = state();
  baseline.reset(path, chunksAt(0), { distance: 0, lane: 0 }, { drive: "torque" });
  upgraded.reset(path, chunksAt(0), { distance: 0, lane: 0 }, { drive: "torque", rocket: "boost", handlebar: "agile" });
  try {
    advance(baseline, a, 1); advance(upgraded, b, 1);
    assert(b.velocity > a.velocity * 1.2, `${a.velocity} vs ${b.velocity}`);
    advance(baseline, a, 24); advance(upgraded, b, 24);
    assert(a.velocity * 3.6 <= 320.1);
    assert(b.velocity * 3.6 > 390 && b.velocity * 3.6 <= 400.1);
    baseline.body.setLinvel({ x: 0, y: 0, z: -40 }, true);
    upgraded.body.setLinvel({ x: 0, y: 0, z: -40 }, true);
    a.steerInput = b.steerInput = 1;
    baseline.update(1 / 120, a); upgraded.update(1 / 120, b);
    assert(Math.abs(b.steeringAngle) > Math.abs(a.steeringAngle) * 1.2);
  } finally { baseline.dispose(); upgraded.dispose(); }
});


test("stock equipment physically caps at 220 km/h", async () => {
  const sim = await setup(), s = state();
  try {
    advance(sim, s, 12);
    assert(s.velocity * 3.6 > 219 && s.velocity * 3.6 <= 220.01);
  } finally { sim.dispose(); }
});


test("holding W slowly corrects airborne imbalance through torque without moving or resetting the rider", async () => {
  const a=await collideWithParts(), b=await collideWithParts();
  try {
    for(const {sim,s} of [a,b]) {
      sim.body.setTranslation({x:0,y:15,z:-30},true);
      sim.body.setLinvel({x:0,y:0,z:0},true);sim.body.setAngvel({x:0,y:0,z:0},true);
      sim.body.setRotation({x:0,y:0,z:Math.sin(.5),w:Math.cos(.5)},true);
      s.balanceRoll=s.balancePitch=0;
    }
    a.s.balanceAssistHeld=true;a.s.throttleInput=1;
    a.sim.update(1/120,a.s);b.sim.update(1/120,b.s);
    assert(Math.abs(a.s.physicsPose.rotation.z-Math.sin(.5))<.01,"W snapped rotation");
    for(let i=0;i<90;i++){a.sim.update(1/120,a.s);b.sim.update(1/120,b.s);}
    assert(Math.abs(a.s.physicsPose.rotation.z)<Math.abs(b.s.physicsPose.rotation.z)-.03,"W did not improve balance");
    assert(a.s.balanceAssisting);assert(a.s.crashed&&a.s.recoverySuspended);
    assert(Math.abs(a.sim.body.translation().z+30)<.05,"assist moved position");
    assert(Math.abs(a.sim.body.translation().y-b.sim.body.translation().y)<.01,"assist altered gravity");
    a.s.balanceAssistHeld=false;a.sim.update(1/120,a.s);assert(!a.s.balanceAssisting);
  }finally{a.sim.dispose();b.sim.dispose();}
});

async function fallenGroundFixture(yaw = 0) {
  const fixture = await collideWithParts();
  const { sim, s } = fixture;
  const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2);
  sim.body.setTranslation({ x: 1, y: path.height + 0.3, z: -30 }, true);
  // Yaw followed by a 90-degree roll keeps the chassis on its side with both
  // wheel rays horizontal. Locked rotation represents a bike wedged on ground.
  sim.body.setRotation({ x: sy * Math.SQRT1_2, y: sy * Math.SQRT1_2,
    z: cy * Math.SQRT1_2, w: cy * Math.SQRT1_2 }, true);
  sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  sim.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  sim.body.setEnabledRotations(false, false, false, true);
  sim.world.propagateModifiedBodyPositionsToColliders();
  s.throttleInput = 0;
  s.balanceAssistHeld = false;
  advance(sim, s, 0.1, 1 / 120);
  assert(s.crashed && !s.recoverySuspended, "fixture must rest on the track while fallen");
  return fixture;
}

test("holding forward on a fallen chassis gradually pushes along its heading without wheel contact", async () => {
  const yaw = 0.4;
  const assisted = await fallenGroundFixture(yaw), idle = await fallenGroundFixture(yaw);
  const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  try {
    const start = { ...assisted.sim.body.translation() };
    assisted.s.throttleInput = 1;
    assisted.s.balanceAssistHeld = true;
    advance(assisted.sim, assisted.s, 0.25, 1 / 120);
    const initialSpeed = assisted.s.velocity;
    assert(initialSpeed < 1, `fallen drive started abruptly at ${initialSpeed} m/s`);
    advance(assisted.sim, assisted.s, 1.25, 1 / 120);
    advance(idle.sim, idle.s, 1.5, 1 / 120);
    const p = assisted.sim.body.translation(), idlePosition = idle.sim.body.translation();
    const distance = (p.x - start.x) * forward.x + (p.z - start.z) * forward.z;
    assert(distance > 0.5, `fallen rider did not move forwards: ${distance} m`);
    assert(assisted.s.velocity > initialSpeed + 0.5 && assisted.s.velocity > idle.s.velocity + 0.5,
      `holding forward provided no gradual drive: ${assisted.s.velocity} vs ${idle.s.velocity}`);
    assert(Math.hypot(idlePosition.x - start.x, idlePosition.z - start.z) < 0.05,
      "fallen rider moved without holding forward");
    assert(Math.abs((p.x - start.x) * forward.z - (p.z - start.z) * forward.x) < 0.05,
      "fallen assistance pushed along the track instead of the bike heading");
    const q = assisted.sim.body.rotation();
    assert(Math.abs(1 - 2 * (q.x * q.x + q.z * q.z)) < 0.01,
      "fixture left its side and gained wheel traction");
    assert(assisted.s.crashed, "ground drive snapped the rider upright");
    advance(assisted.sim, assisted.s, 2, 1 / 120);
    assert(assisted.s.velocity < 20 / 3.6 + 0.05, "fallen assistance exceeded the crawl speed cap");
  } finally { assisted.sim.dispose(); idle.sim.dispose(); }
});

test("fallen forward assistance stops when released or braking and freezes while paused", async () => {
  const { sim, s } = await fallenGroundFixture();
  try {
    s.balanceAssistHeld = true;
    s.throttleInput = 1;
    advance(sim, s, 1.5, 1 / 120);
    assert(s.velocity > 0.5, "fixture did not start moving under forward drive");
    const position = { ...sim.body.translation() }, velocity = { ...sim.body.linvel() };
    const remaining = s.crashRemaining;
    s.running = false;
    advance(sim, s, 2, 1 / 120);
    assert.deepEqual({ ...sim.body.translation() }, position, "paused assistance moved the bike");
    assert.deepEqual({ ...sim.body.linvel() }, velocity, "paused assistance applied force");
    assert.equal(s.crashRemaining, remaining, "paused recovery clock advanced");
    s.running = true;
    s.throttleInput = 0;
    const speed = s.velocity;
    advance(sim, s, 0.2, 1 / 120);
    assert(s.velocity < speed, "released forward input kept driving the fallen chassis");
    for (const brakeFlag of ["brakeInput", "brakeLatched"]) {
      s.balanceAssistHeld = true;
      s.throttleInput = 1;
      s[brakeFlag] = true;
      sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      advance(sim, s, 0.75, 1 / 120);
      assert(s.velocity < 0.05, `${brakeFlag} did not suppress fallen drive`);
      s[brakeFlag] = false;
    }
  } finally { sim.dispose(); }
});

test("holding forward cannot postpone five-second rescue while the bike remains fallen on ground", async () => {
  const { sim, s } = await fallenGroundFixture();
  try {
    s.balanceAssistHeld = true;
    s.throttleInput = 1;
    const steps = Math.ceil(s.crashRemaining * 120);
    for (let i = 0; i < steps - 2; i++) sim.update(1 / 120, s);
    assert(s.crashed && !s.recoverySuspended, "fallen ground drive cancelled the rescue timer");
    for (let i = 0; i < 4; i++) sim.update(1 / 120, s);
    assert(!s.crashed, "forward input prevented rescue after five seconds");
    assert(Math.abs(s.physicsPose.rotation.z) < 0.01, "rescue did not restore an upright pose");
  } finally { sim.dispose(); }
});
