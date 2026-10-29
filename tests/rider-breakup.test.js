import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
const THREE = context.THREE;
globalThis.window = { THREE };
const { createRaceRider } = await import("../src/models/race-rider.js");
const { createRiderBreakup } = await import("../src/effects/rider-breakup.js");
const { createRacingEffects } = await import("../src/effects/racing-effects.js");
const { collectRiderPartMeshes, RIDER_PART_IDS } = await import("../src/models/rider-parts.js");

const initialState = () => ({ cameraMode: "third", running: true, distance: 0, time: 0, phase: 0,
  velocity: 20, crashed: false, physicsPose: { x: 2, y: 1.3, yaw: 0, rotation: { x: 0, y: 0, z: 0, w: 1 } },
  mapSettings: { destruction: true, speedEffects: false } });
const snapshot = (...broken) => ({ version: 1, parts: Object.fromEntries(RIDER_PART_IDS.map(id =>
  [id, { current: broken.includes(id) ? 0 : 100, max: 100, broken: broken.includes(id) }])) });
const impact = { type: "impact", strength: 1, x: 2, y: 1, z: -1, velocity: { x: 0, y: 0, z: -20 } };

function assertCovered(focus, bounds) {
  const center = new THREE.Vector3(focus.x, focus.y, focus.z);
  for (let i = 0; i < 8; i++) {
    const corner = new THREE.Vector3(i & 1 ? bounds.max.x : bounds.min.x,
      i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z);
    assert(corner.distanceTo(center) <= focus.radius + 1e-6, "focus omits intact rider or loose geometry");
  }
}

test("every rider mesh maps to one durable part, with left and right limbs and anatomical attack beak separated", () => {
  for (const attackBeak of [false, true]) {
    const rider = createRaceRider(new THREE.Scene(), { attackBeak }, { weaponPart: attackBeak ? "standard" : "homing-launcher" });
    try {
      const map = collectRiderPartMeshes(rider.model), seen = new Set();
      for (const meshes of map.values()) for (const mesh of meshes) { assert(!seen.has(mesh)); seen.add(mesh); }
      const actual = []; rider.model.group.traverse(node => { if (node.isMesh) actual.push(node); });
      assert.equal(seen.size, actual.length);
      for (const id of RIDER_PART_IDS) assert(map.get(id).length > 0, `missing ${id} geometry`);
      for (const leg of rider.model.pelican.legs)
        assert(map.get(leg.side > 0 ? "leg-right" : "leg-left").includes(leg.upper));
      for (const id of ["wing-left", "wing-right"])
        assert(map.get(id).some(mesh => mesh.userData.partSlot === "wings" && (id === "wing-right" ? mesh.position.z > 0 : mesh.position.z < 0)));
      if (attackBeak) rider.model.pelican.attackBeak.traverse(node => {
        if (node.isMesh) { assert(map.get("beak").includes(node)); assert(!map.get("head").includes(node)); assert(!map.get("weapon").includes(node)); }
      });
    } finally { rider.dispose(); }
  }
});

test("a severe crash alone does not scatter a durable rider; only the depleted rear wheel detaches", () => {
  const rider = createRaceRider(new THREE.Scene()), breakup = createRiderBreakup(new THREE.Scene());
  const state = initialState(); state.partDurability = snapshot();
  breakup.setRider(rider);
  try {
    rider.update(state); state.crashed = true; state.impact = 1;
    breakup.update(0, state, [impact]);
    assert(!breakup.active && rider.model.group.visible && breakup.getFocus() === null);
    state.partDurability.parts["wheel-rear"].current = 1;
    breakup.update(0, state, [impact]); assert(!breakup.active, "part with positive durability must stay attached");
    state.partDurability = snapshot("wheel-rear");
    breakup.update(0, state);
    assert(breakup.active && rider.model.group.visible);
    assert.deepEqual(Array.from(breakup.group.children, part => part.name), ["detached-wheel-rear"]);
    const map = collectRiderPartMeshes(rider.model);
    assert(map.get("wheel-rear").every(mesh => !mesh.visible));
    assert(map.get("wheel-front").every(mesh => mesh.visible));
    assert(map.get("body").every(mesh => mesh.visible));
    const piece = breakup.group.children[0], position = rider.group.position.clone(), rotation = rider.group.quaternion.clone();
    for (let i = 0; i < 5; i++) breakup.update(0.1, state);
    assert.equal(breakup.group.children.length, 1); assert.equal(breakup.group.children[0], piece, "same broken snapshot cloned again");
    const paused = [...piece.position.toArray(), ...piece.quaternion.toArray()]; breakup.update(0, state);
    assert.deepEqual([...piece.position.toArray(), ...piece.quaternion.toArray()], paused);
    assert(rider.group.position.equals(position) && rider.group.quaternion.equals(rotation));
    state.crashed = false; breakup.update(1, state);
    assert(breakup.active && breakup.getFocus().phase === "scattered", "landing must not repair a still-broken part");
    state.partDurability = snapshot(); state.physicsPose.x = 9; state.physicsPose.y = 1.9;
    rider.update(state); breakup.update(0.2, state);
    assert(breakup.active && map.get("wheel-rear").every(mesh => !mesh.visible));
    assert.equal(breakup.getFocus().phase, "returning");
    breakup.update(0.23, state);
    assert(!breakup.active && map.get("wheel-rear").every(mesh => mesh.visible));
    assert.equal(rider.group.position.x, 9); assert.equal(rider.group.position.y, 1.9);
  } finally { breakup.dispose(); rider.dispose(); }
});

