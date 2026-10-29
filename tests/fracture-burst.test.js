import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
const THREE = context.THREE;
globalThis.window = { THREE };
const { createFractureBurst } = await import("../src/effects/fracture-burst.js");

test("solid break fragments stay visible at 500 km/h, pause, expire and remain bounded", () => {
  const scene = new THREE.Scene(), effect = createFractureBurst(scene);
  const mesh = scene.getObjectByName("collision-shell-fragments");
  const speed = 500 / 3.6;
  const state = { distance: 0, mapSettings: { destruction: true, sparks: false } };
  const event = { type: "break", x: 0, y: 0.72, z: -0.8, velocity: { x: 0, y: 0, z: -10 }, travelVelocity: { x: 0, y: 0, z: -speed } };
  effect.update(0, state, [event]);
  assert.equal(mesh.count, 24, "break fragments must not depend on the spark toggle");
  state.distance = speed * 0.25;
  effect.update(0.25, state, []);
  const camera = new THREE.PerspectiveCamera(78, 1.5, 0.1, 700);
  camera.position.set(0, 3, 0);
  camera.lookAt(0, 2.935, -1);
  camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let visible = 0;
  for (let i = 0; i < mesh.count; i++) {
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(i, matrix);
    if (frustum.intersectsSphere(new THREE.Sphere(new THREE.Vector3().setFromMatrixPosition(matrix), 0.25))) visible++;
  }
  assert(visible >= 12, `only ${visible} fragments remain visible`);
  const paused = Array.from(mesh.instanceMatrix.array);
  effect.update(0, state, []);
  assert.deepEqual(Array.from(mesh.instanceMatrix.array), paused);
  effect.update(1, state, []);
  assert.equal(mesh.count, 0);
  effect.update(0, state, Array(10).fill(event));
  assert.equal(mesh.count, 96);
  effect.reset();
  assert.equal(mesh.count, 0);
  state.mapSettings.destruction = false;
  effect.update(0, state, [event]);
  assert.equal(mesh.count, 0);
});
