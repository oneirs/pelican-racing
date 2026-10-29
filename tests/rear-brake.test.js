import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
const THREE = context.THREE;
globalThis.window = { THREE };
const { createRearBrakeEffects } = await import("../src/effects/rear-brake.js");
const { createRaceRider } = await import("../src/models/race-rider.js");

test("rear wheel locks while front keeps rolling, then resumes after releasing brake", () => {
  const scene = new THREE.Scene(), rider = createRaceRider(scene);
  const s = { cameraMode: "third", grounded: true, phase: 0, time: 0, velocity: 20, forwardVelocity: 20, rearBrake: 1, physicsPose: { x: 0, y: 1, rotation: { x: 0, y: 0, z: 0, w: 1 } } };
  rider.update(s); s.time += 0.1; rider.update(s);
  const rear = scene.getObjectByName("racing-rear-wheel"), front = scene.getObjectByName("racing-front-wheel");
  assert.equal(Math.abs(rear.rotation.z), 0);
  assert(Math.abs(front.rotation.z) > 1);
  s.rearBrake = 0; s.time += 0.1; rider.update(s);
  assert(Math.abs(rear.rotation.z) > 1);
  rider.dispose();
});

test("rear skid marks follow rear contact, pause, expire, stay bounded and do not bridge gaps", () => {
  const scene = new THREE.Scene(), fx = createRearBrakeEffects(scene);
  const marks = scene.getObjectByName("rear-tire-skid-marks"), smoke = scene.getObjectByName("rear-tire-smoke");
  const s = { running: true, time: 0, distance: 0, rearSkid: 1, rearContact: { x: 0, y: 0.22, z: 0.85 } };
  fx.update(0.05, s);
  s.distance = 1; s.rearContact.z = -0.15; s.time = 0.05; fx.update(0.05, s);
  assert(marks.count > 0 && smoke.count > 0);
  const matrix = new THREE.Matrix4(); marks.getMatrixAt(0, matrix);
  assert(matrix.elements[14] > 0.85, "track is not trailing the rear tire");
  const before = [...marks.instanceMatrix.array];
  s.running = false; fx.update(0.1, s);
  assert.deepEqual([...marks.instanceMatrix.array], before);
  s.running = true; const count = marks.count;
  s.rearContact.z -= 100; fx.update(0.05, s);
  assert.equal(marks.count, count, "teleport drew a long skid line");
  for (let i = 0; i < 500; i++) { s.rearContact.z -= 1; s.distance += 1; s.time += 0.01; fx.update(0.01, s); }
  assert(marks.count <= 360 && smoke.count <= 72);
  s.rearSkid = 0; s.rearContact = null; fx.update(8, s);
  assert.equal(marks.count, 0); assert.equal(smoke.count, 0);
  fx.reset(); assert.equal(marks.count, 0);
});
