import THREE from "../../core/three.js?v=combat-48";
// Merge opaque static props by material to reduce draw calls without a build tool.
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map(),
    remove = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.material.transparent)
      return;
    const key = [
      o.material.type,
      o.material.color?.getHex(),
      o.material.roughness,
      o.material.metalness,
      o.material.flatShading,
      o.material.side,
      o.material.vertexColors,
      o.material.map?.uuid,
      o.material.emissive?.getHex(),
      o.material.userData.shared,
      o.castShadow,
      o.receiveShadow,
    ].join("|");
    let batch = groups.get(key);
    if (!batch) {
      batch = {
        material: o.material,
        cast: o.castShadow,
        receive: o.receiveShadow,
        geometries: [],
      };
      groups.set(key, batch);
    }
    const geo = o.geometry.index
      ? o.geometry.toNonIndexed()
      : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    batch.geometries.push(geo);
    remove.push(o);
  });
  const keptMaterials = new Set([...groups.values()].map((b) => b.material));
  const oldGeometries = new Set(),
    oldMaterials = new Set();
  for (const o of remove) {
    oldGeometries.add(o.geometry);
    oldMaterials.add(o.material);
    o.removeFromParent();
  }
  oldGeometries.forEach((g) => g.dispose());
  oldMaterials.forEach((m) => {
    if (!keptMaterials.has(m) && !m.userData.shared) m.dispose();
  });
  for (const batch of groups.values()) {
    const merged = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "uv", "color"]) {
      if (!batch.geometries.every((g) => g.getAttribute(name))) continue;
      const size = batch.geometries[0].getAttribute(name).itemSize,
        length = batch.geometries.reduce(
          (n, g) => n + g.getAttribute(name).array.length,
          0,
        ),
        array = new Float32Array(length);
      let offset = 0;
      for (const g of batch.geometries) {
        array.set(g.getAttribute(name).array, offset);
        offset += g.getAttribute(name).array.length;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(array, size));
    }
    const o = new THREE.Mesh(merged, batch.material);
    o.castShadow = batch.cast;
    o.receiveShadow = batch.receive;
    root.add(o);
    batch.geometries.forEach((g) => g.dispose());
  }
}
