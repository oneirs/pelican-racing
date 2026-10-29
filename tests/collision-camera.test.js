import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
const THREE = context.THREE;
globalThis.window = { THREE };
const { createCollisionCamera } = await import("../src/camera/collision.js");
const { createRaceRider } = await import("../src/models/race-rider.js");
const { createRiderBreakup } = await import("../src/effects/rider-breakup.js");
const { updateFirstPerson } = await import("../src/camera/first-person.js");
const path = { height: 0.22 };
function normalView(camera, mode = "first") {
  camera.position.set(0, mode === "first" ? 3.08 : 4.1, mode === "first" ? 0 : 6);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 2, -6);
  camera.fov = mode === "first" ? 68 : 58;
  camera.updateProjectionMatrix();
}
function frustum(camera) {
  camera.updateMatrixWorld(true);
  return new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
}

test("collision view frames moving breakup bounds on wide and portrait screens without rolling", () => {
  for (const aspect of [0.55, 1.5, 2.4]) {
    const camera = new THREE.PerspectiveCamera(68, aspect, 0.1, 700);
    const view = createCollisionCamera();
    const state = { cameraMode: "first", running: true, lookYaw: 0, lookPitch: 0 };
    for (let frame = 0; frame < 120; frame++) {
      normalView(camera);
      const focus = { x: frame * 0.3, y: 1.5 + Math.sin(frame / 30) * 0.7,
        z: frame < 60 ? -frame * 0.2 : 256 - frame * 0.2, radius: 2 + frame * 0.09 };
      view.update(camera, state, path, 1 / 60, focus);
      assert(state.collisionView); assert.equal(state.cameraMode, "first");
      assert.equal(camera.up.y, 1);
      const bounds = new THREE.Sphere(new THREE.Vector3(focus.x, focus.y, focus.z), focus.radius);
      for (const plane of frustum(camera).planes)
        assert(plane.distanceToPoint(bounds.center) >= bounds.radius - 0.001, "visible pieces escaped the view");
      assert(camera.position.y >= path.height + 1.5);
    }
  }
});

test("every actual detached part stays in view as the physical rider tumbles and pieces spread", () => {
  const scene = new THREE.Scene(), rider = createRaceRider(scene), breakup = createRiderBreakup(scene);
  const view = createCollisionCamera(), camera = new THREE.PerspectiveCamera(68, 1.5, 0.1, 700);
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const state = { running: true, cameraMode: "first", crashed: true, impact: 1,
    velocity: 30, distance: 0, time: 0, phase: 0, lookYaw: 0, lookPitch: 0,
    physicsPose: { x: 0, y: 1.3, yaw: 0, rotation }, mapSettings: { destruction: true },
    partDurability: { version: 1, parts: { "wheel-rear": { current: 0, max: 160, broken: true } } } };
  breakup.setRider(rider);
  try {
    for (let frame = 0; frame < 120; frame++) {
      state.time = frame / 60; state.distance = state.time * 30;
      state.physicsPose.x = state.time * 5;
      state.physicsPose.y = Math.max(0.8, 1.3 + 6.35 * state.time - 4.905 * state.time ** 2);
      rider.update(state);
      breakup.update(frame ? 1 / 60 : 0, state);
      assert.equal(breakup.group.children.length, 1);
      assert(rider.model.group.visible, "partial damage must retain the intact rider");
      normalView(camera);
      view.update(camera, state, path, 1 / 60, breakup.getFocus());
      const visible = frustum(camera);
      for (const part of breakup.group.children)
        assert(visible.intersectsBox(new THREE.Box3().setFromObject(part)), "detached body or bicycle disappeared");
      rider.model.pelican.bird.traverse(node => {
        if (node.isMesh && node.visible)
          assert(visible.intersectsBox(new THREE.Box3().setFromObject(node)), "surviving pelican disappeared while following a wheel");
      });
    }
  } finally { breakup.dispose(); rider.dispose(); }
});

test("collision view freezes on pause and smoothly returns to the chosen camera after assembly", () => {
  for (const mode of ["first", "third"]) {
    const camera = new THREE.PerspectiveCamera(68, 1.5, 0.1, 700), view = createCollisionCamera();
    const state = { cameraMode: mode, running: true, lookYaw: 0, lookPitch: 0 };
    normalView(camera, mode);
    view.update(camera, state, path, 1 / 60, { x: 10, y: 3, z: -9, radius: 4 });
    const observerPosition = camera.position.clone(), observerRotation = camera.quaternion.clone();
    state.running = false;
    normalView(camera, mode);
    view.update(camera, state, path, 0.1, null);
    assert(camera.position.equals(observerPosition) && camera.quaternion.equals(observerRotation));
    assert(state.collisionView);
    state.running = true;
    normalView(camera, mode);
    const goal = camera.position.clone(), goalRotation = camera.quaternion.clone();
    view.update(camera, state, path, 1 / 60, null);
    assert(camera.position.distanceTo(observerPosition) < 0.1, "return jumped in its first frame");
    for (let i = 0; i < 40; i++) { normalView(camera, mode); view.update(camera, state, path, 1 / 60, null); }
    assert(!state.collisionView && camera.position.distanceTo(goal) < 1e-6);
    assert(camera.quaternion.angleTo(goalRotation) < 1e-6);
    assert.equal(state.cameraMode, mode);
    view.reset();
    normalView(camera, mode); view.update(camera, state, path, 0, null);
    assert(!state.collisionView);
  }
});

test("first-person landing and breakup observation share one return transition", () => {
  const camera = new THREE.PerspectiveCamera(68, 1.5, 0.1, 700), view = createCollisionCamera();
  const state = { cameraMode: "first", running: true, lookYaw: 0, lookPitch: 0,
    time: 0, velocity: 0, crashed: false, collisionView: false,
    physicsPose: { x: 0, y: 0.9, yaw: 0, rotation: new THREE.Quaternion() },
    mapSettings: { speedEffects: false } };
  function frame(focus) {
    state.time += 1 / 60;
    updateFirstPerson(camera, state, path, 1 / 60);
    view.update(camera, state, path, 1 / 60, focus);
  }
  frame(null);
  const ordinaryPosition = camera.position.clone(), ordinaryRotation = camera.quaternion.clone();
  state.crashed = true;
  state.physicsPose.rotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const focus = { x: 8, y: 3, z: -12, radius: 4 };
  for (let i = 0; i < 30; i++) frame(focus);
  state.crashed = false;
  state.physicsPose.rotation.identity();
  state.landingBlend = 0.8;
  // Assembly still runs for 0.42 seconds after a natural landing.
  for (let i = 0; i < 26; i++) frame(focus);
  for (let i = 0; i < 40; i++) frame(null);
  assert(!state.collisionView);
  assert(camera.position.distanceTo(ordinaryPosition) < 0.01,
    "first-person camera remained outside after the full model became hidden");
  assert(camera.quaternion.angleTo(ordinaryRotation) < 1e-5);
});
