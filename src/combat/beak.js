import { BEAK_ACTION_TIME, BEAK_WINDUP, BEAK_SWEEP_TIME, beakSwingAngle } from "./beak-motion.js?v=beak-54";

export const BEAK_DAMAGE = 25;
export const BEAK_RANGE = 4;
export const BEAK_COOLDOWN = 0.75;
const BEAK_RADIUS = 0.35;
// Neck pivot from the .62-scale racing model, relative to the bicycle body.
const PIVOT = { x: 0, y: 1.9316, z: -0.1426 };
const SWEEP_END = BEAK_WINDUP + BEAK_SWEEP_TIME;
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

function rotate(v, q) {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + q.y * tz - q.z * ty, y: v.y + q.w * ty + q.z * tx - q.x * tz, z: v.z + q.w * tz + q.x * ty - q.y * tx };
}

export function createBeakCombat({ R, world, player, equipped, getOrigin, targetHandles, damageTarget }) {
  const shaft = new R.Ball(BEAK_RADIUS);
  const targets = targetHandles ?? new Set();
  let action = null, sweep = null, cooldown = 0, swings = 0, hits = 0, id = 0;
  let impacts = [];
  // Actors block the shaft; all other solid objects prevent attacks through walls.
  const blocksShaft = collider => targets.has(collider.handle) || !collider.isSensor();

  function sweepShaft(fromAge, toAge, direction, struck) {
    const q = player.rotation(), p = player.translation(), offset = rotate(PIVOT, q);
    const origin = { x: p.x + offset.x, y: p.y + offset.y, z: p.z + offset.z };
    const fromAngle = beakSwingAngle(fromAge, direction), toAngle = beakSwingAngle(toAge, direction);
    // Angular substeps close the gaps between fixed physics frames, without an unbounded target scan.
    const samples = Math.min(32, Math.max(1, Math.ceil(Math.abs(toAngle - fromAngle) * BEAK_RANGE / (BEAK_RADIUS * 0.7))));
    for (let i = 0; i <= samples; i++) {
      const angle = fromAngle + (toAngle - fromAngle) * i / samples;
      const radial = rotate({ x: -Math.sin(angle), y: 0, z: -Math.cos(angle) }, q);
      const hit = world.castShape(origin, IDENTITY, radial, shaft, 0, BEAK_RANGE - BEAK_RADIUS, true,
        undefined, undefined, undefined, player, blocksShaft);
      if (!hit || !targets.has(hit.collider.handle)) continue;
      const actor = hit.collider.parent()?.handle ?? hit.collider.handle;
      if (struck.has(actor)) continue;
      const tangent = rotate({ x: direction * Math.cos(angle), y: 0, z: -direction * Math.sin(angle) }, q);
      const length = Math.hypot(tangent.x, tangent.z);
      if (length < 1e-6) continue;
      const point = {
        x: origin.x + radial.x * hit.time_of_impact,
        y: origin.y + radial.y * hit.time_of_impact,
        z: origin.z + radial.z * hit.time_of_impact - getOrigin(),
        dx: tangent.x / length, dy: 0, dz: tangent.z / length,
        weapon: "attack-beak", direction,
      };
      if (!damageTarget(hit.collider.handle, BEAK_DAMAGE, point)) continue;
      struck.add(actor); hits++;
      impacts.push({ id: ++id, x: point.x, y: point.y, z: point.z, age: 0, direction });
      if (impacts.length > 8) impacts.shift();
    }
  }

  return {
    beforeStep(dt, state, crashed) {
      sweep = null;
      const requested = state.beakAttackRequested;
      state.beakAttackRequested = 0;
      if (!state.running || !(dt > 0) || !Number.isFinite(dt)) return;
      cooldown = Math.max(0, cooldown - dt);
      impacts.forEach(impact => impact.age += dt);
      impacts = impacts.filter(impact => impact.age < 0.35);
      if (!equipped || crashed) { action = null; return; }
      if ((requested === -1 || requested === 1) && cooldown <= 1e-6 && !action) {
        action = { age: 0, direction: requested, struck: new Set() };
        cooldown = BEAK_COOLDOWN; swings++;
      }
      if (!action) return;
      const previousAge = action.age;
      action.age += dt;
      if (action.age > BEAK_WINDUP && previousAge < SWEEP_END) {
        sweep = { fromAge: Math.max(BEAK_WINDUP, previousAge), toAge: Math.min(SWEEP_END, action.age), direction: action.direction, struck: action.struck };
      }
      if (action.age >= BEAK_ACTION_TIME) action = null;
    },
    afterStep() {
      if (!sweep) return;
      sweepShaft(sweep.fromAge, sweep.toAge, sweep.direction, sweep.struck);
      sweep = null;
    },
    read(state) {
      state.beakEquipped = !!equipped;
      state.beakAttack = action ? { age: action.age, direction: action.direction } : null;
      state.beakCooldown = cooldown; state.beakSwings = swings; state.beakHits = hits;
      state.beakImpacts = impacts.map(impact => ({ ...impact }));
    },
  };
}
