import test from "node:test";
import assert from "node:assert/strict";
import { loadPhysics } from "../src/physics/engine.js";
import { createBeakCombat, BEAK_DAMAGE, BEAK_RANGE, BEAK_COOLDOWN } from "../src/combat/beak.js";
import { BEAK_ACTION_TIME, BEAK_WINDUP, BEAK_SWEEP_TIME, beakSwingAngle } from "../src/combat/beak-motion.js";

async function arena({ positions = [{ x: 2.3, y: 1.8, z: -1.4 }], origin = 0, yaw = 0, equipped = true, wall = false } = {}) {
  const R = await loadPhysics(), world = new R.World({ x: 0, y: 0, z: 0 });
  const player = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, 1, origin)
    .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }));
  const targetHandles = new Set(), actors = [], damage = [];
  const place = p => ({ x: Math.cos(yaw) * p.x + Math.sin(yaw) * p.z, y: 1 + p.y, z: origin - Math.sin(yaw) * p.x + Math.cos(yaw) * p.z });
  for (const p of positions) {
    const at = place(p), body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, at.y, at.z));
    const solid = world.createCollider(R.ColliderDesc.cuboid(0.35, 0.45, 0.35), body);
    const sensor = world.createCollider(R.ColliderDesc.cuboid(0.4, 0.5, 0.4).setSensor(true), body);
    targetHandles.add(solid.handle); targetHandles.add(sensor.handle); actors.push(body);
  }
  if (wall) world.createCollider(R.ColliderDesc.cuboid(0.12, 2, 2).setTranslation(1.15, 2.5, origin - 1.4));
  world.step();
  const beak = createBeakCombat({ R, world, player, equipped, getOrigin: () => origin, targetHandles,
    damageTarget(handle, amount, point) { damage.push({ handle, amount, point }); return true; },
  });
  const state = { running: true, beakAttackRequested: 0 };
  const tick = (seconds, crashed = false) => {
    for (let i = 0; i < Math.round(seconds * 120); i++) {
      beak.beforeStep(1 / 120, state, crashed); world.step(); beak.afterStep(1 / 120); beak.read(state);
    }
  };
  return { R, world, beak, state, player, actors, damage, tick };
}

test("long beak swings right with E and left with Q; each actor is hit once per sweep", async () => {
  for (const direction of [-1, 1]) {
    const a = await arena({ positions: [{ x: 2.3, y: 1.8, z: -1.4 }, { x: -2.3, y: 1.8, z: -1.4 }] });
    try {
      a.state.beakAttackRequested = direction;
      a.tick(0.1); assert.equal(a.damage.length, 0, "windup cannot damage");
      a.tick(0.31);
      assert.equal(a.damage.length, 1, "body and sensor must not deal duplicate damage");
      const hit = a.damage[0];
      assert.equal(hit.amount, BEAK_DAMAGE); assert.equal(hit.point.direction, direction);
      assert.equal(Math.sign(hit.point.x), direction); assert.equal(Math.sign(hit.point.dx), direction);
      assert.equal(hit.point.dy, 0); assert.equal(hit.point.weapon, "attack-beak");
      assert.equal(a.state.beakHits, 1); assert.equal(a.state.beakSwings, 1);
      assert.equal(a.state.beakAttack.direction, direction);
      a.tick(0.2); assert.equal(a.state.beakAttack, null); assert.equal(a.damage.length, 1, "recovery cannot damage");
    } finally { a.world.free(); }
  }
});

test("beak attacks require actual short-range contact and solid walls block the swing", async () => {
  for (const options of [
    { positions: [{ x: BEAK_RANGE + 1, y: 1.8, z: -1.4 }] },
    { positions: [{ x: 2.3, y: 4.1, z: -1.4 }] },
    { positions: [{ x: 2.3, y: 1.8, z: 1.8 }] },
    { wall: true },
  ]) {
    const a = await arena(options);
    try { a.state.beakAttackRequested = 1; a.tick(0.6); assert.equal(a.damage.length, 0); }
    finally { a.world.free(); }
  }
  const rotated = await arena({ yaw: Math.PI / 2, origin: 4096 });
  try {
    rotated.state.beakAttackRequested = 1; rotated.tick(0.6);
    assert.equal(rotated.damage.length, 1);
    assert(rotated.damage[0].point.x < 0 && rotated.damage[0].point.z < 0, "attack follows body orientation and offsets are removed");
    assert(rotated.damage[0].point.dz < 0, "sideways impact rotates with the bike");
  } finally { rotated.world.free(); }
});

test("cooldown rejects extra presses; a fresh swing can hit the same airborne opponent again", async () => {
  const a = await arena();
  try {
    a.state.beakAttackRequested = 1; a.tick(0.6);
    assert.equal(a.damage.length, 1);
    a.state.beakAttackRequested = 1; a.tick(0.1);
    assert.equal(a.state.beakSwings, 1); assert.equal(a.state.beakAttackRequested, 0);
    const at = a.actors[0].translation();
    a.actors[0].setTranslation({ ...at, y: at.y + 0.4 }, true);
    a.actors[0].setBodyType(a.R.RigidBodyType.Dynamic, true);
    a.state.rival = { recovery: 3.2 };
    a.tick(0.1);
    a.state.beakAttackRequested = 1; a.tick(0.6);
    assert.equal(a.damage.length, 2); assert.equal(a.state.beakHits, 2); assert.equal(a.state.beakSwings, 2);
    assert.equal(a.state.rival.recovery, 3.2, "melee module must not restart rescue timers");
    assert(a.actors[0].isDynamic());
  } finally { a.world.free(); }
});

test("pause freezes the action and cooldown; unequipped or fallen riders cannot attack", async () => {
  for (const [equipped, crashed] of [[false, false], [true, true]]) {
    const a = await arena({ equipped });
    try {
      a.state.beakAttackRequested = 1; a.tick(1, crashed);
      assert.equal(a.state.beakSwings, 0); assert.equal(a.state.beakAttack, null); assert.equal(a.damage.length, 0);
    } finally { a.world.free(); }
  }
  const a = await arena();
  try {
    a.state.beakAttackRequested = 1; a.tick(0.1);
    const age = a.state.beakAttack.age, cooldown = a.state.beakCooldown;
    a.state.running = false; a.state.beakAttackRequested = -1; a.tick(1);
    assert.equal(a.state.beakAttack.age, age); assert.equal(a.state.beakCooldown, cooldown);
    assert.equal(a.damage.length, 0); assert.equal(a.state.beakAttackRequested, 0);
    a.state.running = true; a.tick(0.5, true);
    assert.equal(a.state.beakAttack, null); assert.equal(a.damage.length, 0);
  } finally { a.world.free(); }
});

test("the shared visible arc is continuous, directional, and returns to rest", () => {
  assert.equal(BEAK_ACTION_TIME, 0.55); assert.equal(BEAK_COOLDOWN, 0.75);
  const end = BEAK_WINDUP + BEAK_SWEEP_TIME;
  for (const direction of [-1, 1]) {
    assert.equal(beakSwingAngle(0, direction), 0);
    assert(Math.abs(beakSwingAngle(BEAK_WINDUP - 1e-7, direction) - beakSwingAngle(BEAK_WINDUP, direction)) < 1e-5);
    assert(Math.abs(beakSwingAngle(end + 1e-7, direction) - beakSwingAngle(end, direction)) < 1e-5);
    assert.equal(Math.sign(beakSwingAngle(0.24, direction)), -direction);
    assert.equal(beakSwingAngle(BEAK_ACTION_TIME, direction), 0);
    assert.equal(beakSwingAngle(10, direction), 0);
  }
});
