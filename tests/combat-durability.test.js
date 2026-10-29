import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "../src/combat/simulation.js";
import { loadPhysics } from "../src/physics/engine.js";

class Vec {
  constructor(x, y, z) { Object.assign(this, { x, y, z }); }
  clone() { return new Vec(this.x, this.y, this.z); }
  addScaledVector(v, amount) { this.x += v.x * amount; this.y += v.y * amount; this.z += v.z * amount; return this; }
}
const path = {
  width: 12, height: 0.22,
  sample(distance, lane = 0) {
    return { point: new Vec(lane, 0.22, -distance), tangent: new Vec(0, 0, -1), normal: new Vec(1, 0, 0) };
  },
};

async function arena(weapon, { origin = 1024, lane = 0, distance = 12, playerPose = {} } = {}) {
  const R = await loadPhysics(), world = new R.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 120;
  const player = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(playerPose.x ?? 0, playerPose.y ?? 1, origin));
  const combat = createCombat({
    R, world, player, path, spawn: { distance: 0, lane: 0 },
    rivalSpawn: { distance, lane }, weapon, getOrigin: () => origin,
  });
  const state = { running: true, distance: 0 };
  combat.read(state);
  function tick(seconds, placeBeforePhysics) {
    for (let step = 0; step < Math.round(seconds * 120); step++) {
      combat.beforeStep(1 / 120, state, false);
      if (state.running) {
        placeBeforePhysics?.();
        world.step();
      }
      combat.afterStep(1 / 120);
      combat.read(state);
    }
  }
  function placeRival(pose, rotation = { x: 0, y: 0, z: 0, w: 1 }) {
    combat.rival.setTranslation({ ...pose, z: origin + pose.z }, true);
    combat.rival.setRotation(rotation, true);
    combat.rival.setLinvel({ x: 0, y: 0, z: 0 }, true);
    combat.rival.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  return { R, world, player, combat, state, origin, tick, placeRival };
}
const damagedIds = snapshot => Object.entries(snapshot.parts)
  .filter(([, part]) => part.current < part.max).map(([id]) => id);

test("single real weapon impacts damage local rival parts without disassembling the whole rider", async () => {
  for (const weapon of ["gatling", "launcher", "attack-beak"]) {
    const a = await arena(weapon, weapon === "attack-beak" ? { lane: 2.3, distance: 1.2 } : {});
    try {
      const initial = a.state.rival.partDurability;
      a.state.fireRequested = weapon === "launcher";
      a.state.gatlingHeld = weapon === "gatling";
      a.state.beakAttackRequested = weapon === "attack-beak" ? 1 : 0;
      a.tick(1 / 120);
      a.state.gatlingHeld = false;
      a.tick(0.8);
      const current = a.state.rival.partDurability;
      assert.equal(initial.totalCurrent - current.totalCurrent, { gatling: 16, launcher: 90, "attack-beak": 25 }[weapon]);
      assert(Object.values(current.parts).every(part => !part.broken));
      assert.equal(damagedIds(current).length, weapon === "gatling" ? 2 : 1);
      if (weapon === "gatling") {
        assert.deepEqual(damagedIds(current), ["leg-left", "leg-right"]);
        assert.equal(a.state.rival.health, 84);
      }
      if (weapon === "attack-beak") assert.equal(a.state.rival.health, 75);
      assert.equal(current.parts.frame.current, current.parts.frame.max);
    } finally { a.world.free(); }
  }
});

test("an airborne rival takes further melee durability damage and upward impulse without resetting rescue", async () => {
  const a = await arena("attack-beak", { lane: 2.3, distance: 1.2 });
  try {
    a.state.beakAttackRequested = 1;
    a.tick(0.8);
    assert.equal(a.state.beakHits, 1);
    const before = a.state.rival.partDurability.totalCurrent;
    const remaining = a.state.rival.recovery;
    a.placeRival({ x: 2.3, y: 1.6, z: -1.5 });
    a.world.step();
    a.state.beakAttackRequested = 1;
    for (let step = 0; step < 100 && a.state.beakHits === 1; step++) a.tick(1 / 120);
    assert.equal(a.state.beakHits, 2);
    assert.equal(a.state.rival.partDurability.totalCurrent, before - 25);
    assert.equal(a.state.rival.health, 50);
    assert(a.combat.rival.linvel().y > 2.5);
    assert(a.state.rival.recovery > 0 && a.state.rival.recovery < remaining);
  } finally { a.world.free(); }
});

