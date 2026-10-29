import THREE from "../core/three.js?v=combat-48";
import { disposeModel } from "../models/dispose.js?v=combat-48";
export function createGatlingView(scene, opponent) {
  const tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.10, 0.10, 2.1), new THREE.MeshBasicMaterial({ color: "#ffdf00", toneMapped: false }), 64);
  const chips = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 272);
  tracers.name = "gatling-tracers"; chips.name = "gatling-impact-fragments";
  for (const mesh of [tracers, chips]) { mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh); }
  const transform = new THREE.Object3D(), color = new THREE.Color(), forward = new THREE.Vector3(0, 0, 1), direction = new THREE.Vector3();
  const materials = new Map();
  opponent.group.traverse(node => {
    if (!node.isMesh || !node.material.color || Array.isArray(node.material)) return;
    if (!materials.has(node.material)) {
      const copy = node.material.clone(); copy.userData = { ...copy.userData, shared: false };
      materials.set(node.material, { copy, base: copy.color.clone() });
    }
    node.material = materials.get(node.material).copy;
  });
  function reset() { tracers.count = chips.count = 0; materials.forEach(({ copy, base }) => { copy.color.copy(base); copy.emissive?.setHex(0); }); }
  return { reset, update(state) {
    const health = state.rival?.health ?? 100, flash = state.rival?.hitFlash ?? 0;
    materials.forEach(({ copy, base }) => {
      copy.color.copy(base).multiplyScalar(0.55 + health * 0.0045);
      copy.emissive?.setHex(flash > 0 ? 0x7e3410 : 0);
    });
    let count = 0;
    for (const b of state.bullets ?? []) {
      if (count >= 64) break;
      transform.position.set(b.x, b.y, b.z + state.distance);
      transform.quaternion.setFromUnitVectors(forward, direction.set(b.dx, b.dy, b.dz));
      transform.scale.set(1, 1, 1); transform.updateMatrix(); tracers.setMatrixAt(count++, transform.matrix);
    }
    tracers.count = count; tracers.instanceMatrix.needsUpdate = true;
    count = 0;
    for (const impact of state.bulletImpacts ?? []) {
      for (let i = 0; i < 8 && count < 256; i++) {
        const a = i * 2.399963 + impact.id, t = impact.age, radius = t * (2 + i % 4), fade = 1 - t / 0.45;
        transform.position.set(impact.x + Math.cos(a) * radius, impact.y + (2 + i % 3) * t - 5 * t * t, impact.z + state.distance + Math.sin(a) * radius);
        transform.rotation.set(a + t * 10, a, t * 13);
        transform.scale.set((i % 3 === 0 ? 0.14 : 0.05) * fade, 0.05 * fade, 0.035 * fade); transform.updateMatrix();
        chips.setMatrixAt(count, transform.matrix);
        chips.setColorAt(count++, color.set(impact.character && i % 3 === 0 ? "#fff0ce" : i % 2 ? "#ffb746" : "#7e8986"));
      }
    }
    if (health < 70 && state.rival) {
      const r = state.rival;
      for (let i = 0; i < 12; i++) {
        const t = ((state.time ?? 0) * 0.8 + i / 12) % 1;
        transform.position.set(r.x + Math.sin(i * 4.7) * t * 0.5, r.y + 0.6 + t * 1.7, r.z + state.distance + Math.cos(i * 4.7) * t * 0.5);
        transform.rotation.set(i, t * 2, i);
        transform.scale.setScalar((1 - health / 100) * (0.08 + t * 0.2) * (1 - t)); transform.updateMatrix();
        chips.setMatrixAt(count, transform.matrix); chips.setColorAt(count++, color.set("#656761"));
      }
    }
    chips.count = count; chips.instanceMatrix.needsUpdate = true;
    if (chips.instanceColor) chips.instanceColor.needsUpdate = true;
  }, dispose() { disposeModel(tracers); disposeModel(chips); } };
}
