import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../vendor/three/three.min.js", import.meta.url), "utf8"), context);
const THREE = context.THREE;
globalThis.window = { THREE };
const { createCollisionSparks } = await import("../src/effects/collision-sparks.js");

test("rail sparks are large modeled glowing chips, follow world rebasing, pause and remain bounded", () => {
  const scene = new THREE.Scene(), effect = createCollisionSparks(scene);
  const state = { distance: 0, mapSettings: {} };
  const event = { type: "scrape", strength: 0.3, x: 3, y: 1, z: -10, velocity: { x: 0, y: 0, z: -30 } };
  try {
    effect.update(0, state, [event]);
    assert(effect.particles.count > 0 && effect.particles.geometry.type === "OctahedronGeometry");
    const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), quaternion = new THREE.Quaternion(), position = new THREE.Vector3();
    effect.particles.getMatrixAt(0, matrix); matrix.decompose(position, quaternion, scale);
    assert(scale.x >= 0.1 && scale.y >= 0.16, "scrape chips are too small");
    assert.equal(position.z, -10);
    state.distance = 256; effect.update(0, state);
    effect.particles.getMatrixAt(0, matrix); matrix.decompose(position, quaternion, scale);
    assert.equal(position.z, 246, "world origin shift detached spark positions");
    const paused = [...effect.particles.instanceMatrix.array];
    effect.update(0, state);
    assert.deepEqual([...effect.particles.instanceMatrix.array], paused);
    effect.update(0, state, Array(100).fill(event));
    assert.equal(effect.particles.count, 320);
    effect.update(1, state);
    assert.equal(effect.particles.count, 0);
    effect.update(0, state, [event]);
    state.mapSettings.sparks = false; effect.update(0, state);
    assert.equal(effect.particles.count, 0);
    effect.reset();
    assert.equal(scene.getObjectByName("collision-spark-trails").geometry.drawRange.count, 0);
  } finally { effect.dispose(); }
  assert.equal(scene.children.length, 0);
});