test("repeated airborne gun hits can break only the struck legs and rescue preserves body damage", async () => {
  const a = await arena("gatling", { playerPose: { x: 0.372, y: 1.5 } });
  try {
    // One barrel hits the centre of the body; the other passes outside the target sensor.
    a.state.gatlingHeld = true;
    a.tick(1 / 120);
    a.state.gatlingHeld = false;
    a.tick(0.2);
    assert.equal(a.state.rival.partDurability.parts.body.current, 312);
    a.player.setTranslation({ x: 0, y: 1, z: a.origin }, true);
    a.state.gatlingHeld = true;
    let previousHits = a.state.gatlingHits, sawAirborneDamage = false;
    for (let step = 0; step < 480 && !a.state.rival.partDurability.parts["leg-left"].broken; step++) {
      const alreadyAirborne = a.state.rival.recovery > 0;
      a.tick(1 / 120, () => {
        if (alreadyAirborne) a.placeRival({ x: 0, y: 1.02, z: -12 });
      });
      if (alreadyAirborne && a.state.gatlingHits > previousHits) {
        sawAirborneDamage = true;
        assert(a.combat.rival.linvel().y > 1);
      }
      previousHits = a.state.gatlingHits;
    }
    assert(sawAirborneDamage);
    const broken = a.state.rival.partDurability;
    assert.equal(broken.parts["leg-left"].broken, true);
    assert.equal(broken.parts["leg-right"].broken, true);
    assert.deepEqual(Object.entries(broken.parts).filter(([, part]) => part.broken).map(([id]) => id), ["leg-left", "leg-right"]);
    assert.equal(broken.parts.body.current, 312);
    a.state.gatlingHeld = false;
    a.state.running = false;
    const paused = structuredClone(a.state.rival.partDurability);
    a.tick(2);
    assert.deepEqual(a.state.rival.partDurability, paused);
    a.state.running = true;
    a.tick(5.1);
    const repaired = a.state.rival.partDurability;
    assert.equal(repaired.parts["leg-left"].current, repaired.parts["leg-left"].max);
    assert.equal(repaired.parts["leg-right"].current, repaired.parts["leg-right"].max);
    assert.equal(repaired.parts.body.current, 312);
    assert.equal(a.state.rival.health, 100);
    assert.equal(a.state.rival.recovery, 0);
  } finally { a.world.free(); }
});

test("blast damage uses the rotated nearest body surface and origin offset, instead of a distant epicentre", async () => {
  const a = await arena("launcher");
  try {
    a.world.createCollider(a.R.ColliderDesc.cuboid(3, 3, 0.1).setTranslation(0, 3, a.origin - 8));
    a.world.step();
    a.state.fireRequested = true;
    a.tick(0.8);
    assert.equal(a.state.weaponHits, 1);
    a.tick(1);
    a.placeRival({ x: 0, y: 3, z: -12 }, { x: 0, y: 1, z: 0, w: 0 });
    a.world.step();
    const before = a.state.rival.partDurability;
    a.state.fireRequested = true;
    for (let step = 0; step < 150 && a.state.weaponHits === 1; step++) {
      a.tick(1 / 120, () => a.placeRival({ x: 0, y: 3, z: -12 }, { x: 0, y: 1, z: 0, w: 0 }));
    }
    assert.equal(a.state.weaponHits, 2);
    const after = a.state.rival.partDurability;
    assert.equal(before.parts["wheel-front"].current - after.parts["wheel-front"].current, 90);
    assert.equal(after.parts["wheel-rear"].current, after.parts["wheel-rear"].max);
    assert.equal(before.totalCurrent - after.totalCurrent, 90);
  } finally { a.world.free(); }
});

test("starting a new combat race restores every rival part to full durability", async () => {
  const damaged = await arena("gatling");
  try {
    damaged.state.gatlingHeld = true;
    damaged.tick(1 / 120);
    damaged.state.gatlingHeld = false;
    damaged.tick(0.2);
    assert(damaged.state.rival.partDurability.totalCurrent < damaged.state.rival.partDurability.totalMax);
    const fresh = await arena("gatling");
    try {
      assert.equal(fresh.state.rival.partDurability.totalCurrent, fresh.state.rival.partDurability.totalMax);
      assert(Object.values(fresh.state.rival.partDurability.parts).every(part => !part.broken));
    } finally { fresh.world.free(); }
  } finally { damaged.world.free(); }
});