test("head and beak break independently, repair one at a time, and retain intact body geometry", () => {
  const rider = createRaceRider(new THREE.Scene(), { attackBeak: true }, {}), breakup = createRiderBreakup(new THREE.Scene());
  const state = initialState(), map = collectRiderPartMeshes(rider.model);
  breakup.setRider(rider);
  try {
    rider.update(state); state.partDurability = snapshot("beak"); breakup.update(0, state);
    assert(map.get("beak").every(mesh => !mesh.visible) && map.get("head").every(mesh => mesh.visible));
    state.partDurability = snapshot("beak", "head"); breakup.update(0, state);
    assert.equal(breakup.group.children.length, 2); assert(map.get("body").every(mesh => mesh.visible));
    state.partDurability = snapshot("head"); breakup.update(0.45, state);
    assert.equal(breakup.group.children.length, 1);
    assert(map.get("beak").every(mesh => mesh.visible) && map.get("head").every(mesh => !mesh.visible));
    assert(breakup.isDetached("head") && !breakup.isDetached("beak"));
    breakup.reset(); assert(map.get("head").every(mesh => mesh.visible));
  } finally { breakup.dispose(); rider.dispose(); }
});

test("repair restores original mesh visibility without revealing a holstered or hidden weapon", () => {
  const rider = createRaceRider(new THREE.Scene(), {}, { weaponPart: "homing-launcher" });
  const breakup = createRiderBreakup(new THREE.Scene()), state = initialState();
  breakup.setRider(rider);
  const map = collectRiderPartMeshes(rider.model), gun = rider.model.pelican.bird.getObjectByName("weapon-mount");
  const hidden = map.get("weapon")[0]; hidden.visible = false;
  try {
    rider.update(state); assert(!gun.visible);
    state.partDurability = snapshot("weapon"); breakup.update(0, state);
    assert(!breakup.active && breakup.isDetached("weapon"));
    assert(!gun.visible && map.get("weapon").every(mesh => !mesh.visible));
    state.partDurability = snapshot(); breakup.update(0.45, state);
    assert(!breakup.isDetached("weapon") && !gun.visible && !hidden.visible);
    assert(map.get("weapon").slice(1).every(mesh => mesh.visible));
    state.partDurability = snapshot("wheel-front"); breakup.update(0, state);
    assert(breakup.active);
    state.mapSettings.destruction = false; breakup.update(0, state);
    assert(!breakup.active && !hidden.visible);
    breakup.setRider(null); breakup.update(1, state);
  } finally { breakup.dispose(); rider.dispose(); }
});

test("partial breakup focus includes the surviving rider through travel and clears only after part repair", () => {
  const rider = createRaceRider(new THREE.Scene(), { attackBeak: true }, {}), breakup = createRiderBreakup(new THREE.Scene());
  const state = initialState(); state.partDurability = snapshot("wheel-front");
  breakup.setRider(rider);
  try {
    rider.update(state); breakup.update(0, state);
    for (let i = 0; i < 15; i++) {
      state.physicsPose.x += 0.4; state.distance += 2; state.time += 0.1;
      rider.update(state); breakup.update(0.1, state);
    }
    const focus = breakup.getFocus();
    assert.equal(focus.count, 1); assert(focus.attachedCount > 0);
    assertCovered(focus, new THREE.Box3().setFromObject(breakup.group));
    // The still-visible torso is deliberately away from the flying wheel.
    const map = collectRiderPartMeshes(rider.model);
    for (const mesh of map.get("body")) assertCovered(focus, new THREE.Box3().setFromObject(mesh));
    const paused = breakup.getFocus(); breakup.update(0, state); assert.deepEqual(breakup.getFocus(), paused);
    state.partDurability = snapshot(); breakup.update(0.45, state);
    assert.equal(breakup.getFocus(), null);
  } finally { breakup.dispose(); rider.dispose(); }
});

test("racing effects use each racer snapshot and keep the cockpit when only a wheel is broken", () => {
  const canvas = { width: 600, height: 400, dataset: {}, getContext: () => ({ clearRect() {} }) }, boost = { hidden: true };
  globalThis.document = { getElementById: id => id === "speed-fx" ? canvas : boost };
  globalThis.matchMedia = () => ({ matches: false }); globalThis.innerWidth = 600; globalThis.innerHeight = 400;
  const scene = new THREE.Scene(), rider = createRaceRider(scene), rival = createRaceRider(scene);
  const cockpit = { group: new THREE.Group() }, effects = createRacingEffects(scene);
  effects.setRider(rider, cockpit); effects.setRival(rival);
  const state = initialState(); state.cameraMode = "first"; state.partDurability = snapshot("wheel-rear");
  state.rival = { ...state.physicsPose, speed: 20, recovery: 5, partDurability: snapshot("leg-left") };
  try {
    rider.update(state); rival.update({ ...state, cameraMode: "third", physicsPose: state.rival });
    state.time = 0.1; effects.update(0.1, state, [impact]);
    assert(effects.disassembled && cockpit.group.visible && rider.model.group.visible);
    assert.deepEqual(Array.from(scene.getObjectByName("rival-rider-breakup").children, part => part.name), ["detached-leg-left"]);
    state.partDurability = snapshot("wheel-rear", "handlebar"); state.time += 0.1; effects.update(0.1, state);
    assert(!cockpit.group.visible);
    state.rival = null; state.partDurability = snapshot(); state.time += 0.45;
    rider.update(state); effects.update(0.45, state);
    assert(!effects.disassembled && cockpit.group.visible && effects.getPlayerFocus() === null);
    assert.equal(scene.getObjectByName("rival-rider-breakup").children.length, 0);
    effects.setRival(null); effects.update(0, state); effects.reset();
  } finally { effects.reset(); rider.dispose(); rival.dispose(); }
});
