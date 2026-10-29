import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
const THREE = context.THREE;
globalThis.window = { THREE };
const { createThirdPersonCamera } = await import("../src/camera/third-person.js");
const { createRaceRider } = await import("../src/models/race-rider.js");

test("third-person camera follows heading and jumps without drifting at 500 km/h or rolling with crashes", () => {
  const chase = createThirdPersonCamera(), camera = new THREE.PerspectiveCamera(58, 1.5, 0.1, 700);
  const state = { physicsPose: { x: 0, y: 0.9, yaw: 0 }, distance: 0, velocity: 500 / 3.6, lookYaw: 0, lookPitch: 0 };
  const path = { height: 0.22 };
  chase.update(camera, state, path, 1 / 60);
  for (let i = 0; i < 300; i++) { state.distance += state.velocity / 60; chase.update(camera, state, path, 1 / 60); }
  assert(Math.abs(camera.position.z - 5.55) < 0.01, "camera fell behind with world origin shifts");
  const groundY = camera.position.y;
  state.physicsPose.y = 3;
  for (let i = 0; i < 30; i++) chase.update(camera, state, path, 1 / 60);
  assert(camera.position.y > groundY + 1.5, "camera failed to follow jump");
  state.physicsPose.yaw = Math.PI / 2;
  for (let i = 0; i < 120; i++) chase.update(camera, state, path, 1 / 60);
  assert(camera.position.x > 5.4 && Math.abs(camera.position.z) < 0.1, "camera not behind new heading");
  state.crashed = true; state.physicsPose.yaw = -2; state.physicsPose.y = -10;
  chase.update(camera, state, path, 1 / 60);
  assert.equal(camera.up.y, 1);
  assert(camera.position.x > 5.4, "crash spun chase camera");
  assert(camera.position.y >= path.height + 1.5);
});

test("third-person rider includes equipment, tracks physical pose and hides for cockpit mode", () => {
  const scene = new THREE.Scene();
  const rider = createRaceRider(scene, { legPart: "gold" }, { color: "#ff0000" });
  const pose = { x: 3, y: 2, rotation: { x: 0.2, y: 0, z: 0, w: Math.sqrt(0.96) } };
  const state = { cameraMode: "third", physicsPose: pose, phase: 0.4, time: 1, grounded: false };
  rider.update(state);
  assert(rider.group.visible);
  assert.equal(rider.group.position.x, 3);
  assert.equal(rider.group.position.y, 2);
  assert.equal(rider.group.quaternion.x, pose.rotation.x);
  assert.equal(rider.group.children[0].children.length, 2, "bird and bicycle must share one transform");
  state.cameraMode = "first"; rider.update(state);
  assert(!rider.group.visible);
  rider.dispose();
  assert(!scene.getObjectByName("third-person-rider"));
});

test("speed view strengthens progressively, stays centered and honors effects setting", () => {
  const chase = createThirdPersonCamera(), camera = new THREE.PerspectiveCamera(58, 1.5, 0.1, 700);
  const state = { physicsPose: { x: 0, y: 0.9, yaw: 0 }, velocity: 0, lookYaw: 0, lookPitch: 0 };
  const path = { height: 0.22 };
  const settle = () => { for (let i = 0; i < 180; i++) chase.update(camera, state, path, 1 / 60); };
  settle();
  const restingHeight = camera.position.y;
  state.velocity = 60; settle();
  const middleFov = camera.fov;
  state.velocity = 500 / 3.6; settle();
  assert(camera.fov > middleFov && camera.fov <= 76);
  assert(camera.position.y < restingHeight - 0.6);
  assert.equal(camera.position.x, 0);
  state.mapSettings = { speedEffects: false }; settle();
  assert(Math.abs(camera.fov - 58) < 0.02);
  assert(Math.abs(camera.position.y - restingHeight) < 0.01);
});

test("long raised scarf flutters independently while pedal phase is stationary", async () => {
  const { createRider } = await import("../src/models/rider.js");
  const { updateRiding } = await import("../src/animation/riding.js");
  const { disposeModel } = await import("../src/models/dispose.js");
  const rider = createRider();
  try {
    updateRiding(rider, 0.7, 0, 0, 1);
    const initial = Array.from(rider.pelican.ribbons[0].geo.attributes.position.array);
    const pedalRotation = rider.bicycle.pedalRig.rotation.z;
    updateRiding(rider, 0.7, 0, 0, 1.5);
    const current = Array.from(rider.pelican.ribbons[0].geo.attributes.position.array);
    assert.notDeepEqual(current, initial, "scarf stopped with stationary pedals");
    assert.deepEqual(current.slice(0, 6), initial.slice(0, 6), "scarf attachment drifted");
    assert.equal(rider.bicycle.pedalRig.rotation.z, pedalRotation);
    assert(current[1] > 3.5 && current.at(-3) < -3.2);
  } finally { disposeModel(rider.group); }
});
