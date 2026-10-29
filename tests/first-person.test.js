import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
const THREE = context.THREE;
globalThis.window = { THREE };
const { updateFirstPerson, resetFirstPerson } = await import("../src/camera/first-person.js");

const path = { height: 0.22 };
const makeState = () => ({
  physicsPose: { x: 0, y: 0.9, yaw: 0, rotation: new THREE.Quaternion() },
  running: true, crashed: false, landingBlend: 0, time: 0,
  lookYaw: 0, lookPitch: 0, velocity: 0,
  mapSettings: { speedEffects: false },
});
const makeCamera = () => new THREE.PerspectiveCamera(68, 1.5, 0.1, 700);
const forward = camera => new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

test("a tumbling chassis cannot drop or turn the first-person view away from the road", () => {
  const camera = makeCamera(), state = makeState();
  updateFirstPerson(camera, state, path, 1 / 60);
  const ridingEye = camera.position.y;
  state.crashed = true;
  state.physicsPose.yaw = Math.PI / 2;
  state.physicsPose.rotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  updateFirstPerson(camera, state, path, 1 / 60);
  camera.updateMatrixWorld();
  const road = new THREE.Vector3(0, path.height, -8).project(camera);
  assert(camera.position.y >= ridingEye - 0.05, "crash abruptly lowered the eye");
  assert(Math.abs(forward(camera).x) < 0.2, "crash followed a tumbling yaw");
  assert(Math.abs(road.x) < 1 && Math.abs(road.y) < 1 && road.z < 1,
    "the road left the crash view");

  state.physicsPose.rotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.up.y > 0.9, "an upside-down chassis inverted the horizon");
  resetFirstPerson(camera);
});

test("landing starts from the camera actually displayed, freezes on pause, and recovers smoothly", () => {
  const camera = makeCamera(), state = makeState();
  updateFirstPerson(camera, state, path, 1 / 60);
  state.crashed = true;
  state.physicsPose.rotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  updateFirstPerson(camera, state, path, 1 / 60);
  // An impact observer can override the first-person camera after its update.
  camera.position.set(8, 6, 12);
  camera.lookAt(0, 2, 0);
  const shownPosition = camera.position.clone(), shownRotation = camera.quaternion.clone();
  state.crashed = false;
  state.landingBlend = 0.8;
  state.physicsPose.rotation.identity();
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.position.distanceTo(shownPosition) < 1e-9, "landing skipped the displayed camera pose");
  assert(camera.quaternion.angleTo(shownRotation) < 1e-7);

  state.running = false;
  updateFirstPerson(camera, state, path, 0.3);
  assert(camera.position.distanceTo(shownPosition) < 1e-9, "pause advanced landing");
  state.running = true;
  updateFirstPerson(camera, state, path, 0);
  assert(camera.position.distanceTo(shownPosition) < 1e-9, "zero dt advanced landing");
  updateFirstPerson(camera, state, path, 0.2);
  assert(camera.position.distanceTo(shownPosition) > 0);

  // A later external override must become the new visible starting point.
  camera.position.set(4, 4, 8);
  camera.lookAt(0, 2, 0);
  const laterPosition = camera.position.clone();
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.position.distanceTo(laterPosition) < 1e-9, "external camera override was ignored");
  for (let i = 0; i < 60; i++) updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.position.distanceTo(new THREE.Vector3(0, 3.08, 0)) < 0.01,
    "first-person eye did not return to riding position");
  assert(forward(camera).z < -0.9, "view did not face forward after landing");
  resetFirstPerson(camera);
});

test("collision observer owns the return without a second first-person recovery", () => {
  const camera = makeCamera(), state = makeState();
  const ridingEye = new THREE.Vector3(0, 3.08, 0);
  updateFirstPerson(camera, state, path, 1 / 60);
  state.crashed = true;
  updateFirstPerson(camera, state, path, 1 / 60);
  camera.position.set(8, 6, 12); // The observer's last displayed frame.
  state.crashed = false;
  state.landingBlend = 0.8;
  state.collisionView = true;
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.position.distanceTo(ridingEye) < 1e-9,
    "first person mixed the distant observer into its normal return goal");

  // The observer keeps overriding the final camera while it performs its return.
  camera.position.set(4, 4, 8);
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.position.distanceTo(ridingEye) < 1e-9);
  state.collisionView = false;
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.position.distanceTo(ridingEye) < 1e-9,
    "first person restarted recovery after the observer finished");
  resetFirstPerson(camera);
});

test("collision observer cancels a first-person recovery already in progress", () => {
  const camera = makeCamera(), state = makeState();
  updateFirstPerson(camera, state, path, 1 / 60);
  state.crashed = true;
  updateFirstPerson(camera, state, path, 1 / 60);
  camera.position.set(8, 6, 12);
  state.crashed = false;
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.position.x === 8, "fixture did not start its own recovery");
  state.collisionView = true;
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.position.distanceTo(new THREE.Vector3(0, 3.08, 0)) < 1e-9);
  state.collisionView = false;
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(camera.position.distanceTo(new THREE.Vector3(0, 3.08, 0)) < 1e-9);
  resetFirstPerson(camera);
});

test("resetFirstPerson drops the previous ride heading", () => {
  const camera = makeCamera(), state = makeState();
  updateFirstPerson(camera, state, path, 1 / 60);
  resetFirstPerson(camera);
  state.crashed = true;
  state.physicsPose.yaw = Math.PI / 2;
  updateFirstPerson(camera, state, path, 1 / 60);
  assert(forward(camera).x < -0.9);
});
