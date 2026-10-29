import test from "node:test";
import assert from "node:assert/strict";
import { createRiderPhysics } from "../src/physics/rider-physics.js";

class Vec {
  constructor(x, y, z) { Object.assign(this, { x, y, z }); }
  clone() { return new Vec(this.x, this.y, this.z); }
  addScaledVector(v, amount) { this.x += v.x * amount; this.y += v.y * amount; this.z += v.z * amount; return this; }
}
const path = {
  width: 12, height: 0.22,
  sample(distance, lane = 0) { return { point: new Vec(lane, 0.22, -distance), tangent: new Vec(0, 0, -1), normal: new Vec(1, 0, 0) }; },
};
const chunks = new Map(Array.from({ length: 8 }, (_, i) => [i - 2, { userData: { barriers: [] } }]));
async function setup(weapon = "attack-beak", lane = 2.3) {
  const sim = await createRiderPhysics();
  sim.reset(path, chunks, { distance: 0, lane: 0 }, { weapon }, { rival: true, rivalSpawn: { distance: 1.2, lane } });
  const state = { running: true, targetKmh: 220, throttleInput: 0, time: 0, distance: 0, beakAttackRequested: 0 };
  const tick = seconds => { for (let i = 0; i < Math.round(seconds * 120); i++) sim.update(1 / 120, state); };
  sim.update(0, state);
  return { sim, state, tick };
}

test("equipped long beak launches a nearby racer on the selected side and cannot fire another weapon", async () => {
  for (const direction of [-1, 1]) {
    const a = await setup("attack-beak", direction * 2.3);
    try {
      a.state.beakAttackRequested = direction; a.state.fireRequested = true; a.state.gatlingHeld = true;
      a.tick(0.3);
      assert.equal(a.state.weaponKind, "attack-beak"); assert(a.state.beakEquipped);
      assert.equal(a.state.beakSwings, 1); assert.equal(a.state.beakHits, 1);
      assert.equal(a.state.rival.health, 75); assert(a.state.rival.recovery > 4.8);
      assert(a.sim.combat.rival.isDynamic());
      const v = a.sim.combat.rival.linvel();
      assert.equal(Math.sign(v.x), direction); assert(v.y > 5, "a physical upward impulse must launch the opponent");
      assert.equal(a.state.weaponShots, 0); assert.equal(a.state.gatlingShots, 0);
      assert.deepEqual(a.state.missiles, []); assert.deepEqual(a.state.bullets, []);
      assert(!a.state.weaponLocked); assert.equal(a.state.beakAttackRequested, 0);
      assert.equal(a.state.beakImpacts.length, 1);
    } finally { a.sim.dispose(); }
  }
});

test("the opposite side and an empty attack slot take no melee damage", async () => {
  for (const [weapon, lane, direction] of [["attack-beak", 2.3, -1], ["attack-beak", -2.3, 1], ["standard", 2.3, 1]]) {
    const a = await setup(weapon, lane);
    try {
      a.state.beakAttackRequested = direction; a.tick(0.6);
      assert.equal(a.state.beakHits, 0); assert.equal(a.state.rival.health, 100); assert.equal(a.state.rival.recovery, 0);
      assert(a.sim.combat.rival.isKinematic());
      assert.equal(a.state.beakSwings, weapon === "attack-beak" ? 1 : 0);
    } finally { a.sim.dispose(); }
  }
});

test("pausing physics freezes a melee windup and clears queued attack requests", async () => {
  const a = await setup();
  try {
    a.state.beakAttackRequested = 1; a.tick(0.1);
    const age = a.state.beakAttack.age, cooldown = a.state.beakCooldown;
    const pose = { ...a.sim.combat.rival.translation() };
    a.state.running = false; a.state.beakAttackRequested = -1; a.tick(2);
    assert.equal(a.state.beakAttack.age, age); assert.equal(a.state.beakCooldown, cooldown);
    assert.equal(a.state.beakHits, 0); assert.equal(a.state.beakAttackRequested, 0);
    assert.deepEqual({ ...a.sim.combat.rival.translation() }, pose);
    a.state.running = true; a.tick(0.2);
    assert.equal(a.state.beakHits, 1); assert.equal(a.state.beakSwings, 1);
  } finally { a.sim.dispose(); }
});

test("another melee hit re-launches an airborne opponent without restarting its five-second recovery", async () => {
  const a = await setup();
  try {
    a.state.beakAttackRequested = 1; a.tick(0.8);
    assert.equal(a.state.beakHits, 1); assert.equal(a.state.rival.health, 75);
    const body = a.sim.combat.rival, player = a.sim.body.translation();
    body.setTranslation({ x: player.x + 2.3, y: player.y + 0.6, z: player.z - 1.5 }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    a.sim.world.step();
    const remaining = a.state.rival.recovery;
    a.state.beakAttackRequested = 1;
    let previousYVelocity = body.linvel().y;
    for (let i = 0; i < 80 && a.state.beakHits === 1; i++) {
      previousYVelocity = body.linvel().y; a.tick(1 / 120);
    }
    assert.equal(a.state.beakHits, 2); assert.equal(a.state.rival.health, 50);
    assert(body.isDynamic());
    assert(body.linvel().y > previousYVelocity + 2.5, "the second impact must add an upward impulse even while falling");
    assert(a.state.rival.recovery > 0 && a.state.rival.recovery < remaining, "a repeat hit must preserve the rescue countdown");
  } finally { a.sim.dispose(); }
});

test("reset clears melee state and switching back to ranged weapons keeps attack slots exclusive", async () => {
  const a = await setup();
  try {
    a.state.beakAttackRequested = 1; a.tick(0.3);
    assert.equal(a.state.beakHits, 1); assert(a.state.beakAttack); assert(a.state.beakImpacts.length > 0);
    for (const weapon of ["launcher", "gatling"]) {
      a.sim.reset(path, chunks, { distance: 0, lane: 0 }, { weapon }, { rival: true, rivalSpawn: { distance: 12, lane: 0 } });
      a.sim.update(0, a.state);
      assert(!a.state.beakEquipped); assert.equal(a.state.beakAttack, null);
      assert.equal(a.state.beakHits, 0); assert.equal(a.state.beakSwings, 0); assert.equal(a.state.beakCooldown, 0);
      assert.deepEqual(a.state.beakImpacts, []);
      a.state.beakAttackRequested = 1; a.state.fireRequested = true; a.state.gatlingHeld = true; a.tick(0.65);
      assert.equal(a.state.beakSwings, 0); assert.equal(a.state.weaponShots > 0, weapon === "launcher");
      assert.equal(a.state.gatlingShots > 0, weapon === "gatling");
    }
    a.sim.reset(path, chunks, { distance: 0, lane: 0 }, { weapon: "attack-beak" }, { rival: false });
    a.state.beakAttackRequested = 0;
    a.sim.update(0, a.state);
    assert.equal(a.state.beakEquipped, true); assert.equal(a.state.beakAttack, null);
    assert.equal(a.state.rival, null); assert.deepEqual(a.state.beakImpacts, []);
    a.state.beakAttackRequested = 1; a.tick(0.3);
    assert.equal(a.state.beakSwings, 1); assert(a.state.beakAttack);
    assert.equal(a.state.beakHits, 0);
  } finally { a.sim.dispose(); }
});
