import { balanceAtSpeed, steeringLimit, cornerLean } from "./handling.js?v=combat-48";
import { createDebris } from "./debris.js?v=combat-48";
import { computeTuning, normalizeParts } from "../game/upgrades.js?v=durability-57";
import { loadPhysics } from "./engine.js?v=combat-48";
import { FIXED_DT, SMASH_SPEED_KMH } from "./config.js?v=combat-48";
import { CHUNK_LENGTH } from "../world/endless/config.js?v=combat-48";
import { createCombat } from "../combat/simulation.js?v=durability-57";
import { createDurability, selectImpactPart } from "../game/durability.js?v=durability-57";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export async function createRiderPhysics() {
  const R = await loadPhysics();
  let world,
    body,
    collider,
    vehicle,
    events,
    path,
    origin = 0,
    accumulator = 0;
  let tuning = computeTuning();
  let combat = null;
  let durability = null;
  const roads = new Map();
  const obstacles = new Map();
  const pickups = new Map();
  let pickupBoost = 0, pickupNotice = "", pickupNoticeTime = 0;
  const groundHandles = new Set();
  const impactHandles = new Set();
  const railHandles = new Set();
  const obstacleHandles = new Map();
  let debris,
    effectEvents = [],
    destroyedCount = 0,
    scrapeClock = 0;
  let collisionCount = 0,
    impact = 0,
    crashTime = 0;
  let crashHeading = 0;
  let crashing = false, crashElapsed = 0, landingBlend = 0, balanceAfterLanding = false;
  let recoverySuspended = false;
  let reverseSeconds = 0, directionCorrecting = false, rideLean = 0;
  let pedalPhase = 0, cadenceRpm = 0, braking = false;
  let driveEngagement = 0;
  let weightX = 0, weightZ = 0;
  function makeWorld() {
    world = new R.World({ x: 0, y: -9.81, z: 0 });
    events = new R.EventQueue(true);
    world.timestep = FIXED_DT;
    world.maxCcdSubsteps = 4;
    world.numSolverIterations = 8;
    debris = createDebris(R, world);
  }
  function addRoad(id, chunk) {
    const start = id * CHUNK_LENGTH,
      vertices = [],
      indices = [];
    for (let i = 0; i <= 32; i++) {
      const d = start + i * 2,
        pose = path.sample(d);
      for (const side of [-1, 1]) {
        const p = pose.point
          .clone()
          .addScaledVector(pose.normal, side * (path.width / 2 + 0.8));
        vertices.push(p.x, path.height, p.z + start);
      }
      if (i) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const fixed = world.createRigidBody(
      R.RigidBodyDesc.fixed().setTranslation(0, 0, origin - start),
    );
    const ground = world.createCollider(
      R.ColliderDesc.trimesh(
        new Float32Array(vertices),
        new Uint32Array(indices),
      )
        .setFriction(1.2)
        .setRestitution(0),
      fixed,
    );
    groundHandles.add(ground.handle);
    for (const rail of chunk.userData.barriers ?? []) {
      const q = {
        x: 0,
        y: Math.sin(rail.yaw / 2),
        z: 0,
        w: Math.cos(rail.yaw / 2),
      };
      const barrier = world.createCollider(
        R.ColliderDesc.cuboid(...rail.half)
          .setTranslation(rail.x, rail.y, rail.z)
          .setRotation(q)
          .setFriction(0.25)
          .setRestitution(0)
          .setRestitutionCombineRule(R.CoefficientCombineRule.Min),
        fixed,
      );
      impactHandles.add(barrier.handle);
      railHandles.add(barrier.handle);
    }
    for (const terrain of chunk.userData.terrain ?? []) {
      const surface = world.createCollider(
        R.ColliderDesc.trimesh(new Float32Array(terrain.vertices), new Uint32Array(terrain.indices))
          .setFriction(1.2).setRestitution(0), fixed,
      );
      groundHandles.add(surface.handle);
    }
    pickups.set(id, (chunk.userData.pickups ?? []).map(spec => ({ ...spec, collected: false })));
    roads.set(id, fixed);
    const objects = [];
    for (const spec of chunk.userData.obstacles ?? []) {
      const obstacle = world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(spec.x, spec.y, origin - start + spec.z)
          .setLinearDamping(0.12)
          .setAngularDamping(0.3)
          .setCcdEnabled(true),
      );
      const shape = world.createCollider(
        R.ColliderDesc.cylinder(spec.halfHeight, spec.radius)
          .setMass(spec.mass)
          .setFriction(0.8)
          .setRestitution(0.15),
        obstacle,
      );
      impactHandles.add(shape.handle);
      const object = {
        body: obstacle,
        handle: shape.handle,
        mesh: spec.mesh,
        hp: 100,
        breakable: !!spec.breakable,
        chunkId: id,
      };
      if (spec.mesh) spec.mesh.visible = true;
      objects.push(object);
      obstacleHandles.set(shape.handle, object);
    }
    obstacles.set(id, objects);
  }
  function syncChunks(chunks) {
    debris?.syncChunks(chunks);
    for (const [id, fixed] of roads)
      if (!chunks.has(id)) {
        for (let i = 0; i < fixed.numColliders(); i++) {
          impactHandles.delete(fixed.collider(i).handle);
          railHandles.delete(fixed.collider(i).handle);
          groundHandles.delete(fixed.collider(i).handle);
        }
        for (const object of obstacles.get(id) ?? []) {
          impactHandles.delete(object.handle);
          obstacleHandles.delete(object.handle);
          if (object.body) world.removeRigidBody(object.body);
        }
        obstacles.delete(id);
        pickups.delete(id);
        world.removeRigidBody(fixed);
        roads.delete(id);
      }
    for (const [id, chunk] of chunks) if (!roads.has(id)) addRoad(id, chunk);
  }
  function reset(nextPath, chunks, spawn, parts, options = {}) {
    parts = normalizeParts(parts);
    durability = createDurability(parts);
    tuning = computeTuning(parts);
    combat = null;
    if (world) world.free();
    events?.free();
    roads.clear();
    groundHandles.clear();
    obstacles.clear();
    pickups.clear();
    pickupBoost = pickupNoticeTime = 0; pickupNotice = "";
    impactHandles.clear();
    railHandles.clear();
    obstacleHandles.clear();
    effectEvents = [];
    destroyedCount = scrapeClock = 0;
    collisionCount = impact = crashTime = 0;
    crashing = balanceAfterLanding = recoverySuspended = false;
    crashElapsed = landingBlend = 0;
    reverseSeconds = rideLean = weightX = weightZ = driveEngagement = 0;
    directionCorrecting = false;
    path = nextPath;
    origin = Math.floor(spawn.distance / 256) * 256;
    accumulator = 0;
    pedalPhase = cadenceRpm = 0;
    braking = false;
    makeWorld();
    syncChunks(chunks);
    const p = path.sample(spawn.distance, spawn.lane),
      yaw = Math.atan2(-p.tangent.x, -p.tangent.z);
    body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(p.point.x, path.height + 0.58, origin + p.point.z)
        .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
        .enabledRotations(false, true, false)
        .setCcdEnabled(true)
        .setCanSleep(false)
        .setAngularDamping(2)
        .setAdditionalSolverIterations(4),
    );
    collider = world.createCollider(
      R.ColliderDesc.cuboid(0.3, 0.18, 0.78)
        .setCollisionGroups(0x00020001)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS)
        .setMass(tuning.mass)
        .setFriction(0.2)
        .setRestitution(0.05),
      body,
    );
    vehicle = world.createVehicleController(body);
    vehicle.indexUpAxis = 1;
    vehicle.setIndexForwardAxis = 2;
    for (const z of [-0.85, 0.85]) {
      vehicle.addWheel(
        { x: 0, y: 0, z },
        { x: 0, y: -1, z: 0 },
        { x: 1, y: 0, z: 0 },
        0.25,
        0.42,
      );
      const i = vehicle.numWheels() - 1;
      vehicle.setWheelSuspensionStiffness(i, 50);
      vehicle.setWheelSuspensionCompression(i, 4.4);
      vehicle.setWheelSuspensionRelaxation(i, 4.6);
      vehicle.setWheelMaxSuspensionTravel(i, 0.18);
      vehicle.setWheelMaxSuspensionForce(i, 12000);
      vehicle.setWheelFrictionSlip(i, tuning.grip);
      vehicle.setWheelSideFrictionStiffness(i, (1.1 * tuning.grip) / 3);
    }
    combat = createCombat({ R, world, player: body, path, spawn, rivalSpawn: options.rivalSpawn, weapon: parts?.weapon, getOrigin: () => origin, rivalEnabled: !!options.rival });
    if (combat.collider) impactHandles.add(combat.collider.handle);
    // A settling step also makes newly inserted ground available to wheel queries.
    world.step();
  }
  function rebase() {
    const p = body.translation();
    if (Math.abs(p.z) < 256) return;
    const shift = -Math.trunc(p.z / 256) * 256;
    origin += shift;
    world.forEachRigidBody((b) => {
      const p = b.translation();
      b.setTranslation({ x: p.x, y: p.y, z: p.z + shift }, false);
    });
    world.propagateModifiedBodyPositionsToColliders();
  }
  function launchCrash(speed) {
    crashTime = tuning.recoveryTime;
    crashing = true;
    recoverySuspended = false;
    crashElapsed = 0;
    landingBlend = 0;
    driveEngagement = 0;
    body.setGravityScale(tuning.airGravity, true);
    body.setEnabledRotations(true, true, true, true);
    body.setAngularDamping(0.25);
    body.setLinearDamping(0.15);
    body.resetForces(true);
    // Deliberate arcade launch impulse; Rapier handles the subsequent flight and contacts.
    body.applyImpulse(
      { x: 0, y: body.mass() * clamp(5 + speed * 0.045, 5.5, 11), z: 0 },
      true,
    );
    const q = body.rotation(),
      yaw = 2 * Math.atan2(q.y, q.w);
    crashHeading = yaw;
    body.applyTorqueImpulse(
      { x: Math.cos(yaw) * -45, y: 6, z: Math.sin(yaw) * 45 + 10 },
      true,
    );
    for (let i = 0; i < 2; i++) {
      vehicle.setWheelEngineForce(i, 0);
      vehicle.setWheelBrake(i, 0);
    }
  }
  function uprightAmount() {
    const q = body.rotation();
    return 1 - 2 * (q.x * q.x + q.z * q.z);
  }
  function stabilize(strength, correctHeading = true) {
    const q = body.rotation(), w = body.angvel();
    const ux = 2 * (q.x * q.y - q.z * q.w), uz = 2 * (q.y * q.z + q.x * q.w);
    const tilt = Math.acos(clamp(uprightAmount(), -1, 1));
    const axisLength = Math.hypot(ux, uz);
    const rate = Math.min(0.8, tilt * 1.2);
    const tx = axisLength > 0.001 ? -uz / axisLength * rate : tilt > 1 ? rate : 0;
    const tz = axisLength > 0.001 ? ux / axisLength * rate : 0;
    const speed = Math.hypot(body.linvel().x, body.linvel().z);
    const gain = body.mass() * 0.18 * 5 * strength * (0.7 + balanceAtSpeed(speed) * 0.5) * FIXED_DT;
    const yaw = Math.atan2(2 * (q.x * q.z + q.y * q.w), 1 - 2 * (q.x * q.x + q.y * q.y));
    const yawError = Math.atan2(Math.sin(crashHeading - yaw), Math.cos(crashHeading - yaw));
    const yawImpulse = crashing && correctHeading ? (clamp(yawError * 3, -2, 2) - w.y) * gain : 0;
    body.applyTorqueImpulse({ x: (tx - w.x) * gain, y: yawImpulse, z: (tz - w.z) * gain }, true);
  }
  function assistForwardBalance(state) {
    if (!state.balanceAssistHeld) return;
    const w = body.angvel();
    if (uprightAmount() > 0.995 && Math.hypot(w.x, w.z) < 0.15) return;
    // Apply a limited roll/pitch torque, never snap pose, move position, or steer yaw.
    stabilize(0.6, false);
    state.balanceAssisting = true;
  }
  function engageDrive(state, contact) {
    if ((state.throttleInput ?? 0) <= 0 || state.brakeInput || state.brakeLatched) driveEngagement = 0;
    else if (contact) driveEngagement = Math.min(1, driveEngagement + FIXED_DT / 1.5);
  }
  function assistGroundDrive(state, supported, wheelTraction) {
    if (!supported || !state.balanceAssistHeld || driveEngagement === 0 || wheelTraction >= 1) return;
    const q = body.rotation(), v = body.linvel();
    const x = -2 * (q.x * q.z + q.y * q.w), z = -(1 - 2 * (q.x * q.x + q.y * q.y));
    const length = Math.hypot(x, z);
    // Ground-only arcade recovery push follows the horizontal bike heading.
    if (length < 0.1) return;
    const forwardX = x / length, forwardZ = z / length;
    const target = Math.min(20 / 3.6, Math.max(0, (state.targetKmh ?? tuning.maxSpeedKmh) / 3.6));
    if (target === 0) return;
    const speed = v.x * forwardX + v.z * forwardZ;
    const drive = tuning.driveForce * 0.6 * driveEngagement * (1 - wheelTraction)
      * clamp(1 - Math.max(0, speed) / target, 0, 1);
    // Airborne W still only assists balance.
    body.addForce({ x: forwardX * drive, y: 0, z: forwardZ * drive }, true);
  }
  function applyBalanceInput(state) {
    const roll = clamp(state.balanceRoll ?? 0, -1, 1), pitch = clamp(state.balancePitch ?? 0, -1, 1);
    if (!roll && !pitch) return;
    const q = body.rotation(), w = body.angvel();
    // Rotate rider-local pitch/roll axes into world space; input also works upside down.
    const right = { x: 1 - 2 * (q.y * q.y + q.z * q.z), y: 2 * (q.x * q.y + q.z * q.w), z: 2 * (q.x * q.z - q.y * q.w) };
    const back = { x: 2 * (q.x * q.z + q.y * q.w), y: 2 * (q.y * q.z - q.x * q.w), z: 1 - 2 * (q.x * q.x + q.y * q.y) };
    const dot = a => w.x * a.x + w.y * a.y + w.z * a.z;
    const pitchTorque = pitch ? clamp(-pitch * 1.8 - dot(right), -3, 3) : 0;
    const rollTorque = roll ? clamp(-roll * 2.2 - dot(back), -3, 3) : 0;
    const gain = body.mass() * 1.2 * FIXED_DT;
    body.applyTorqueImpulse({ x: (right.x * pitchTorque + back.x * rollTorque) * gain, y: (right.y * pitchTorque + back.y * rollTorque) * gain, z: (right.z * pitchTorque + back.z * rollTorque) * gain }, true);
  }
  function touchesRoad() {
    let touching = false;
    world.contactPairsWith(collider, (other) => {
      if (!groundHandles.has(other.handle)) return;
      world.contactPair(collider, other, (manifold) => {
        for (let i = 0; i < manifold.numContacts(); i++)
          if (manifold.contactDist(i) < 0.03) touching = true;
      });
    });
    return touching;
  }
  function finishLanding(state) {
    // Do not change translation, rotation or velocity on a natural landing.
    crashing = false;
    recoverySuspended = false;
    crashTime = impact = 0;
    landingBlend = 0.8;
    balanceAfterLanding = true;
    body.setGravityScale(1, true);
    body.setAngularDamping(2);
    body.setLinearDamping(0);
    body.resetForces(true);
    body.resetTorques(true);
  }
  function recoverOffTrack(state) {
    const distance = origin - body.translation().z;
    const lane = clamp(state.desiredLane ?? 0, -path.width / 2 + 1, path.width / 2 - 1);
    const p = path.sample(distance, lane), yaw = Math.atan2(-p.tangent.x, -p.tangent.z);
    body.setTranslation({ x: p.point.x, y: path.height + 0.58, z: origin + p.point.z }, true);
    body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    durability.repairBroken();
    finishLanding(state);
    state.desiredLane = lane;
    world.propagateModifiedBodyPositionsToColliders();
  }
  function emitEffect(type, position, strength, velocity = body.linvel(), travelVelocity = velocity) {
    if (effectEvents.length >= 64) effectEvents.shift();
    effectEvents.push({
      type,
      x: position.x,
      y: position.y,
      z: position.z - origin,
      strength,
      velocity: { ...velocity },
      travelVelocity: { ...travelVelocity },
    });
  }
  function damageObject(object, speed, velocityChange, forceBreak = false, travelVelocity) {
    if (!object?.breakable || !object.body) return;
    object.hp = forceBreak ? 0 : object.hp - velocityChange * (speed >= 12 ? 55 : 6);
    if (object.hp > 0) return;
    const position = { ...object.body.translation() },
      rotation = { ...object.body.rotation() },
      velocity = { ...object.body.linvel() };
    const strength = clamp(speed / 45, 0.2, 1);
    emitEffect("break", position, strength, velocity, travelVelocity);
    impactHandles.delete(object.handle);
    obstacleHandles.delete(object.handle);
    world.removeRigidBody(object.body);
    object.body = null;
    if (object.mesh) object.mesh.visible = false;
    debris.burst(position, rotation, velocity, strength, object.chunkId);
    destroyedCount++;
    return true;
  }
  function contactInfo(manifold, flipped) {
    if (!manifold.numContacts()) return null;
    let index = 0;
    for (let i = 1; i < manifold.numContacts(); i++)
      if (manifold.contactDist(i) < manifold.contactDist(index)) index = i;
    const local = flipped ? manifold.localContactPoint2(index) : manifold.localContactPoint1(index);
    if (!local) return null;
    const q = collider.rotation(), origin = collider.translation();
    const tx = 2 * (q.y * local.z - q.z * local.y), ty = 2 * (q.z * local.x - q.x * local.z), tz = 2 * (q.x * local.y - q.y * local.x);
    return {
      point: { x: origin.x + local.x + q.w * tx + q.y * tz - q.z * ty, y: origin.y + local.y + q.w * ty + q.z * tx - q.x * tz, z: origin.z + local.z + q.w * tz + q.x * ty - q.y * tx },
      normal: manifold.normal(), distance: manifold.contactDist(index),
    };
  }
  function intoRiderSpace(vector) {
    const rotation = body.rotation();
    const q = { x: -rotation.x, y: -rotation.y, z: -rotation.z, w: rotation.w };
    const tx = 2 * (q.y * vector.z - q.z * vector.y);
    const ty = 2 * (q.z * vector.x - q.x * vector.z);
    const tz = 2 * (q.x * vector.y - q.y * vector.x);
    return {
      x: vector.x + q.w * tx + q.y * tz - q.z * ty,
      y: vector.y + q.w * ty + q.z * tx - q.x * tz,
      z: vector.z + q.w * tz + q.x * ty - q.y * tx,
    };
  }
  function damageRiderContact(point, normalSpeed, velocityChange, ground = false) {
    if (normalSpeed < 4 || velocityChange < 1) return false;
    const position = body.translation();
    const local = intoRiderSpace({ x: point.x - position.x, y: point.y - position.y, z: point.z - position.z });
    let partId = selectImpactPart(local);
    if (ground) {
      // The shared chassis contact represents the side of the rider that lands first.
      const down = intoRiderSpace({ x: 0, y: -1, z: 0 });
      if (down.y > 0.4) partId = "head";
      else if (Math.abs(down.x) > 0.5) partId = `${down.y < -0.3 ? "leg" : "wing"}-${down.x < 0 ? "left" : "right"}`;
      else if (down.z < -0.5) partId = "beak";
      else if (down.z > 0.5) partId = "body";
    }
    // One impact is capped below the weakest stock part's maximum durability.
    const amount = clamp((normalSpeed - 3) * 1.4 + velocityChange * 2, 0, 85);
    const result = durability.damage(partId, amount);
    if (result.applied <= 0) return false;
    // Connected parts share a small shock load; the collision proxy is still
    // one chassis, so this does not add colliders or change handling/inertia.
    const linked = {
      "wheel-front": { frame: 0.25, handlebar: 0.15 },
      "wheel-rear": { frame: 0.25, drive: 0.15 },
      frame: { drive: 0.15, "leg-left": 0.1, "leg-right": 0.1, rocket: 0.05, weapon: 0.05 },
      body: { head: 0.1, "wing-left": 0.1, "wing-right": 0.1 },
      head: { body: 0.1 }, beak: { body: 0.1 },
      "wing-left": { body: 0.1 }, "wing-right": { body: 0.1 },
      "leg-left": { body: 0.1 }, "leg-right": { body: 0.1 },
    }[partId] ?? {};
    for (const [id, scale] of Object.entries(linked)) durability.damage(id, result.applied * scale);
    return true;
  }
  function landingContactDamage(a, b, started, before) {
    if (!started) return false;
    const otherHandle = a === collider.handle ? b : b === collider.handle ? a : null;
    if (otherHandle === null || !groundHandles.has(otherHandle)) return false;
    const after = body.linvel();
    const change = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
    let applied = false;
    world.contactPair(collider, world.getCollider(otherHandle), (manifold, flipped) => {
      if (applied) return;
      const contact = contactInfo(manifold, flipped);
      if (!contact) return;
      const n = contact.normal;
      applied = damageRiderContact(contact.point, Math.abs(before.x * n.x + before.y * n.y + before.z * n.z), change, true);
    });
    return applied;
  }
  function flightContactDamage(a, b, started, before) {
    if (!started) return false;
    const otherHandle = a === collider.handle ? b : b === collider.handle ? a : null;
    if (otherHandle === null) return false;
    if (groundHandles.has(otherHandle)) return landingContactDamage(a, b, started, before);
    if (!impactHandles.has(otherHandle)) return false;
    const speed = Math.hypot(before.x, before.z);
    if (obstacleHandles.get(otherHandle)?.breakable && speed * 3.6 >= SMASH_SPEED_KMH) return false;
    const after = body.linvel();
    const change = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
    let applied = false;
    world.contactPair(collider, world.getCollider(otherHandle), (manifold, flipped) => {
      if (applied) return;
      const contact = contactInfo(manifold, flipped);
      if (!contact) return;
      const n = contact.normal;
      const normalSpeed = Math.abs(before.x * n.x + before.y * n.y + before.z * n.z);
      if (railHandles.has(otherHandle) && (normalSpeed < Math.max(12, tuning.crashThreshold * 10) || normalSpeed < speed * Math.sin(Math.PI / 3))) return;
      applied = damageRiderContact(contact.point, normalSpeed, change);
    });
    return applied;
  }
  function sampleScrape() {
    scrapeClock -= FIXED_DT;
    if (scrapeClock > 0) return;
    const v = body.linvel();
    if (Math.hypot(v.x, v.z) < 3) return;
    let emitted = false;
    world.contactPairsWith(collider, (other) => {
      if (emitted || (!impactHandles.has(other.handle) && !crashTime)) return;
      world.contactPair(collider, other, (manifold, flipped) => {
        if (emitted) return;
        const contact = contactInfo(manifold, flipped);
        if (!contact) return;
        const point = contact.point, n = contact.normal;
        const otherV = other.parent()?.linvel() ?? { x: 0, y: 0, z: 0 };
        const relative = {
          x: v.x - otherV.x,
          y: v.y - otherV.y,
          z: v.z - otherV.z,
        };
        const normalSpeed =
          relative.x * n.x + relative.y * n.y + relative.z * n.z;
        const tangentSpeed = Math.sqrt(
          Math.max(
            0,
            relative.x ** 2 +
              relative.y ** 2 +
              relative.z ** 2 -
              normalSpeed ** 2,
          ),
        );
        if (
          point &&
          contact.distance < 0.025 &&
          tangentSpeed > 3
        ) {
          emitEffect("scrape", point, clamp(tangentSpeed / 35, 0.15, 1));
          emitted = true;
        }
      });
    });
    if (emitted) scrapeClock = 0.045;
  }
  function shiftWeight(state) {
    const grounded = !crashing && (vehicle.wheelIsInContact(0) || vehicle.wheelIsInContact(1));
    const response = 1 - Math.exp(-FIXED_DT * 9);
    const targetX = grounded ? clamp(state.balanceRoll ?? 0, -1, 1) * 0.12 : 0;
    const targetZ = grounded ? -clamp(state.balancePitch ?? 0, -1, 1) * 0.22 : 0;
    const nextX = weightX + (targetX - weightX) * response;
    const nextZ = weightZ + (targetZ - weightZ) * response;
    if (Math.abs(nextX - weightX) + Math.abs(nextZ - weightZ) < 1e-6) return;
    weightX = nextX; weightZ = nextZ;
    // Move the combined rider/bicycle mass within the chassis; preserve mass and inertia.
    const m = tuning.mass;
    collider.setMassProperties(m, { x: weightX, y: 0, z: weightZ }, {
      x: m / 3 * (0.18 ** 2 + 0.78 ** 2),
      y: m / 3 * (0.3 ** 2 + 0.78 ** 2),
      z: m / 3 * (0.3 ** 2 + 0.18 ** 2),
    }, { x: 0, y: 0, z: 0, w: 1 });
    body.recomputeMassPropertiesFromColliders();
  }
  function collectPickups(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const length2 = dx * dx + dy * dy + dz * dz;
    for (const [id, entries] of pickups) for (const item of entries) {
      if (item.collected) continue;
      const position = { x: item.x, y: item.y, z: origin - id * CHUNK_LENGTH + item.z };
      const t = length2 ? clamp(((position.x - from.x) * dx + (position.y - from.y) * dy + (position.z - from.z) * dz) / length2, 0, 1) : 0;
      if (Math.hypot(from.x + dx * t - position.x, from.y + dy * t - position.y, from.z + dz * t - position.z) > 1.2) continue;
      item.collected = true;
      if (item.mesh) item.mesh.visible = false;
      if (item.kind === "boost") { pickupBoost = 6; pickupNotice = "加速道具 · 驱动力增强 6 秒"; }
      else if (item.kind === "repair") { durability.repairAll(); pickupNotice = "维修道具 · 部位耐久已修复"; }
      pickupNoticeTime = 2.5;
    }
  }
  function fixedStep(state) {
    pickupBoost = Math.max(0, pickupBoost - FIXED_DT);
    pickupNoticeTime = Math.max(0, pickupNoticeTime - FIXED_DT);
    durability.tick(FIXED_DT);
    state.balanceAssisting = false;
    shiftWeight(state);
    debris.step(FIXED_DT);
    landingBlend = Math.max(0, landingBlend - FIXED_DT);
    if (crashing) {
      state.jumpRequested = false;
      reverseSeconds = 0;
      directionCorrecting = false;
      cadenceRpm = 0;
      braking = false;
      crashElapsed += FIXED_DT;
      body.resetForces(true);
      body.resetTorques(true);
      if (crashElapsed > 0.7 && body.linvel().y < 0)
        body.addForce({ x: 0, y: -body.mass() * 2 * tuning.airGravity, z: 0 }, true);
      const queriedWheels = uprightAmount() > 0.65 && crashElapsed > 0.4;
      const groundContact = touchesRoad();
      const wheelContact = queriedWheels && (vehicle.wheelIsInContact(0) || vehicle.wheelIsInContact(1));
      const wheelTraction = wheelContact ? clamp((uprightAmount() - 0.65) / 0.3, 0, 1) : 0;
      engageDrive(state, (groundContact || wheelContact) && state.balanceAssistHeld);
      if (queriedWheels) {
        const recoveringDrive = state.balanceAssistHeld && wheelContact
          ? tuning.driveForce * driveEngagement * 0.22 * wheelTraction
          : 0;
        for (let i = 0; i < 2; i++) vehicle.setWheelEngineForce(i, recoveringDrive / 2);
        vehicle.updateVehicle(FIXED_DT, undefined, undefined, (c) => groundHandles.has(c.handle));
      }
      assistGroundDrive(state, groundContact, wheelTraction);
      stabilize(0.25 * clamp((crashElapsed - 0.35) / 0.8, 0, 1));
      assistForwardBalance(state);
      applyBalanceInput(state);
      const beforeContact = { ...body.linvel() };
      world.step(events);
      let damagedLanding = false;
      events.drainCollisionEvents((a, b, started) => {
        if (damagedLanding) return;
        damagedLanding = flightContactDamage(a, b, started, beforeContact);
      });
      sampleScrape();
      impact *= Math.exp(-FIXED_DT * 7);
      const position = body.translation();
      const center = path.sample(origin - position.z);
      const onTrack = Math.abs((position.x - center.point.x) * center.normal.x) < path.width / 2 + 0.5;
      const supported = touchesRoad() || (queriedWheels && (vehicle.wheelIsInContact(0) || vehicle.wheelIsInContact(1)));
      recoverySuspended = onTrack && !supported && position.y > path.height + 0.25;
      if (!recoverySuspended) crashTime = Math.max(0, crashTime - FIXED_DT);
      const angular = body.angvel();
      const balanced = uprightAmount() > 0.94 && Math.hypot(angular.x, angular.z) < 1.2;
      if (crashElapsed > 0.4 && onTrack && supported && balanced && body.linvel().y <= 1) finishLanding(state);
      else if (!recoverySuspended && crashTime < 1e-6) recoverOffTrack(state);
      rebase();
      return;
    }
    const p = body.translation(),
      v = body.linvel(),
      q = body.rotation(),
      speed = Math.hypot(v.x, v.z);
    const forwardX = -2 * (q.x * q.z + q.y * q.w),
      forwardZ = -(1 - 2 * (q.x * q.x + q.y * q.y)),
      signedSpeed = v.x * forwardX + v.z * forwardZ;
    const grounded = vehicle.wheelIsInContact(0) || vehicle.wheelIsInContact(1);
    engageDrive(state, grounded);
    const maxSteer = steeringLimit(speed, tuning.steering);
    let steering = -clamp(state.steerInput ?? 0, -1, 1) * maxSteer;
    reverseSeconds = grounded && signedSpeed < -0.4 ? reverseSeconds + FIXED_DT : 0;
    directionCorrecting = false;
    if (reverseSeconds >= 5 && Math.abs(state.steerInput ?? 0) < 0.01 && !state.brakeInput) {
      const road = path.sample(origin - p.z);
      const roadYaw = Math.atan2(-road.tangent.x, -road.tangent.z);
      const yaw = Math.atan2(2 * (q.x * q.z + q.y * q.w), 1 - 2 * (q.x * q.x + q.y * q.y));
      const error = Math.atan2(Math.sin(roadYaw - yaw), Math.cos(roadYaw - yaw));
      directionCorrecting = Math.abs(error) > 0.04;
      if (directionCorrecting) {
        const desiredYawRate = clamp(error * 1.4, -0.5, 0.5);
        steering = clamp(Math.atan(1.7 * desiredYawRate / signedSpeed), -maxSteer, maxSteer);
      }
    }
    vehicle.setWheelSteering(0, steering);
    const throttle = clamp(state.throttleInput ?? 0, -1, 1);
    const coasting = throttle === 0 && !state.brakeInput;
    const target = state.brakeInput ? 0 : throttle < 0 ? -20 / 3.6 : clamp(state.targetKmh / 3.6, 0, tuning.maxSpeedKmh / 3.6),
      direction = Math.sign(target),
      changingDirection = target * signedSpeed < 0 && speed > 0.4,
      delta = (changingDirection ? 0 : Math.abs(target)) - speed;
    const drag = tuning.drag * speed * speed + tuning.rolling;
    const balanceDrive = balanceAfterLanding ? clamp((uprightAmount() - 0.9) / 0.09, 0, 1) : 1;
    const drive =
      throttle !== 0 && target !== 0 && !changingDirection
        ? direction * clamp(delta * tuning.mass * 2 + drag, 0, tuning.driveForce * (pickupBoost > 0 ? 1.5 : 1)) * balanceDrive * (throttle > 0 ? driveEngagement : 1)
        : 0;
    const brake = coasting ? 0 :
      delta < -0.1
        ? Math.min(18, -delta * tuning.mass * FIXED_DT * 0.85)
        : target === 0
          ? 12
          : 0;
    for (let i = 0; i < 2; i++) {
      vehicle.setWheelEngineForce(i, drive / 2);
      vehicle.setWheelBrake(i, i === 1 ? brake * 2 : 0);
      vehicle.setWheelSideFrictionStiffness(i, (1.1 * tuning.grip) / 3 * (i === 1 && brake > 8 && speed > 3 ? 0.65 : 1));
    }
    body.resetForces(true);
    body.resetTorques(true);
    if (balanceAfterLanding) {
      const angular = body.angvel();
      if (grounded && uprightAmount() > 0.9995 && Math.hypot(angular.x, angular.z) < 0.12) {
        body.setEnabledRotations(false, true, false, true);
        balanceAfterLanding = false;
      }
    }
    const brakingForce =
      !coasting && vehicle.wheelIsInContact(1) && delta < 0
        ? Math.min(tuning.mass * tuning.brakeAccel, -delta * tuning.mass * 5)
        : 0;
    if (speed > 0.01)
      body.addForce(
        {
          x: (-v.x / speed) * drag,
          y: 0,
          z: (-v.z / speed) * drag,
        },
        true,
      );
    const rearContact = vehicle.wheelContactPoint(1);
    if (brakingForce > 0 && speed > 0.01 && rearContact)
      body.addForceAtPoint({ x: -v.x / speed * brakingForce, y: 0, z: -v.z / speed * brakingForce }, rearContact, true);
    braking = !coasting && vehicle.wheelIsInContact(1) && speed > 0.4 && delta < -0.1;
    cadenceRpm = grounded && Math.abs(drive) > 0 && !braking ? clamp(70 + speed * 2.5, 70, 420) : 0;
    pedalPhase += direction * cadenceRpm / 60 * Math.PI * 2 * FIXED_DT;
    vehicle.updateVehicle(
      FIXED_DT,
      undefined,
      undefined,
      (c) => c.handle !== collider.handle && !debris.handles.has(c.handle) && !combat?.handles.has(c.handle),
    );
    if (balanceAfterLanding) stabilize(0.3);
    assistForwardBalance(state);
    if (grounded && Math.abs(state.steerInput ?? 0) > 0.01) {
      const desiredYawRate = clamp(signedSpeed * Math.tan(steering) / 1.7, -1.1, 1.1);
      const currentYawRate = body.angvel().y;
      if (desiredYawRate * currentYawRate < 0) {
        // Countersteering brakes the old turn through torque, without snapping heading.
        body.applyTorqueImpulse({ x: 0, y: (desiredYawRate - currentYawRate) * body.mass() * 0.24 * 16 * FIXED_DT, z: 0 }, true);
      }
    }
    if (state.jumpRequested && grounded && v.y <= 1 && uprightAmount() > 0.94) {
      body.setEnabledRotations(true, true, true, true);
      balanceAfterLanding = true;
      body.applyImpulse({ x: 0, y: body.mass() * 5.2, z: 0 }, true);
    }
    if (!grounded || balanceAfterLanding) applyBalanceInput(state);
    state.jumpRequested = false;
    impact *= Math.exp(-FIXED_DT * 7);
    const beforeContact = { ...body.linvel() }, beforeSpin = { ...body.angvel() };
    world.step(events);
    let hardImpact = false, solidImpact = false, smashedThrough = false;
    let riderHit = null;
    const damaged = [];
    events.drainCollisionEvents((a, b, started) => {
      if (!started) return;
      const other =
        a === collider.handle ? b : b === collider.handle ? a : null;
      if (other !== null && groundHandles.has(other)) {
        landingContactDamage(a, b, started, beforeContact);
        return;
      }
      if (other !== null && impactHandles.has(other)) {
        const after = body.linvel();
        const velocityChange = Math.hypot(after.x - v.x, after.z - v.z);
        const object = obstacleHandles.get(other);
        const smash = !!object?.breakable && speed * 3.6 >= SMASH_SPEED_KMH;
        if (!smash) solidImpact = true;
        const otherCollider = world.getCollider(other);
        const isRail = railHandles.has(other);
        const railRotation = otherCollider.rotation();
        // Use the contact normal, not total speed: glancing blows slide along rails.
        let normal = { x: 1 - 2 * railRotation.y ** 2, y: 0, z: -2 * railRotation.y * railRotation.w };
        let hitPoint = otherCollider.translation();
        world.contactPair(collider, otherCollider, (manifold, flipped) => {
          const contact = contactInfo(manifold, flipped);
          if (contact) { hitPoint = contact.point; normal = contact.normal; }
        });
        const normalSpeed = Math.abs(beforeContact.x * normal.x + beforeContact.z * normal.z);
        const tangentSpeed = Math.sqrt(Math.max(0, beforeContact.x ** 2 + beforeContact.z ** 2 - normalSpeed ** 2));
        const angle = Math.atan2(normalSpeed, tangentSpeed);
        // 0° runs along the rail; 90° hits it head-on. Rapier resolves friction from
        // normal load, preserving tangential travel on shallow-angle contacts.
        const frontalRailHit = normalSpeed >= Math.max(12, tuning.crashThreshold * 10) && angle >= Math.PI / 3;
        const launches = !smash && speed >= 12 && velocityChange >= tuning.crashThreshold && (!isRail || frontalRailHit);
        if (launches) hardImpact = true;
        const scrapingRail = isRail && !launches;
        if (!smash && !scrapingRail) {
          const effectiveSpeed = isRail ? normalSpeed : Math.max(normalSpeed, velocityChange);
          if (!riderHit || effectiveSpeed + velocityChange > riderHit.normalSpeed + riderHit.velocityChange)
            riderHit = { point: hitPoint, normalSpeed: effectiveSpeed, velocityChange };
        }
        emitEffect(scrapingRail ? "scrape" : "impact", hitPoint, clamp((scrapingRail ? tangentSpeed * (0.25 + 0.75 * Math.sin(angle)) : speed) / 35, 0.2, 1), v);
        damaged.push([object, speed, velocityChange, smash, v]);
        collisionCount++;
        if (!smash) impact = Math.max(impact, scrapingRail ? clamp(normalSpeed / 60, 0.03, 0.18) : clamp(speed / 25, 0.15, 1));
      }
    });
    if (riderHit) damageRiderContact(riderHit.point, riderHit.normalSpeed, riderHit.velocityChange);
    sampleScrape();
    for (const args of damaged) {
      const destroyed = damageObject(...args);
      if (destroyed && args[3]) smashedThrough = true;
    }
    if (smashedThrough && !solidImpact) {
      // Arcade smash-through: retain forward motion after Rapier reports the contact.
      const afterContact = body.translation();
      body.setTranslation({ x: p.x + beforeContact.x * FIXED_DT, y: afterContact.y, z: p.z + beforeContact.z * FIXED_DT }, true);
      body.setLinvel(beforeContact, true);
      body.setRotation(q, true);
      body.setAngvel(beforeSpin, true);
      world.propagateModifiedBodyPositionsToColliders();
    }
    // A velocity limiter is applied as an opposing impulse, never as position movement.
    const after = body.linvel(),
      actual = Math.hypot(after.x, after.z);
    if (actual > tuning.maxSpeedKmh / 3.6) {
      const correction = (actual - tuning.maxSpeedKmh / 3.6) * body.mass();
      body.applyImpulse(
        {
          x: (-after.x / actual) * correction,
          y: 0,
          z: (-after.z / actual) * correction,
        },
        true,
      );
    }
    if (hardImpact) launchCrash(speed);
    else if (balanceAfterLanding && touchesRoad() && uprightAmount() < 0.8) {
      // An unsuccessful player-controlled landing enters recovery without a second launch.
      crashing = true;
      crashTime = tuning.recoveryTime;
      crashElapsed = 0.4;
      driveEngagement = 0;
      crashHeading = 2 * Math.atan2(body.rotation().y, body.rotation().w);
      body.setGravityScale(tuning.airGravity, true);
      for (let i = 0; i < 2; i++) { vehicle.setWheelEngineForce(i, 0); vehicle.setWheelBrake(i, 0); }
    }
    collectPickups(p, body.translation());
    rebase();
  }
  function read(state) {
    const p = body.translation(),
      v = body.linvel(),
      q = body.rotation();
    state.crashed = crashing;
    state.partDurability = durability.read();
    state.pickupBoostRemaining = pickupBoost;
    state.pickupNotice = pickupNoticeTime > 0 ? pickupNotice : "";
    state.landingBlend = landingBlend;
    state.crashRemaining = crashTime;
    state.recoverySuspended = recoverySuspended;
    state.reverseSeconds = reverseSeconds;
    state.directionCorrecting = directionCorrecting;
    state.steeringAngle = vehicle.wheelSteering(0);
    state.balance = balanceAtSpeed(Math.hypot(v.x, v.z));
    const wobble = !crashing && (vehicle.wheelIsInContact(0) || vehicle.wheelIsInContact(1))
      ? Math.sin(pedalPhase * 0.8) * 0.025 * (1 - state.balance) * clamp(Math.hypot(v.x, v.z) / 2, 0, 1) : 0;
    state.rideLean = rideLean + wobble;
    state.weightShiftX = weightX;
    state.weightShiftZ = weightZ;
    state.impact = impact;
    state.collisionCount = collisionCount;
    state.destroyedCount = destroyedCount;
    state.debris = debris.read(origin);
    for (const [id, objects] of obstacles) {
      for (const object of objects) {
        if (!object.mesh || !object.body) continue;
        const position = object.body.translation();
        object.mesh.position.set(
          position.x,
          position.y,
          position.z - origin + id * CHUNK_LENGTH,
        );
        object.mesh.quaternion.copy(object.body.rotation());
      }
    }
    state.distance = origin - p.z;
    state.velocity = Math.hypot(v.x, v.z);
    state.forwardVelocity = -2 * (q.x * q.z + q.y * q.w) * v.x - (1 - 2 * (q.x * q.x + q.y * q.y)) * v.z;
    const center = path.sample(state.distance);
    state.lane = (p.x - center.point.x) * center.normal.x;
    state.physicsPose = {
      x: p.x,
      y: p.y,
      z: p.z,
      origin,
      rotation: { x: q.x, y: q.y, z: q.z, w: q.w },
      yaw: 2 * Math.atan2(q.y, q.w),
    };
    state.phase = pedalPhase;
    state.cadenceRpm = cadenceRpm;
    state.braking = braking;
    const rearGrounded = !crashing && vehicle.wheelIsInContact(1);
    state.rearBrake = rearGrounded && braking ? clamp((vehicle.wheelBrake(1) ?? 0) / 24, 0, 1) : 0;
    state.rearSkid = rearGrounded && state.velocity > 2 ? state.rearBrake * clamp((state.velocity - 2) / 5, 0, 1) : 0;
    const rearPoint = rearGrounded ? vehicle.wheelContactPoint(1) : null;
    state.rearContact = rearPoint ? { x: rearPoint.x, y: rearPoint.y, z: rearPoint.z - origin } : null;
    state.grounded =
      !state.crashed &&
      (vehicle.wheelIsInContact(0) || vehicle.wheelIsInContact(1) || touchesRoad());
  }
  function update(dt, state) {
    if (state.running) {
      accumulator = Math.min(accumulator + dt, 0.1);
      while (accumulator >= FIXED_DT) {
        combat?.beforeStep(FIXED_DT, state, crashing);
        fixedStep(state);
        combat?.afterStep(FIXED_DT);
        const v = body.linvel(), q = body.rotation();
        const forwardSpeed = -2 * (q.x * q.z + q.y * q.w) * v.x - (1 - 2 * (q.x * q.x + q.y * q.y)) * v.z;
        const leaning = !crashing && (vehicle.wheelIsInContact(0) || vehicle.wheelIsInContact(1));
        const desiredLean = leaning ? clamp(cornerLean(forwardSpeed, body.angvel().y) - weightX * 0.75, -0.5, 0.5) : 0;
        rideLean += (desiredLean - rideLean) * (1 - Math.exp(-FIXED_DT * (5 + balanceAtSpeed(forwardSpeed) * 7)));
        accumulator -= FIXED_DT;
        state.time += FIXED_DT;
      }
    } else { accumulator = 0; state.fireRequested = state.gatlingHeld = state.balanceAssistHeld = state.balanceAssisting = false; state.beakAttackRequested = 0; }
    read(state);
    if (combat) combat.read(state);
    else {
      state.rival = null; state.missiles = []; state.explosions = []; state.bullets = []; state.bulletImpacts = [];
      state.gatlingFiring = state.gatlingEquipped = state.beakEquipped = false;
      state.beakAttack = null; state.beakImpacts = []; state.beakCooldown = state.beakSwings = state.beakHits = state.beakAttackRequested = 0;
    }
  }
  function dispose() {
    world?.free();
    events?.free();
    roads.clear();
    groundHandles.clear();
    obstacles.clear();
    pickups.clear();
    pickupBoost = pickupNoticeTime = 0; pickupNotice = "";
    impactHandles.clear();
    railHandles.clear();
    obstacleHandles.clear();
    effectEvents = [];
  }
  return {
    reset,
    syncChunks,
    update,
    dispose,
    drainEffects() {
      const result = effectEvents;
      effectEvents = [];
      return result;
    },
    get combat() { return combat; },
    get debrisCount() {
      return debris.count;
    },
    get body() {
      return body;
    },
    get world() {
      return world;
    },
    get vehicle() {
      return vehicle;
    },
    get colliderCount() {
      return world.colliders.len();
    },
    get chunkCount() {
      return roads.size;
    },
  };
}
