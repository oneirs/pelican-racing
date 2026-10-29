export const GATLING_DAMAGE = 8;
export const GATLING_RANGE = 180;
export const GATLING_INTERVAL = 0.1; // Two barrels fire together: 20 rounds per second.
function rotate(v, q) {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + q.y * tz - q.z * ty, y: v.y + q.w * ty + q.z * tx - q.x * tz, z: v.z + q.w * tz + q.x * ty - q.y * tx };
}
export function createGatlingCombat({ R, world, player, equipped, getOrigin, damageTarget }) {
  let bullets = [], impacts = [], cooldown = 0, shots = 0, hits = 0, id = 0, phase = 0, firing = false;
  const shape = new R.Ball(0.075);
  return {
    beforeStep(dt, state, crashed) {
      impacts.forEach(p => p.age += dt); impacts = impacts.filter(p => p.age < 0.45);
      firing = equipped && !!state.gatlingHeld && !crashed && !!state.running;
      cooldown = Math.max(0, cooldown - dt);
      if (!firing) return;
      phase = (phase + dt * 42) % (Math.PI * 2);
      if (cooldown > 1e-6) return;
      cooldown = GATLING_INTERVAL;
      const q = player.rotation(), p = player.translation(), v = player.linvel();
      const direction = rotate({ x: 0, y: 0, z: -1 }, q);
      for (const side of [-1, 1]) {
        const offset = rotate({ x: side * 0.372, y: 0.735, z: -0.55 }, q);
        bullets.push({ id: ++id, x: p.x + offset.x, y: p.y + offset.y, z: p.z - getOrigin() + offset.z,
          dx: direction.x, dy: direction.y, dz: direction.z, travelled: 0, muzzle: 0.55,
          speed: 300 + Math.max(0, v.x * direction.x + v.y * direction.y + v.z * direction.z) });
        shots++;
      }
    },
    afterStep(dt) {
      bullets = bullets.filter(b => {
        const travel = Math.min(GATLING_RANGE - b.travelled, b.speed * dt + b.muzzle); b.muzzle = 0;
        const hit = world.castShape({ x: b.x, y: b.y, z: b.z + getOrigin() }, { x: 0, y: 0, z: 0, w: 1 },
          { x: b.dx, y: b.dy, z: b.dz }, shape, 0, travel, true, undefined, undefined, undefined, player);
        const length = hit ? hit.time_of_impact : travel;
        b.x += b.dx * length; b.y += b.dy * length; b.z += b.dz * length; b.travelled += length;
        if (hit) {
          const character = damageTarget(hit.collider.handle, GATLING_DAMAGE, b);
          if (character) hits++;
          impacts.push({ id: ++id, x: b.x, y: b.y, z: b.z, age: 0, character });
          if (impacts.length > 32) impacts.shift();
          return false;
        }
        return b.travelled < GATLING_RANGE;
      });
    },
    read(state) {
      state.gatlingAim = null;
      state.gatlingEquipped = equipped; state.gatlingFiring = firing && state.running && !state.crashed;
      state.gatlingShots = shots; state.gatlingHits = hits; state.gatlingPhase = phase;
      state.bullets = bullets.map(b => ({ ...b })); state.bulletImpacts = impacts.map(p => ({ ...p }));
    },
  };
}
