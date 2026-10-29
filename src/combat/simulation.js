import { createGatlingCombat } from "./gatling.js?v=combat-48";
import { createBeakCombat } from "./beak.js?v=beak-54";
import { createRacerDriver } from "./racer-driver.js?v=durability-57";
import { createDurability, selectImpactPart } from "../game/durability.js?v=durability-57";
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
export const ROCKET_COOLDOWN = 1.6;
export const ROCKET_RANGE = 240;
export const BLAST_RADIUS = 13.5;

export const DRAW_TIME = 0.48;
export const ACTION_TIME = 1.15;
// The rival races independently; explosions switch it to a dynamic Rapier body.
export function createCombat({ R, world, player, path, spawn, rivalSpawn, weapon, getOrigin, rivalEnabled = true }) {
  let cooldown = 0, recovery = 0, speed = 0, phase = 0, shots = 0, hits = 0, blasts = 0, id = 0;
  let missiles = [], explosions = [];
  let stepping = false;
  let action = null, health = 100, hitFlash = 0;
  const partDurability = createDurability({});
  const homing = weapon === "homing-launcher";
  const explosiveEquipped = homing || weapon === "launcher";
  const missileShape = new R.Ball(0.09);
  const start = { ...(rivalSpawn ?? { distance: spawn.distance, lane: Math.abs(spawn.lane) > 1 ? -spawn.lane : 3 }) };
  start.lane = clamp(start.lane, -path.width / 2 + 1.5, path.width / 2 - 1.5);
  const driver = rivalEnabled ? createRacerDriver(path, start) : null;
  const clearanceShape = new R.Ball(0.6);
  const rival = rivalEnabled ? world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true)) : null;
  const collider = rival ? world.createCollider(R.ColliderDesc.cuboid(0.35, 0.18, 0.85).setMass(80).setFriction(0.5).setRestitution(0.05).setCollisionGroups(0x00010003), rival) : null;
  const target = rival ? world.createCollider(R.ColliderDesc.cuboid(0.55, 0.85, 0.9).setTranslation(0, 0.8, 0).setSensor(true).setMass(0).setCollisionGroups(0x00010003), rival) : null;
  const handles = new Set(collider ? [collider.handle, target.handle] : []);
  function place(distance) {
    const pose = path.sample(distance, driver.lane), yaw = Math.atan2(-pose.tangent.x, -pose.tangent.z);
    rival.setBodyType(R.RigidBodyType.KinematicPositionBased, true);
    rival.setTranslation({ x: pose.point.x, y: path.height + 0.8, z: pose.point.z + getOrigin() }, true);
    rival.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    rival.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rival.setAngvel({ x: 0, y: 0, z: 0 }, true);
    speed = 0; driver.stop(); health = 100; hitFlash = 0;
    partDurability.repairBroken();
  }
  if (rival) place(start.distance);
  function targetPosition() {
    if (!target) return null;
    const p = target.translation();
    return { x: p.x, y: p.y, z: p.z - getOrigin() };
  }
  function nearbyTarget(origin) {
    const p = targetPosition();
    if (!p) return null;
    return Math.hypot(p.x - origin.x, p.y - origin.y, p.z - origin.z) <= 140 ? p : null;
  }
  function localImpact(point) {
    const p = rival.translation(), rotation = rival.rotation();
    const q = { x: -rotation.x, y: -rotation.y, z: -rotation.z, w: rotation.w };
    const v = { x: point.x - p.x, y: point.y - p.y, z: point.z + getOrigin() - p.z };
    const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
    return {
      x: v.x + q.w * tx + q.y * tz - q.z * ty,
      y: v.y + q.w * ty + q.z * tx - q.x * tz,
      z: v.z + q.w * tz + q.x * ty - q.y * tx,
    };
  }
  function damagePart(point, damage, blast = false) {
    const local = localImpact(point);
    if (blast) {
      // A blast hits the nearest surface of the body sensor, not its distant epicentre.
      local.x = clamp(local.x, -0.55, 0.55);
      local.y = clamp(local.y, -0.05, 1.65);
      local.z = clamp(local.z, -0.9, 0.9);
    }
    partDurability.damage(selectImpactPart(local), damage);
  }
  function aim() {
    const p = player.translation(), q = player.rotation();
    const rotate = (x, y, z) => {
      const tx = 2 * (q.y * z - q.z * y), ty = 2 * (q.z * x - q.x * z), tz = 2 * (q.x * y - q.y * x);
      return { x: x + q.w * tx + q.y * tz - q.z * ty, y: y + q.w * ty + q.z * tx - q.x * tz, z: z + q.w * tz + q.x * ty - q.y * tx };
    };
    const offset = rotate(0.527, 1.355, -0.155), forward = rotate(0, 0, -1);
    const origin = { x: p.x + offset.x, y: p.y + offset.y, z: p.z - getOrigin() + offset.z };
    const lock = homing ? nearbyTarget(origin) : null;
    if (lock) {
      const dx = lock.x - origin.x, dy = lock.y - origin.y, dz = lock.z - origin.z;
      const length = Math.hypot(dx, dy, dz);
      if (length > 0.001) return { ...origin, dx: dx / length, dy: dy / length, dz: dz / length, guided: true };
    }
    return { ...origin, dx: forward.x, dy: forward.y, dz: forward.z, guided: false };
  }
  function wreck(point) {
    health = 0; recovery = 5;
    const p = rival.translation(), q = rival.rotation();
    const dx = p.x - point.x, dz = p.z - getOrigin() - point.z;
    rival.setBodyType(R.RigidBodyType.Dynamic, true);
    rival.setEnabledRotations(true, true, true, true);
    rival.setAngularDamping(0.5);
    rival.setLinvel({ x: -Math.sin(2 * Math.atan2(q.y, q.w)) * speed, y: 0, z: -Math.cos(2 * Math.atan2(q.y, q.w)) * speed }, true);
    const length = Math.max(1, Math.hypot(dx, dz));
    rival.applyImpulse({ x: dx / length * 240, y: 720, z: dz / length * 240 }, true);
    rival.applyTorqueImpulse({ x: -70, y: 16, z: 38 }, true);
  }
  function explode(point) {
    blasts++; explosions.push({ id: ++id, ...point, age: 0 });
    if (explosions.length > 6) explosions.shift();
    if (!rival) return;
    const p = rival.translation(), dx = p.x - point.x, dy = p.y + 0.6 - point.y, dz = p.z - getOrigin() - point.z;
    if (Math.hypot(dx, dy, dz) < BLAST_RADIUS) {
      hits++;
      damagePart(point, 90, true);
      if (recovery <= 0) wreck(point);
      else {
        const length = Math.max(1, Math.hypot(dx, dz));
        rival.applyImpulse({ x: dx / length * 240, y: 720, z: dz / length * 240 }, true);
        rival.applyTorqueImpulse({ x: -35, y: 8, z: 19 }, true);
      }
    }
  }
  const gun = createGatlingCombat({ R, world, player, equipped: weapon === "gatling", getOrigin,
    damageTarget(handle, damage, point) {
      if (!handles.has(handle)) return false;
      damagePart(point, damage);
      if (rival && recovery > 0) {
        hitFlash = 0.14;
        rival.applyImpulse({ x: point.dx * 14, y: 90 + Math.max(0, point.dy) * 14, z: point.dz * 14 }, true);
        return true;
      }
      health = Math.max(0, health - damage); hitFlash = 0.14;
      if (health === 0) wreck(point);
      return true;
    },
  });
  const beak = createBeakCombat({ R, world, player, equipped: weapon === "attack-beak", getOrigin,
    targetHandles: handles,
    damageTarget(handle, damage, point) {
      if (!handles.has(handle)) return false;
      damagePart(point, damage);
      health = Math.max(0, health - damage);
      hitFlash = 0.14;
      const airborne = recovery > 0;
      if (!airborne) {
        recovery = 5;
        const q = rival.rotation(), yaw = 2 * Math.atan2(q.y, q.w);
        rival.setBodyType(R.RigidBodyType.Dynamic, true);
        rival.setEnabledRotations(true, true, true, true);
        rival.setAngularDamping(0.5);
        rival.setLinvel({ x: -Math.sin(yaw) * speed, y: 0, z: -Math.cos(yaw) * speed }, true);
      }
      rival.applyImpulse({ x: point.dx * 320, y: airborne ? 240 : 480, z: point.dz * 320 }, true);
      rival.applyTorqueImpulse({ x: -35, y: point.direction * 14, z: point.direction * 38 }, true);
      return true;
    },
  });
  return {
    rival, collider, handles,
    beforeStep(dt, state, playerCrashed) {
      stepping = !!state.running;
      if (!stepping) return;
      partDurability.tick(dt);
      cooldown = Math.max(0, cooldown - dt);
      hitFlash = Math.max(0, hitFlash - dt);
      explosions.forEach(e => e.age += dt);
      explosions = explosions.filter(e => e.age < 0.95);
      if (recovery > 0) {
        recovery = Math.max(0, recovery - dt);
        if (recovery === 0) place(driver.distance);
      } else if (rival) {
        const pose = driver.update(dt, candidateLane => {
          const at = path.sample(driver.distance, candidateLane);
          const hit = world.castShape({ x: at.point.x, y: path.height + 0.9, z: at.point.z + getOrigin() },
            { x: 0, y: 0, z: 0, w: 1 }, at.tangent, clearanceShape, 0, 115, true,
            undefined, undefined, undefined, rival, c => !c.isSensor());
          return hit ? hit.time_of_impact : Infinity;
        }, 0.7 + health * 0.003);
        speed = driver.speed; phase = driver.phase;
        const yaw = Math.atan2(-pose.tangent.x, -pose.tangent.z);
        rival.setNextKinematicTranslation({ x: pose.point.x, y: path.height + 0.8, z: pose.point.z + getOrigin() });
        rival.setNextKinematicRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
      }
      gun.beforeStep(dt, state, playerCrashed);
      beak.beforeStep(dt, state, playerCrashed);
      const requested = state.fireRequested;
      state.fireRequested = false;
      if (playerCrashed) { action = null; return; }
      if (requested && explosiveEquipped && cooldown === 0 && !action) {
        action = { age: 0, fired: false, aim: aim() };
        cooldown = ROCKET_COOLDOWN;
      }
      if (!action) return;
      action.age += dt;
      action.aim = aim();
      if (!action.fired && action.age >= DRAW_TIME) {
        const direction = action.aim, pv = player.linvel();
        missiles.push({ id: ++id, ...direction,
          speed: 105 + Math.max(0, pv.x * direction.dx + pv.z * direction.dz), travelled: 0 });
        action.fired = true; shots++;
      }
      if (action.age >= ACTION_TIME) action = null;
    },
    afterStep(dt) {
      if (!stepping) return;
      gun.afterStep(dt);
      beak.afterStep(dt);
      missiles = missiles.filter(m => {
        if (m.guided && target) {
          const p = targetPosition(), dx = p.x - m.x, dy = p.y - m.y, dz = p.z - m.z;
          const length = Math.hypot(dx, dy, dz);
          if (length > 0.001) {
            const ux = dx / length, uy = dy / length, uz = dz / length;
            const dot = clamp(m.dx * ux + m.dy * uy + m.dz * uz, -1, 1);
            const angle = Math.acos(dot), step = Math.min(angle, 0.65 * dt);
            // Bounded turning; never snap or chase a target behind the missile.
            if (dot > -0.95 && angle > 0.00001) {
              const a = Math.sin(angle - step) / Math.sin(angle), b = Math.sin(step) / Math.sin(angle);
              const x = a * m.dx + b * ux, y = a * m.dy + b * uy, z = a * m.dz + b * uz;
              const norm = Math.hypot(x, y, z);
              m.dx = x / norm; m.dy = y / norm; m.dz = z / norm;
            }
          }
        }
        const distance = Math.min(m.speed * dt, ROCKET_RANGE - m.travelled);
        const hit = world.castShape({ x: m.x, y: m.y, z: m.z + getOrigin() },
          { x: 0, y: 0, z: 0, w: 1 }, { x: m.dx, y: m.dy, z: m.dz },
          missileShape, 0, distance, true, undefined, undefined, undefined, player);
        const travel = hit ? hit.time_of_impact : distance;
        m.x += m.dx * travel; m.y += m.dy * travel; m.z += m.dz * travel; m.travelled += travel;
        if (hit) { explode({ x: m.x, y: m.y, z: m.z }); return false; }
        return m.travelled < ROCKET_RANGE && m.y > -3;
      });
    },
    read(state) {
      gun.read(state);
      beak.read(state);
      if (rival) {
        const p = rival.translation(), q = rival.rotation();
        state.rival = { x: p.x, y: p.y, z: p.z - getOrigin(), rotation: { ...q }, yaw: 2 * Math.atan2(q.y, q.w), speed, phase, recovery, health, hitFlash, distance: driver.distance, maxSpeedKmh: driver.tuning.maxSpeedKmh, gap: driver.distance - state.distance, partDurability: partDurability.read() };
      } else state.rival = null;
      state.weaponEquipped = explosiveEquipped;
      state.weaponKind = weapon;
      state.weaponAction = action ? { age: action.age, fired: action.fired, aim: { ...action.aim } } : null;
      state.weaponCooldown = cooldown;
      state.weaponTarget = homing ? nearbyTarget(aim()) : null;
      state.weaponLocked = !!state.weaponTarget;
      state.weaponShots = shots; state.weaponHits = hits; state.weaponBlasts = blasts;
      state.missiles = missiles.map(m => ({ ...m }));
      state.explosions = explosions.map(e => ({ ...e }));
    },
  };
}
