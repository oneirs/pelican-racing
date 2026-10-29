import test from "node:test";
import assert from "node:assert/strict";
import { loadPhysics } from "../src/physics/engine.js";
import { createCombat } from "../src/combat/simulation.js";

const path = { width: 12, height: 0.22 };
async function arena(weapon, wall = false) {
  const R = await loadPhysics(), world = new R.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 120;
  const player = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, 1, 0));
  world.createCollider(R.ColliderDesc.cuboid(0.3, 0.18, 0.78), player);
  if (wall) world.createCollider(R.ColliderDesc.cuboid(6, 3, 0.2).setTranslation(0, 2, -10));
  const combat = createCombat({ R, world, player, path, spawn: { distance: 0, lane: 0 }, weapon, getOrigin: () => 0, rivalEnabled: false });
  const state = { running: true, distance: 0, fireRequested: true, gatlingHeld: true, beakAttackRequested: 1 };
  const tick = seconds => {
    for (let i = 0; i < Math.round(seconds * 120); i++) {
      combat.beforeStep(1 / 120, state, false); world.step(); combat.afterStep(1 / 120); combat.read(state);
    }
  };
  return { world, combat, state, tick };
}

test("solo training creates no rival rigid body while every equipped weapon remains usable", async () => {
  for (const weapon of ["standard", "launcher", "homing-launcher", "gatling", "attack-beak"]) {
    const a = await arena(weapon);
    try {
      assert.equal(a.combat.rival, null); assert.equal(a.combat.collider, null); assert.equal(a.combat.handles.size, 0);
      assert.equal(a.world.bodies.len(), 1, "training must not create a hidden AI body");
      a.tick(0.55);
      assert.equal(a.state.rival, null); assert.equal(a.state.weaponTarget, null); assert(!a.state.weaponLocked);
      assert.equal(a.state.weaponShots, ["launcher", "homing-launcher"].includes(weapon) ? 1 : 0);
      assert.equal(a.state.gatlingShots > 0, weapon === "gatling");
      assert.equal(a.state.beakSwings, weapon === "attack-beak" ? 1 : 0);
      assert.equal(a.state.beakHits, 0); assert.equal(a.state.weaponHits, 0); assert.equal(a.state.gatlingHits, 0);
      if (weapon === "homing-launcher") {
        const missile = a.state.missiles[0];
        assert(missile && !missile.guided); assert.equal(missile.dx, 0); assert.equal(missile.dy, 0); assert.equal(missile.dz, -1);
      }
    } finally { a.world.free(); }
  }
});

test("solo projectiles still collide with obstacles and homing rockets fall back to straight flight", async () => {
  for (const weapon of ["launcher", "homing-launcher", "gatling"]) {
    const a = await arena(weapon, true);
    try {
      a.tick(0.7);
      assert.equal(a.state.rival, null); assert(!a.state.weaponLocked);
      if (weapon === "gatling") {
        assert(a.state.bulletImpacts.length > 0);
        assert(a.state.bulletImpacts.every(impact => !impact.character && Math.abs(impact.z + 10) < 0.5));
      } else {
        assert.equal(a.state.missiles.length, 0); assert.equal(a.state.weaponBlasts, 1);
        assert.equal(a.state.explosions.length, 1); assert(Math.abs(a.state.explosions[0].z + 10) < 0.5);
      }
      assert.equal(a.state.weaponHits, 0); assert.equal(a.state.gatlingHits, 0);
    } finally { a.world.free(); }
  }
});
